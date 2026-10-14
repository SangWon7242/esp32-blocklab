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
  POW: ["**", Order.EXPONENTIATION],
};

/** calc_round 의 OP → 함수 이름 (math.* 는 import math 규칙이 붙는다) */
const ROUND: Record<string, string> = { ROUND: "round", FLOOR: "math.floor", CEIL: "math.ceil", ABS: "abs", SQRT: "math.sqrt" };

/**
 * 왼쪽은 같은 우선순위에 괄호를 치지 않도록 order + 1, 오른쪽은 그대로.
 * (Blockly 는 비교 전에 두 order 를 내림하므로 0.1 로는 부족하다. order + 1 은 한 단계 낮은
 * 우선순위만 괄호로 감싼다.)
 */
function binary(block: Blockly.Block, gen: Gen, symbol: string, order: number): [string, number] {
  // ** 는 오른쪽부터 묶는다 (2 ** 3 ** 2 == 2 ** (3 ** 2)): 왼쪽에 같은 우선순위가 오면 괄호, 오른쪽은 괄호 없이
  const right = order === Order.EXPONENTIATION;
  const a = value(block, gen, "A", right ? order : order + 1);
  const b = value(block, gen, "B", right ? order + 1 : order);
  return [`${a} ${symbol} ${b}`, order];
}

/** LOW <= A <= HIGH, ITEM in CONTAINER 처럼 비교 연산자로 잇는 식의 칸들. 비교식이 칸에 들어오면 괄호로 감싼다 */
const relational = (block: Blockly.Block, gen: Gen, ...names: string[]) => names.map((name) => value(block, gen, name, Order.RELATIONAL));

/** 블록의 변수 칸(VAR)이 가리키는 변수의 코드 이름 */
const varName = (block: Blockly.Block, gen: Gen) => gen.getVariableName(block.getFieldValue("VAR"));

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
  f["flow_for_range"] = (block, g) => {
    const gen = g as Gen;
    return `for ${varName(block, gen)} in range(${value(block, gen, "FROM")}, ${value(block, gen, "TO")}):\n${branch(block, gen, "DO")}`;
  };
  f["flow_for_each"] = (block, g) => {
    const gen = g as Gen;
    return `for ${varName(block, gen)} in ${value(block, gen, "LIST", Order.NONE, "[]")}:\n${branch(block, gen, "DO")}`;
  };
  f["flow_break"] = () => "break\n";
  f["flow_continue"] = () => "continue\n";
  f["flow_wait"] = (block, g) => `time.sleep(${value(block, g as Gen, "SEC")})\n`;
  f["flow_wait_ms"] = (block, g) => `time.sleep_ms(${value(block, g as Gen, "MS")})\n`;
  f["flow_wait_us"] = (block, g) => `time.sleep_us(${value(block, g as Gen, "US")})\n`;

  f["calc_arith"] = (block, g) => {
    const [symbol, order] = ARITH[block.getFieldValue("OP")] ?? ARITH.ADD;
    return binary(block, g as Gen, symbol, order);
  };
  f["calc_concat"] = (block, g) => binary(block, g as Gen, "+", Order.ADDITIVE);
  f["calc_random"] = (block, g) => [`random.randint(${value(block, g as Gen, "A")}, ${value(block, g as Gen, "B")})`, Order.FUNCTION_CALL];
  f["calc_round"] = (block, g) => [`${ROUND[block.getFieldValue("OP")] ?? "round"}(${value(block, g as Gen, "X")})`, Order.FUNCTION_CALL];
  f["calc_minmax"] = (block, g) => [`${block.getFieldValue("OP") === "MIN" ? "min" : "max"}(${value(block, g as Gen, "A")}, ${value(block, g as Gen, "B")})`, Order.FUNCTION_CALL];
  f["calc_len"] = (block, g) => [`len(${value(block, g as Gen, "X", Order.NONE, '""')})`, Order.FUNCTION_CALL];
  f["calc_item"] = (block, g) => [`${value(block, g as Gen, "X", Order.MEMBER, '""')}[${value(block, g as Gen, "INDEX")}]`, Order.MEMBER];
  f["calc_ticks"] = () => ["time.ticks_ms()", Order.FUNCTION_CALL];

  f["judge_between"] = (block, g) => {
    const [a, low, high] = relational(block, g as Gen, "A", "LOW", "HIGH");
    return [`${low} <= ${a} <= ${high}`, Order.RELATIONAL];
  };
  f["judge_contains"] = (block, g) => {
    const [container, item] = relational(block, g as Gen, "CONTAINER", "ITEM");
    return [`${item} in ${container}`, Order.RELATIONAL];
  };
  // "들어 있는가" 를 뒤집으면 not x in xs 가 아니라 파이썬다운 x not in xs 로 쓴다 (파서가 x not in xs 를 이 모양으로 읽는다)
  const builtinNegate = f["logic_negate"];
  f["logic_negate"] = (block, g) => {
    const inner = block.getInputTargetBlock("BOOL");
    if (inner?.type === "judge_contains" && inner.isEnabled()) {
      const [container, item] = relational(inner, g as Gen, "CONTAINER", "ITEM");
      return [`${item} not in ${container}`, Order.RELATIONAL];
    }
    return builtinNegate.call(f, block, g);
  };
  f["calc_str"] = (block, g) => [`str(${value(block, g as Gen, "X")})`, Order.FUNCTION_CALL];
  f["calc_int"] = (block, g) => [`int(${value(block, g as Gen, "X")})`, Order.FUNCTION_CALL];

  // 변수 만큼 바꾸기
  f["var_change"] = (block, g) => `${varName(block, g as Gen)} += ${value(block, g as Gen, "DELTA")}\n`;

  // 리스트 (VAR 는 리스트 변수 칸)
  f["list_create"] = (block, g) => `${varName(block, g as Gen)} = []\n`;
  f["list_create_from"] = (block, g) => `${varName(block, g as Gen)} = [${String(block.getFieldValue("ITEMS") ?? "").trim()}]\n`;
  f["list_append"] = (block, g) => `${varName(block, g as Gen)}.append(${value(block, g as Gen, "V")})\n`;
  f["list_insert"] = (block, g) => `${varName(block, g as Gen)}.insert(${value(block, g as Gen, "I")}, ${value(block, g as Gen, "V")})\n`;
  f["list_remove_at"] = (block, g) => `${varName(block, g as Gen)}.pop(${value(block, g as Gen, "I")})\n`;
  f["list_remove_value"] = (block, g) => `${varName(block, g as Gen)}.remove(${value(block, g as Gen, "V")})\n`;
  f["list_clear"] = (block, g) => `${varName(block, g as Gen)}.clear()\n`;
  f["list_set"] = (block, g) => `${varName(block, g as Gen)}[${value(block, g as Gen, "I")}] = ${value(block, g as Gen, "V")}\n`;
  f["list_index"] = (block, g) => [`${varName(block, g as Gen)}.index(${value(block, g as Gen, "V")})`, Order.FUNCTION_CALL];

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
    // 코드 지도: return 줄은 몸통 마지막 블록과 같은 들여쓰기라 정의 블록 표식을 다시 연다
    const returnLine = ret ? `${g.markFor(block, g.INDENT)}${g.INDENT}return ${ret}\n` : "";
    if (!body && !returnLine) body = g.PASS;
    // 함수 정의 블록은 null 을 돌려주므로 Blockly 가 표식을 붙이지 않는다. def 줄 앞에 직접 넣는다 (지도 모드에서만)
    const code = `${g.markFor(block)}def ${name}(${params.join(", ")}):\n${body}${returnLine}`;
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
