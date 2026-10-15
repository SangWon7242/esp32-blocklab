import { beforeAll, describe, expect, it } from "vitest";
import { registerBlocks } from "@/blocks";
import { workspaceJsonToCode, type WorkspaceJson } from "@/codegen";
import { CONTENT } from "@/docs/content";
import { blockLabel, lint } from "@/lint";
import { requiredInputs } from "@/lint/labels";
import { codeToBlocks } from "./index";
import type { BlockJson } from "./types";

/** 계획 11 ①C: 터치 패드·버튼 인터럽트·지난 시간·범위 바꾸기의 양방향 변환 (블록 → 코드 → 블록 → 같은 코드)과 검사 */

beforeAll(() => registerBlocks());

type B = Record<string, unknown>;
const num = (n: number): B => ({ type: "math_number", fields: { NUM: n } });
const v = (name: string): B => ({ type: "variables_get", fields: { VAR: { id: `var_${name}` } } });
const VAR = (name: string) => ({ VAR: { id: `var_${name}` } });
const blk = (type: string, fields: B | undefined, inputs: Record<string, B> = {}): B => ({
  type,
  ...(fields ? { fields } : {}),
  ...(Object.keys(inputs).length ? { inputs: Object.fromEntries(Object.entries(inputs).map(([k, b]) => [k, { block: b }])) } : {}),
});
const print = (value: B): B => blk("esp_print", undefined, { VALUE: value });
const set = (name: string, value: B): B => blk("variables_set", VAR(name), { VALUE: value });
const arith = (a: B, op: string, b: B): B => blk("calc_arith", { OP: op }, { A: a, B: b });

function chain(blocks: B[]): B {
  const [head, ...rest] = blocks.map((b) => ({ ...b }));
  let cur = head;
  for (const b of rest) { cur.next = { block: b }; cur = b; }
  return head;
}

const NAMES = ["button", "touch", "led", "start", "x", "a", "b", "pin", "value", "percent"];
function program(body: B[], tops: B[] = []): WorkspaceJson {
  return {
    variables: NAMES.map((name) => ({ name, id: `var_${name}` })),
    blocks: { languageVersion: 0, blocks: [...tops, { type: "start_program", id: "start", x: 0, y: 0, inputs: { BODY: { block: chain(body) } } }] },
  } as unknown as WorkspaceJson;
}
const toCode = (body: B[], tops: B[] = []) => workspaceJsonToCode(program(body, tops));

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
function body(code: string): BlockJson[] {
  const start = (parse(code).json.blocks.blocks as BlockJson[]).find((b) => b.type === "start_program");
  const out: BlockJson[] = [];
  for (let c = start?.inputs?.BODY?.block; c; c = c.next?.block) out.push(c);
  return out;
}
/** 코드 → 블록 → 같은 코드, unparsed 0, 코드 블록 없음. 되돌린 블록 type 들을 돌려준다 */
function fixedPoint(code: string): string[] {
  const r = parse(code);
  expect(r.unparsed, code).toEqual([]);
  const ts = types(r.json);
  expect(ts, code).not.toContain("code_stmt");
  expect(ts, code).not.toContain("code_expr");
  expect(workspaceJsonToCode(r.json)).toBe(code);
  return ts;
}
const lintCode = (code: string) => lint(parse(code).json as never, null);

describe("터치 패드 (dev_touch_setup · dev_touch_value · dev_touch_pressed)", () => {
  const setup = blk("dev_touch_setup", { PIN: 4, ...VAR("touch") });
  const pressed = (threshold: B) => blk("dev_touch_pressed", VAR("touch"), { THRESHOLD: threshold });

  it("준비 → touch = TouchPad(Pin(4)), machine 에서 TouchPad 를 가져온다", () => {
    const code = toCode([setup, print(blk("dev_touch_value", VAR("touch")))]);
    expect(code).toBe("from machine import Pin, TouchPad\n\ntouch = TouchPad(Pin(4))\n\nprint(touch.read())\n");
    expect(fixedPoint(code)).toEqual(expect.arrayContaining(["dev_touch_setup", "dev_touch_value"]));
    expect(body(code)[0].fields).toEqual({ PIN: 4, ...VAR("touch") });
  });

  it("만졌는가: touch.read() < 기준. 숫자·변수는 그대로, 식은 괄호로 묶어 다시 같은 블록", () => {
    const code = toCode([setup, set("x", num(300)), print(pressed(num(300))), print(pressed(v("x"))), print(pressed(arith(v("x"), "ADD", num(50))))]);
    expect(code).toContain("print(touch.read() < 300)\nprint(touch.read() < x)\nprint(touch.read() < (x + 50))\n");
    const ts = fixedPoint(code);
    expect(ts.filter((t) => t === "dev_touch_pressed")).toHaveLength(3);
    expect(body(code)[4].inputs?.VALUE?.block?.inputs?.THRESHOLD?.block?.type).toBe("calc_arith");
  });

  it("if 조건과 and 안에서도 블록으로, 기준이 비교보다 느슨하게 묶이면 접지 않는다", () => {
    const code = "from machine import Pin, TouchPad\n\ntouch = TouchPad(Pin(4))\n\nif touch.read() < 300 and touch.read() > 10:\n    print(1)\n";
    expect(fixedPoint(code)).toEqual(expect.arrayContaining(["logic_operation", "dev_touch_pressed", "logic_compare", "dev_touch_value"]));
  });

  it("터치 준비가 없으면 x.read() < 300 은 비교 블록", () => {
    expect(body("print(t.read() < 300)\n")[0].inputs?.VALUE?.block?.type).toBe("logic_compare");
    expect(types(parse("print(t.read() < 300)\n").json)).not.toContain("dev_touch_pressed");
  });

  it("검사: 터치 핀이 아니면 pin-rule 주의, 기준이 0~1023 밖이면 value-range 오류", () => {
    const issues = lint(program([blk("dev_touch_setup", { PIN: 5, ...VAR("touch") }), print(pressed(num(2000)))]) as never, null);
    expect(issues.filter((i) => i.id === "pin-rule").map((i) => [i.level, i.ko])).toEqual([["warning", "5번 핀은 터치 핀이 아니에요 (4, 0, 2, 15, 13, 12, 14, 27, 33, 32)"]]);
    expect(issues.filter((i) => i.id === "value-range").map((i) => i.ko)).toEqual(["기준은 0~1023 사이여야 해요"]);
    for (const pin of [4, 0, 2, 15, 13, 12, 14, 27, 33, 32]) {
      expect(lint(program([blk("dev_touch_setup", { PIN: pin, ...VAR("touch") })]) as never, null).filter((i) => i.id === "pin-rule"), String(pin)).toEqual([]);
    }
  });

  it("라벨·빈 칸", () => {
    expect(blockLabel("dev_touch_pressed")).toBe("… 을 만졌는가 (기준 …)");
    expect(requiredInputs("dev_touch_pressed", undefined)).toEqual(["THRESHOLD"]);
  });
});

describe("버튼 인터럽트 (dev_button_irq)", () => {
  const def = (params: string[], stack: B[]): B => ({
    type: "procedures_defnoreturn", x: 0, y: 300,
    fields: { NAME: "on_press" },
    extraState: { params: params.map((p) => ({ name: p, id: `var_${p}` })) },
    inputs: { STACK: { block: chain(stack) } },
  });
  const irq = (name = "on_press") => blk("dev_button_irq", { ...VAR("button"), FUNC: name });
  const buttonSetup = blk("dev_button_setup", { PIN: 14, ...VAR("button") });
  const CODE = [
    "from machine import Pin",
    "",
    "button = Pin(14, Pin.IN, Pin.PULL_UP)",
    "",
    "",
    "def on_press(pin):",
    "    print(\"pressed\")",
    "",
    "",
    "button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)",
    "",
  ].join("\n");

  it("블록 → button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)", () => {
    expect(toCode([buttonSetup, irq()], [def(["pin"], [print({ type: "text", fields: { TEXT: "pressed" } })])])).toBe(CODE);
  });

  it("왕복: 같은 블록, 같은 코드", () => {
    const ts = fixedPoint(CODE);
    expect(ts).toEqual(expect.arrayContaining(["dev_button_setup", "dev_button_irq", "procedures_defnoreturn"]));
    expect(body(CODE)[1].fields).toEqual({ ...VAR("button"), FUNC: "on_press" });
  });

  it("틸트·PIR 처럼 입력 핀 변수에도 쓸 수 있다", () => {
    const code = "from machine import Pin\n\npir = Pin(23, Pin.IN)\n\npir.irq(trigger=Pin.IRQ_FALLING, handler=alarm)\n";
    expect(body(code)[1].type).toBe("dev_button_irq");
  });

  it("글자가 다른 꼴(띄어쓰기·IRQ_RISING·준비 안 된 이름)은 코드로 남는다", () => {
    for (const line of [
      "button.irq(trigger=Pin.IRQ_FALLING, handler = on_press)",
      "button.irq(trigger=Pin.IRQ_RISING, handler=on_press)",
      "button.irq(handler=on_press, trigger=Pin.IRQ_FALLING)",
    ]) expect(types(parse(`from machine import Pin\n\nbutton = Pin(14, Pin.IN, Pin.PULL_UP)\n\n${line}\n`).json), line).not.toContain("dev_button_irq");
    expect(types(parse("b.irq(trigger=Pin.IRQ_FALLING, handler=on_press)\n").json)).not.toContain("dev_button_irq");
  });

  it("검사: 함수가 없으면 오류, 매개변수가 하나가 아니면 오류, 몸통에 기다리기가 있으면 주의", () => {
    const missing = lint(program([buttonSetup, irq("nope")]) as never, null).filter((i) => i.id.startsWith("irq-handler"));
    expect(missing.map((i) => [i.id, i.level, i.ko])).toEqual([["irq-handler-missing", "error", "nope 함수가 없어요. 함수 블록으로 먼저 만들어 주세요"]]);

    const noParam = lint(program([buttonSetup, irq()], [def([], [print(num(1))])]) as never, null).filter((i) => i.id.startsWith("irq-handler"));
    expect(noParam.map((i) => [i.id, i.level])).toEqual([["irq-handler-params", "error"]]);

    const sleepy = lintCode(`${CODE.replace('    print("pressed")', '    print("pressed")\n    time.sleep(0.5)')}`).filter((i) => i.id.startsWith("irq-handler"));
    expect(sleepy.map((i) => [i.id, i.level, i.ko])).toEqual([["irq-handler-sleep", "warning", "인터럽트 함수 안에서는 기다리면 안 돼요"]]);

    expect(lintCode(CODE).filter((i) => i.id.startsWith("irq-handler"))).toEqual([]);
  });

  it("검사: 버튼 준비 없이 쓰면 device-before-setup", () => {
    const issues = lint(program([irq()], [def(["pin"], [print(num(1))])]) as never, null);
    expect(issues.filter((i) => i.id === "device-before-setup")).toHaveLength(1);
  });

  it("라벨", () => {
    expect(blockLabel("dev_button_irq")).toBe("버튼 … 이 눌렸을 때 함수 … 실행하기");
    expect(requiredInputs("dev_button_irq", undefined)).toEqual([]);
  });
});

describe("지난 시간 (calc_elapsed)", () => {
  it("블록 → time.ticks_diff(time.ticks_ms(), start), 왕복", () => {
    const code = toCode([set("start", { type: "calc_ticks" }), print(blk("calc_elapsed", undefined, { X: v("start") }))]);
    expect(code).toBe("import time\n\nstart = time.ticks_ms()\nprint(time.ticks_diff(time.ticks_ms(), start))\n");
    expect(fixedPoint(code)).toEqual(expect.arrayContaining(["calc_ticks", "calc_elapsed"]));
  });
  it("비교·계산 안에서도 괄호 없이", () => {
    const code = toCode([set("start", { type: "calc_ticks" }), print(blk("logic_compare", { OP: "GT" }, { A: blk("calc_elapsed", undefined, { X: v("start") }), B: num(3000) }))]);
    expect(code).toContain("print(time.ticks_diff(time.ticks_ms(), start) > 3000)\n");
    fixedPoint(code);
  });
  it("첫 인자가 time.ticks_ms() 가 아니면 블록이 아니다 (초음파 ticks_diff(stop, start))", () => {
    expect(types(parse("t = time.ticks_diff(stop, start)\n").json)).not.toContain("calc_elapsed");
  });
  it("라벨·빈 칸", () => {
    expect(blockLabel("calc_elapsed")).toBe("… 부터 지난 시간 (ms)");
    expect(requiredInputs("calc_elapsed", undefined)).toEqual(["X"]);
  });
});

describe("범위 바꾸기 (calc_map)", () => {
  const map = (x: B, a: B, b: B, c: B, d: B) => blk("calc_map", undefined, { X: x, A: a, B: b, C: c, D: d });

  it("블록 → ((X - A) * (D - C) // (B - A) + C), 왕복", () => {
    const code = toCode([set("x", num(2048)), set("percent", map(v("x"), num(0), num(4095), num(0), num(100)))]);
    expect(code).toBe("x = 2048\npercent = ((x - 0) * (100 - 0) // (4095 - 0) + 0)\n");
    expect(fixedPoint(code)).toContain("calc_map");
  });

  it("칸에 식이 들어가도(빼기·더하기) 같은 코드로 돌아온다", () => {
    const code = toCode([set("a", num(1)), set("b", num(2)), set("x", map(arith(v("a"), "MINUS", v("b")), arith(v("a"), "ADD", num(1)), num(4095), arith(v("b"), "MINUS", num(1)), num(-180)))]);
    expect(code).toContain("x = ((a - b - (a + 1)) * (-180 - (b - 1)) // (4095 - (a + 1)) + (b - 1))\n");
    expect(fixedPoint(code)).toContain("calc_map");
  });

  it("계산 안에 끼워도 바깥 괄호 하나만", () => {
    const code = toCode([set("x", num(1)), set("a", arith(map(v("x"), num(0), num(10), num(0), num(100)), "MULTIPLY", num(2)))]);
    expect(code).toContain("a = ((x - 0) * (100 - 0) // (10 - 0) + 0) * 2\n");
    expect(fixedPoint(code)).toContain("calc_map");
  });

  it("A 두 곳·C 두 곳의 글자가 다르거나 모양이 다르면 계산 블록들로", () => {
    for (const code of ["x = 1\ny = ((x - 0) * (100 - 0) // (4095 - 1) + 0)\n", "x = 1\ny = ((x - 0) * (100 - 0) // (4095 - 0) + 5)\n", "x = 1\ny = (x - 0) * (100 - 0) // (4095 - 0) + 0\n"]) {
      const r = parse(code);
      expect(r.unparsed, code).toEqual([]);
      expect(types(r.json), code).not.toContain("calc_map");
      expect(workspaceJsonToCode(r.json)).toBe(code);
    }
  });

  it("라벨·빈 칸", () => {
    expect(blockLabel("calc_map")).toBe("… 을(를) …~… 에서 …~… 로 바꾸기");
    expect(requiredInputs("calc_map", undefined)).toEqual(["X", "A", "B", "C", "D"]);
  });
});

describe("블록 사전 예시: 다시 만든 코드도 다시 같은 코드 (수업 파일 꼴)", () => {
  for (const type of ["dev_button_irq", "dev_touch_setup", "dev_touch_value", "dev_touch_pressed", "calc_elapsed", "calc_map"]) {
    it(type, () => {
      const first = parse(CONTENT[type].example.code);
      expect(first.unparsed).toEqual([]);
      const ts = fixedPoint(workspaceJsonToCode(first.json));
      expect(ts).toContain(type === "dev_touch_value" ? "dev_touch_value" : type);
    });
  }
});
