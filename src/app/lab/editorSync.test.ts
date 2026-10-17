import { describe, expect, it, beforeAll, vi } from "vitest";
import { registerBlocks } from "@/blocks";
import { codeToBlocks } from "@/parser";
import { workspaceJsonToCode } from "@/codegen";
import { runSaveProject, type SaveProjectInput } from "./saveProject";
import { countCodeBlocks, editorReducer, initialEditorState, programForSave } from "./editorSync";
import { labStart } from "./labStart";
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
    const map = { blockToLines: { a: [4] }, lineToBlock: { 4: "a" }, blockStart: { a: 4 } };
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

/*
 * lib-v1.0.4: 코드 모드에서 code 가 블록과 맞지 않은 채 「작품으로 저장」하면 blocksJson 은 null — 학생이 친 code 가 기준.
 * 그렇게 저장한 작품을 다시 열면(blocksJson 없음 + 블록으로 못 바꿈) 코드 모드로 열고 친 글을 그대로 둔다.
 */
describe("programForSave (작품으로 저장)", () => {
  const BROKEN = LED + "led.value(\n";
  const codeMode = () => editorReducer(initialEditorState(LED), { type: "switchSource", source: "code" });

  it("블록 모드: 작업판 블록을 그대로 넘긴다", () => {
    const s = initialEditorState(LED);
    expect(programForSave(s)).toEqual({ code: LED, blocksJson: s.blocks, unconvertible: false });
  });

  it("코드 모드 문법 오류: blocksJson 은 null, 친 글을 code 로, 안내 표시", () => {
    const s = editorReducer(codeMode(), { type: "codeChanged", code: BROKEN });
    expect(s.parseError).not.toBeNull();
    expect(s.blocks).not.toBeNull(); // 마지막 성공 블록이 남아 있다
    expect(programForSave(s)).toEqual({ code: BROKEN, blocksJson: null, unconvertible: true });
  });

  it("코드 모드에서 code 가 블록이 만드는 코드와 같으면 블록도 넘긴다 (줄 끝 빈칸 차이는 같다고 본다)", () => {
    const generated = workspaceJsonToCode(initialEditorState(LED).blocks!);
    const s = editorReducer(codeMode(), { type: "codeChanged", code: generated.replace(/\n/g, "  \n") + "\n\n" });
    expect(programForSave(s).blocksJson).toBe(s.blocks);
  });

  it("코드 모드에서 code 가 블록이 만드는 코드와 다르면 blocksJson 은 null (안내는 없다)", () => {
    const s = editorReducer(codeMode(), { type: "codeChanged", code: "from machine import Pin\nled=Pin(26,Pin.OUT)\nled.value(1)\n" });
    expect(s.parseError).toBeNull();
    expect(programForSave(s)).toMatchObject({ blocksJson: null, unconvertible: false });
  });

  it("저장 인자: 문법 오류면 호스트에 blocksJson null 로 간다", async () => {
    const save = vi.fn(async (_p: SaveProjectInput) => {});
    const p = programForSave(editorReducer(codeMode(), { type: "codeChanged", code: BROKEN }));
    await runSaveProject(save, { title: "깜빡이", code: p.code, blocksJson: p.blocksJson });
    expect(save).toHaveBeenCalledWith({ title: "깜빡이", code: BROKEN, blocksJson: null });
  });

  it("다시 열기: 그 작품은 코드 모드로, 친 글이 편집기에 그대로, 오류 줄 표시", () => {
    const start = labStart({ initialProgram: { code: BROKEN, blocksJson: null } });
    expect(start).toEqual({ initialCode: BROKEN, initialSource: "code" });
    const s = initialEditorState(start.initialCode, start.initialSource);
    expect(s.source).toBe("code");
    expect(s.code).toBe(BROKEN);
    expect(s.blocks).toBeNull();
    expect(s.parseError?.line).toBeGreaterThan(0);
    // 고치면 블록이 따라오고 블록 모드로 돌아갈 수 있다
    const fixed = editorReducer(s, { type: "codeChanged", code: LED });
    expect(fixed.parseError).toBeNull();
    expect(editorReducer(fixed, { type: "switchSource", source: "blocks" }).source).toBe("blocks");
  });

  it("lib-v1.0.3 이 오류 전 블록을 함께 저장한 작품도 친 글을 코드 모드로 연다", () => {
    const old = initialEditorState(LED).blocks;
    expect(labStart({ initialProgram: { code: BROKEN, blocksJson: old } })).toEqual({ initialCode: BROKEN, initialSource: "code" });
  });
});
