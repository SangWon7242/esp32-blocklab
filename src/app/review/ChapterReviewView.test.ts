import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderWithHost } from "@/host/testHost";
import { getChapter } from "@/track/content";
import type { StepRecord } from "@/track/progress";
import { ChapterReviewView, EMPTY_TEXT, NO_RECORD_TEXT, readAnswerText } from "./ChapterReviewView";

/*
 * 챕터 열람 화면: 학생의 답·코드·판정 결과를 입력 칸 없이 깔끔히 보여 준다 (react-dom/server).
 * 호스트 컨텍스트가 없어도 그려지고, 있어도 같다.
 */

const CHAPTER = "01-led";
const now = "2026-10-16T03:00:00.000Z";
const rec = (input: Record<string, unknown>, status: StepRecord["status"] = "done", attempts = 1): StepRecord => ({ status, input, attempts, updatedAt: now });
const file = (name: string) => getChapter(CHAPTER)!.files[name];

const records: Record<string, StepRecord> = {
  problem: rec({ answers: ["26번 핀이에요", ""] }),
  analysis: rec({ know: "어느 핀인지", decide: "켤지 끌지", act: "LED 켜기", revealed: true, matched: { "know:0": true } }),
  predict: rec({ answers: ["켜진다", "꺼진다"] }),
  run: rec({ program: { code: file("step1_led_on.py") }, ran: true }),
  readcheck: rec({ answers: ["1", "0", "8"], results: [true, false, true] }, "open", 2),
  mission: rec({ program: { code: file("mission1_slow_blink.py"), blocksJson: { blocks: { blocks: [{ type: "start_program" }] } } }, passed: true, failures: [], judgedCode: file("mission1_slow_blink.py"), notes: ["검사 주의"], explained: true, explainMemo: "sleep 자리를 설명함" }),
  design: rec({ blanks: ["", "", "1", "", "2"], blankResults: [null, null, true, null, false], blanksDone: false, program: { code: file("step4_blink_loop.py") }, passed: false, failures: ["순서나 값이 설계도와 달라요. 의사코드와 한 줄씩 대조해 보세요"] }, "open"),
  // reflect 는 기록 없음
};

describe("ChapterReviewView", () => {
  const html = renderToStaticMarkup(createElement(ChapterReviewView, { chapterId: CHAPTER, records }));

  it("머리: 열람 배지·제목·완료 수", () => {
    expect(html).toContain('data-testid="chapter-review"');
    expect(html).toContain("열람 모드");
    expect(html).toContain("LED 켜기");
    expect(html).toContain("5 / 8 단계 완료");
  });

  it("단계마다 카드가 있고 기록이 없는 단계는 그렇게 말한다", () => {
    for (const id of ["problem", "analysis", "predict", "run", "readcheck", "mission", "design", "reflect"]) expect(html).toContain(`data-testid="review-step-${id}"`);
    expect(html).toContain('data-testid="review-step-reflect" data-status="none"');
    expect(html).toContain(NO_RECORD_TEXT);
    expect(html).toContain("기록 없음");
    expect(html).toContain("완료");
    expect(html).toContain("진행 중");
    expect(html).toContain("시도 2회");
  });

  it("글 답: 질문과 학생 글, 빈 답은 표시", () => {
    expect(html).toContain("LED의 긴 다리는 저항을 거쳐 몇 번 핀에 이어져 있나요?");
    expect(html).toContain("26번 핀이에요");
    expect(html).toContain(EMPTY_TEXT);
    expect(html).toContain("알아야 할 것");
    expect(html).toContain("어느 핀인지");
    expect(html).toContain("예시 답을 열어 내 답과 대조했어요");
    expect(html).toContain("켜진다");
  });

  it("읽기 체크: 학생 답을 글로, 정답과 채점", () => {
    expect(html).toContain("학생 답: ");
    expect(html).toContain("정답: led.value(0)");
    expect(html).toContain("8번 줄");
    expect(html).toContain("틀림");
    expect(html).toContain("맞음");
  });

  it("미션: 지시문·통과·주의·교사 확인·메모·코드와 블록 자리", () => {
    expect(html).toContain("LED가 2초 동안 켜져 있다가 1초 동안 꺼지기를 계속 되풀이하도록 코드를 바꾸세요");
    expect(html).toContain('data-testid="review-judge" data-passed="true"');
    expect(html).toContain("통과했어요");
    expect(html).toContain("검사 주의");
    expect(html).toContain("선생님 확인 완료");
    expect(html).toContain("sleep 자리를 설명함");
    expect(html).toContain("time.sleep(2)");
    expect(html).toContain('data-testid="project-blocks"');
  });

  it("설계: 빈칸 답과 채점, 조립 판정 실패 문장", () => {
    expect(html).toContain('data-testid="review-pseudocode"');
    expect(html).toContain("[ 1 ]초 기다린다");
    expect(html).toContain("[ 2 ]초 기다린다");
    expect(html).toContain("빈칸을 아직 다 맞히지 않았어요");
    expect(html).toContain('data-passed="false"');
    expect(html).toContain("순서나 값이 설계도와 달라요");
  });

  it("실행: 실행 성공 표시와 코드", () => {
    expect(html).toContain("보드에서 끝까지 실행했어요");
    expect(html).toContain("led.value(1)");
  });

  it("읽기 전용: 입력 칸·판정·완료·AI 버튼이 없다", () => {
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("판정");
    expect(html).not.toContain("내 설명 점검 받기");
    expect(html).not.toContain("track-editor");
  });

  it("호스트 안에서도 같은 화면", () => {
    const inHost = renderWithHost(createElement(ChapterReviewView, { chapterId: CHAPTER, records }), { mode: "review", reviewRecords: records });
    expect(inHost).toContain('data-testid="chapter-review"');
    expect(inHost).toContain("26번 핀이에요");
  });

  it("없는 챕터는 그렇게 말한다", () => {
    expect(renderToStaticMarkup(createElement(ChapterReviewView, { chapterId: "99-none", records: {} }))).toContain("없는 챕터예요: 99-none");
  });

  it("빈 기록이면 모든 단계가 기록 없음", () => {
    const empty = renderToStaticMarkup(createElement(ChapterReviewView, { chapterId: CHAPTER, records: {} }));
    expect(empty).toContain("0 / 8 단계 완료");
    expect(empty.match(new RegExp(NO_RECORD_TEXT, "g"))).toHaveLength(8);
  });
});

describe("성찰·디버깅 열람", () => {
  it("성찰: 줄 설명 표(쓴 줄 수)와 네 칸, AI 점검 결과", () => {
    const html = renderToStaticMarkup(createElement(ChapterReviewView, {
      chapterId: CHAPTER,
      records: { reflect: rec({ lines: { 1: "핀 기능을 가져와요" }, prompts: ["숫자 자리", "", "", ""], ai: { correct: ["핀 설명"], missing: ["sleep"], questions: ["왜?", "어디?", "언제?"], at: now } }, "open") },
    }));
    expect(html).toContain('data-testid="review-lines"');
    expect(html).toContain("1 / 8줄");
    expect(html).toContain("핀 기능을 가져와요");
    expect(html).toContain("막힌 곳");
    expect(html).toContain("숫자 자리");
    expect(html).toContain('data-testid="ai-review"');
    expect(html).toContain("핀 설명");
  });

  it("디버깅: 증상마다 고장 코드·설명·고친 프로그램·판정", () => {
    const html = renderToStaticMarkup(createElement(ChapterReviewView, {
      chapterId: "10-auto-door",
      records: {
        debug1: rec({
          explanations: ["선이 바뀌었어요", "들여쓰기가 빠졌어요"],
          saved: [true, true],
          programs: [{ code: "trig = Pin(13, Pin.OUT)\necho = Pin(12, Pin.IN)" }, { code: "if d < 15:\nprint('x')" }, null],
          passed: [true, false],
          failures: [[], ["에러가 몇 번째 줄이라고 하나요?"]],
          judgedCodes: ["trig = Pin(13, Pin.OUT)\necho = Pin(12, Pin.IN)", "if d < 15:\nprint('x')"],
          ai: [{ correct: [], missing: [], questions: ["q1", "q2", "q3"], at: now }],
        }, "open"),
      },
    }));
    expect(html).toContain('data-testid="review-symptom-0"');
    expect(html).toContain('data-testid="review-symptom-2"');
    expect(html).toContain("숫자가 계속 0만 나와요");
    expect(html).toContain("고장 난 코드");
    expect(html).toContain("선이 바뀌었어요");
    expect(html).toContain("고쳤어요");
    expect(html).toContain("에러가 몇 번째 줄이라고 하나요?");
    expect(html).toContain("손대지 않음");
    expect(html).toContain("q1");
    expect(html).not.toContain("<button");
  });
});

describe("readAnswerText", () => {
  it("선택지는 글로, 줄은 n번 줄로, 숫자는 그대로, 빈 답은 빈 글", () => {
    expect(readAnswerText({ kind: "choice", q: "?", options: ["a", "b"], answer: 1 }, "1")).toBe("b");
    expect(readAnswerText({ kind: "choice", q: "?", options: ["a", "b"], answer: 1 }, "7")).toBe("7");
    expect(readAnswerText({ kind: "line", q: "?", answer: 8 }, "8")).toBe("8번 줄");
    expect(readAnswerText({ kind: "number", q: "?", answer: 1 }, " 1 ")).toBe("1");
    expect(readAnswerText({ kind: "number", q: "?", answer: 1 }, undefined)).toBe("");
  });
});
