import { describe, expect, it, beforeAll } from "vitest";
import { registerBlocks } from "@/blocks";
import { codeToBlocks } from "@/parser";
import { countCodeBlocks, editorReducer, initialEditorState } from "./editorSync";
import { SAMPLE_CODE } from "./sample";

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

  it("문법 오류가 남아 있으면 블록으로 돌아가지 않는다 (친 코드를 지키려고)", () => {
    const s0 = editorReducer(initialEditorState(LED), { type: "switchSource", source: "code" });
    const s1 = editorReducer(s0, { type: "codeChanged", code: LED + "if x\n" });
    expect(s1.parseError).not.toBeNull();
    const s2 = editorReducer(s1, { type: "switchSource", source: "blocks" });
    expect(s2).toBe(s1);
    expect(s2.source).toBe("code");
    expect(s2.code).toBe(LED + "if x\n");
  });

  it("변환 안 된 조각 수를 센다", () => {
    const s0 = editorReducer(initialEditorState(LED), { type: "switchSource", source: "code" });
    const s1 = editorReducer(s0, { type: "codeChanged", code: "x = time.ticks_us()\n" });
    expect(s1.unparsed).toHaveLength(1);
  });
  it("코드 지도: blocksChanged·mapUpdated 가 지도를 넣고, 블록을 새로 만든 codeChanged 는 비운다", () => {
    const map = { blockToLines: { a: [4] }, lineToBlock: { 4: "a" } };
    const s0 = initialEditorState(LED);
    expect(s0.map).toBeNull();
    const s1 = editorReducer(s0, { type: "blocksChanged", json: s0.blocks!, code: LED, map });
    expect(s1.map).toBe(map);
    const s2 = editorReducer(editorReducer(s1, { type: "switchSource", source: "code" }), { type: "codeChanged", code: LED + "led.value(0)\n" });
    expect(s2.map).toBeNull();
    const s3 = editorReducer(s2, { type: "mapUpdated", map });
    expect(s3.map).toBe(map);
    expect(editorReducer(s3, { type: "codeChanged", code: "if x\n" }).map).toBe(map);
  });
});

describe("countCodeBlocks", () => {
  const json = (code: string) => {
    const r = codeToBlocks(code);
    if (!r.ok) throw new Error(r.error.message);
    return r.json;
  };
  it("작업판에 남은 코드 블록(code_stmt·code_expr)을 센다", () => {
    expect(countCodeBlocks(json("x = time.ticks_us()\noled.fill(0)\n"))).toBe(2);
  });
  it("몸통·값 칸 안의 코드 블록도 센다", () => {
    expect(countCodeBlocks(json("while True:\n    print(time.ticks_us())\n"))).toBe(1);
  });
  it("예시 코드와 빈 작업판은 0", () => {
    expect(countCodeBlocks(json(SAMPLE_CODE))).toBe(0);
    expect(countCodeBlocks(null)).toBe(0);
  });
});
