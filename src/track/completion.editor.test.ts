import { describe, expect, it } from "vitest";
import { canComplete } from "./completion";
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
