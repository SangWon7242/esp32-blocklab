import { beforeAll, describe, expect, it } from "vitest";
import { registerBlocks } from "@/blocks";
import { workspaceJsonToCode, type WorkspaceJson } from "@/codegen";
import { CONTENT } from "@/docs/content";
import { blockLabel, lint } from "@/lint";
import { requiredInputs } from "@/lint/labels";
import { codeToBlocks } from "./index";

/** 전역 변수 쓰기(var_global, global x): 양방향 변환과 검사 (global-outside-function · global-missing) */

beforeAll(() => registerBlocks());

type B = Record<string, unknown>;
const num = (n: number): B => ({ type: "math_number", fields: { NUM: n } });
const VAR = (name: string) => ({ VAR: { id: `var_${name}` } });
const blk = (type: string, fields: B | undefined, inputs: Record<string, B> = {}): B => ({
  type,
  ...(fields ? { fields } : {}),
  ...(Object.keys(inputs).length ? { inputs: Object.fromEntries(Object.entries(inputs).map(([k, b]) => [k, { block: b }])) } : {}),
});
const set = (name: string, value: B): B => blk("variables_set", VAR(name), { VALUE: value });
const change = (name: string, delta = 1): B => blk("var_change", VAR(name), { DELTA: num(delta) });
const glob = (name: string): B => blk("var_global", VAR(name));

function chain(blocks: B[]): B {
  const [head, ...rest] = blocks.map((b) => ({ ...b }));
  let cur = head;
  for (const b of rest) { cur.next = { block: b }; cur = b; }
  return head;
}
const def = (name: string, params: string[], stack: B[]): B => ({
  type: "procedures_defnoreturn", x: 0, y: 300,
  fields: { NAME: name },
  extraState: { params: params.map((p) => ({ name: p, id: `var_${p}` })) },
  ...(stack.length ? { inputs: { STACK: { block: chain(stack) } } } : {}),
});

const NAMES = ["button", "count", "a", "b", "pin", "total"];
function program(body: B[], tops: B[] = []): WorkspaceJson {
  return {
    variables: NAMES.map((name) => ({ name, id: `var_${name}` })),
    blocks: { languageVersion: 0, blocks: [...tops, { type: "start_program", id: "start", x: 0, y: 0, ...(body.length ? { inputs: { BODY: { block: chain(body) } } } : {}) }] },
  } as unknown as WorkspaceJson;
}

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
/** 코드 → 블록 → 같은 코드, unparsed 0, 코드 블록 없음 */
function fixedPoint(code: string): string[] {
  const r = parse(code);
  expect(r.unparsed, code).toEqual([]);
  const ts = types(r.json);
  expect(ts, code).not.toContain("code_stmt");
  expect(ts, code).not.toContain("code_expr");
  expect(workspaceJsonToCode(r.json)).toBe(code);
  return ts;
}
const issuesOf = (json: WorkspaceJson, prefix = "global-") => lint(json as never, null).filter((i) => i.id.startsWith(prefix));

const COUNTER_SOURCE = [
  "count = 0",
  "",
  "def on_press(pin):",
  "    global count",
  "    count += 1",
  "",
  "button = Pin(14, Pin.IN, Pin.PULL_UP)",
  "button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)",
  "",
].join("\n");

/** 생성기 순서: import → 준비 줄 → def → 시작 블록 몸통 */
const COUNTER = [
  "from machine import Pin",
  "",
  "button = Pin(14, Pin.IN, Pin.PULL_UP)",
  "",
  "",
  "def on_press(pin):",
  "    global count",
  "    count += 1",
  "",
  "",
  "count = 0",
  "button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)",
  "",
].join("\n");

describe("전역 변수 쓰기 (var_global)", () => {
  it("블록 → global count", () => {
    const code = workspaceJsonToCode(program([set("count", num(0))], [def("bump", [], [glob("count"), change("count")])]));
    expect(code).toBe("def bump():\n    global count\n    count += 1\n\n\ncount = 0\n");
    fixedPoint(code);
  });

  it("버튼 세기 프로그램: unparsed 0, 코드 블록 없이 블록이 되고 생성기 순서의 코드로 돌아온다", () => {
    const r = parse(COUNTER_SOURCE);
    expect(r.unparsed).toEqual([]);
    const ts = types(r.json);
    expect(ts).not.toContain("code_stmt");
    expect(ts).toEqual(expect.arrayContaining(["var_global", "var_change", "procedures_defnoreturn", "dev_button_setup", "dev_button_irq"]));
    const regenerated = workspaceJsonToCode(r.json);
    expect(regenerated).toBe(COUNTER);
    // 다시 만든 코드는 고정점 (codeToBlocks → workspaceJsonToCode 가 그대로)
    fixedPoint(regenerated);
    // 검사: 전역 변수 블록이 있으니 global-* 도, 정하지 않은 변수도 없다
    expect(lint(r.json as never, null).filter((i) => i.id.startsWith("global-") || i.id === "undefined-variable" || i.id.startsWith("irq-handler"))).toEqual([]);
  });

  it("global a, b → 블록 둘 (이름마다 하나), 다시 쓰면 한 줄에 하나", () => {
    const r = parse("a = 0\nb = 0\n\ndef f():\n    global a, b\n    a += 1\n    b += 2\n");
    expect(r.unparsed).toEqual([]);
    const fn = (r.json.blocks.blocks as { type: string; inputs?: { STACK?: { block?: unknown } } }[]).find((b) => b.type === "procedures_defnoreturn")!;
    const stack: { type: string; fields?: { VAR?: { id?: string } }; next?: { block: unknown } }[] = [];
    for (let c = fn.inputs?.STACK?.block as (typeof stack)[number] | undefined; c; c = c.next?.block as (typeof stack)[number] | undefined) stack.push(c);
    expect(stack.map((b) => b.type)).toEqual(["var_global", "var_global", "var_change", "var_change"]);
    // 이름은 변수로 등록된다 (정하기 블록과 같은 변수)
    const ids = new Map(((r.json.variables ?? []) as { name: string; id: string }[]).map((v) => [v.name, v.id]));
    expect(stack[0].fields?.VAR?.id).toBe(ids.get("a"));
    expect(stack[1].fields?.VAR?.id).toBe(ids.get("b"));
    const code = workspaceJsonToCode(r.json);
    expect(code).toContain("def f():\n    global a\n    global b\n    a += 1\n    b += 2\n");
    fixedPoint(code);
  });

  it("함수 밖(바깥 줄)의 global 도 블록으로 읽는다 (파이썬은 받지만 검사가 오류로 알린다)", () => {
    const code = "global count\ncount = 0\n";
    expect(fixedPoint(code)).toContain("var_global");
    expect(lint(parse(code).json as never, null).filter((i) => i.id.startsWith("global-")).map((i) => [i.id, i.level])).toEqual([["global-outside-function", "error"]]);
  });

  it("nonlocal 은 블록이 없어 코드로 남는다", () => {
    expect(types(parse("def f():\n    nonlocal x\n").json)).not.toContain("var_global");
  });

  it("검사: 정한 적 없는 변수를 쓰는 것으로 치지 않는다 (정하는 것도 읽는 것도 아니다)", () => {
    // global 만 있고 읽기·바꾸기가 없으면 undefined-variable 없음
    expect(issuesOf(program([], [def("f", [], [glob("total")])]), "undefined-variable")).toEqual([]);
    // global 이 있어도 값을 정한 적이 없으면 바꾸기는 여전히 주의
    expect(issuesOf(program([], [def("f", [], [glob("total"), change("total")])]), "undefined-variable")).toHaveLength(1);
  });

  it("검사 global-outside-function: 함수 밖이면 오류, 함수 안(반복·만약 안이어도)이면 없음", () => {
    const outside = issuesOf(program([glob("count")]));
    expect(outside.map((i) => [i.id, i.level, i.ko, i.en])).toEqual([["global-outside-function", "error", "함수 안에서만 쓸 수 있어요", "'global' outside function"]]);
    const nested = blk("controls_if", undefined, { IF0: { type: "logic_boolean", fields: { BOOL: "TRUE" } }, DO0: glob("count") });
    expect(issuesOf(program([set("count", num(0))], [def("f", [], [nested, change("count")])]), "global-outside-function")).toEqual([]);
  });

  it("검사 global-missing: 바깥과 함수 안에서 같은 변수에 값을 넣는데 전역 변수 블록이 없으면 주의 (함수마다 한 번)", () => {
    const missing = issuesOf(program([set("count", num(0))], [def("f", [], [change("count"), set("count", num(5))])]));
    expect(missing.map((i) => [i.id, i.level, i.ko, i.en])).toEqual([
      ["global-missing", "warning", "함수 안에서 바깥 변수를 바꾸려면 전역 변수 블록이 필요해요", "Warning: assignment to outer variable 'count' without 'global'"],
    ]);
    // 전역 변수 블록이 있으면 없음
    expect(issuesOf(program([set("count", num(0))], [def("f", [], [glob("count"), change("count")])]))).toEqual([]);
    // 다른 함수의 global 은 이 함수에 소용없다
    expect(issuesOf(program([set("count", num(0))], [def("f", [], [glob("count")]), def("g", [], [change("count")])]))).toHaveLength(1);
    // 바깥에서 값을 넣지 않는 이름(함수 안의 지역 변수)은 알리지 않는다
    expect(issuesOf(program([set("a", num(0))], [def("f", [], [set("total", num(0)), change("total")])]))).toEqual([]);
    // 읽기만 하거나 리스트 안을 고치기만 하면 global 이 필요 없다
    const appendOnly = blk("list_append", { VAR: { id: "var_total" } }, { V: num(1) });
    expect(issuesOf(program([{ type: "list_create", fields: VAR("total") }], [def("f", [], [appendOnly])]))).toEqual([]);
    // 리스트를 새로 만들면(이름에 새 값) 알린다
    expect(issuesOf(program([{ type: "list_create", fields: VAR("total") }], [def("f", [], [{ type: "list_create", fields: VAR("total") }])])).map((i) => i.id)).toEqual(["global-missing"]);
  });

  it("라벨·빈 칸·사전 예시", () => {
    expect(blockLabel("var_global")).toBe("전역 변수 … 쓰기");
    expect(requiredInputs("var_global", undefined)).toEqual([]);
    const first = parse(CONTENT.var_global.example.code);
    expect(first.unparsed).toEqual([]);
    expect(fixedPoint(workspaceJsonToCode(first.json))).toContain("var_global");
    expect(lint(first.json as never, null).filter((i) => i.level !== "info" && i.id !== "no-start")).toEqual([]);
  });
});
