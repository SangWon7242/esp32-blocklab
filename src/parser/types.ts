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

/** codeToBlocks 의 선택 사항 */
export type ParseOptions = {
  /**
   * 호스트가 보드에 미리 올려 두는 장치 id (예: 행사용 AI 카드 편집기의 ["rgb"]). 코드에 그 장치의 준비 줄·도우미 def 가 없어도
   * 그 장치 블록 꼴(`set_color(255, 0, 0)` → RGB 색 블록)로 돌아온다
   */
  hostDevices?: readonly string[];
};
