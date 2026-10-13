/**
 * 검사 테스트용 작업판 JSON 도우미 (src/codegen/codegen.test.ts 의 program·chain 을 옮기고 블록마다 id 를 붙였다).
 * Blockly 에 기대지 않는다.
 */
import type { BlockJson, LintWorkspaceJson } from "./types";

export type B = BlockJson & Record<string, unknown>;

let auto = 0;
/** 이름을 주지 않은 블록의 id */
const nextId = (type: string) => `${type}_${auto++}`;

export const num = (n: number | string, id = nextId("num")): B => ({ type: "math_number", id, fields: { NUM: n } });
export const str = (s: string, id = nextId("text")): B => ({ type: "text", id, fields: { TEXT: s } });
export const varGet = (name: string, id = nextId("get")): B => ({ type: "variables_get", id, fields: { VAR: { id: `var_${name}` } } });
export const varSet = (name: string, value: B, id = nextId("set")): B => ({ type: "variables_set", id, fields: { VAR: { id: `var_${name}` } }, inputs: { VALUE: { block: value } } });
/** 그림자 숫자 칸 */
export const shadowNum = (n: number, id = nextId("shadow")) => ({ shadow: { type: "math_number", id, fields: { NUM: n } } });

/** 명령 블록 배열을 next 체인으로 잇는다 */
export function chain(blocks: B[]): B | undefined {
  const copies = blocks.map((b) => ({ ...b }));
  for (let i = 0; i < copies.length - 1; i++) copies[i].next = { block: copies[i + 1] };
  return copies[0];
}

/** 시작 블록(id "start") 몸통에 body 를 이은 작업판. tops 는 다른 최상위 블록, vars 는 변수 이름 */
export function program(body: B[], extra: { tops?: B[]; vars?: string[]; noStart?: boolean } = {}): LintWorkspaceJson {
  const head = chain(body);
  const start: B = { type: "start_program", id: "start", x: 0, y: 0, ...(head ? { inputs: { BODY: { block: head } } } : {}) };
  return {
    variables: (extra.vars ?? []).map((name) => ({ name, id: `var_${name}` })),
    blocks: { blocks: [...(extra.tops ?? []), ...(extra.noStart ? [] : [start])] },
  };
}

export const pinSetup = (id: string, name: string, pin: number, mode = "OUT"): B => ({ type: "esp_pin_setup", id, fields: { PIN: pin, MODE: mode, VAR: { id: `var_${name}` } } });
export const pinWrite = (id: string, name: string, v: 0 | 1 = 1): B => ({ type: "esp_pin_write", id, fields: { VAR: { id: `var_${name}` }, VALUE: String(v) } });
export const wait = (id: string, sec: number): B => ({ type: "flow_wait", id, inputs: { SEC: { block: num(sec) } } });
export const forever = (id: string, body: B[]): B => {
  const head = chain(body);
  return { type: "flow_repeat_forever", id, ...(head ? { inputs: { DO: { block: head } } } : {}) };
};
