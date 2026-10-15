import { describe, expect, it } from "vitest";
import { allSteps, stepStates } from "./gating";
import type { Chapter, Step } from "./schema";

const p = (id: string, optional?: boolean): Step => ({ id, type: "problem", title: id, questions: ["?"], ...(optional ? { optional } : {}) });

// part1: a b(선택) c / part2: d e(선택) f(선택) g
const chapter: Chapter = {
  id: "t", order: 1, title: "t", track: "sensor", label: "S1", status: "published",
  parts: [
    { id: "part1", title: "1부", steps: [p("a"), p("b", true), p("c")] },
    { id: "part2", title: "2부", steps: [p("d"), p("e", true), p("f", true), p("g")] },
  ],
};
const done = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, { status: "done" as const }]));

describe("stepStates — 관문", () => {
  it("allSteps 는 부를 이어 순서대로 편다", () => {
    expect(allSteps(chapter).map((s) => s.id)).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
  });
  it("1. 기록이 없으면 첫 단계만 열린다", () => {
    expect(stepStates(chapter, {})).toEqual({ a: "open", b: "locked", c: "locked", d: "locked", e: "locked", f: "locked", g: "locked" });
  });
  it("2. 이전 필수 단계가 done 이면 다음이 열린다", () => {
    expect(stepStates(chapter, done("a"))).toMatchObject({ a: "done", b: "open" });
  });
  it("3. 선택 단계는 건너뛰어도 그다음이 열린다", () => {
    expect(stepStates(chapter, done("a"))).toMatchObject({ b: "open", c: "open", d: "locked" });
  });
  it("4. 부 경계를 넘어 이어진다", () => {
    expect(stepStates(chapter, done("a", "c"))).toMatchObject({ c: "done", d: "open", e: "locked" });
  });
  it("5. 선택 단계가 이어져도 모두 건너뛸 수 있다", () => {
    expect(stepStates(chapter, done("a", "c", "d"))).toMatchObject({ e: "open", f: "open", g: "open" });
  });
  it("6. done 이 아닌 기록(open)은 열지 않는다", () => {
    expect(stepStates(chapter, { a: { status: "open" } })).toMatchObject({ a: "open", b: "locked", c: "locked" });
  });
  it("7. 교사 모드는 모두 열되 done 표시는 지킨다", () => {
    expect(stepStates(chapter, done("c"), true)).toEqual({ a: "open", b: "open", c: "done", d: "open", e: "open", f: "open", g: "open" });
  });
  it("선택 단계를 done 으로 마쳐도 그대로 done", () => {
    expect(stepStates(chapter, done("a", "b"))).toMatchObject({ b: "done", c: "open" });
  });
});
