import { describe, expect, it } from "vitest";
import { initialEditorState, programForSave } from "../lab/editorSync";
import { COACH_RUN_OUTPUT_LIMIT, coachProgramKey, coachProgramOf, coachRunEvent, tailOutput } from "./coachProgram";

describe("coachProgramOf", () => {
  it("블록으로 바뀌는 코드는 작업판 JSON 과 함께, parseError false", () => {
    const p = coachProgramOf(programForSave(initialEditorState("print(1)\n")));
    expect(p.code).toBe("print(1)\n");
    expect(p.parseError).toBe(false);
    expect(p.blocksJson).not.toBeNull();
  });

  it("코드 모드 문법 오류면 blocksJson null, parseError true (programForSave 규칙)", () => {
    const p = coachProgramOf(programForSave(initialEditorState("if x\n", "code")));
    expect(p).toEqual({ code: "if x\n", blocksJson: null, parseError: true });
  });

  it("열쇠는 코드·오류·블록이 같으면 같다", () => {
    const a = coachProgramOf(programForSave(initialEditorState("print(1)\n")));
    const b = coachProgramOf(programForSave(initialEditorState("print(1)\n")));
    expect(coachProgramKey(a)).toBe(coachProgramKey(b));
    expect(coachProgramKey({ ...a, code: "print(2)\n" })).not.toBe(coachProgramKey(a));
  });
});

describe("coachRunEvent", () => {
  const at = new Date("2026-10-26T01:02:03.000Z");

  it("성공: 가짜 보드면 source fake, error 없음", () => {
    expect(coachRunEvent({ fake: true, result: { ok: true, stopped: false }, output: "1\n", code: "print(1)", at })).toEqual({
      source: "fake", ok: true, output: "1\n", code: "print(1)", at: "2026-10-26T01:02:03.000Z",
    });
  });

  it("오류: 줄과 메시지 (Traceback 원문은 넘기지 않는다), 줄이 없으면 message 만", () => {
    const e = coachRunEvent({
      fake: false, result: { ok: false, stopped: false, error: { line: 3, message: "NameError: x", traceback: "Traceback..." } }, output: "", code: "x", at,
    });
    expect(e.source).toBe("board");
    expect(e.error).toEqual({ line: 3, message: "NameError: x" });
    const noLine = coachRunEvent({ fake: false, result: { ok: false, stopped: false, error: { line: null, message: "OSError" , traceback: "" } }, output: "", code: "x", at });
    expect(noLine.error).toEqual({ message: "OSError" });
  });

  it("멈춤: ok false, error 없음", () => {
    const e = coachRunEvent({ fake: true, result: { ok: false, stopped: true }, output: "a", code: "x", at });
    expect(e.ok).toBe(false);
    expect(e.error).toBeUndefined();
  });

  it("출력은 마지막 4096자만", () => {
    const long = "a".repeat(5000) + "END";
    const out = coachRunEvent({ fake: true, result: { ok: true, stopped: false }, output: long, code: "", at }).output;
    expect(out).toHaveLength(COACH_RUN_OUTPUT_LIMIT);
    expect(out.endsWith("END")).toBe(true);
    expect(tailOutput("abc")).toBe("abc");
  });
});
