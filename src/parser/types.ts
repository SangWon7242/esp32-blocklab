/**
 * Blockly 작업판 JSON (`Blockly.serialization.workspaces.save` 의 반환 꼴과 같다 — src/codegen/index.ts 가 같은지 지킨다).
 * 파서는 Blockly 없이 도는 순수 경로라서(서버 입구 core, lib-v1.0.2) 선언에서도 blockly 를 import 하지 않는다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Blockly 의 선언 그대로
export type WorkspaceJson = { [key: string]: any };

export type BlockJson = {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlockJson; shadow?: BlockJson }>;
  next?: { block: BlockJson };
  extraState?: unknown;
  icons?: { comment: { text: string; pinned: boolean; height: number; width: number } };
};

export type UnparsedItem = { line: number; text: string };

export type ParseResult =
  | { ok: true; json: WorkspaceJson; unparsed: UnparsedItem[] }
  | { ok: false; error: { line: number; message: string } };
