import type { BlockJson } from "./types";

export const num = (n: number): BlockJson => ({ type: "math_number", fields: { NUM: n } });
export const str = (s: string): BlockJson => ({ type: "text", fields: { TEXT: s } });
export const bool = (b: boolean): BlockJson => ({ type: "logic_boolean", fields: { BOOL: b ? "TRUE" : "FALSE" } });
export const varGet = (id: string): BlockJson => ({ type: "variables_get", fields: { VAR: { id } } });
export const varSet = (id: string, value: BlockJson): BlockJson => ({ type: "variables_set", fields: { VAR: { id } }, inputs: { VALUE: { block: value } } });
export const codeExpr = (code: string): BlockJson => ({ type: "code_expr", fields: { CODE: code } });
export const codeStmt = (code: string): BlockJson => ({ type: "code_stmt", fields: { CODE: code } });

export function block(type: string, fields?: Record<string, unknown>, inputs?: Record<string, BlockJson | undefined>, extraState?: unknown): BlockJson {
  const out: BlockJson = { type };
  if (fields && Object.keys(fields).length) out.fields = fields;
  if (inputs) {
    const entries = Object.entries(inputs).filter(([, v]) => v !== undefined) as [string, BlockJson][];
    if (entries.length) out.inputs = Object.fromEntries(entries.map(([k, v]) => [k, { block: v }]));
  }
  if (extraState !== undefined) out.extraState = extraState;
  return out;
}

/** 명령 블록 배열을 next 로 잇고 머리를 돌려준다. 빈 배열이면 undefined */
export function chain(blocks: BlockJson[]): BlockJson | undefined {
  if (!blocks.length) return undefined;
  for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
  return blocks[0];
}

export function withComment(b: BlockJson, text: string | null): BlockJson {
  if (text) b.icons = { comment: { text, pinned: false, height: 80, width: 160 } };
  return b;
}

/**
 * 블록 코멘트 글. 줄 끝 주석만 있으면 그 글 그대로. 문장 위 주석 줄(leading)이 있으면 줄마다 한 줄씩,
 * 줄 끝 주석은 `|` 를 붙인 마지막 줄. 위 주석이 한 줄뿐이고 줄 끝 주석이 없으면 빈 `|` 줄을 붙여
 * (한 줄짜리 코멘트는 생성기가 줄 끝 주석으로 쓰므로) 위 주석임을 표시한다. 생성기 splitComment 와 짝.
 */
export function commentText(leading: string[], trailing: string | null): string | null {
  if (!leading.length) return trailing;
  if (trailing) return [...leading, `|${trailing}`].join("\n");
  return leading.length === 1 ? `${leading[0]}\n|` : leading.join("\n");
}
