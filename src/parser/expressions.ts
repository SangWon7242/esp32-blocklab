import type { SyntaxNode } from "@lezer/common";
import { block, bool, codeExpr, num, str, varGet } from "./builders";
import type { ParseContext } from "./context";
import { findValueByBlock } from "@/devices/registry";
import { isProgramName } from "@/blocks/names";
import { matchCall, matchExpr } from "./devices";
import { children, operands } from "./tree";
import type { BlockJson } from "./types";

const COMPARE: Record<string, string> = { "<": "LT", ">": "GT", "==": "EQ", "!=": "NEQ", "<=": "LTE", ">=": "GTE" };
const ARITH: Record<string, string> = { "+": "ADD", "-": "MINUS", "*": "MULTIPLY", "/": "DIVIDE", "//": "FLOORDIV", "%": "MOD", "**": "POW" };
/** 인자 하나짜리 내장 함수 → calc_round 의 OP */
const ROUND_BUILTINS: Record<string, string> = { round: "ROUND", abs: "ABS" };
/** math.* 함수 → calc_round 의 OP */
const ROUND_MATH: Record<string, string> = { floor: "FLOOR", ceil: "CEIL", sqrt: "SQRT" };

/** 따옴표 안 내용을 푼다. JSON 으로 풀 수 없는 이스케이프(`\x41`, `\a` 등)면 null — 식을 code_expr 로 남긴다 */
export function decodeString(literal: string): string | null {
  const quote = literal[0];
  const inner = literal.slice(1, -1);
  try {
    if (quote === '"') return JSON.parse(literal) as string;
    return JSON.parse(`"${inner.replace(/\\'/g, "'").replace(/"/g, '\\"')}"`) as string;
  } catch {
    return null;
  }
}

/** 이름 붙인 인자(`end=""`)와 펼친 인자(`*xs`, `**kw`)의 토큰. 블록은 위치 인자만 담는다. */
const NON_POSITIONAL = new Set(["AssignOp", "*", "**"]);

/** 호출식의 (피호출자, 인자 노드들). plain 은 인자가 모두 위치 인자인지 */
export function callParts(call: SyntaxNode): { callee: SyntaxNode; args: SyntaxNode[]; plain: boolean } {
  const kids = children(call);
  const argList = kids.find((k) => k.name === "ArgList");
  const plain = !argList || children(argList).every((k) => !NON_POSITIONAL.has(k.name));
  return { callee: kids[0], args: argList ? operands(argList) : [], plain };
}

/** obj.method 꼴이면 이름 둘을 돌려준다 */
export function memberParts(node: SyntaxNode, ctx: ParseContext): { obj: string; prop: string } | null {
  if (node.name !== "MemberExpression") return null;
  const kids = children(node);
  if (kids.length !== 3 || kids[0].name !== "VariableName" || kids[2].name !== "PropertyName") return null;
  return { obj: ctx.src.slice(kids[0]), prop: ctx.src.slice(kids[2]) };
}

/**
 * 리스트 블록(append·index …)으로 읽을 변수 이름인지: 장치 변수(ctx.devices)도, 프로그램이 쓰는 이름(time·machine·oled 같은
 * 모듈·고정 장치 이름)도 아니다. 장치 변수의 메서드는 장치 패턴이 먼저 본다
 */
export const isListVariable = (name: string, ctx: ParseContext): boolean => !ctx.devices.has(name) && !isProgramName(name);

const isStringy = (node: SyntaxNode, ctx: ParseContext) =>
  node.name === "String" || (node.name === "CallExpression" && ctx.src.slice(callParts(node).callee) === "str");

/** 비교 연산자 노드 이름: <·== 들은 CompareOp, in·is 는 제 이름, not in 은 not 토큰 뒤에 in */
const COMPARE_TOKENS = new Set(["CompareOp", "in", "is", "not"]);

/** 괄호 없이 쓴 비교식인지 (BinaryExpression 의 연산자가 CompareOp·in·not in·is). 파이썬은 이런 식을 이어 쓰면 연쇄 비교로 읽는다 */
const isComparison = (node: SyntaxNode) => node.name === "BinaryExpression" && COMPARE_TOKENS.has(node.firstChild?.nextSibling?.name ?? "");

/** X <= Y <= Z (연산자 둘이 모두 <=, 세 칸 모두 비교식이 아님) 이면 [X, Y, Z] */
function betweenParts(left: SyntaxNode, op: string, right: SyntaxNode, ctx: ParseContext): [SyntaxNode, SyntaxNode, SyntaxNode] | null {
  if (op !== "<=" || !isComparison(left) || isComparison(right)) return null;
  const inner = children(left);
  if (inner.length !== 3 || inner[1].name !== "CompareOp" || ctx.src.slice(inner[1]) !== "<=") return null;
  if (isComparison(inner[0]) || isComparison(inner[2])) return null;
  return [inner[0], inner[2], right];
}

/** and·or·not 식을 편 토큰: 연산자 이름이거나 그 밖의 식 노드(괄호 식은 한 덩어리) */
type LogicToken = "and" | "or" | "not" | SyntaxNode;

/**
 * and·or·not 으로 이은 식을 원문 순서대로 편다. lezer 는 `not` 이 오른쪽의 and·or 전체를 삼키게 읽으므로
 * (`not a and b` → not(a and b), `a and not b or c` → a and not(b or c)) 트리를 그대로 쓰면 뜻이 바뀐다.
 */
function logicTokens(node: SyntaxNode, out: LogicToken[] = []): LogicToken[] {
  const kids = children(node);
  if (node.name === "BinaryExpression" && kids.length === 3 && (kids[1].name === "and" || kids[1].name === "or")) {
    logicTokens(kids[0], out);
    out.push(kids[1].name);
    logicTokens(kids[2], out);
  } else if (node.name === "UnaryExpression" && kids[0]?.name === "not" && kids[1]) {
    out.push("not");
    logicTokens(kids[1], out);
  } else out.push(node);
  return out;
}

/** cond 가 식 전체를 뒤집는 `not X` 인지 (`not a and b` 는 (not a) and b 라서 아니다) */
export function isWholeNot(cond: SyntaxNode): boolean {
  const tokens = logicTokens(cond);
  return tokens[0] === "not" && !tokens.includes("and") && !tokens.includes("or");
}

/** 편 토큰을 파이썬 우선순위(or < and < not, 왼쪽부터 묶음)로 다시 묶어 판단 블록으로 */
function logicBlock(node: SyntaxNode, ctx: ParseContext): BlockJson {
  const tokens = logicTokens(node);
  let i = 0;
  const atom = (): BlockJson => {
    if (tokens[i] === "not") {
      i++;
      return block("logic_negate", undefined, { BOOL: atom() });
    }
    return convertExpr(tokens[i++] as SyntaxNode, ctx, "Boolean");
  };
  const chain = (op: "and" | "or", next: () => BlockJson) => (): BlockJson => {
    let left = next();
    while (tokens[i] === op) {
      i++;
      left = block("logic_operation", { OP: op.toUpperCase() }, { A: left, B: next() });
    }
    return left;
  };
  return chain("or", chain("and", atom))();
}

function fallback(node: SyntaxNode, ctx: ParseContext): BlockJson {
  ctx.markUnparsed(node);
  return codeExpr(ctx.src.slice(node));
}

/** 입력의 형식 검사(check). 블록 정의의 input_value check 와 같은 이름. */
export type Check = "Boolean" | "Number" | "String";

/** 파서가 내는 기본 값 블록의 출력 형식. 장치 값 블록은 레지스트리의 output 을 쓴다 */
const OUTPUT_TYPES: Record<string, readonly string[]> = {
  math_number: ["Number"], calc_arith: ["Number"], calc_int: ["Number"],
  text: ["String"], calc_str: ["String"], calc_concat: ["String"],
  logic_compare: ["Boolean"], logic_operation: ["Boolean"], logic_negate: ["Boolean"], logic_boolean: ["Boolean"],
  judge_between: ["Boolean"], judge_contains: ["Boolean"],
  calc_random: ["Number"], calc_round: ["Number"], calc_minmax: ["Number"], calc_len: ["Number"], calc_ticks: ["Number"],
  list_index: ["Number"],
  // calc_item 은 output null (리스트·글자의 항목은 어떤 값이든) 이라 여기에 넣지 않는다
};

/** 값 블록의 출력 형식. 형식이 없는 블록(variables_get·code_expr·procedures_callreturn, output null 인 장치 값)은 어디든 끼운다 */
function outputTypes(type: string): readonly string[] | undefined {
  if (OUTPUT_TYPES[type]) return OUTPUT_TYPES[type];
  const output = findValueByBlock(type)?.output;
  if (output === undefined || output === null) return undefined;
  return typeof output === "string" ? [output] : output;
}

/** Blockly 는 math_number 를 String(Number(NUM)) 로 쓰므로, 그 결과가 원문과 같은 숫자만 블록으로 */
const isCanonicalNumber = (text: string) => String(Number(text)) === text;

/** 접두사(r·b·f·u)나 세 따옴표가 없는 한 줄 문자열만 text 블록으로 */
const isPlainString = (text: string) => /^["']/.test(text) && !text.startsWith('"""') && !text.startsWith("'''");

/**
 * 식 노드를 값 블록으로. expect 를 주면 그 입력의 형식 검사를 통과하지 못하는 블록 대신
 * code_expr 로 떨어뜨린다 (그대로 두면 작업판에 올릴 때 연결 검사 오류가 난다).
 */
export function convertExpr(node: SyntaxNode, ctx: ParseContext, expect?: Check): BlockJson {
  const mark = ctx.unparsed.length;
  const out = convertAny(node, ctx);
  const types = outputTypes(out.type);
  if (!expect || !types || types.includes(expect)) return out;
  ctx.unparsed.length = mark; // 버린 하위 블록이 남긴 표시를 지우고 식 전체를 한 번만 표시
  return fallback(node, ctx);
}

/** 노드들을 값 블록으로. 하나라도 expect 칸에 못 끼우면 null (그동안 남긴 표시도 지운다) */
export function convertAllOrNull(nodes: SyntaxNode[], ctx: ParseContext, expect: Check): BlockJson[] | null {
  const mark = ctx.unparsed.length;
  const out = nodes.map((n) => convertAny(n, ctx));
  if (out.every((b) => { const types = outputTypes(b.type); return !types || types.includes(expect); })) return out;
  ctx.unparsed.length = mark;
  return null;
}

function convertAny(node: SyntaxNode, ctx: ParseContext): BlockJson {
  // 장치 값: 식 전체 정규식(expr) 먼저, 그다음 method·call
  const device = matchExpr(node, ctx) ?? matchCall(node, ctx, "values");
  if (device) return device;
  const text = ctx.src.slice(node);
  switch (node.name) {
    case "Number": return isCanonicalNumber(text) ? num(Number(text)) : fallback(node, ctx);
    case "String": {
      const decoded = isPlainString(text) ? decodeString(text) : null;
      return decoded === null ? fallback(node, ctx) : str(decoded);
    }
    case "Boolean": return bool(text === "True");
    case "VariableName": return ctx.hasVar(text) ? varGet(ctx.varId(text)) : fallback(node, ctx);
    case "ParenthesizedExpression": {
      const inner = operands(node)[0];
      return inner ? convertExpr(inner, ctx) : fallback(node, ctx);
    }
    case "UnaryExpression": {
      const kids = children(node);
      const op = ctx.src.slice(kids[0]);
      if (op === "not" && kids[1]) return logicBlock(node, ctx);
      if (op === "-" && kids[1]?.name === "Number" && isCanonicalNumber(ctx.src.slice(kids[1]))) return num(-Number(ctx.src.slice(kids[1])));
      return fallback(node, ctx);
    }
    case "BinaryExpression": {
      const kids = children(node);
      // x not in xs → "들어 있는가" 를 뒤집은 블록 (생성기가 다시 x not in xs 로 쓴다)
      if (kids.length === 4 && kids[1].name === "not" && kids[2].name === "in") {
        if (isComparison(kids[0]) || isComparison(kids[3])) return fallback(node, ctx);
        return block("logic_negate", undefined, { BOOL: block("judge_contains", undefined, { CONTAINER: convertExpr(kids[3], ctx), ITEM: convertExpr(kids[0], ctx) }) });
      }
      if (kids.length !== 3) return fallback(node, ctx);
      const [left, opNode, right] = kids;
      const op = ctx.src.slice(opNode);
      // 0 <= d <= 100 만 "사이인가" 블록으로
      const between = opNode.name === "CompareOp" ? betweenParts(left, op, right, ctx) : null;
      if (between) {
        // 칸 하나라도 숫자 칸에 못 끼우면("a" <= c <= "z") 칸만 식 블록으로 바꿀 때 괄호가 붙어 코드가 달라진다 — 식 전체를 코드로
        const parts = convertAllOrNull(between, ctx, "Number");
        if (!parts) return fallback(node, ctx);
        const [low, a, high] = parts;
        return block("judge_between", undefined, { A: a, LOW: low, HIGH: high });
      }
      // 5 < d < 15 는 (5 < d) and (d < 15) 라서 비교 블록 둘로 쌓으면 뜻이 바뀐다 — 식 전체를 코드로 (a < b in c 도 같다)
      if (COMPARE_TOKENS.has(opNode.name) && (isComparison(left) || isComparison(right))) return fallback(node, ctx);
      if (opNode.name === "in") return block("judge_contains", undefined, { CONTAINER: convertExpr(right, ctx), ITEM: convertExpr(left, ctx) });
      if (opNode.name === "CompareOp" && COMPARE[op]) return block("logic_compare", { OP: COMPARE[op] }, { A: convertExpr(left, ctx), B: convertExpr(right, ctx) });
      if (opNode.name === "and" || opNode.name === "or") return logicBlock(node, ctx);
      if (opNode.name === "ArithOp" && ARITH[op]) {
        if (op === "+" && (isStringy(left, ctx) || isStringy(right, ctx))) return block("calc_concat", undefined, { A: convertExpr(left, ctx), B: convertExpr(right, ctx) });
        return block("calc_arith", { OP: ARITH[op] }, { A: convertExpr(left, ctx), B: convertExpr(right, ctx) });
      }
      return fallback(node, ctx);
    }
    case "CallExpression": {
      const { callee, args, plain } = callParts(node);
      if (!plain) return fallback(node, ctx);
      if (callee.name === "VariableName") {
        const name = ctx.src.slice(callee);
        if (name === "str" && args.length === 1) return block("calc_str", undefined, { X: convertExpr(args[0], ctx) });
        if (name === "int" && args.length === 1) return block("calc_int", undefined, { X: convertExpr(args[0], ctx) });
        if (ROUND_BUILTINS[name] && args.length === 1) return block("calc_round", { OP: ROUND_BUILTINS[name] }, { X: convertExpr(args[0], ctx, "Number") });
        // max(a, b, c) 처럼 셋 이상은 코드로
        if ((name === "max" || name === "min") && args.length === 2) {
          return block("calc_minmax", { OP: name.toUpperCase() }, { A: convertExpr(args[0], ctx, "Number"), B: convertExpr(args[1], ctx, "Number") });
        }
        if (name === "len" && args.length === 1) return block("calc_len", undefined, { X: convertExpr(args[0], ctx) });
        const fn = ctx.functions.get(name);
        if (fn && fn.returns && args.length === fn.params.length) return callBlock("procedures_callreturn", name, fn.params, args, ctx);
        return fallback(node, ctx);
      }
      const member = memberParts(callee, ctx);
      if (member?.obj === "random" && member.prop === "randint" && args.length === 2) {
        return block("calc_random", undefined, { A: convertExpr(args[0], ctx, "Number"), B: convertExpr(args[1], ctx, "Number") });
      }
      if (member?.obj === "math" && ROUND_MATH[member.prop] && args.length === 1) {
        return block("calc_round", { OP: ROUND_MATH[member.prop] }, { X: convertExpr(args[0], ctx, "Number") });
      }
      if (member?.obj === "time" && member.prop === "ticks_ms" && args.length === 0) return block("calc_ticks");
      // items.index(3) → 리스트에서 위치
      if (member && member.prop === "index" && args.length === 1 && isListVariable(member.obj, ctx)) {
        return block("list_index", { VAR: { id: ctx.varId(member.obj) } }, { V: convertExpr(args[0], ctx) });
      }
      return fallback(node, ctx);
    }
    case "MemberExpression": {
      // x[i] 만 "n번째 항목" 블록으로. x[1:3]·x[:]·x[a, b] 는 코드로 (속성 a.b 는 장치 값이 먼저 본다)
      const kids = children(node);
      if (kids.length === 4 && kids[1].name === "[" && kids[3].name === "]" && kids[2].name !== ":" && kids[2].name !== ",") {
        // 번호가 숫자 칸에 못 끼우면(d["k"] 사전 찾기) "0부터 n번째" 로 보이지 않게 식 전체를 코드로
        const mark = ctx.unparsed.length;
        const X = convertExpr(kids[0], ctx);
        const index = convertAllOrNull([kids[2]], ctx, "Number");
        if (!index) {
          ctx.unparsed.length = mark;
          return fallback(node, ctx);
        }
        return block("calc_item", undefined, { X, INDEX: index[0] });
      }
      return fallback(node, ctx);
    }
    default:
      return fallback(node, ctx);
  }
}

export function callBlock(type: "procedures_callreturn" | "procedures_callnoreturn", name: string, params: string[], args: SyntaxNode[], ctx: ParseContext): BlockJson {
  const inputs: Record<string, BlockJson> = {};
  args.forEach((a, i) => { inputs[`ARG${i}`] = convertExpr(a, ctx); });
  return block(type, undefined, inputs, { name, params });
}
