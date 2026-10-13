/*
 * 장치 선언 테스트(src/devices/specs/*.test.ts)가 함께 쓰는 도우미. 테스트에서만 불러온다.
 * 작업판 JSON 을 짜서 코드로 만들고, 그 코드를 다시 블록으로 되돌려 블록 type 열을 견준다.
 */
import { workspaceJsonToCode, type WorkspaceJson } from "@/codegen";
import { codeToBlocks } from "@/parser";
import type { BlockJson } from "@/parser/types";

export type B = BlockJson;

export const num = (n: number): B => ({ type: "math_number", fields: { NUM: n } });
export const arith = (a: B, op: string, b: B): B => ({ type: "calc_arith", fields: { OP: op }, inputs: { A: { block: a }, B: { block: b } } });
/** 변수 칸 값 (codeToBlocks 가 만드는 id 와 같은 꼴) */
export const v = (name: string) => ({ id: `var_${name}` });
export const print = (value: B): B => ({ type: "esp_print", inputs: { VALUE: { block: value } } });
export const ifThen = (cond: B, body: B[]): B => ({ type: "controls_if", inputs: { IF0: { block: cond }, DO0: { block: chain(body) } } });
export const forever = (body: B[]): B => ({ type: "flow_repeat_forever", inputs: { DO: { block: chain(body) } } });

/** 명령 블록 배열을 next 로 잇는다 */
export function chain(blocks: B[]): B {
  const copies = blocks.map((b) => ({ ...b }));
  for (let i = 0; i < copies.length - 1; i++) copies[i].next = { block: copies[i + 1] };
  return copies[0];
}

/** 시작 블록 몸통에 blocks 를 넣은 작업판. vars 는 변수 칸에 쓰는 이름 */
export function program(blocks: B[], vars: string[] = []): WorkspaceJson {
  return {
    variables: vars.map((name) => ({ name, id: `var_${name}` })),
    blocks: { languageVersion: 0, blocks: [{ type: "start_program", x: 0, y: 0, inputs: { BODY: { block: chain(blocks) } } }] },
  } as unknown as WorkspaceJson;
}

/** 블록 하나와 그 아래(값 입력은 이름 순, 그다음 next)의 type 을 깊이 우선으로 */
export function typesOf(b: B | undefined): string[] {
  if (!b) return [];
  const inputs = Object.keys(b.inputs ?? {}).sort().flatMap((k) => typesOf(b.inputs![k].block));
  return [b.type, ...inputs, ...typesOf(b.next?.block)];
}

/** 블록 → 코드 */
export const toCode = (blocks: B[], vars: string[] = []): string => workspaceJsonToCode(program(blocks, vars));

/** 코드 → 블록: 시작 블록 몸통의 블록들, type 열, unparsed, 그리고 다시 만든 코드 */
export function fromCode(code: string) {
  const r = codeToBlocks(code);
  if (!r.ok) throw new Error(r.error.message);
  const tops = r.json.blocks.blocks as B[];
  const body = tops.find((b) => b.type === "start_program")?.inputs?.BODY?.block;
  const list: B[] = [];
  for (let c = body; c; c = c.next?.block) list.push(c);
  return { body: list, types: typesOf(body), tops: tops.map((t) => t.type), unparsed: r.unparsed, code: workspaceJsonToCode(r.json) };
}
