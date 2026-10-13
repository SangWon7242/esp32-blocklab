import { describe, expect, it } from "vitest";
import { workspaceJsonToCodeWithMap, type WorkspaceJson } from "@/codegen";
import { forever, pinSetup, program, wait } from "@/lint/testkit";
import { computeLintView } from "./useLint";

describe("computeLintView ignoreRules (설계 조립)", () => {
  it("흩어 둔 블록의 orphan 경고를 문제·콘솔에서 뺀다", () => {
    const json = program([], { tops: [pinSetup("s", "led", 26), forever("loop", [wait("w", 1)])], vars: ["led"] });
    const { code, map } = workspaceJsonToCodeWithMap(json as WorkspaceJson);
    const snapshot = { json: json as WorkspaceJson, generated: code, map };
    const plain = computeLintView({ snapshot, source: "blocks", code, parseError: null });
    expect(plain.issues.filter((i) => i.id === "orphan")).toHaveLength(2);
    const assembly = computeLintView({ snapshot, source: "blocks", code, parseError: null, ignoreRules: ["orphan"] });
    expect(assembly.issues.filter((i) => i.id === "orphan")).toHaveLength(0);
    expect(assembly.console.some((c) => /orphan/.test(c.text))).toBe(false);
  });
});
