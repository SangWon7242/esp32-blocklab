import { beforeAll, describe, expect, it } from "vitest";
import { registerBlocks } from "@/blocks";
import { workspaceJsonToCode } from "@/codegen";
import { codeToBlocks, normalizeCode } from "./index";
import type { BlockJson } from "./types";

/**
 * 장치 도우미 함수(get_distance·set_color·hc595_shift …)의 몸통이 모두 블록이 되도록 더한 블록:
 * 비트 연산(& | >> <<), 마이크로초 시각(time.ticks_us), 걸린 시간(time.ticks_diff(a, b)), 자연로그(math.log),
 * 식을 내보내는 핀 쓰기(x.value(식)), RGB·모터 핀의 0~1023 세기(x.duty(식)).
 */

beforeAll(() => registerBlocks());

function parse(src: string) {
  const r = codeToBlocks(src);
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

/** 블록 → 코드가 원문과 같고 code_stmt·code_expr 가 하나도 없다 */
function roundTrips(src: string): void {
  const r = parse(src);
  expect(r.unparsed).toEqual([]);
  expect(normalizeCode(workspaceJsonToCode(r.json))).toEqual(normalizeCode(src));
}

/** 시작 블록 몸통의 블록들 */
const body = (src: string): BlockJson[] => {
  const start = (parse(src).json.blocks.blocks as BlockJson[]).find((b) => b.type === "start_program") as BlockJson;
  const out: BlockJson[] = [];
  for (let b = start.inputs?.BODY?.block; b; b = b.next?.block) out.push(b);
  return out;
};
const value = (b: BlockJson) => b.inputs?.VALUE?.block;

describe("비트 연산 (calc_arith)", () => {
  it("& | >> << 는 계산 블록, 학생 괄호는 괄호 블록으로 글자 그대로", () => {
    const src = "dat = 79\nbit = 3\nvalue = 1 & (dat >> bit)\ncode = dat | 128\nx = dat << 1\n";
    roundTrips(src);
    const [, , v, c, x] = body(src);
    expect(value(v)).toMatchObject({ type: "calc_arith", fields: { OP: "BITAND" } });
    expect(value(v)?.inputs?.B?.block).toMatchObject({ type: "calc_paren" });
    expect(value(c)).toMatchObject({ type: "calc_arith", fields: { OP: "BITOR" } });
    expect(value(x)).toMatchObject({ type: "calc_arith", fields: { OP: "LSHIFT" } });
  });
  it("파이썬 우선순위대로 괄호를 치지 않거나 친다", () => {
    roundTrips("a = 1\nb = 2\nc = 3\nx = a | b & c\ny = (a | b) & c\nz = a + b >> c\nw = a & b | c\n");
  });
  it("^ (XOR)는 블록의 ^ (거듭제곱)와 헷갈리므로 코드로 남긴다", () => {
    expect(parse("a = 1\nx = a ^ 2\n").unparsed.map((u) => u.text)).toEqual(["a ^ 2"]);
  });
});

describe("시각과 걸린 시간", () => {
  it("time.ticks_us() 는 지금까지 지난 시간(µs), time.ticks_ms() 는 단위 칸 없이(ms)", () => {
    const src = "import time\n\nstart = time.ticks_us()\nnow = time.ticks_ms()\n";
    roundTrips(src);
    const [us, ms] = body(src);
    expect(value(us)).toEqual({ type: "calc_ticks", fields: { UNIT: "US" } });
    expect(value(ms)).toEqual({ type: "calc_ticks" });
  });
  it("time.ticks_diff(stop, start) 는 걸린 시간 블록, ticks_diff(time.ticks_ms(), x) 는 지난 시간 블록 그대로", () => {
    const src = "import time\n\nstart = time.ticks_us()\nstop = time.ticks_us()\nt = time.ticks_diff(stop, start) // 2\ne = time.ticks_diff(time.ticks_ms(), start)\n";
    roundTrips(src);
    const [, , t, e] = body(src);
    expect(value(t)?.inputs?.A?.block).toMatchObject({ type: "calc_ticks_diff" });
    expect(value(e)).toMatchObject({ type: "calc_elapsed" });
  });
});

describe("자연로그 (calc_round LOG)", () => {
  it("math.log(x) 는 calc_round 의 자연로그, import math 가 다시 붙는다", () => {
    const src = "import math\n\nr = 5\nx = 1 / (math.log(r / 10) / 3950 + 1 / 298.15) - 273.15\n";
    roundTrips(src);
    expect(workspaceJsonToCode(parse(src).json)).toBe(src);
  });
});

describe("식을 내보내는 핀 쓰기 (dev_pin_write_value)", () => {
  it("0·1 글자는 켜기·끄기 블록, 식은 값 내보내기 블록", () => {
    const src = "from machine import Pin\n\nsi = Pin(5, Pin.OUT)\nvalue = 1\nsi.value(1)\nsi.value(value)\n";
    roundTrips(src);
    const b = body(src);
    expect(b.map((x) => x.type)).toEqual(["esp_pin_setup", "variables_set", "esp_pin_write", "dev_pin_write_value"]);
  });
});
