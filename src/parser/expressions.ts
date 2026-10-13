import type { SyntaxNode } from "@lezer/common";
import { block, bool, codeExpr, num, str, varGet } from "./builders";
import type { ParseContext } from "./context";
import { children, operands } from "./tree";
import type { BlockJson } from "./types";

const COMPARE: Record<string, string> = { "<": "LT", ">": "GT", "==": "EQ", "!=": "NEQ", "<=": "LTE", ">=": "GTE" };
const ARITH: Record<string, string> = { "+": "ADD", "-": "MINUS", "*": "MULTIPLY", "/": "DIVIDE", "//": "FLOORDIV", "%": "MOD" };

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

const isStringy = (node: SyntaxNode, ctx: ParseContext) =>
  node.name === "String" || (node.name === "CallExpression" && ctx.src.slice(callParts(node).callee) === "str");

/** 괄호 없이 쓴 비교식인지 (BinaryExpression 의 연산자가 CompareOp) */
const isComparison = (node: SyntaxNode) => node.name === "BinaryExpression" && node.firstChild?.nextSibling?.name === "CompareOp";

function fallback(node: SyntaxNode, ctx: ParseContext): BlockJson {
  ctx.markUnparsed(node);
  return codeExpr(ctx.src.slice(node));
}

/** 입력의 형식 검사(check). 블록 정의의 input_value check 와 같은 이름. */
export type Check = "Boolean" | "Number";

/** 파서가 내는 값 블록의 출력 형식. 표에 없는 블록(variables_get·code_expr·procedures_callreturn)은 형식이 없어 어디든 끼운다. */
const OUTPUT_TYPES: Record<string, readonly string[]> = {
  math_number: ["Number"], calc_arith: ["Number"], calc_int: ["Number"], esp_distance: ["Number"],
  esp_pin_read: ["Number", "Boolean"],
  text: ["String"], calc_str: ["String"], calc_concat: ["String"],
  logic_compare: ["Boolean"], logic_operation: ["Boolean"], logic_negate: ["Boolean"], logic_boolean: ["Boolean"],
};

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
  const types = OUTPUT_TYPES[out.type];
  if (!expect || !types || types.includes(expect)) return out;
  ctx.unparsed.length = mark; // 버린 하위 블록이 남긴 표시를 지우고 식 전체를 한 번만 표시
  return fallback(node, ctx);
}

function convertAny(node: SyntaxNode, ctx: ParseContext): BlockJson {
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
      if (op === "not" && kids[1]) return block("logic_negate", undefined, { BOOL: convertExpr(kids[1], ctx, "Boolean") });
      if (op === "-" && kids[1]?.name === "Number" && isCanonicalNumber(ctx.src.slice(kids[1]))) return num(-Number(ctx.src.slice(kids[1])));
      return fallback(node, ctx);
    }
    case "BinaryExpression": {
      const kids = children(node);
      if (kids.length !== 3) return fallback(node, ctx);
      const [left, opNode, right] = kids;
      const op = ctx.src.slice(opNode);
      // 5 < d < 15 는 (5 < d) and (d < 15) 라서 비교 블록 둘로 쌓으면 뜻이 바뀐다 — 식 전체를 코드로
      if (opNode.name === "CompareOp" && (isComparison(left) || isComparison(right))) return fallback(node, ctx);
      if (opNode.name === "CompareOp" && COMPARE[op]) return block("logic_compare", { OP: COMPARE[op] }, { A: convertExpr(left, ctx), B: convertExpr(right, ctx) });
      if (opNode.name === "and" || opNode.name === "or") return block("logic_operation", { OP: op.toUpperCase() }, { A: convertExpr(left, ctx, "Boolean"), B: convertExpr(right, ctx, "Boolean") });
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
        if (name === "get_distance" && ctx.ultrasonicFolded && args.length === 0) return block("esp_distance");
        const fn = ctx.functions.get(name);
        if (fn && fn.returns && args.length === fn.params.length) return callBlock("procedures_callreturn", name, fn.params, args, ctx);
        return fallback(node, ctx);
      }
      const member = memberParts(callee, ctx);
      if (member && member.prop === "value" && args.length === 0 && ctx.pins.has(member.obj)) return block("esp_pin_read", { VAR: { id: ctx.varId(member.obj) } });
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
