import type { SyntaxNode } from "@lezer/common";
import { bodyStatements, children, operands } from "./tree";
import { normalizeCode } from "./normalize";
import type { ParseContext } from "./context";

export const STANDARD_GET_DISTANCE = [
  "trig.value(1)", "time.sleep_us(10)", "trig.value(0)", "while not echo.value():", "pass",
  "start = time.ticks_us()", "while echo.value():", "pass", "stop = time.ticks_us()",
  "t = time.ticks_diff(stop, start) // 2", "return int(340 * t // 10000)",
];
export const STANDARD_SHOW = ["oled.fill(0)", "oled.text(a, 0, 20)", "oled.text(b, 0, 36)", "oled.show()"];

export const RE_PIN_SETUP = /^(\w+)\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.(OUT|IN)\s*\)$/;
export const RE_PWM_SETUP = /^(\w+)\s*=\s*PWM\(\s*Pin\(\s*(\d+)\s*\)\s*\)$/;
export const RE_FREQ = /^(\w+)\.freq\(\s*(\d+)\s*\)$/;
export const RE_DUTY = /^(\w+)\.duty_u16\(\s*(\d+)\s*\)$/;
export const RE_I2C_SETUP = /^i2c\s*=\s*SoftI2C\(\s*scl\s*=\s*Pin\(\s*(\d+)\s*\)\s*,\s*sda\s*=\s*Pin\(\s*(\d+)\s*\)\s*\)$/;
export const RE_OLED_SETUP = /^oled\s*=\s*ssd1306\.SSD1306_I2C\(\s*128\s*,\s*64\s*,\s*i2c\s*\)$/;
export const RE_KNOWN_IMPORT = /^(from\s+machine\s+import\s+[\w,\s]+|import\s+time|import\s+ssd1306)$/;

/** 함수 몸통의 문장들을 주석 없이, 들여쓰기 없이 한 줄씩 */
export function bodyLines(body: SyntaxNode, ctx: ParseContext): string[] {
  return bodyStatements(body).flatMap((s) => normalizeCode(ctx.src.slice(s)).map((l) => l.trim()));
}

export function isStandardBody(body: SyntaxNode, ctx: ParseContext, standard: string[]): boolean {
  const lines = bodyLines(body, ctx);
  return lines.length === standard.length && lines.every((l, i) => l === standard[i]);
}

const SIMPLE_PARAM_TOKENS = new Set(["(", ")", ",", "VariableName"]);

/** simple 은 매개변수가 이름뿐인지(기본값·*args·**kw 없음). 아니면 함수 블록으로 옮길 수 없다. */
export function functionParts(def: SyntaxNode, ctx: ParseContext): { name: string; params: string[]; body: SyntaxNode | null; simple: boolean } {
  const kids = children(def);
  const nameNode = kids.find((k) => k.name === "VariableName");
  const paramList = kids.find((k) => k.name === "ParamList");
  const body = kids.find((k) => k.name === "Body") ?? null;
  const params = paramList ? children(paramList).filter((p) => p.name === "VariableName").map((p) => ctx.src.slice(p)) : [];
  const simple = !paramList || children(paramList).every((p) => SIMPLE_PARAM_TOKENS.has(p.name));
  return { name: nameNode ? ctx.src.slice(nameNode) : "", params, body, simple };
}

/** 몸통의 마지막 문장이 값을 돌려주는 return 인지. 정의 블록 종류와 호출 블록 종류가 이 기준 하나를 함께 쓴다. */
export function returnsValue(body: SyntaxNode | null): boolean {
  const stmts = body ? bodyStatements(body) : [];
  const last = stmts[stmts.length - 1];
  return last?.name === "ReturnStatement" && operands(last).length > 0;
}
