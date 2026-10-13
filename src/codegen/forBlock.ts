import type * as Blockly from "blockly";
import { Order } from "blockly/python";
import type { MicroPythonGenerator } from "./generator";
import { registerDeviceGenerators } from "@/devices/toCodegen";

type Gen = MicroPythonGenerator;
const value = (block: Blockly.Block, gen: Gen, name: string, order = Order.NONE, fallback = "0") => gen.valueToCode(block, name, order) || fallback;
const branch = (block: Blockly.Block, gen: Gen, name: string) => gen.statementToCode(block, name) || gen.PASS;

const ARITH: Record<string, [string, number]> = {
  ADD: ["+", Order.ADDITIVE], MINUS: ["-", Order.ADDITIVE],
  MULTIPLY: ["*", Order.MULTIPLICATIVE], DIVIDE: ["/", Order.MULTIPLICATIVE],
  FLOORDIV: ["//", Order.MULTIPLICATIVE], MOD: ["%", Order.MULTIPLICATIVE],
};

/**
 * 왼쪽은 같은 우선순위에 괄호를 치지 않도록 order + 1, 오른쪽은 그대로.
 * (Blockly 는 비교 전에 두 order 를 내림하므로 0.1 로는 부족하다. order + 1 은 한 단계 낮은
 * 우선순위만 괄호로 감싼다.)
 */
function binary(block: Blockly.Block, gen: Gen, symbol: string, order: number): [string, number] {
  const a = value(block, gen, "A", order + 1);
  const b = value(block, gen, "B", order);
  return [`${a} ${symbol} ${b}`, order];
}

/** 이름·속성 연결(a.b) 이거나, 첫 `(` 가 맨 끝 `)` 와 짝을 이루는 호출 하나인지 */
function isSimpleCallOrName(text: string): boolean {
  if (/^[A-Za-z_][\w.]*$/.test(text)) return true;
  const head = /^[A-Za-z_][\w.]*\(/.exec(text);
  if (!head) return false;
  let depth = 0;
  for (let i = head[0].length - 1; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i === text.length - 1;
  }
  return false;
}

export function registerForBlocks(gen: Gen): void {
  const f = gen.forBlock;

  f["start_program"] = (block, g) => {
    const first = block.getInputTargetBlock("BODY");
    return first ? (g.blockToCode(first) as string) : "";
  };

  f["flow_repeat_forever"] = (block, g) => `while True:\n${branch(block, g as Gen, "DO")}`;
  f["flow_repeat_n"] = (block, g) => `for i in range(${value(block, g as Gen, "TIMES")}):\n${branch(block, g as Gen, "DO")}`;
  f["flow_wait"] = (block, g) => `time.sleep(${value(block, g as Gen, "SEC")})\n`;
  f["flow_wait_ms"] = (block, g) => `time.sleep_ms(${value(block, g as Gen, "MS")})\n`;
  f["flow_wait_us"] = (block, g) => `time.sleep_us(${value(block, g as Gen, "US")})\n`;

  f["calc_arith"] = (block, g) => {
    const [symbol, order] = ARITH[block.getFieldValue("OP")] ?? ARITH.ADD;
    return binary(block, g as Gen, symbol, order);
  };
  f["calc_concat"] = (block, g) => binary(block, g as Gen, "+", Order.ADDITIVE);
  f["calc_str"] = (block, g) => [`str(${value(block, g as Gen, "X")})`, Order.FUNCTION_CALL];
  f["calc_int"] = (block, g) => [`int(${value(block, g as Gen, "X")})`, Order.FUNCTION_CALL];

  // 내장 text 는 작은따옴표를 쓰므로 큰따옴표로 바꾼다
  f["text"] = (block) => {
    const raw = String(block.getFieldValue("TEXT"));
    const escaped = raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
    return [`"${escaped}"`, Order.ATOMIC];
  };

  // 내장 함수 정의는 global 선언을 넣으므로 덮어쓴다
  const defGenerator = (block: Blockly.Block, g: Gen) => {
    const name = g.getProcedureName(block.getFieldValue("NAME"));
    const params = block.getVarModels().map((v) => g.getVariableName(v.getId()));
    let body = g.statementToCode(block, "STACK");
    const ret = block.getInput("RETURN") ? g.valueToCode(block, "RETURN", Order.NONE) : "";
    const returnLine = ret ? `${g.INDENT}return ${ret}\n` : "";
    if (!body && !returnLine) body = g.PASS;
    const code = `def ${name}(${params.join(", ")}):\n${body}${returnLine}`;
    g.setDefinition(`%${name}`, g.scrubBlock(block, code));
    return null;
  };
  f["procedures_defnoreturn"] = (block, g) => defGenerator(block, g as Gen);
  f["procedures_defreturn"] = (block, g) => defGenerator(block, g as Gen);

  f["code_stmt"] = (block) => `${block.getFieldValue("CODE")}\n`;
  // 이름·속성·호출 하나(time.ticks_us(), Pin(26, Pin.OUT))면 호출 우선순위, 그 밖에는 연산자가
  // 섞였을 수 있으니 NONE 으로 두어 식 안에서 괄호로 감싸게 한다
  f["code_expr"] = (block) => {
    const code = String(block.getFieldValue("CODE"));
    return [code, isSimpleCallOrName(code) ? Order.FUNCTION_CALL : Order.NONE];
  };

  // 장치 블록(esp_*·dev_*)은 레지스트리 선언에서 만든다
  registerDeviceGenerators(gen);
}
