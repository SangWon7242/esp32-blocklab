import { beforeAll, describe, expect, it, vi } from "vitest";
import * as Blockly from "blockly";
import { registerBlocks } from "@/blocks";
import { BLOCK_DOC_MENU_ID, codeOfBlock, registerBlockDocMenu } from "./blockDocMenu";

beforeAll(() => {
  registerBlocks();
});

function waitBlock(ws: Blockly.Workspace, sec: number): Blockly.Block {
  return Blockly.serialization.blocks.append(
    { type: "flow_wait", inputs: { SEC: { shadow: { type: "math_number", fields: { NUM: sec } } } } },
    ws,
  );
}

type ActionItem = Extract<Blockly.ContextMenuRegistry.RegistryItem, { callback: unknown }>;

describe("블록 설명 메뉴", () => {
  it("두 번 등록해도 항목은 하나이고 콜백은 마지막 것으로 바뀐다", () => {
    const first = vi.fn();
    const second = vi.fn();
    registerBlockDocMenu(first);
    expect(() => registerBlockDocMenu(second)).not.toThrow();
    const registry = Blockly.ContextMenuRegistry.registry;
    const item = registry.getItem(BLOCK_DOC_MENU_ID) as ActionItem;
    expect(item).toBeTruthy();
    expect(item.displayText).toBe("이 블록 설명 보기");
    expect(item.weight).toBe(0);
    expect(item.scopeType).toBe(Blockly.ContextMenuRegistry.ScopeType.BLOCK);

    const ws = new Blockly.Workspace();
    try {
      const block = waitBlock(ws, 2);
      const scope = { block: block as Blockly.BlockSvg };
      expect(item.preconditionFn(scope, new Event("contextmenu"))).toBe("enabled");
      item.callback(scope, new Event("contextmenu"), new Event("click"), new Blockly.utils.Coordinate(0, 0));
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
      const req = second.mock.calls[0][0];
      expect(req.type).toBe("flow_wait");
      expect(req.code).toContain("time.sleep(2)");
      expect(req.blockId).toBe(block.id);

      // 그림자 블록이면 담은 블록의 설명
      const shadow = block.getInputTargetBlock("SEC")!;
      item.callback({ block: shadow as Blockly.BlockSvg }, new Event("contextmenu"), new Event("click"), new Blockly.utils.Coordinate(0, 0));
      expect(second.mock.calls[1][0].type).toBe("flow_wait");
    } finally {
      ws.dispose();
    }
  });

  it("codeOfBlock: 블록 하나의 코드 (값 블록이면 식)", () => {
    const ws = new Blockly.Workspace();
    try {
      expect(codeOfBlock(waitBlock(ws, 2))).toContain("time.sleep(2)");
      expect(codeOfBlock(ws.newBlock("math_number")).trim()).toBe("0");
    } finally {
      ws.dispose();
    }
  });

  it("codeOfBlock: 꺼진 블록도 코드를 보여 준다", () => {
    const ws = new Blockly.Workspace();
    try {
      const block = waitBlock(ws, 3);
      block.setDisabledReason(true, "orphaned_block");
      expect(block.isEnabled()).toBe(false);
      expect(codeOfBlock(block)).toContain("time.sleep(3)");
      // 원래 블록은 그대로 꺼져 있다
      expect(block.isEnabled()).toBe(false);
    } finally {
      ws.dispose();
    }
  });
});
