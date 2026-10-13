import type { BlockJson, FlatBlock, Issue, LintContext, LintWorkspaceJson } from "./types";
import type { LineMap } from "@/codegen/linemap";

/** 작업판 JSON → 평탄화한 블록 목록과 검사 문맥 */
export function buildContext(json: LintWorkspaceJson, map: LineMap | null): LintContext {
  const blocks: FlatBlock[] = [];
  const byId = new Map<string, FlatBlock>();
  let counter = 0;

  /** 줄(머리 + next 사슬)을 편다. 돌려주는 값은 머리 id */
  const visitChain = (head: BlockJson, parentId: string | null, inputName: string | null, topLevel: boolean, shadow: boolean): string => {
    let cur: BlockJson | undefined = head;
    let prev: FlatBlock | null = null;
    let headId = "";
    let first = true;
    while (cur) {
      const fb = visit(cur, parentId, inputName, first && topLevel, shadow);
      if (prev) prev.nextId = fb.id;
      else headId = fb.id;
      prev = fb;
      first = false;
      cur = cur.next?.block;
    }
    return headId;
  };

  const visit = (b: BlockJson, parentId: string | null, inputName: string | null, topLevel: boolean, shadow: boolean): FlatBlock => {
    const hasId = typeof b.id === "string" && b.id.length > 0;
    let id = hasId ? (b.id as string) : `_${counter++}`;
    while (byId.has(id)) id = `${id}_${counter++}`;
    const fb: FlatBlock = {
      id, hasId, type: b.type, fields: b.fields ?? {}, inputs: {}, extraState: b.extraState,
      parentId, inputName, nextId: null, topLevel, shadow,
    };
    blocks.push(fb);
    byId.set(id, fb);
    for (const [name, input] of Object.entries(b.inputs ?? {})) {
      const slot: { block?: string; shadow?: string } = {};
      if (input?.shadow) slot.shadow = visitChain(input.shadow, id, name, false, true);
      if (input?.block) slot.block = visitChain(input.block, id, name, false, shadow);
      fb.inputs[name] = slot;
    }
    return fb;
  };

  for (const top of json.blocks?.blocks ?? []) visitChain(top, null, null, true, false);

  const names = new Map((json.variables ?? []).map((v) => [v.id, v.name]));
  const varName = (field: unknown): string | undefined => {
    if (typeof field === "string") return field || undefined;
    if (field && typeof field === "object") {
      const f = field as { id?: unknown; name?: unknown };
      if (typeof f.name === "string" && f.name) return f.name;
      if (typeof f.id === "string") return names.get(f.id);
    }
    return undefined;
  };
  return { blocks, byId, varName, map };
}

/** 블록의 next 사슬과 모든 입력 아래(그림자 제외)의 블록들 — 자기 자신 포함 */
export function subtree(ctx: LintContext, headId: string | undefined): FlatBlock[] {
  const out: FlatBlock[] = [];
  const stack: string[] = headId ? [headId] : [];
  while (stack.length) {
    const b = ctx.byId.get(stack.pop() as string);
    if (!b) continue;
    out.push(b);
    if (b.nextId) stack.push(b.nextId);
    for (const slot of Object.values(b.inputs)) if (slot.block) stack.push(slot.block);
  }
  return out;
}

/** 블록의 코드 첫 줄 (값 블록처럼 지도에 없으면 담은 블록을 거슬러 올라간다) */
export function lineOf(ctx: LintContext, id: string | undefined): number | undefined {
  let cur = id ? ctx.byId.get(id) : undefined;
  while (cur) {
    const lines = ctx.map?.blockToLines[cur.id];
    if (lines?.length) return lines[0];
    cur = cur.parentId ? ctx.byId.get(cur.parentId) : undefined;
  }
  return undefined;
}

/** 실제(그림자 아닌) 블록만 */
export const realBlocks = (ctx: LintContext): FlatBlock[] => ctx.blocks.filter((b) => !b.shadow);

/** 입력에 실제로 들어간 블록 (블록이 없으면 그림자) */
export function inputTarget(ctx: LintContext, b: FlatBlock, input: string): FlatBlock | undefined {
  const slot = b.inputs[input];
  const id = slot?.block ?? slot?.shadow;
  return id ? ctx.byId.get(id) : undefined;
}

/** 블록에 단 문제 하나 (줄 번호는 코드 지도에서; 지어낸 id 는 내보내지 않는다) */
export function issueAt(ctx: LintContext, b: FlatBlock, id: string, level: Issue["level"], ko: string, en: string): Issue {
  const out: Issue = { id, level, ko, en };
  if (b.hasId) out.blockId = b.id;
  const line = lineOf(ctx, b.id);
  if (line !== undefined) out.line = line;
  return out;
}
