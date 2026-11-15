import { describe, expect, it } from "vitest";
import { canComplete, runSucceeded } from "./completion";
import type { Step } from "./schema";

const run: Step = { id: "run", type: "run", title: "run", code: "a.py" };
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

describe("편집기 단계 완료 조건", () => {
  it("run: 실행에 성공해야 한다", () => {
    expect(canComplete(run, {})).toBe(false);
    expect(canComplete(run, { ran: true })).toBe(true);
  });
  it("mission: 마지막 판정을 통과해야 한다", () => {
    expect(canComplete(mission, { failedOnce: true, passed: false })).toBe(false);
    expect(canComplete(mission, { passed: true })).toBe(true);
  });
  it("debug: 모든 증상을 통과해야 한다", () => {
    expect(canComplete(debug, { passed: [true] })).toBe(false);
    expect(canComplete(debug, { passed: [true, false] })).toBe(false);
    expect(canComplete(debug, { passed: [true, true] })).toBe(true);
  });
});

/*
 * 실행 단계는 끝없이 도는 프로그램(while True)으로 가득하다. 그런 실행은 「멈춤」으로만 끝나므로
 * 멈춤을 해내지 못한 것으로 세면 아이가 그 단계를 영영 끝낼 수 없다 (진짜 보드에서만 드러나는 막힘 —
 * 가짜 보드는 while True 를 한 바퀴만 훑고 ok 로 끝낸다).
 */
describe("실행 단계: 어떤 실행을 해냈다고 볼지", () => {
  it("끝까지 돌고 끝난 실행은 해냈다", () => {
    expect(runSucceeded({ ok: true, stopped: false })).toBe(true);
  });
  it("멈춤으로 끝난 실행도 해냈다 (끝없이 도는 프로그램)", () => {
    expect(runSucceeded({ ok: false, stopped: true })).toBe(true);
  });
  it("오류(Traceback)로 끝난 실행은 해내지 못했다", () => {
    expect(runSucceeded({ ok: false, stopped: false, error: { line: 3, message: "NameError", traceback: "..." } })).toBe(false);
    // 멈추는 길에 오류가 함께 왔어도 오류가 먼저다
    expect(runSucceeded({ ok: false, stopped: true, error: { line: 3, message: "OSError", traceback: "..." } })).toBe(false);
  });
  it("실행 단계의 완료 조건은 그 실행 한 번(ran)뿐이다", () => {
    expect(canComplete(run, { ran: true })).toBe(true);
    expect(canComplete(run, { ran: false })).toBe(false);
  });
});
