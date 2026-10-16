import { describe, expect, it } from "vitest";
import { codeToBlocks } from "@/parser";
import { initialEditorState, initialEditorStateFromBlocks } from "./editorSync";
import { labStart, usableBlocksJson } from "./labStart";
import { SAMPLE_CODE, START_ONLY_CODE } from "./sample";

/*
 * 자유 코딩 첫 프로그램 (lib-v1.0.3 initialProgram): 작품 > 예시 > 콘텐츠 코드 > 빈 프로그램.
 * blocksJson 이 있으면 작업판 JSON 으로(EditorWorkbench initialBlocks), 없으면 code 를 블록으로(codeToBlocks).
 */

const blocks = (() => {
  const r = codeToBlocks(SAMPLE_CODE);
  if (!r.ok) throw new Error("샘플 코드를 블록으로 못 바꿨어요");
  return r.json;
})();

describe("labStart", () => {
  it("코드만 있는 작품: 코드로 싣고 편집기가 그 코드를 블록으로 바꾼다", () => {
    const start = labStart({ initialProgram: { code: SAMPLE_CODE } });
    expect(start).toEqual({ initialCode: SAMPLE_CODE });
    const state = initialEditorState(start.initialCode);
    expect(state.parseError).toBeNull();
    expect(state.blocks).toEqual(blocks);
  });

  it("블록 JSON 이 있는 작품: 작업판 JSON 으로 싣는다", () => {
    const start = labStart({ initialProgram: { code: "print('old')", blocksJson: blocks, title: "깜빡이" } });
    expect(start.initialBlocks).toBe(blocks);
    expect(initialEditorStateFromBlocks(start.initialBlocks!).blocks).toBe(blocks);
  });

  it("빈 작업판·이상한 블록 JSON 이면 코드로 싣는다", () => {
    for (const bad of [null, {}, [], "x", { blocks: { blocks: [] } }, { blocks: {} }]) {
      expect(labStart({ initialProgram: { code: SAMPLE_CODE, blocksJson: bad } })).toEqual({ initialCode: SAMPLE_CODE });
    }
  });

  it("작품이 예시·콘텐츠 코드보다 먼저", () => {
    const start = labStart({ initialProgram: { code: SAMPLE_CODE }, example: "led.value(1)", codeRef: "01-led/step4_blink_loop.py" });
    expect(start).toEqual({ initialCode: SAMPLE_CODE });
  });

  it("작품이 없으면 예전 그대로: 예시 > 콘텐츠 코드 > 빈 프로그램", () => {
    expect(labStart({ example: "led.value(1)" })).toEqual({ initialCode: START_ONLY_CODE, initialExample: "led.value(1)" });
    expect(labStart({ codeRef: "01-led/step4_blink_loop.py" }).initialCode).toContain("while True");
    expect(labStart({ codeRef: "없는/파일.py" })).toEqual({ initialCode: START_ONLY_CODE });
    expect(labStart({ initialProgram: null })).toEqual({ initialCode: START_ONLY_CODE });
    expect(labStart({})).toEqual({ initialCode: START_ONLY_CODE });
  });

  it("usableBlocksJson: 맨 위 블록이 하나 이상인 객체만", () => {
    expect(usableBlocksJson(blocks)).toBe(true);
    expect(usableBlocksJson({ blocks: { blocks: [] } })).toBe(false);
    expect(usableBlocksJson(undefined)).toBe(false);
  });
});
