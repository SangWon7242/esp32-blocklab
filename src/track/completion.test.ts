import { describe, expect, it } from "vitest";
import { awaitingExplain, canComplete, explainableLines, gradeReadCheck, isEditorStep, judgePassed, onEditedProgram, parseGiven, type MissionInput } from "./completion";
import type { ReadQuestion, Step, StepOf } from "./schema";

const problem: StepOf<"problem"> = { id: "p", type: "problem", title: "p", questions: ["a?", "b?"] };
const analysis: StepOf<"analysis"> = { id: "a", type: "analysis", title: "a", answer: { know: ["x"], decide: ["y"], act: ["z"] } };
const predict: StepOf<"predict"> = { id: "pr", type: "predict", title: "pr", code: "a.py", blanks: [{ q: "1" }, { q: "2" }] };
const questions: ReadQuestion[] = [
  { kind: "number", q: "n", answer: 2 },
  { kind: "choice", q: "c", options: ["x", "y"], answer: 1 },
  { kind: "line", q: "l", answer: 8 },
];
const readcheck: StepOf<"readcheck"> = { id: "r", type: "readcheck", title: "r", code: "a.py", questions };
const reflect: StepOf<"reflect"> = { id: "re", type: "reflect", title: "re", lineExplain: "a.py", prompts: ["1", "2", "3", "4"] };
const run: Step = { id: "run", type: "run", title: "run", code: "a.py" };

describe("canComplete", () => {
  it("problem: 질문마다 글이 있어야 한다 (공백만은 안 됨)", () => {
    expect(canComplete(problem, {})).toBe(false);
    expect(canComplete(problem, { answers: ["가", "  "] })).toBe(false);
    expect(canComplete(problem, { answers: ["가", "나"] })).toBe(true);
  });
  it("predict: 빈칸을 모두 채워야 한다", () => {
    expect(canComplete(predict, { answers: ["1"] })).toBe(false);
    expect(canComplete(predict, { answers: ["1", "2"] })).toBe(true);
  });
  it("analysis: 세 칸을 쓰고 예시 답을 펼쳐 대조(체크 하나 이상 또는 대조했어요)해야 한다", () => {
    const three = { know: "a", decide: "b", act: "c" };
    expect(canComplete(analysis, three)).toBe(false);
    expect(canComplete(analysis, { ...three, decide: "", revealed: true, compared: true })).toBe(false);
    expect(canComplete(analysis, { ...three, revealed: true })).toBe(false);
    expect(canComplete(analysis, { ...three, revealed: true, matched: { "know:0": false } })).toBe(false);
    expect(canComplete(analysis, { ...three, revealed: true, matched: { "know:0": true } })).toBe(true);
    expect(canComplete(analysis, { ...three, revealed: true, compared: true })).toBe(true);
  });
  it("readcheck: 마지막 확인에서 모든 문항이 맞아야 한다", () => {
    expect(canComplete(readcheck, {})).toBe(false);
    expect(canComplete(readcheck, { results: [true, false, true] })).toBe(false);
    expect(canComplete(readcheck, { results: [true, null, true] })).toBe(false);
    expect(canComplete(readcheck, { results: [true, true, true] })).toBe(true);
  });
  it("reflect: 성찰 네 칸을 써야 한다 (줄 설명은 권장)", () => {
    expect(canComplete(reflect, { prompts: ["1", "2", "3"] })).toBe(false);
    expect(canComplete(reflect, { prompts: ["1", "2", "3", "4"] })).toBe(true);
  });
  it("편집기 단계는 완료 버튼으로 끝나지 않는다 (건너뛰기만)", () => {
    expect(isEditorStep(run)).toBe(true);
    expect(isEditorStep(problem)).toBe(false);
    expect(canComplete(run, { skipped: true })).toBe(false);
  });
});

describe("gradeReadCheck", () => {
  it("숫자·선택지 번호·줄 번호를 글로 받아 채점한다", () => {
    expect(gradeReadCheck(questions, ["2", "1", "8"])).toEqual([true, true, true]);
    expect(gradeReadCheck(questions, [" 2 ", "0", "7"])).toEqual([true, false, false]);
    expect(gradeReadCheck(questions, ["", undefined, "abc"])).toEqual([false, false, false]);
  });
  it("parseGiven", () => {
    expect(parseGiven("0.3")).toBe(0.3);
    expect(parseGiven("")).toBeNull();
    expect(parseGiven("x")).toBeNull();
  });
});

describe("explainableLines", () => {
  it("빈 줄과 주석 줄은 뺀다", () => {
    expect(explainableLines("import time\n\n# 주석\n  x = 1\n")).toEqual([1, 4]);
  });
});

describe("1분 설명 관문 (explainGate)", () => {
  const mission: Step = { id: "m", type: "mission", title: "m", instructions: "하세요", rules: [{ codeMatches: "x", fail: "x?" }] };
  const debug: Step = {
    id: "d",
    type: "debug",
    title: "d",
    symptoms: [
      { title: "a", code: "x = 1", question: "왜?", rules: [] },
      { title: "b", code: "y = 1", question: "왜?", rules: [] },
    ],
    rules: [],
  };
  const on = { explainGate: true };
  const off = { explainGate: false };

  it("mission: 관문이 꺼져 있으면 판정 통과만으로 완료 (explained 는 보지 않는다)", () => {
    expect(canComplete(mission, { passed: true })).toBe(true);
    expect(canComplete(mission, { passed: true }, off)).toBe(true);
    expect(canComplete(mission, { passed: true, explained: false }, off)).toBe(true);
    expect(canComplete(mission, { passed: false, explained: true }, off)).toBe(false);
  });
  it("mission: 관문이 켜져 있으면 passed 와 explained === true 가 모두 있어야 한다", () => {
    expect(canComplete(mission, { passed: true }, on)).toBe(false);
    expect(canComplete(mission, { passed: true, explained: false }, on)).toBe(false);
    expect(canComplete(mission, { passed: true, explained: true }, on)).toBe(true);
    // 교사 확인만 있고 판정은 통과하지 않았다면 완료 불가
    expect(canComplete(mission, { passed: false, explained: true }, on)).toBe(false);
  });
  it("debug: 모든 증상 통과 + (관문이 켜져 있으면) 단계 하나의 explained", () => {
    expect(canComplete(debug, { passed: [true, true] }, off)).toBe(true);
    expect(canComplete(debug, { passed: [true, true] }, on)).toBe(false);
    expect(canComplete(debug, { passed: [true, true], explained: true }, on)).toBe(true);
    expect(canComplete(debug, { passed: [true, false], explained: true }, on)).toBe(false);
  });
  it("다른 유형은 관문과 무관하다", () => {
    expect(canComplete(run, { ran: true }, on)).toBe(true);
    expect(canComplete(problem, { answers: ["가", "나"] }, on)).toBe(true);
  });

  it("judgePassed: mission·debug 의 판정 통과만 본다", () => {
    expect(judgePassed(mission, { passed: true })).toBe(true);
    expect(judgePassed(mission, {})).toBe(false);
    expect(judgePassed(debug, { passed: [true, true] })).toBe(true);
    expect(judgePassed(debug, { passed: [true] })).toBe(false);
    expect(judgePassed(run, { ran: true })).toBe(false);
  });
  it("awaitingExplain(확인 대기): 관문이 켜져 있고 판정은 통과했는데 explained 가 없을 때만", () => {
    expect(awaitingExplain(mission, { passed: true }, on)).toBe(true);
    expect(awaitingExplain(mission, { passed: true, explained: true }, on)).toBe(false);
    expect(awaitingExplain(mission, { passed: false }, on)).toBe(false);
    expect(awaitingExplain(mission, { passed: true }, off)).toBe(false);
    expect(awaitingExplain(mission, { passed: true })).toBe(false);
    expect(awaitingExplain(debug, { passed: [true, true] }, on)).toBe(true);
    expect(awaitingExplain(debug, { passed: [true, false] }, on)).toBe(false);
    expect(awaitingExplain(run, { ran: true }, on)).toBe(false);
  });
  it("onEditedProgram: 교사 확인을 받은 뒤 코드를 바꾸면 explained 도 지운다", () => {
    const confirmed: MissionInput = { passed: true, failures: [], judgedCode: "ok\n", explained: true };
    expect(canComplete(mission, confirmed, on)).toBe(true);
    const same = { ...confirmed, ...onEditedProgram(confirmed, { code: "ok\n" }) };
    expect(same.explained).toBe(true);
    const edited = { ...confirmed, ...onEditedProgram(confirmed, { code: "changed\n" }) };
    expect(edited.explained).toBeUndefined();
    expect(edited.passed).toBe(false);
    expect(canComplete(mission, edited, on)).toBe(false);
  });
});
