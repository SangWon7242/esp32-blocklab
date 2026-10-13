import { describe, expect, it, beforeAll } from "vitest";
import { registerBlocks } from "@/blocks";
import { editorReducer, initialEditorState } from "./editorSync";

beforeAll(() => registerBlocks());

const LED = "from machine import Pin\n\nled = Pin(26, Pin.OUT)\n\nled.value(1)\n";

describe("editorReducer", () => {
  it("초기 상태는 코드에서 블록을 만든다", () => {
    const s = initialEditorState(LED);
    expect(s.source).toBe("blocks");
    expect(s.blocks).not.toBeNull();
    expect(s.code).toBe(LED);
    expect(s.parseError).toBeNull();
  });

  it("블록 모드에서 blocksChanged 는 코드를 갱신한다", () => {
    const s0 = initialEditorState(LED);
    const s1 = editorReducer(s0, { type: "blocksChanged", json: s0.blocks!, code: "print(1)\n" });
    expect(s1.code).toBe("print(1)\n");
  });

  it("코드 모드에서 codeChanged 는 블록을 다시 만들고, 문법 오류면 블록을 유지한다", () => {
    const s0 = editorReducer(initialEditorState(LED), { type: "switchSource", source: "code" });
    const s1 = editorReducer(s0, { type: "codeChanged", code: LED + "led.value(0)\n" });
    expect(s1.parseError).toBeNull();
    expect(JSON.stringify(s1.blocks)).toContain('"VALUE":"0"');
    const s2 = editorReducer(s1, { type: "codeChanged", code: "if x\n" });
    expect(s2.parseError?.line).toBe(1);
    expect(s2.blocks).toBe(s1.blocks);
    expect(s2.code).toBe("if x\n");
  });

  it("코드 모드에서 blocksChanged 는 무시한다", () => {
    const s0 = editorReducer(initialEditorState(LED), { type: "switchSource", source: "code" });
    const s1 = editorReducer(s0, { type: "blocksChanged", json: s0.blocks!, code: "zzz" });
    expect(s1).toBe(s0);
  });

  it("블록 모드로 돌아오면 코드를 블록 기준으로 다시 만든다", () => {
    const s0 = editorReducer(initialEditorState(LED), { type: "switchSource", source: "code" });
    const s1 = editorReducer(s0, { type: "codeChanged", code: "led = Pin(26, Pin.OUT)   # 주석\nled.value(1)\n" });
    const s2 = editorReducer(s1, { type: "switchSource", source: "blocks" });
    expect(s2.code).toBe("from machine import Pin\n\nled = Pin(26, Pin.OUT)  # 주석\n\nled.value(1)\n");
    expect(s2.parseError).toBeNull();
  });

  it("변환 안 된 조각 수를 센다", () => {
    const s0 = editorReducer(initialEditorState(LED), { type: "switchSource", source: "code" });
    const s1 = editorReducer(s0, { type: "codeChanged", code: "x = time.ticks_us()\n" });
    expect(s1.unparsed).toHaveLength(1);
  });
});
