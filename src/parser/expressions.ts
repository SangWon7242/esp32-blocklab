import type { SyntaxNode } from "@lezer/common";
import { block, bool, codeExpr, num, str, varGet } from "./builders";
import type { ParseContext } from "./context";
import { children, operands } from "./tree";
import type { BlockJson } from "./types";

const COMPARE: Record<string, string> = { "<": "LT", ">": "GT", "==": "EQ", "!=": "NEQ", "<=": "LTE", ">=": "GTE" };
const ARITH: Record<string, string> = { "+": "ADD", "-": "MINUS", "*": "MULTIPLY", "/": "DIVIDE", "//": "FLOORDIV", "%": "MOD" };

export function decodeString(literal: string): string {
  const quote = literal[0];
  const inner = literal.slice(1, -1);
  try {
    if (quote === '"') return JSON.parse(literal) as string;
    return JSON.parse(`"${inner.replace(/\\'/g, "'").replace(/"/g, '\\"')}"`) as string;
  } catch {
    return inner;
  }
}

/** 호출식의 (피호출자, 인자 노드들) */
export function callParts(call: SyntaxNode): { callee: SyntaxNode; args: SyntaxNode[] } {
  const kids = children(call);
  const argList = kids.find((k) => k.name === "ArgList");
  return { callee: kids[0], args: argList ? operands(argList) : [] };
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

function fallback(node: SyntaxNode, ctx: ParseContext): BlockJson {
  ctx.markUnparsed(node);
  return codeExpr(ctx.src.slice(node));
}

export function convertExpr(node: SyntaxNode, ctx: ParseContext): BlockJson {
  const text = ctx.src.slice(node);
  switch (node.name) {
    case "Number": return num(Number(text));
    case "String": return str(decodeString(text));
    case "Boolean": return bool(text === "True");
    case "VariableName": return ctx.hasVar(text) ? varGet(ctx.varId(text)) : fallback(node, ctx);
    case "ParenthesizedExpression": {
      const inner = operands(node)[0];
      return inner ? convertExpr(inner, ctx) : fallback(node, ctx);
    }
    case "UnaryExpression": {
      const kids = children(node);
      const op = ctx.src.slice(kids[0]);
      if (op === "not" && kids[1]) return block("logic_negate", undefined, { BOOL: convertExpr(kids[1], ctx) });
      if (op === "-" && kids[1]?.name === "Number") return num(-Number(ctx.src.slice(kids[1])));
      return fallback(node, ctx);
    }
    case "BinaryExpression": {
      const kids = children(node);
      if (kids.length !== 3) return fallback(node, ctx);
      const [left, opNode, right] = kids;
      const op = ctx.src.slice(opNode);
      if (opNode.name === "CompareOp" && COMPARE[op]) return block("logic_compare", { OP: COMPARE[op] }, { A: convertExpr(left, ctx), B: convertExpr(right, ctx) });
      if (opNode.name === "and" || opNode.name === "or") return block("logic_operation", { OP: op.toUpperCase() }, { A: convertExpr(left, ctx), B: convertExpr(right, ctx) });
      if (opNode.name === "ArithOp" && ARITH[op]) {
        if (op === "+" && (isStringy(left, ctx) || isStringy(right, ctx))) return block("calc_concat", undefined, { A: convertExpr(left, ctx), B: convertExpr(right, ctx) });
        return block("calc_arith", { OP: ARITH[op] }, { A: convertExpr(left, ctx), B: convertExpr(right, ctx) });
      }
      return fallback(node, ctx);
    }
    case "CallExpression": {
      const { callee, args } = callParts(node);
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
