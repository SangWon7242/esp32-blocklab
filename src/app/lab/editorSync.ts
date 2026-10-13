import { workspaceJsonToCode, type WorkspaceJson } from "@/codegen";
import { codeToBlocks, type BlockJson, type UnparsedItem } from "@/parser";

export type Source = "blocks" | "code";

export type EditorState = {
  /** 지금 기준이 되는 쪽. blocks 면 코드 패널은 읽기 전용 */
  source: Source;
  code: string;
  blocks: WorkspaceJson | null;
  unparsed: UnparsedItem[];
  parseError: { line: number; message: string } | null;
};

export type EditorAction =
  | { type: "blocksChanged"; json: WorkspaceJson; code: string }
  | { type: "codeChanged"; code: string }
  | { type: "switchSource"; source: Source }
  | { type: "loadCode"; code: string };

function fromCode(code: string, prev: EditorState): EditorState {
  const r = codeToBlocks(code);
  if (!r.ok) return { ...prev, code, parseError: r.error };
  return { ...prev, code, blocks: r.json, unparsed: r.unparsed, parseError: null };
}

export function initialEditorState(code: string): EditorState {
  const base: EditorState = { source: "blocks", code, blocks: null, unparsed: [], parseError: null };
  return fromCode(code, base);
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "blocksChanged":
      if (state.source !== "blocks") return state;
      return { ...state, blocks: action.json, code: action.code };
    case "codeChanged":
      if (state.source !== "code") return state;
      return fromCode(action.code, state);
    case "switchSource": {
      if (action.source === state.source) return state;
      if (action.source === "blocks") {
        // 문법 오류가 남은 채로 돌아가면 마지막 성공 블록의 코드로 덮여 방금 친 코드가 사라진다
        if (state.parseError) return state;
        const code = state.blocks ? workspaceJsonToCode(state.blocks) : state.code;
        return { ...state, source: "blocks", code, parseError: null };
      }
      return { ...state, source: "code" };
    }
    case "loadCode":
      return fromCode(action.code, { ...state, source: "blocks" });
  }
}

/** 작업판에 남은 코드 블록(code_stmt·code_expr) 수. 블록 모드의 "변환 못 한" 배지가 쓴다 */
export function countCodeBlocks(json: WorkspaceJson | null): number {
  if (!json) return 0;
  let n = 0;
  const visit = (b: BlockJson | undefined): void => {
    if (!b) return;
    if (b.type === "code_stmt" || b.type === "code_expr") n++;
    for (const input of Object.values(b.inputs ?? {})) { visit(input.block); visit(input.shadow); }
    visit(b.next?.block);
  };
  for (const top of (json.blocks?.blocks ?? []) as BlockJson[]) visit(top);
  return n;
}
