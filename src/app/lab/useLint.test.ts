import { describe, expect, it } from "vitest";
import { workspaceJsonToCodeWithMap, type WorkspaceJson } from "@/codegen";
import { forever, pinSetup, pinWrite, program, varGet, wait } from "@/lint/testkit";
import type { LintWorkspaceJson } from "@/lint";
import { blockAtLine, blockLines, computeLintView, highlightFor, type WorkspaceSnapshot } from "./useLint";

/** 헤드리스 작업판에서 잰 코드·지도 (id 는 JSON 의 id) */
function snapshot(json: LintWorkspaceJson): WorkspaceSnapshot {
  const { code, map } = workspaceJsonToCodeWithMap(json as WorkspaceJson);
  return { json: json as WorkspaceJson, generated: code, map };
}

/** 준비 없이 led 켜기 + 반복 (주의 없음) */
const noSetup = () => program([forever("loop", [pinWrite("on", "led"), wait("w", 1)])], { vars: ["led"] });

describe("computeLintView", () => {
  it("블록 모드: 문제의 줄은 재생성 코드 줄 그대로, 콘솔은 영어", () => {
    const snap = snapshot(noSetup());
    const view = computeLintView({ snapshot: snap, source: "blocks", code: snap.generated, parseError: null });
    const issue = view.issues.find((i) => i.id === "device-before-setup")!;
    expect(issue.blockId).toBe("on");
    expect(snap.generated.split("\n")[issue.line! - 1]).toContain("led.value(1)");
    expect(view.console[0].text).toBe(`  File "main.py", line ${issue.line}\nNameError: name 'led' is not defined`);
    expect(view.console[0].blockId).toBe("on");
  });

  it("코드 모드: 학생이 친 원문 줄로 옮긴다 (주석·빈 줄 때문에 밀린 줄)", () => {
    const snap = snapshot(noSetup());
    const source = "# 깜빡이기\n\n\n" + snap.generated;
    const view = computeLintView({ snapshot: snap, source: "code", code: source, parseError: null });
    const issue = view.issues.find((i) => i.id === "device-before-setup")!;
    expect(source.split("\n")[issue.line! - 1]).toContain("led.value(1)");
    expect(view.console[0].text).toContain(`line ${issue.line}\n`);
    // 블록 줄도 원문 기준
    expect(blockLines(view, "on")).toEqual([issue.line]);
    expect(blockAtLine(view, issue.line!)).toBe("on");
  });

  it("코드 모드: 원문에서 짝을 못 찾은 줄은 줄 번호를 버린다", () => {
    const snap = snapshot(noSetup());
    const view = computeLintView({ snapshot: snap, source: "code", code: "print(1)\n", parseError: null });
    const issue = view.issues.find((i) => i.id === "device-before-setup")!;
    expect(issue.line).toBeUndefined();
    expect(view.console.find((e) => e.blockId === "on")!.text).toBe("NameError: name 'led' is not defined");
  });

  it("문법 오류가 있으면 Traceback 하나와 한글 문제 하나만 (지난 블록의 문제는 숨긴다)", () => {
    const snap = snapshot(noSetup());
    const view = computeLintView({ snapshot: snap, source: "code", code: "if x\n", parseError: { line: 1, message: "문법 오류가 있어요. 이 줄을 다시 읽어 보세요." } });
    expect(view.console).toEqual([{ level: "error", line: 1, text: 'Traceback (most recent call last):\n  File "main.py", line 1\nSyntaxError: invalid syntax' }]);
    expect(view.issues).toEqual([{ id: "syntax", level: "error", line: 1, ko: "문법 오류가 있어요. 이 줄을 다시 읽어 보세요.", en: "SyntaxError: invalid syntax" }]);
    expect(blockAtLine(view, 1)).toBeUndefined();
  });

  it("블록이 하나도 없는 빈 작업판은 시작 블록 오류를 내지 않는다", () => {
    const empty: WorkspaceSnapshot = { json: {} as WorkspaceJson, generated: "", map: { blockToLines: {}, lineToBlock: {} } };
    expect(computeLintView({ snapshot: empty, source: "blocks", code: "", parseError: null }).issues).toEqual([]);
    expect(computeLintView({ snapshot: null, source: "blocks", code: "", parseError: null }).issues).toEqual([]);
  });

  it("값 블록은 그 블록을 담은 명령 블록의 줄", () => {
    const json = program([pinSetup("setup", "led", 26), forever("loop", [{ type: "flow_wait", id: "w", inputs: { SEC: { block: varGet("t", "get_t") } } }])], { vars: ["led", "t"] });
    const snap = snapshot(json);
    const view = computeLintView({ snapshot: snap, source: "blocks", code: snap.generated, parseError: null });
    expect(blockLines(view, "get_t")).toEqual(blockLines(view, "w"));
    expect(blockLines(view, "w")).toHaveLength(1);
    expect(blockLines(view, "nope")).toEqual([]);
  });
});

describe("highlightFor", () => {
  it("문제 줄(수준별) 다음에 강조 줄을 붙인다", () => {
    const issues = [
      { id: "a", level: "error" as const, line: 3, ko: "", en: "" },
      { id: "b", level: "warning" as const, ko: "", en: "" },
      { id: "c", level: "info" as const, line: 5, ko: "", en: "" },
    ];
    expect(highlightFor(issues, [3, 4])).toEqual([
      { line: 3, kind: "error" },
      { line: 5, kind: "info" },
      { line: 3, kind: "focus" },
      { line: 4, kind: "focus" },
    ]);
  });
});

