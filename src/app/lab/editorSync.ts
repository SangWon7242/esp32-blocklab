import { workspaceJsonToCode, type LineMap, type WorkspaceJson } from "@/codegen";
import { codeToBlocks, type BlockJson, type UnparsedItem } from "@/parser";

export type Source = "blocks" | "code";

export type EditorState = {
  /** 지금 기준이 되는 쪽. blocks 면 코드 패널은 읽기 전용 */
  source: Source;
  code: string;
  blocks: WorkspaceJson | null;
  unparsed: UnparsedItem[];
  parseError: { line: number; message: string } | null;
  /**
   * 코드 지도: 작업판 블록 id ↔ 작업판에서 다시 만든 코드의 줄 번호. 블록 모드에서는 state.code 와 줄이 같고,
   * 코드 모드에서는 학생이 친 원문이 아니라 재생성 코드 기준이다 (원문 줄로 옮기는 일은 검사 쪽 정렬이 한다).
   * 블록이 바뀌었는데 아직 작업판에서 다시 재지 않았으면 null.
   */
  map: LineMap | null;
};

export type EditorAction =
  | { type: "blocksChanged"; json: WorkspaceJson; code: string; map?: LineMap }
  | { type: "codeChanged"; code: string }
  | { type: "switchSource"; source: Source }
  | { type: "loadCode"; code: string }
  /** 작업판에 블록을 다시 올린 뒤(전환·코드 모드 재로드) 그 작업판에서 잰 지도 */
  | { type: "mapUpdated"; map: LineMap };

function fromCode(code: string, prev: EditorState): EditorState {
  const r = codeToBlocks(code);
  if (!r.ok) return { ...prev, code, parseError: r.error };
  // 새 블록의 id 는 작업판에 올려야 정해지므로 지도는 그때(mapUpdated) 다시 받는다
  return { ...prev, code, blocks: r.json, unparsed: r.unparsed, parseError: null, map: null };
}

/**
 * 코드로 시작한다. source 가 "code" 면 코드 모드로 연다 (lib-v1.0.4: 블록으로 바꾸지 못하는 작품을 다시 열 때 —
 * 친 글을 코드 편집기에 그대로 두고 오류 줄을 보여 준다)
 */
export function initialEditorState(code: string, source: Source = "blocks"): EditorState {
  const base: EditorState = { source, code, blocks: null, unparsed: [], parseError: null, map: null };
  return fromCode(code, base);
}

/** 블록 JSON 으로 시작한다 (설계 조립: 떼어 흩어 둔 블록). 코드는 그 작업판이 만드는 코드 */
export function initialEditorStateFromBlocks(blocks: WorkspaceJson): EditorState {
  return { source: "blocks", code: workspaceJsonToCode(blocks), blocks, unparsed: [], parseError: null, map: null };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "blocksChanged":
      if (state.source !== "blocks") return state;
      return { ...state, blocks: action.json, code: action.code, map: action.map ?? null };
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
    case "mapUpdated":
      return { ...state, map: action.map };
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

/** 「작품으로 저장」에 넘길 프로그램 (lib-v1.0.4) */
export type SaveProgram = {
  code: string;
  blocksJson: WorkspaceJson | null;
  /** 코드 모드 문법 오류로 블록으로 바꾸지 못해 코드 글만 저장한다 (대화상자 안내) */
  unconvertible: boolean;
};

/** 줄 끝 빈칸·끝 빈 줄 차이는 같은 코드로 본다 */
function sameCode(a: string, b: string): boolean {
  const tidy = (s: string) => s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trimEnd()).join("\n").trimEnd();
  return tidy(a) === tidy(b);
}

/**
 * 저장할 프로그램. 학생이 친 code 가 기준이다: 코드 모드에서 code 가 지금 블록과 맞지 않으면
 * (문법 오류로 블록이 마지막 성공 파싱에 머물러 있거나, code 가 그 블록에서 다시 만든 코드와 다르면) blocksJson 은 null.
 * 그래야 다시 열 때 오류 전 블록이 친 글을 덮지 않는다. 블록 모드는 작업판이 기준이라 그대로 둔다.
 */
export function programForSave(state: EditorState): SaveProgram {
  if (state.source === "code") {
    if (state.parseError) return { code: state.code, blocksJson: null, unconvertible: true };
    if (!state.blocks || !sameCode(state.code, workspaceJsonToCode(state.blocks))) return { code: state.code, blocksJson: null, unconvertible: false };
  }
  return { code: state.code, blocksJson: state.blocks, unconvertible: false };
}
