import { describe, expect, it } from "vitest";
import { canComplete, judgeIsStale, onEditedProgram, type MissionInput } from "./completion";
import type { Step } from "./schema";

describe("판정 뒤 코드를 바꾸면 판정이 낡는다", () => {
  it("judgeIsStale: 판정한 코드와 다를 때만", () => {
    expect(judgeIsStale(undefined, "a")).toBe(false);
    expect(judgeIsStale(null, "a")).toBe(false);
    expect(judgeIsStale("a", "a")).toBe(false);
    expect(judgeIsStale("a", "b")).toBe(true);
  });

  it("onEditedProgram: 통과 → 코드 바꿈 → passed·failures 지움 → 완료 불가", () => {
    const step = { id: "m", type: "mission", title: "t", instructions: "i", rules: [] } as unknown as Step;
    const passed: MissionInput = { passed: true, failures: [], judgedCode: "ok\n", failedOnce: true };
    expect(canComplete(step, passed)).toBe(true);

    const same = { ...passed, ...onEditedProgram(passed, { code: "ok\n" }) };
    expect(same.passed).toBe(true);
    expect(same.program).toEqual({ code: "ok\n" });

    const edited = { ...passed, ...onEditedProgram(passed, { code: "broken\n" }) };
    expect(edited).toMatchObject({ passed: false, failures: null, judgedCode: undefined, failedOnce: true, program: { code: "broken\n" } });
    expect(canComplete(step, edited)).toBe(false);
  });
});
