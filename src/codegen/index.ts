import * as Blockly from "blockly";
import { registerBlocks } from "@/blocks";
import { MicroPythonGenerator } from "./generator";
import { registerForBlocks } from "./forBlock";
import type { LineMap } from "./linemap";

export { collectImports } from "./imports";
export { MicroPythonGenerator };
export { emptyLineMap, type LineMap } from "./linemap";
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

/**
 * 작업판 전체를 코드와 코드 지도(블록 id ↔ 줄 번호)로. 코드는 generateCode 와 같은 글자열이다.
 * 공유 생성기의 지도 모드를 이번 한 번만 켠다 (workspaceToCodeWithMap 이 끝나면 끈다).
 */
export function generateCodeWithMap(workspace: Blockly.Workspace): { code: string; map: LineMap } {
  shared ??= createGenerator();
  return shared.workspaceToCodeWithMap(workspace);
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

/** 직렬화 JSON을 헤드리스 작업판에 올려 코드와 코드 지도로 (블록 id 는 JSON 의 id) */
export function workspaceJsonToCodeWithMap(json: WorkspaceJson): { code: string; map: LineMap } {
  registerBlocks();
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(json, ws);
    return generateCodeWithMap(ws);
  } finally {
    ws.dispose();
  }
}
