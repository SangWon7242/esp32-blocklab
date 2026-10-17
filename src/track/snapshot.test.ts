import { describe, expect, it, vi } from "vitest";
import { getChapter } from "./content";
import { allSteps } from "./gating";
import { emptyProgress, type Progress, type StepRecord } from "./progress";
import {
  ANALYSIS_BOX_LABEL, chapterSnapshot, EXPLAIN_MEMO_PROMPT, judgeSnapshot, NOTE_NO_PROGRAM, NOTE_SCREEN_PASSED, NOTE_SKIPPED, savedPrograms,
  textAnswersOf, type ChapterSnapshot,
} from "./snapshot";

/*
 * 제출 스냅숏·글 답·다시 판정 (src/track — Blockly 없이). 01-led 의 정답 기록으로 missions/passed 와 글 답 추출을 본다.
 * blockly 를 누군가 불러오면 바로 깨지게 가짜 모듈을 세운다 (서버에서 돌아야 하는 함수들이다).
 */
vi.mock("blockly", () => {
  throw new Error("src/track/snapshot 은 Blockly 를 불러오면 안 돼요");
});

const CHAPTER = "01-led";
const now = "2026-10-16T01:00:00.000Z";
const rec = (input: Record<string, unknown>, status: StepRecord["status"] = "done"): StepRecord => ({ status, input, attempts: 1, updatedAt: now });

const chapter = () => getChapter(CHAPTER)!;
const file = (name: string) => chapter().files[name];

/** 01-led 의 정답 기록: 글 답은 채우고, 미션은 정답 코드, 설계는 목표 코드 */
function answerRecords(): Record<string, StepRecord> {
  return {
    problem: rec({ answers: ["26번 핀이에요. Pin(26) 에 보일 것 같아요", "보드가 HIGH 를 보내요"] }),
    analysis: rec({ know: "어느 핀에 LED 가 있는지", decide: "켤지 끌지", act: "LED 켜기", revealed: true, compared: true }),
    predict: rec({ answers: ["켜진다", "꺼진다"] }),
    run: rec({ program: { code: file("step1_led_on.py") }, ran: true }),
    readcheck: rec({ answers: ["1", "1", "8"], results: [true, true, true] }),
    mission: rec({ program: { code: file("mission1_slow_blink.py") }, passed: true, failures: [], judgedCode: file("mission1_slow_blink.py"), notes: ["검사 주의 하나"] }),
    design: rec({ blanks: ["", "", "1", "", "1"], blanksDone: true, tableDone: true, program: { code: file("step4_blink_loop.py") }, passed: true, failures: [], judgedCode: file("step4_blink_loop.py") }),
    reflect: rec({ lines: { 1: "핀 기능을 가져와요", 4: "26번 핀을 출력으로 준비해요", 6: "" }, prompts: ["숫자 자리", "둘 다 바꿔 봤어요", "켜기 다음 숫자", "sleep 숫자부터"] }),
  };
}

function progressWith(records: Record<string, StepRecord>): Progress {
  const p = emptyProgress();
  p.chapters[CHAPTER] = records;
  p.chapters["10-auto-door"] = { problem: rec({ answers: ["다른 챕터"] }) };
  return p;
}

const snapshotOf = (records: Record<string, StepRecord>): ChapterSnapshot => ({ chapterId: CHAPTER, takenAt: now, records, programs: [] });

describe("chapterSnapshot", () => {
  it("그 챕터의 기록만 복사해 담고, 저장된 프로그램을 단계 순서대로 모은다", () => {
    const records = answerRecords();
    const progress = progressWith(records);
    const snap = chapterSnapshot(progress, CHAPTER);
    expect(snap.chapterId).toBe(CHAPTER);
    expect(snap.takenAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Object.keys(snap.records)).toEqual(Object.keys(records));
    expect(snap.records).not.toHaveProperty("10-auto-door");
    expect(snap.programs.map((p) => p.stepId)).toEqual(["run", "mission", "design"]);
    expect(snap.programs[1].code).toBe(file("mission1_slow_blink.py"));
    // 복사본: 뒤에 기록이 바뀌어도 스냅숏은 그대로
    (records.problem.input as { answers: string[] }).answers[0] = "바뀜";
    expect((snap.records.problem.input as { answers: string[] }).answers[0]).toBe("26번 핀이에요. Pin(26) 에 보일 것 같아요");
  });

  it("기록이 없는 챕터는 빈 스냅숏", () => {
    const snap = chapterSnapshot(emptyProgress(), CHAPTER);
    expect(snap.records).toEqual({});
    expect(snap.programs).toEqual([]);
  });

  it("디버깅은 증상마다 프로그램을 하나씩 (null 은 건너뜀)", () => {
    expect(savedPrograms({ programs: [{ code: "a" }, null, { code: "c", blocksJson: {} }] }).map((p) => p.code)).toEqual(["a", "c"]);
    expect(savedPrograms({ program: { code: "x" } }).map((p) => p.code)).toEqual(["x"]);
    expect(savedPrograms({ answers: ["글"] })).toEqual([]);
  });
});

describe("textAnswersOf", () => {
  it("01-led: 문제·조건 분석·예측·설계 빈칸·줄 설명·성찰을 단계 순서대로", () => {
    const answers = textAnswersOf(chapter(), snapshotOf(answerRecords()));
    const by = (stepId: string) => answers.filter((a) => a.stepId === stepId);

    const problem = allSteps(chapter()).find((s) => s.id === "problem")!;
    expect(by("problem").map((a) => a.prompt)).toEqual(problem.type === "problem" ? problem.questions : []);
    expect(by("problem")[1].answer).toBe("보드가 HIGH 를 보내요");
    expect(by("problem")[0]).toMatchObject({ stepType: "problem", title: "문제 만나기 — LED는 어떻게 켜질까?" });

    expect(by("analysis").map((a) => [a.prompt, a.answer])).toEqual([
      [ANALYSIS_BOX_LABEL.know, "어느 핀에 LED 가 있는지"],
      [ANALYSIS_BOX_LABEL.decide, "켤지 끌지"],
      [ANALYSIS_BOX_LABEL.act, "LED 켜기"],
    ]);

    expect(by("predict").map((a) => a.answer)).toEqual(["켜진다", "꺼진다"]);
    expect(by("predict")[0].prompt).toBe("실행하면 26번 핀에 꽂힌 LED는 어떻게 될까요?");

    // 설계: 빈칸이 있는 줄만 (3번째·5번째)
    expect(by("design").map((a) => [a.prompt, a.answer])).toEqual([["__초 기다린다", "1"], ["__초 기다린다", "1"]]);

    // 성찰: 쓴 줄 설명(코드 줄 포함) → 네 칸
    const reflect = by("reflect");
    expect(reflect.slice(0, 2).map((a) => a.prompt)).toEqual(["1번 줄 from machine import Pin", "4번 줄 led = Pin(26, Pin.OUT)  # IO26을 출력으로"]);
    expect(reflect.slice(0, 2).map((a) => a.answer)).toEqual(["핀 기능을 가져와요", "26번 핀을 출력으로 준비해요"]);
    expect(reflect.slice(2).map((a) => [a.prompt, a.answer])).toEqual([
      ["막힌 곳", "숫자 자리"], ["내가 해 본 것", "둘 다 바꿔 봤어요"], ["결국 원인은", "켜기 다음 숫자"], ["다음엔 여기부터 본다", "sleep 숫자부터"],
    ]);

    // 글 답이 없는 유형(실행·읽기 체크·미션)은 나오지 않는다
    expect(answers.map((a) => a.stepId)).not.toContain("run");
    expect(answers.map((a) => a.stepId)).not.toContain("readcheck");
    expect(answers.map((a) => a.stepId)).not.toContain("mission");
    // 전체 순서는 단계 순서
    expect([...new Set(answers.map((a) => a.stepId))]).toEqual(["problem", "analysis", "predict", "design", "reflect"]);
  });

  it("기록이 있는 단계의 빈 답은 \"\" 로 남기고, 기록이 없는 단계는 건너뛴다", () => {
    const answers = textAnswersOf(chapter(), snapshotOf({ problem: rec({ answers: ["첫 답만"] }, "open") }));
    expect(answers.map((a) => a.answer)).toEqual(["첫 답만", ""]);
  });

  it("files 가 없는 Chapter 로도 줄 설명을 뽑는다 (줄 번호만)", () => {
    const { files: _files, ...plain } = chapter();
    const answers = textAnswersOf(plain, snapshotOf({ reflect: rec({ lines: { 2: "시간 기능" }, prompts: [] }, "open") }));
    expect(answers[0]).toMatchObject({ prompt: "2번 줄", answer: "시간 기능" });
    expect(answers).toHaveLength(5);
  });

  it("1분 설명 메모가 저장돼 있으면 미션·디버깅 답에 넣는다", () => {
    const answers = textAnswersOf(chapter(), snapshotOf({ mission: rec({ program: { code: "x" }, explainMemo: "켜기 다음 sleep 이 켜진 시간이라고 설명함" }) }));
    expect(answers).toEqual([{ stepId: "mission", stepType: "mission", title: "미션 — 천천히 깜빡이기", prompt: EXPLAIN_MEMO_PROMPT, answer: "켜기 다음 sleep 이 켜진 시간이라고 설명함" }]);
    expect(textAnswersOf(chapter(), snapshotOf({ mission: rec({ program: { code: "x" } }) }))).toEqual([]);
  });

  it("디버깅: 증상마다 \"왜 이런 증상일까?\" 설명", () => {
    const door = getChapter("10-auto-door")!;
    const snap: ChapterSnapshot = { chapterId: door.id, takenAt: now, programs: [], records: { debug1: rec({ explanations: ["선이 바뀌었어요", "들여쓰기가 없어요"] }, "open") } };
    const answers = textAnswersOf(door, snap);
    expect(answers.map((a) => a.prompt)).toEqual([
      "증상 1. 숫자가 계속 0만 나와요 — 왜 이런 증상일까?",
      "증상 2. 빨간 글씨로 IndentationError 가 떠요 — 왜 이런 증상일까?",
      "증상 3. 에러는 없는데 10초에 한 번만 재요 — 왜 이런 증상일까?",
    ]);
    expect(answers.map((a) => a.answer)).toEqual(["선이 바뀌었어요", "들여쓰기가 없어요", ""]);
  });
});

describe("judgeSnapshot", () => {
  it("01-led 정답 기록: 미션·설계 모두 통과 (missions 2, passed 2), 저장된 주의는 그대로 붙는다", () => {
    const summary = judgeSnapshot(chapter(), snapshotOf(answerRecords()));
    expect(summary.missions).toBe(2);
    expect(summary.passed).toBe(2);
    expect(summary.steps.map((s) => [s.stepId, s.type, s.passed])).toEqual([["mission", "mission", true], ["design", "design", true]]);
    expect(summary.steps[0].failures).toEqual([]);
    expect(summary.steps[0].notes).toEqual(["검사 주의 하나"]);
    expect(summary.steps[1].notes).toEqual([]);
  });

  it("시작 코드 그대로인 미션은 코드로 다시 판정해 실패하고, 화면이 통과라고 적어 두었어도 알린다", () => {
    const start = file("step4_blink_loop.py");
    const records = answerRecords();
    records.mission = rec({ program: { code: start }, passed: true, judgedCode: start, notes: ["무시될 주의"] });
    const summary = judgeSnapshot(chapter(), snapshotOf(records));
    const mission = summary.steps[0];
    expect(mission.passed).toBe(false);
    expect(mission.failures).toEqual(["켜진 시간과 꺼진 시간이 다른가요? time.sleep 숫자를 다시 보세요"]);
    expect(mission.notes).toEqual([NOTE_SCREEN_PASSED]);
    expect(summary.passed).toBe(1);
  });

  it("저장된 작업판 JSON 이 있으면 그것으로 블록 규칙을 본다", () => {
    const records = answerRecords();
    // 코드는 정답이지만 작업판에는 아무 블록도 없는 척 → blocks 규칙이 모두 실패해야 한다
    const emptyWorkspace = { blocks: { languageVersion: 0, blocks: [{ type: "start_program", id: "s" }] } };
    records.mission = rec({ program: { code: file("mission1_slow_blink.py"), blocksJson: emptyWorkspace } });
    const mission = judgeSnapshot(chapter(), snapshotOf(records)).steps[0];
    expect(mission.passed).toBe(false);
    expect(mission.failures).toHaveLength(4);
  });

  it("프로그램이 없으면 null, 건너뛰었으면 그렇게 알린다", () => {
    const summary = judgeSnapshot(chapter(), snapshotOf({ mission: rec({}, "open"), design: rec({ skipped: true }) }));
    expect(summary.steps.map((s) => [s.passed, s.notes])).toEqual([[null, [NOTE_NO_PROGRAM]], [null, [NOTE_SKIPPED]]]);
    expect(summary.missions).toBe(2);
    expect(summary.passed).toBe(0);
    // 기록이 전혀 없어도 단계 수는 그대로
    expect(judgeSnapshot(chapter(), snapshotOf({})).steps.map((s) => s.passed)).toEqual([null, null]);
  });

  it("설계: 목표 코드와 다르면 설계 실패 문장", () => {
    const records = answerRecords();
    records.design = rec({ program: { code: file("step3_blink_once.py") }, passed: false, judgedCode: file("step3_blink_once.py") });
    const design = judgeSnapshot(chapter(), snapshotOf(records)).steps[1];
    expect(design.passed).toBe(false);
    expect(design.failures).toEqual(["순서나 값이 설계도와 달라요. 의사코드와 한 줄씩 대조해 보세요"]);
    expect(design.notes).toEqual([]);
  });

  it("디버깅: 증상마다 증상 규칙 + 전체 규칙, 하나라도 실패하면 단계 실패, 없는 증상 프로그램은 알림", () => {
    const door = getChapter("10-auto-door")!;
    const fixed = ["trig = Pin(13, Pin.OUT)\necho = Pin(12, Pin.IN)", "if d < 15:\n    print(\"가까워요!\")", "from machine import Pin\nimport time\n\ntrig = Pin(13, Pin.OUT)\n\ntrig.value(1)\ntime.sleep_us(10)\ntrig.value(0)\n"];
    const ok = judgeSnapshot(door, { chapterId: door.id, takenAt: now, programs: [], records: { debug1: rec({ programs: fixed.map((code) => ({ code })), passed: [true, true, true] }) } });
    const d1 = ok.steps.find((s) => s.stepId === "debug1")!;
    expect(d1.passed).toBe(true);
    expect(d1.failures).toEqual([]);

    const partial = judgeSnapshot(door, {
      chapterId: door.id, takenAt: now, programs: [],
      records: { debug1: rec({ programs: [{ code: "trig = Pin(12, Pin.OUT)\necho = Pin(13, Pin.IN)" }, null, { code: fixed[2] }] }, "open") },
    });
    const p1 = partial.steps.find((s) => s.stepId === "debug1")!;
    expect(p1.passed).toBe(false);
    expect(p1.failures).toEqual(["증상 1: 쏘는 선과 듣는 선, 어느 쪽이 13번이죠?"]);
    expect(p1.notes).toEqual([`증상 2: ${NOTE_NO_PROGRAM}`]);
    expect(ok.missions).toBe(allSteps(door).filter((s) => s.type === "mission" || s.type === "debug" || s.type === "design").length);
  });
});
