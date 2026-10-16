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

describe("stepStates — 1분 설명 관문 (awaiting: 확인 대기)", () => {
  const mission: Step = { id: "m", type: "mission", title: "m", instructions: "하세요", rules: [{ codeMatches: "x", fail: "x?" }] };
  const debug: Step = {
    id: "dbg", type: "debug", title: "d", rules: [],
    symptoms: [{ title: "a", code: "x = 1", question: "왜?", rules: [] }, { title: "b", code: "y = 1", question: "왜?", rules: [] }],
  };
  const gated: Chapter = { ...chapter, parts: [{ id: "part1", title: "1부", steps: [p("a"), mission, debug, p("z")] }] };
  const open = (input: Record<string, unknown>) => ({ status: "open" as const, input });

  it("관문이 꺼져 있으면(기본) 판정을 통과해도 open 그대로", () => {
    const records = { ...done("a"), m: open({ passed: true }) };
    expect(stepStates(gated, records)).toMatchObject({ m: "open", dbg: "locked" });
    expect(stepStates(gated, records, false, { explainGate: false })).toMatchObject({ m: "open" });
  });
  it("관문이 켜져 있으면 판정 통과 + 확인 전 mission 은 awaiting, 그다음은 여전히 locked", () => {
    const records = { ...done("a"), m: open({ passed: true }) };
    expect(stepStates(gated, records, false, { explainGate: true })).toEqual({ a: "done", m: "awaiting", dbg: "locked", z: "locked" });
  });
  it("확인을 받으면(explained) open 으로 돌아오고, done 으로 기록하면 done", () => {
    expect(stepStates(gated, { ...done("a"), m: open({ passed: true, explained: true }) }, false, { explainGate: true })).toMatchObject({ m: "open" });
    expect(stepStates(gated, { ...done("a"), m: { status: "done", input: { passed: true } } }, false, { explainGate: true })).toMatchObject({ m: "done", dbg: "open" });
  });
  it("판정을 통과하지 않았거나 기록이 없으면 open", () => {
    expect(stepStates(gated, { ...done("a"), m: open({ passed: false }) }, false, { explainGate: true })).toMatchObject({ m: "open" });
    expect(stepStates(gated, done("a"), false, { explainGate: true })).toMatchObject({ m: "open" });
  });
  it("debug 는 모든 증상을 통과했을 때만 awaiting", () => {
    expect(stepStates(gated, { ...done("a", "m"), dbg: open({ passed: [true, false] }) }, false, { explainGate: true })).toMatchObject({ dbg: "open" });
    expect(stepStates(gated, { ...done("a", "m"), dbg: open({ passed: [true, true] }) }, false, { explainGate: true })).toMatchObject({ dbg: "awaiting" });
  });
  it("교사 모드에서도 awaiting 은 구분한다 (잠긴 단계는 열린다)", () => {
    expect(stepStates(gated, { m: open({ passed: true }) }, true, { explainGate: true })).toEqual({ a: "open", m: "awaiting", dbg: "open", z: "open" });
  });
  it("잠긴 단계는 판정 기록이 있어도 locked", () => {
    expect(stepStates(gated, { m: open({ passed: true }) }, false, { explainGate: true })).toMatchObject({ a: "open", m: "locked" });
  });
});
