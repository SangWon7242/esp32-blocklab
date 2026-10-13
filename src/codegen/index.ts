import * as Blockly from "blockly";
import { registerBlocks } from "@/blocks";
import { MicroPythonGenerator } from "./generator";
import { registerForBlocks } from "./forBlock";

export { collectImports } from "./imports";
export { MicroPythonGenerator };
export type WorkspaceJson = ReturnType<typeof Blockly.serialization.workspaces.save>;

export function createGenerator(): MicroPythonGenerator {
  registerBlocks();
  const gen = new MicroPythonGenerator();
  registerForBlocks(gen);
  return gen;
}

let shared: MicroPythonGenerator | null = null;

/** 작업판 전체를 MicroPython 코드로 */
export function generateCode(workspace: Blockly.Workspace): string {
  shared ??= createGenerator();
  return shared.workspaceToCode(workspace);
}

/** 직렬화 JSON을 헤드리스 작업판에 올려 코드로 바꾼다 (테스트·동기화용) */
export function workspaceJsonToCode(json: WorkspaceJson): string {
  registerBlocks();
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(json, ws);
    return generateCode(ws);
  } finally {
    ws.dispose();
  }
}
