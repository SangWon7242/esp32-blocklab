import { beforeAll, describe, expect, it } from "vitest";
import { registerBlocks } from "@/blocks";
import { workspaceJsonToCode, workspaceJsonToCodeWithMap, type WorkspaceJson } from "@/codegen";
import { blockLabel, lint } from "@/lint";
import { requiredInputs } from "@/lint/labels";
import { codeToBlocks } from "./index";
import type { BlockJson } from "./types";

/** 계획 10 Task 2: 변수 핀 준비·거꾸로·걸음 반복의 양방향 변환 (블록 → 코드 → 블록 → 같은 코드)과 검사 */

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
const wait = (sec: number): B => blk("flow_wait", undefined, { SEC: num(sec) });
const pinVar = (pinVarName: string, name: string, mode = "OUT"): B => blk("esp_pin_setup_var", { PINVAR: { id: `var_${pinVarName}` }, MODE: mode, VAR: { id: `var_${name}` } });
const write = (name: string, value: "0" | "1"): B => blk("esp_pin_write", { VAR: { id: `var_${name}` }, VALUE: value });
const pinsList = blk("list_create_from", { ...VAR("pins"), ITEMS: "18, 5, 14, 17, 26" });

function chain(blocks: B[]): B {
  const [head, ...rest] = blocks.map((b) => ({ ...b }));
  let cur = head;
  for (const b of rest) { cur.next = { block: b }; cur = b; }
  return head;
}
const withBody = (type: string, fields: B | undefined, inputs: Record<string, B>, body: B[]): B => blk(type, fields, { ...inputs, DO: chain(body) });

const NAMES = ["pins", "pin", "led", "num", "bit", "n"];
function program(body: B[]): WorkspaceJson {
  return {
    variables: NAMES.map((name) => ({ name, id: `var_${name}` })),
    blocks: { languageVersion: 0, blocks: [{ type: "start_program", id: "start", x: 0, y: 0, inputs: { BODY: { block: chain(body) } } }] },
  } as unknown as WorkspaceJson;
}
const toCode = (body: B[]) => workspaceJsonToCode(program(body));

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
  for (let cur = start?.inputs?.BODY?.block; cur; cur = cur.next?.block) out.push(cur);
  return out;
}
const codeToCode = (code: string) => workspaceJsonToCode(parse(code).json);

describe("변수 핀 준비 (esp_pin_setup_var)", () => {
  const loop = withBody("flow_for_each", VAR("pin"), { LIST: v("pins") }, [pinVar("pin", "led"), write("led", "1"), wait(0.2), write("led", "0")]);
  const code = [
    "from machine import Pin",
    "import time",
    "",
    "pins = [18, 5, 14, 17, 26]",
    "for pin in pins:",
    "    led = Pin(pin, Pin.OUT)",
    "    led.value(1)",
    "    time.sleep(0.2)",
    "    led.value(0)",
    "",
  ].join("\n");

  it("블록 → 코드: 맨 위로 올리지 않고 반복 안 제자리에 쓴다", () => {
    expect(toCode([pinsList, loop])).toBe(code);
  });
  it("코드 → 블록: 반복 변수 pin 으로 준비하고, led 켜기·끄기는 핀 블록 (unparsed 0)", () => {
    const r = parse(code);
    expect(r.unparsed).toEqual([]);
    const [list, each] = body(code);
    expect(list.type).toBe("list_create_from");
    expect(each.type).toBe("flow_for_each");
    const inner = each.inputs!.DO.block!;
    expect(inner).toMatchObject({ type: "esp_pin_setup_var", fields: { PINVAR: { id: "var_pin" }, MODE: "OUT", VAR: { id: "var_led" } } });
    expect(types(inner)).toEqual(["esp_pin_setup_var", "esp_pin_write", "flow_wait", "math_number", "esp_pin_write"]);
    expect(codeToCode(code)).toBe(code);
  });
  it("입력(IN)도, 맨 바깥에서 대입한 변수도 받는다", () => {
    const src = "from machine import Pin\n\nnumber = 14\nbutton = Pin(number, Pin.IN)\nprint(button.value())\n";
    expect(body(src).map((b) => b.type)).toEqual(["variables_set", "esp_pin_setup_var", "esp_print"]);
    expect(types(body(src)[2])).toEqual(["esp_print", "esp_pin_read"]);
    expect(codeToCode(src)).toBe(src);
  });
  it("값이 정해진 적 없는 이름이면 블록으로 바꾸지 않는다 (코드 블록)", () => {
    const src = "from machine import Pin\n\nled = Pin(PIN_NO, Pin.OUT)\n";
    const r = parse(src);
    expect(types(r.json)).not.toContain("esp_pin_setup_var");
    expect(r.unparsed.length).toBeGreaterThan(0);
    expect(codeToCode(src)).toBe(src);
  });
  it("숫자 핀은 그대로 핀 준비 블록 (맨 위로 모인다)", () => {
    expect(body("from machine import Pin\n\nled = Pin(26, Pin.OUT)\n")[0].type).toBe("esp_pin_setup");
  });
  it("코드 지도: 제자리 준비 줄은 그 블록 것", () => {
    const tagged = withBody("flow_for_each", VAR("pin"), { LIST: v("pins") }, [{ ...pinVar("pin", "led"), id: "pv" }, write("led", "1")]);
    const { code: out, map } = workspaceJsonToCodeWithMap(program([pinsList, tagged]));
    const line = out.split("\n").findIndex((l) => l.trim() === "led = Pin(pin, Pin.OUT)") + 1;
    expect(map.blockToLines.pv).toEqual([line]);
  });
  it("검사: 핀 번호를 따지지 않고, led 는 준비된 핀으로 본다", () => {
    const issues = lint(program([pinsList, loop]) as never, null);
    expect(issues.filter((i) => ["pin-rule", "pin-conflict", "device-before-setup", "undefined-variable"].includes(i.id))).toEqual([]);
    expect(blockLabel("esp_pin_setup_var")).toBe("변수 … 번 핀을 … 으로 준비하고 … 이름 붙이기");
  });
});

describe("거꾸로 (list_reversed)", () => {
  const code = "pins = [18, 5, 14, 17, 26]\nfor pin in reversed(pins):\n    print(pin)\n";
  it("for pin in reversed(pins): → 각 항목 반복(거꾸로(pins))", () => {
    const [, each] = body(code);
    expect(each.type).toBe("flow_for_each");
    expect(each.inputs!.LIST.block).toEqual({ type: "list_reversed", inputs: { X: { block: { type: "variables_get", fields: { VAR: { id: "var_pins" } } } } } });
    expect(parse(code).unparsed).toEqual([]);
  });
  it("블록 → 코드 → 블록 → 같은 코드", () => {
    const loop = withBody("flow_for_each", VAR("pin"), { LIST: blk("list_reversed", undefined, { X: v("pins") }) }, [print(v("pin"))]);
    expect(toCode([pinsList, loop])).toBe(code);
    expect(codeToCode(code)).toBe(code);
  });
  it("인자가 둘이면 코드 식", () => {
    expect(types(parse("print(reversed(a, b))\n").json)).toContain("code_expr");
  });
  it("검사 라벨·빈 칸", () => {
    expect(blockLabel("list_reversed")).toBe("… 을(를) 거꾸로");
    expect(requiredInputs("list_reversed", undefined)).toEqual(["X"]);
  });
});

describe("걸음 반복 (flow_for_range_step)", () => {
  const step = (name: string, from: number, to: number, by: number, inner: B[]) => withBody("flow_for_range_step", VAR(name), { FROM: num(from), TO: num(to), STEP: num(by) }, inner);
  for (const [name, from, to, by] of [["num", 9, -1, -1], ["bit", 7, -1, -1], ["n", 0, 10, 2]] as const) {
    const code = `for ${name} in range(${from}, ${to}, ${by}):\n    print(${name})\n`;
    it(`${code.split("\n")[0]} 왕복 (음수는 숫자 블록)`, () => {
      expect(toCode([step(name, from, to, by, [print(v(name))])])).toBe(code);
      const [loop] = body(code);
      expect(loop.type).toBe("flow_for_range_step");
      expect(loop.fields).toEqual(VAR(name));
      expect([loop.inputs!.FROM.block, loop.inputs!.TO.block, loop.inputs!.STEP.block]).toEqual([num(from), num(to), num(by)]);
      expect(parse(code).unparsed).toEqual([]);
      expect(codeToCode(code)).toBe(code);
    });
  }
  it("식 칸도 받는다", () => {
    const code = "n = 3\nfor i in range(n * 2, 0, -1):\n    print(i)\n";
    expect(types(parse(code).json)).not.toContain("code_expr");
    expect(codeToCode(code)).toBe(code);
  });
  it("멈추기는 반복 안, 검사 라벨·빈 칸", () => {
    const loop = { ...step("n", 0, 10, 2, [blk("flow_break", undefined)]), id: "loop" };
    expect(lint(program([loop]) as never, null).filter((i) => i.id === "break-outside-loop")).toEqual([]);
    expect(blockLabel("flow_for_range_step")).toBe("… 을(를) … 부터 … 전까지 … 씩 바꾸며 반복");
    expect(requiredInputs("flow_for_range_step", undefined)).toEqual(["FROM", "TO", "STEP"]);
  });
});

describe("4장 흐르는 불빛 꼴 전체", () => {
  it("리스트·변수 핀 준비·거꾸로 반복이 코드 블록 없이 돌아온다", () => {
    const src = [
      "from machine import Pin",
      "import time",
      "",
      "pins = [18, 5, 14, 17, 26]",
      "for pin in pins:",
      "    led = Pin(pin, Pin.OUT)",
      "    led.value(1)",
      "    time.sleep(0.2)",
      "    led.value(0)",
      "for pin in reversed(pins):",
      "    led = Pin(pin, Pin.OUT)",
      "    led.value(1)",
      "    time.sleep(0.2)",
      "    led.value(0)",
      "",
    ].join("\n");
    const r = parse(src);
    expect(r.unparsed).toEqual([]);
    const t = types(r.json);
    expect(t).not.toContain("code_stmt");
    expect(t).not.toContain("code_expr");
    expect(codeToCode(src)).toBe(src);
  });
});
