import * as Blockly from "blockly";
import { blockSnippet, type WorkspaceJson } from "@/codegen";

/** 블록 우클릭 메뉴의 "이 블록 설명 보기" 항목 id */
export const BLOCK_DOC_MENU_ID = "block_doc";

export type BlockDocRequest = { type: string; code: string; blockId: string };

/** 메뉴를 누르면 부를 함수. 등록은 한 번이고 이것만 바꿔 끼운다 (작업판을 다시 만들 때마다) */
let onOpenRef: ((req: BlockDocRequest) => void) | null = null;

/** 그림자 블록이면 그것을 담은 진짜 블록 (학생이 보는 블록의 설명을 연다) */
function realBlock(block: Blockly.Block): Blockly.Block {
  let b: Blockly.Block | null = block;
  while (b?.isShadow()) b = b.getParent();
  return b ?? block;
}

type BlockState = Blockly.serialization.blocks.State;

/** 직렬화 JSON 에서 id 블록을 찾아 그 블록과 안쪽 블록을 모두 켠다 (찾으면 true) */
function enableSubtree(state: BlockState | undefined, id: string, inside = false): boolean {
  if (!state) return false;
  const here = inside || state.id === id;
  if (here) delete (state as BlockState & { disabledReasons?: string[] }).disabledReasons;
  let found = state.id === id;
  for (const input of Object.values(state.inputs ?? {})) {
    found = enableSubtree(input.block, id, here) || found;
    found = enableSubtree(input.shadow, id, here) || found;
  }
  // 아래로 이어진 블록은 이 블록의 코드가 아니므로 켜지 않는다 (찾기만 한다)
  found = enableSubtree(state.next?.block, id, inside) || found;
  return found;
}

/**
 * 블록 하나의 코드 (우클릭한 블록의 지금 값으로). 값 블록이면 식.
 * 시작 블록에 붙지 않아 꺼진 블록은 생성기가 건너뛰므로, 헤드리스 사본에서 켜서 만든다.
 */
export function codeOfBlock(block: Blockly.Block): string {
  if (block.isEnabled()) return blockSnippet(block);
  const json = Blockly.serialization.workspaces.save(block.workspace) as WorkspaceJson & {
    blocks?: { blocks?: BlockState[] };
  };
  for (const top of json.blocks?.blocks ?? []) if (enableSubtree(top, block.id)) break;
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(json, ws);
    const copy = ws.getBlockById(block.id);
    return copy ? blockSnippet(copy) : "";
  } catch {
    return "";
  } finally {
    ws.dispose();
  }
}

/** 한 번만 등록. 두 번 불러도 항목은 하나. 콜백은 마지막 것으로 바뀐다 */
export function registerBlockDocMenu(onOpen: (req: BlockDocRequest) => void): void {
  onOpenRef = onOpen;
  const registry = Blockly.ContextMenuRegistry.registry;
  if (registry.getItem(BLOCK_DOC_MENU_ID)) return;
  registry.register({
    id: BLOCK_DOC_MENU_ID,
    scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    displayText: "이 블록 설명 보기",
    // 맨 위에 (기본 항목은 1부터)
    weight: 0,
    // 작업판·팔레트 블록 모두
    preconditionFn: () => "enabled",
    callback: (scope) => {
      if (!scope.block) return;
      const block = realBlock(scope.block);
      onOpenRef?.({ type: block.type, code: codeOfBlock(block), blockId: block.id });
    },
  });
}
