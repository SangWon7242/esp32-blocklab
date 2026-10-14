import { beforeAll, describe, expect, it } from "vitest";
import { registerBlocks } from "@/blocks";
import { workspaceJsonToCode, type WorkspaceJson } from "@/codegen";
import { codeToBlocks } from "./index";
import type { BlockJson } from "./types";

/** 계획 6 Task 1: 판단·계산 블록의 양방향 변환 (블록 → 코드 → 블록 → 같은 코드) */

beforeAll(() => registerBlocks());

type B = Record<string, unknown>;
const num = (n: number): B => ({ type: "math_number", fields: { NUM: n } });
const str = (s: string): B => ({ type: "text", fields: { TEXT: s } });
const v = (name: string): B => ({ type: "variables_get", fields: { VAR: { id: `var_${name}` } } });
const blk = (type: string, fields: B | undefined, inputs: Record<string, B> = {}): B => ({
  type,
  ...(fields ? { fields } : {}),
  inputs: Object.fromEntries(Object.entries(inputs).map(([k, b]) => [k, { block: b }])),
});
const set = (name: string, value: B): B => ({ type: "variables_set", fields: { VAR: { id: `var_${name}` } }, inputs: { VALUE: { block: value } } });

function chain(blocks: B[]): B {
  const [head, ...rest] = blocks.map((b) => ({ ...b }));
  let cur = head;
  for (const b of rest) { cur.next = { block: b }; cur = b; }
  return head;
}

/** 변수 a=3, b=7, word="hello" 를 정한 뒤 x = expr */
function program(expr: B): WorkspaceJson {
  const names = ["a", "b", "word", "x"];
  return {
    variables: names.map((name) => ({ name, id: `var_${name}` })),
    blocks: {
      languageVersion: 0,
      blocks: [{ type: "start_program", x: 0, y: 0, inputs: { BODY: { block: chain([set("a", num(3)), set("b", num(7)), set("word", str("hello")), set("x", expr)]) } } }],
    },
  } as WorkspaceJson;
}
const HEAD = 'a = 3\nb = 7\nword = "hello"\n';

function parse(code: string) {
  const r = codeToBlocks(code);
  if (!r.ok) throw new Error(`parse failed: ${r.error.message}`);
  return r;
}
/** 블록 JSON 을 훑어 블록 종류를 모은다 */
function types(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => types(n, out));
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.type === "string") out.push(o.type);
    Object.values(o).forEach((x) => types(x, out));
  }
  return out;
}
/** 코드의 마지막 문장(x = ...)의 값 블록 */
function lastValue(code: string): BlockJson {
  const start = (parse(code).json.blocks.blocks as BlockJson[]).find((b) => b.type === "start_program");
  let cur = start?.inputs?.BODY?.block;
  while (cur?.next?.block) cur = cur.next.block;
  return cur!.inputs!.VALUE!.block!;
}
const codeToCode = (code: string) => workspaceJsonToCode(parse(code).json);

/** 블록 → 코드 → 블록 → 같은 코드, 되돌아온 블록에 기대한 블록이 있고 code_expr 가 없다 */
function roundTrip(expr: B, expected: string, imports: string[] = []) {
  const code = workspaceJsonToCode(program(expr));
  const head = imports.length ? `${imports.join("\n")}\n\n` : "";
  expect(code).toBe(`${head}${HEAD}x = ${expected}\n`);
  const r = parse(code);
  expect(r.unparsed).toEqual([]);
  const back = types(r.json);
  expect(back).not.toContain("code_expr");
  expect(back).toContain(expr.type);
  expect(workspaceJsonToCode(r.json)).toBe(code);
  return lastValue(code);
}

describe("판단 블록 왕복", () => {
  it("judge_between → LOW <= A <= HIGH", () => {
    const back = roundTrip(blk("judge_between", undefined, { A: v("a"), LOW: num(0), HIGH: num(100) }), "0 <= a <= 100");
    expect(back.type).toBe("judge_between");
    expect(back.inputs?.LOW?.block).toEqual({ type: "math_number", fields: { NUM: 0 } });
    expect(back.inputs?.A?.block?.type).toBe("variables_get");
    expect(back.inputs?.HIGH?.block).toEqual({ type: "math_number", fields: { NUM: 100 } });
  });
  it("judge_between 칸에 계산이 들어와도 괄호 없이, 비교가 들어오면 괄호", () => {
    roundTrip(blk("judge_between", undefined, { A: blk("calc_arith", { OP: "ADD" }, { A: v("a"), B: num(1) }), LOW: num(-5), HIGH: v("b") }), "-5 <= a + 1 <= b");
  });
  it("judge_contains → ITEM in CONTAINER", () => {
    const back = roundTrip(blk("judge_contains", undefined, { CONTAINER: v("word"), ITEM: str("e") }), '"e" in word');
    expect(back.inputs?.ITEM?.block).toEqual({ type: "text", fields: { TEXT: "e" } });
    expect(back.inputs?.CONTAINER?.block?.type).toBe("variables_get");
  });
  it("아니다(judge_contains) → ITEM not in CONTAINER", () => {
    const back = roundTrip(blk("logic_negate", undefined, { BOOL: blk("judge_contains", undefined, { CONTAINER: v("word"), ITEM: str("z") }) }), '"z" not in word');
    expect(back.type).toBe("logic_negate");
    expect(back.inputs?.BOOL?.block?.type).toBe("judge_contains");
  });
  it("not x in xs 도 같은 블록이 되고 x not in xs 로 쓴다", () => {
    expect(codeToCode(`${HEAD}x = not "z" in word\n`)).toBe(`${HEAD}x = "z" not in word\n`);
  });
  it("다른 아니다 블록은 그대로 not ...", () => {
    roundTrip(blk("logic_negate", undefined, { BOOL: blk("logic_compare", { OP: "LT" }, { A: v("a"), B: v("b") }) }), "not a < b");
  });
});

describe("계산 블록 왕복", () => {
  it("calc_arith ^ → A ** B", () => {
    const back = roundTrip(blk("calc_arith", { OP: "POW" }, { A: v("a"), B: num(2) }), "a ** 2");
    expect(back.fields).toEqual({ OP: "POW" });
  });
  it("** 는 오른쪽부터 묶는다: 오른쪽 ** 는 괄호 없이, 왼쪽 ** 는 괄호", () => {
    const pow = (a: B, b: B) => blk("calc_arith", { OP: "POW" }, { A: a, B: b });
    roundTrip(pow(num(2), pow(num(3), num(2))), "2 ** 3 ** 2");
    roundTrip(pow(pow(num(2), num(3)), num(2)), "(2 ** 3) ** 2");
    roundTrip(pow(num(-2), num(2)), "(-2) ** 2");
    roundTrip(pow(blk("calc_arith", { OP: "ADD" }, { A: v("a"), B: v("b") }), num(2)), "(a + b) ** 2");
    roundTrip(blk("calc_arith", { OP: "MULTIPLY" }, { A: num(2), B: pow(v("a"), num(2)) }), "2 * a ** 2");
    roundTrip(pow(v("a"), blk("calc_arith", { OP: "MULTIPLY" }, { A: num(2), B: v("b") })), "a ** (2 * b)");
  });
  it("calc_random → random.randint(A, B) + import random", () => {
    roundTrip(blk("calc_random", undefined, { A: num(1), B: num(6) }), "random.randint(1, 6)", ["import random"]);
  });
  it("calc_round 의 다섯 가지 (math.* 일 때만 import math)", () => {
    const round = (op: string) => blk("calc_round", { OP: op }, { X: v("a") });
    expect(roundTrip(round("ROUND"), "round(a)").fields).toEqual({ OP: "ROUND" });
    expect(roundTrip(round("ABS"), "abs(a)").fields).toEqual({ OP: "ABS" });
    expect(roundTrip(round("FLOOR"), "math.floor(a)", ["import math"]).fields).toEqual({ OP: "FLOOR" });
    expect(roundTrip(round("CEIL"), "math.ceil(a)", ["import math"]).fields).toEqual({ OP: "CEIL" });
    expect(roundTrip(round("SQRT"), "math.sqrt(a)", ["import math"]).fields).toEqual({ OP: "SQRT" });
  });
  it("calc_minmax → max(A, B) / min(A, B)", () => {
    expect(roundTrip(blk("calc_minmax", { OP: "MAX" }, { A: v("a"), B: v("b") }), "max(a, b)").fields).toEqual({ OP: "MAX" });
    expect(roundTrip(blk("calc_minmax", { OP: "MIN" }, { A: v("a"), B: num(0) }), "min(a, 0)").fields).toEqual({ OP: "MIN" });
  });
  it("calc_len → len(X)", () => {
    roundTrip(blk("calc_len", undefined, { X: v("word") }), "len(word)");
  });
  it("calc_item → X[INDEX] (식 번호, 음수 번호도)", () => {
    roundTrip(blk("calc_item", undefined, { X: v("word"), INDEX: num(0) }), "word[0]");
    roundTrip(blk("calc_item", undefined, { X: v("word"), INDEX: blk("calc_arith", { OP: "MINUS" }, { A: blk("calc_len", undefined, { X: v("word") }), B: num(1) }) }), "word[len(word) - 1]");
    roundTrip(blk("calc_item", undefined, { X: v("word"), INDEX: num(-1) }), "word[-1]");
  });
  it("calc_ticks → time.ticks_ms() + import time", () => {
    roundTrip(blk("calc_ticks", undefined), "time.ticks_ms()", ["import time"]);
  });
  it("값이 어떤 값이든 되는 n번째 항목은 숫자 칸에도 끼운다", () => {
    roundTrip(blk("calc_round", { OP: "ABS" }, { X: blk("calc_item", undefined, { X: v("word"), INDEX: num(1) }) }), "abs(word[1])");
  });
});

describe("블록이 되지 않는 꼴은 code_expr 로 남는다", () => {
  const cases = [
    "max(a, b, 5)",
    "min(a)",
    "word[1:3]",
    "word[:]",
    "word[1:]",
    "5 < a < 15",
    "0 <= a < 10",
    "0 < a <= 10",
    "0 <= a <= b <= 10",
    "a < b in word",
    '"e" in word < b',
    "round(a, 2)",
    "random.randint(1)",
    "math.floor(a, b)",
    "-a ** 2",
  ];
  for (const expr of cases) {
    it(expr, () => {
      const code = `${HEAD}x = ${expr}\n`;
      const value = lastValue(code);
      expect(value).toEqual({ type: "code_expr", fields: { CODE: expr } });
      // import 줄 없이 쓴 원문이라 import 줄만 더해질 수 있다
      expect(codeToCode(code).endsWith(code)).toBe(true);
    });
  }
});

describe("import 줄은 한 번만", () => {
  it("random·math·time 을 여러 번 써도 한 줄씩, math 를 쓰지 않으면 import math 없음", () => {
    const code = [
      "a = random.randint(1, 6)",
      "b = random.randint(a, 10)",
      "c = math.floor(a) + math.sqrt(b)",
      "d = time.ticks_ms() - time.ticks_ms()",
      "",
    ].join("\n");
    const out = codeToCode(code);
    expect(out).toBe(`import time\nimport math\nimport random\n\n${code}`);
    expect(out.match(/^import random$/gm)).toHaveLength(1);
    expect(out.match(/^import math$/gm)).toHaveLength(1);
    expect(out.match(/^import time$/gm)).toHaveLength(1);
    expect(codeToCode("a = 3\nx = round(a) + abs(a)\n")).toBe("a = 3\nx = round(a) + abs(a)\n");
  });
  it("원문에 있던 import random 은 지우고 다시 만든다 (두 번 생기지 않음)", () => {
    const src = "import random\n\nx = random.randint(1, 6)\n";
    expect(codeToCode(src)).toBe(src);
  });
});

describe("조건 칸에서", () => {
  it("if 10 <= d <= 30: 은 사이인가 블록", () => {
    const src = 'd = 25\nif 10 <= d <= 30:\n    print("near")\n';
    const r = parse(src);
    expect(types(r.json)).toContain("judge_between");
    expect(types(r.json)).not.toContain("code_expr");
    expect(workspaceJsonToCode(r.json)).toBe(src);
  });
  it("while \"q\" not in word: 은 아니다 + 들어 있는가", () => {
    const src = 'word = "abc"\nwhile "q" not in word:\n    word = word + "q"\n';
    const r = parse(src);
    expect(types(r.json)).toEqual(expect.arrayContaining(["logic_negate", "judge_contains"]));
    expect(workspaceJsonToCode(r.json)).toBe(src);
  });
  it("문자열 사이 비교는 숫자 칸에 못 끼우니 식 전체를 code_expr 로", () => {
    const src = 'c = "m"\nx = "a" <= c <= "z"\n';
    expect(lastValue(src)).toEqual({ type: "code_expr", fields: { CODE: '"a" <= c <= "z"' } });
    expect(parse(src).unparsed).toHaveLength(1);
    expect(codeToCode(src)).toBe(src);
  });
});
