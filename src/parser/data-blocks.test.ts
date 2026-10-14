import { beforeAll, describe, expect, it } from "vitest";
import { registerBlocks } from "@/blocks";
import { workspaceJsonToCode, type WorkspaceJson } from "@/codegen";
import { codeToBlocks } from "./index";
import type { BlockJson } from "./types";

/** 계획 6 Task 2: 변수 바꾸기·리스트·흐름 추가 블록의 양방향 변환 (블록 → 코드 → 블록 → 같은 코드) */

beforeAll(() => registerBlocks());

type B = Record<string, unknown>;
const num = (n: number): B => ({ type: "math_number", fields: { NUM: n } });
const str = (s: string): B => ({ type: "text", fields: { TEXT: s } });
const v = (name: string): B => ({ type: "variables_get", fields: { VAR: { id: `var_${name}` } } });
const VAR = (name: string) => ({ VAR: { id: `var_${name}` } });
const blk = (type: string, fields: B | undefined, inputs: Record<string, B> = {}): B => ({
  type,
  ...(fields ? { fields } : {}),
  inputs: Object.fromEntries(Object.entries(inputs).map(([k, b]) => [k, { block: b }])),
});
const set = (name: string, value: B): B => blk("variables_set", VAR(name), { VALUE: value });
const print = (value: B): B => blk("esp_print", undefined, { VALUE: value });

function chain(blocks: B[]): B {
  const [head, ...rest] = blocks.map((b) => ({ ...b }));
  let cur = head;
  for (const b of rest) { cur.next = { block: b }; cur = b; }
  return head;
}

const NAMES = ["items", "item", "count", "x", "i", "word"];
function program(body: B[]): WorkspaceJson {
  return {
    variables: NAMES.map((name) => ({ name, id: `var_${name}` })),
    blocks: { languageVersion: 0, blocks: [{ type: "start_program", x: 0, y: 0, inputs: { BODY: { block: chain(body) } } }] },
  } as WorkspaceJson;
}
const withBody = (type: string, fields: B | undefined, inputs: Record<string, B>, body: B[]): B => blk(type, fields, { ...inputs, DO: chain(body) });

function parse(code: string) {
  const r = codeToBlocks(code);
  if (!r.ok) throw new Error(`parse failed: ${r.error.message}`);
  return r;
}
function types(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => types(n, out));
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.type === "string") out.push(o.type);
    Object.values(o).forEach((x) => types(x, out));
  }
  return out;
}
/** 시작 블록 몸통의 문장 블록들 */
function body(code: string): BlockJson[] {
  const start = (parse(code).json.blocks.blocks as BlockJson[]).find((b) => b.type === "start_program");
  const out: BlockJson[] = [];
  for (let cur = start?.inputs?.BODY?.block; cur; cur = cur.next?.block) out.push(cur);
  return out;
}
const codeToCode = (code: string) => workspaceJsonToCode(parse(code).json);

/** 블록 → 정확한 코드 → 블록(기대한 블록이 있고 code_stmt·code_expr·unparsed 없음) → 같은 코드 */
function roundTrip(blocks: B[], expected: string, expectTypes: string[]) {
  const code = workspaceJsonToCode(program(blocks));
  expect(code).toBe(expected);
  const r = parse(code);
  expect(r.unparsed).toEqual([]);
  const back = types(r.json);
  expect(back).not.toContain("code_stmt");
  expect(back).not.toContain("code_expr");
  for (const t of expectTypes) expect(back, t).toContain(t);
  expect(workspaceJsonToCode(r.json)).toBe(code);
}

const ITEMS = blk("list_create_from", { ...VAR("items"), ITEMS: "1, 2, 3" });
const HEAD = "items = [1, 2, 3]\n";

describe("변수 만큼 바꾸기", () => {
  it("count += 1, 식 칸도", () => {
    roundTrip([set("count", num(0)), blk("var_change", VAR("count"), { DELTA: num(1) })], "count = 0\ncount += 1\n", ["var_change"]);
    roundTrip([set("count", num(0)), blk("var_change", VAR("count"), { DELTA: num(-2) })], "count = 0\ncount += -2\n", ["var_change"]);
    roundTrip(
      [set("count", num(0)), set("x", num(3)), blk("var_change", VAR("count"), { DELTA: blk("calc_arith", { OP: "MULTIPLY" }, { A: v("x"), B: num(2) }) })],
      "count = 0\nx = 3\ncount += x * 2\n",
      ["var_change", "calc_arith"],
    );
  });

  it("코드의 count += 1 은 var_change, 칸은 숫자 블록", () => {
    const [, change] = body("count = 0\ncount += 1\n");
    expect(change).toEqual({ type: "var_change", fields: VAR("count"), inputs: { DELTA: { block: num(1) } } });
  });

  it("반례: -= · *= · 항목 += 는 code_stmt (코드는 그대로)", () => {
    for (const src of ["x = 5\nx -= 1\n", "x = 5\nx *= 2\n", "items = [1, 2, 3]\nitems[0] += 1\n"]) {
      const r = parse(src);
      expect(types(r.json), src).toContain("code_stmt");
      expect(types(r.json), src).not.toContain("var_change");
      expect(codeToCode(src)).toBe(src);
    }
  });

  it("글자를 더하면 칸만 식 블록 (코드는 그대로)", () => {
    const src = 'word = "a"\nword += "b"\n';
    const [, change] = body(src);
    expect(change.type).toBe("var_change");
    expect(change.inputs?.DELTA?.block?.type).toBe("code_expr");
    expect(codeToCode(src)).toBe(src);
  });
});

describe("리스트 블록 왕복", () => {
  it("만들기: 빈 리스트 · 항목으로", () => {
    roundTrip([blk("list_create", VAR("items"))], "items = []\n", ["list_create"]);
    roundTrip([ITEMS], HEAD, ["list_create_from"]);
    roundTrip([blk("list_create_from", { ...VAR("items"), ITEMS: '"red", "green"' })], 'items = ["red", "green"]\n', ["list_create_from"]);
  });

  it("항목 칸은 대괄호 안 원문 (앞뒤 공백만 뗀다), 비면 빈 리스트", () => {
    expect(body("items = [ 1,2 ,3 ]\n")[0]).toEqual({ type: "list_create_from", fields: { ...VAR("items"), ITEMS: "1,2 ,3" } });
    expect(body("items = [ ]\n")[0]).toEqual({ type: "list_create", fields: VAR("items") });
    roundTrip([blk("list_create_from", { ...VAR("items"), ITEMS: "  " })], "items = []\n", ["list_create"]);
  });

  it("추가 · 끼우기 · 번째 지우기 · 값 지우기 · 비우기 · 정하기", () => {
    roundTrip([ITEMS, blk("list_append", VAR("items"), { V: num(4) })], `${HEAD}items.append(4)\n`, ["list_append"]);
    roundTrip([ITEMS, blk("list_insert", VAR("items"), { I: num(0), V: num(5) })], `${HEAD}items.insert(0, 5)\n`, ["list_insert"]);
    roundTrip([ITEMS, blk("list_remove_at", VAR("items"), { I: num(1) })], `${HEAD}items.pop(1)\n`, ["list_remove_at"]);
    roundTrip([ITEMS, blk("list_remove_value", VAR("items"), { V: num(3) })], `${HEAD}items.remove(3)\n`, ["list_remove_value"]);
    roundTrip([ITEMS, blk("list_clear", VAR("items"))], `${HEAD}items.clear()\n`, ["list_clear"]);
    roundTrip([ITEMS, blk("list_set", VAR("items"), { I: num(0), V: num(10) })], `${HEAD}items[0] = 10\n`, ["list_set"]);
    roundTrip(
      [ITEMS, set("x", num(1)), blk("list_set", VAR("items"), { I: blk("calc_arith", { OP: "ADD" }, { A: v("x"), B: num(1) }), V: str("a") })],
      `${HEAD}x = 1\nitems[x + 1] = "a"\n`,
      ["list_set"],
    );
  });

  it("위치 (값 블록, 숫자 칸에도)", () => {
    roundTrip([ITEMS, print(blk("list_index", VAR("items"), { V: num(3) }))], `${HEAD}print(items.index(3))\n`, ["list_index"]);
    roundTrip(
      [ITEMS, set("x", blk("calc_arith", { OP: "ADD" }, { A: blk("list_index", VAR("items"), { V: num(2) }), B: num(1) }))],
      `${HEAD}x = items.index(2) + 1\n`,
      ["list_index", "calc_arith"],
    );
    roundTrip([ITEMS, blk("flow_wait", undefined, { SEC: blk("list_index", VAR("items"), { V: num(2) }) })], `import time\n\n${HEAD}time.sleep(items.index(2))\n`, ["list_index"]);
  });

  it("공용 블록: n번째 항목 · 길이 · 들어 있는가 를 리스트 변수에", () => {
    roundTrip(
      [ITEMS, print(blk("calc_item", undefined, { X: v("items"), INDEX: num(0) })), print(blk("calc_len", undefined, { X: v("items") }))],
      `${HEAD}print(items[0])\nprint(len(items))\n`,
      ["calc_item", "calc_len"],
    );
    roundTrip([ITEMS, print(blk("judge_contains", undefined, { CONTAINER: v("items"), ITEM: num(3) }))], `${HEAD}print(3 in items)\n`, ["judge_contains"]);
  });

  it("코드의 리스트 문장이 그 블록이 되고 변수 칸이 리스트를 가리킨다", () => {
    const src = `${HEAD}items.append(4)\nitems.insert(0, 5)\nitems.pop(0)\nitems.remove(4)\nitems.clear()\nitems[0] = 1\n`;
    const b = body(src);
    expect(b.map((x) => x.type)).toEqual(["list_create_from", "list_append", "list_insert", "list_remove_at", "list_remove_value", "list_clear", "list_set"]);
    for (const x of b) expect(x.fields?.VAR).toEqual({ id: "var_items" });
    expect(parse(src).json.variables).toEqual([{ name: "items", id: "var_items" }]);
    expect(codeToCode(src)).toBe(src);
  });

  it("반례: 장치 변수의 메서드는 리스트 블록이 아니다", () => {
    const src = "from machine import Pin\n\nled = Pin(26, Pin.OUT)\n\nled.pop(0)\nx = led.index(3)\nled.clear()\n";
    const t = types(parse(src).json);
    for (const type of ["list_remove_at", "list_index", "list_clear"]) expect(t, type).not.toContain(type);
    expect(codeToCode(src)).toBe(src);
  });

  it("반례: 고정 이름 장치·모듈 이름(oled, time)의 메서드도 리스트 블록이 아니다", () => {
    for (const src of ["oled.clear()\n", "x = oled.index(1)\n", "time.clear()\n"]) {
      const t = types(parse(src).json);
      expect(t.some((x) => x.startsWith("list_")), src).toBe(false);
    }
  });

  it("반례: 인자 수가 다른 메서드 · 식 속 pop · 슬라이스·겹친 번째에 정하기 · 여러 줄 리스트", () => {
    const cases: [string, string][] = [
      [`${HEAD}items.pop()\n`, "code_stmt"],
      [`${HEAD}items.append(1, 2)\n`, "code_stmt"],
      [`${HEAD}x = items.pop(0)\n`, "code_expr"],
      [`${HEAD}items[0:2] = [9]\n`, "code_stmt"],
      [`${HEAD}x = [items]\nx[0][1] = 3\n`, "code_stmt"],
      ["items = [\n    1,\n    2,\n]\n", "code_expr"],
    ];
    for (const [src, fallback] of cases) {
      expect(types(parse(src).json), src).toContain(fallback);
      expect(codeToCode(src), src).toBe(src);
    }
  });
});

describe("사전(d[\"k\"]) 은 n번째 리스트 블록이 아니다", () => {
  it('d["k"] = 1 · d.pop("k") · d.insert("k", 2) 는 code_stmt 로 원문 그대로 (표시는 문장마다 하나)', () => {
    for (const line of ['d["k"] = 1', 'd.pop("k")', 'd.insert("k", 2)']) {
      const src = `d = {"k": 1}\n${line}\n`;
      const r = parse(src);
      const t = types(r.json);
      expect(t, src).toContain("code_stmt");
      expect(t.some((x) => x.startsWith("list_")), src).toBe(false);
      expect(r.unparsed.length, src).toBe(2);
      expect(codeToCode(src), src).toBe(src);
    }
  });

  it("숫자 번호는 그대로 리스트 블록", () => {
    expect(body(`${HEAD}items[1] = 5\n`)[1].type).toBe("list_set");
    expect(body(`${HEAD}items.pop(0)\n`)[1].type).toBe("list_remove_at");
    expect(body(`${HEAD}items.insert(0, 5)\n`)[1].type).toBe("list_insert");
    expect(body(`${HEAD}x = 1\nitems[x] = 5\n`)[2].type).toBe("list_set");
  });
});

describe("흐름 추가 블록 왕복", () => {
  it("각 항목 반복: 몸통의 반복 변수는 변수 블록", () => {
    roundTrip(
      [ITEMS, withBody("flow_for_each", VAR("item"), { LIST: v("items") }, [print(v("item"))])],
      `${HEAD}for item in items:\n    print(item)\n`,
      ["flow_for_each"],
    );
    roundTrip([withBody("flow_for_each", VAR("x"), { LIST: str("abc") }, [print(v("x"))])], 'for x in "abc":\n    print(x)\n', ["flow_for_each"]);
    const [, loop] = body(`${HEAD}for item in items:\n    print(item)\n`);
    expect(loop.type).toBe("flow_for_each");
    expect(loop.fields).toEqual(VAR("item"));
    expect(loop.inputs?.DO?.block?.inputs?.VALUE?.block).toEqual(v("item"));
  });

  it("범위 반복: range(FROM, TO), 반복 변수가 i 여도", () => {
    roundTrip([withBody("flow_for_range", VAR("x"), { FROM: num(1), TO: num(6) }, [print(v("x"))])], "for x in range(1, 6):\n    print(x)\n", ["flow_for_range"]);
    roundTrip([withBody("flow_for_range", VAR("i"), { FROM: num(2), TO: num(5) }, [print(v("i"))])], "for i in range(2, 5):\n    print(i)\n", ["flow_for_range"]);
    expect(body("for i in range(2, 5):\n    print(i)\n")[0].type).toBe("flow_for_range");
  });

  it("for x in range(3) (i 가 아닌 변수) → 범위 반복 FROM 0, 코드는 range(0, 3) 으로", () => {
    const [loop] = body("for x in range(3):\n    print(x)\n");
    expect(loop.type).toBe("flow_for_range");
    expect(loop.inputs?.FROM?.block).toEqual(num(0));
    expect(loop.inputs?.TO?.block).toEqual(num(3));
    expect(codeToCode("for x in range(3):\n    print(x)\n")).toBe("for x in range(0, 3):\n    print(x)\n");
  });

  it("for i in range(3) 은 여전히 n번 반복", () => {
    const [loop] = body("for i in range(3):\n    print(i)\n");
    expect(loop.type).toBe("flow_repeat_n");
    expect(codeToCode("for i in range(3):\n    print(i)\n")).toBe("for i in range(3):\n    print(i)\n");
  });

  it("멈추기 · 건너뛰기", () => {
    const ifThen = (cond: B, then: B[]): B => blk("controls_if", undefined, { IF0: cond, DO0: chain(then) });
    const eq = (a: B, b: B) => blk("logic_compare", { OP: "EQ" }, { A: a, B: b });
    roundTrip(
      [withBody("flow_for_range", VAR("x"), { FROM: num(0), TO: num(10) }, [ifThen(eq(v("x"), num(3)), [blk("flow_continue", undefined)]), ifThen(eq(v("x"), num(5)), [blk("flow_break", undefined)]), print(v("x"))])],
      "for x in range(0, 10):\n    if x == 3:\n        continue\n    if x == 5:\n        break\n    print(x)\n",
      ["flow_break", "flow_continue"],
    );
    roundTrip([withBody("flow_repeat_forever", undefined, {}, [blk("flow_break", undefined)])], "while True:\n    break\n", ["flow_break"]);
  });

  it("반례: range 의 step · 여러 반복 변수 · else 절은 code_stmt", () => {
    for (const src of ["for x in range(0, 10, 2):\n    print(x)\n", "for a, b in items:\n    print(a)\n", `${HEAD}for item in items:\n    print(item)\nelse:\n    print(0)\n`]) {
      expect(types(parse(src).json), src).toContain("code_stmt");
      expect(codeToCode(src), src).toBe(src);
    }
  });

  it("반례: for x in a, b: (콤마로 여러 개) 는 첫 항목만 남기지 않고 code_stmt 로 원문 그대로", () => {
    for (const src of ['for c in "red", "green":\n    print(c)\n', "for x in 1, 2, 3:\n    print(x)\n", `${HEAD}for x in items,:\n    print(x)\n`]) {
      const t = types(parse(src).json);
      expect(t, src).toContain("code_stmt");
      expect(t, src).not.toContain("flow_for_each");
      expect(codeToCode(src), src).toBe(src);
    }
    expect(body(`${HEAD}for x in items:\n    print(x)\n`)[1].type).toBe("flow_for_each");
  });

  it("반복 변수는 반복 뒤에서 읽어도 변수 블록 (변수 표에 등록된다)", () => {
    const src = "for x in range(0, 3):\n    print(x)\nprint(x)\n";
    expect(types(parse(src).json)).not.toContain("code_expr");
    expect(parse(src).json.variables).toEqual([{ name: "x", id: "var_x" }]);
  });
});
