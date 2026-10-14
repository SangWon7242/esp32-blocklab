import type { SyntaxNode } from "@lezer/common";
import { block, chain, codeStmt, commentText, num, varSet, withComment } from "./builders";
import type { ParseContext } from "./context";
import { isFoldedHelper, matchActionLines, matchCall, matchSetupAt, setupBlock } from "./devices";
import { callBlock, callParts, convertExpr, isListVariable, isWholeNot, memberParts } from "./expressions";
import { functionParts, isKnownImport, returnsValue } from "./patterns";
import { bodyStatements, children, operands } from "./tree";
import type { BlockJson } from "./types";

export type Converted = { blocks: BlockJson[]; tops: BlockJson[]; consumed: number };

/** 문장 첫 줄의 줄 끝 주석을 찾는다 (형제 Comment 또는 Body 첫 Comment) */
function inlineComment(node: SyntaxNode, ctx: ParseContext): string | null {
  const line = ctx.src.lineOf(node.from);
  const candidates: SyntaxNode[] = [];
  for (let s = node.nextSibling; s && s.name === "Comment"; s = s.nextSibling) candidates.push(s);
  const body = children(node).find((k) => k.name === "Body");
  if (body) for (const k of children(body)) if (k.name === "Comment") candidates.push(k);
  const hit = candidates.find((c) => ctx.src.lineOf(c.from) === line);
  return hit ? ctx.src.slice(hit).replace(/^#\s?/, "").trim() : null;
}

export function convertBody(body: SyntaxNode | null, ctx: ParseContext): BlockJson | undefined {
  if (!body) return undefined;
  const stmts = bodyStatements(body);
  if (stmts.every((s) => s.name === "PassStatement")) return undefined;
  return chain(convertStatements(stmts, ctx, false).blocks);
}

/**
 * 문장들을 위에서부터 블록으로. 주석은 이렇게 붙는다:
 * - 문장 첫 줄 끝 주석 → 그 블록 코멘트 (줄 끝 주석)
 * - 문장 앞의 주석만 있는 줄들(빈 줄은 건너뜀, 들여쓰기 상관없이 바로 앞 문장 뒤부터) → 그 블록 코멘트의 윗줄
 * - 여러 문장이 블록 하나로 접히면(준비 줄 묶음, 여러 줄 명령) 둘째 문장부터의 윗줄·줄 끝 주석 → 그 블록 코멘트의 윗줄에 이어서
 * - 블록이 생기지 않는 문장(지운 import, 접힌 도우미 함수) 앞의 주석 줄 → 다음 문장으로 넘김
 * - 파일 첫 문장이 import 면 그 앞 주석 줄 → 파일 머리말 (시작 블록 코멘트)
 * - 몸통 끝·파일 끝 주석 줄 → 바깥의 다음 문장 (없으면 버림)
 * 장치 패턴(레지스트리)은 최상위 준비 줄 묶음 → 여러 줄 명령(lines) → 문장 하나(method·call) 순으로 본다.
 */
export function convertStatements(all: SyntaxNode[], ctx: ParseContext, topLevel: boolean): { blocks: BlockJson[]; tops: BlockJson[] } {
  const blocks: BlockJson[] = [];
  const tops: BlockJson[] = [];
  // 줄 끝 주석은 문장 사이에 형제로 끼어 있으므로 빼야 뒤따르는 문장(freq·duty_u16)을 바로 본다
  const nodes = all.filter((n) => n.name !== "Comment");
  const texts = nodes.map((n) => ctx.src.slice(n).trim());
  let pending: string[] = [];
  for (let i = 0; i < nodes.length; ) {
    const node = nodes[i];
    const leading = [...pending, ...ctx.takeLeading(node.from)];
    pending = [];
    if (topLevel && i === 0 && node.name === "ImportStatement") ctx.header.push(...leading.splice(0));
    const r = convertDevice(nodes, texts, i, ctx, topLevel) ?? convertStatement(node, ctx, topLevel);
    const consumed = Math.max(1, r.consumed);
    // 접힌 둘째 문장부터의 주석은 윗줄 주석으로 잇는다
    for (let k = 1; k < consumed; k++) {
      leading.push(...ctx.takeLeading(nodes[i + k].from));
      const trailing = inlineComment(nodes[i + k], ctx);
      if (trailing !== null) leading.push(trailing);
    }
    // 이 문장(들) 안에서 아직 아무도 가져가지 않은 주석 줄은 code_stmt 원문에 들었거나 접혀 사라진 것
    ctx.skipComments(nodes[i + consumed - 1].to);
    const target = r.blocks[0] ?? r.tops[0];
    if (target) withComment(target, commentText(leading, inlineComment(node, ctx)));
    else pending = leading;
    blocks.push(...r.blocks);
    tops.push(...r.tops);
    i += consumed;
  }
  return { blocks, tops };
}

/** 레지스트리 패턴: 최상위 준비 줄 묶음, 그다음 여러 줄 명령 */
function convertDevice(nodes: SyntaxNode[], texts: string[], i: number, ctx: ParseContext, topLevel: boolean): Converted | null {
  const setup = topLevel ? matchSetupAt(texts, i, ctx) : null;
  if (setup) return one(setupBlock(setup.spec, setup.fields, ctx), setup.consumed);
  const action = matchActionLines(nodes, texts, i, ctx);
  return action ? one(action.block, action.consumed) : null;
}

/** while/for 의 else: 절. 블록에 자리가 없으므로 문장 전체를 code_stmt 로 남긴다 */
const hasElseClause = (node: SyntaxNode) => children(node).some((k) => k.name === "else");

/** 리스트 메서드 문장 → [블록, 인자 칸들]. 인자 수가 맞을 때만 블록으로 (pop() 처럼 인자가 없으면 코드로) */
const LIST_METHODS: Record<string, { type: string; inputs: { name: string; check?: "Number" }[] }> = {
  append: { type: "list_append", inputs: [{ name: "V" }] },
  insert: { type: "list_insert", inputs: [{ name: "I", check: "Number" }, { name: "V" }] },
  pop: { type: "list_remove_at", inputs: [{ name: "I", check: "Number" }] },
  remove: { type: "list_remove_value", inputs: [{ name: "V" }] },
  clear: { type: "list_clear", inputs: [] },
};

const varField = (name: string, ctx: ParseContext) => ({ VAR: { id: ctx.varId(name) } });

/** x[i] (i 는 슬라이스·여러 칸이 아님) 이면 [x, i] */
function subscriptParts(node: SyntaxNode): [SyntaxNode, SyntaxNode] | null {
  if (node.name !== "MemberExpression") return null;
  const kids = children(node);
  if (kids.length !== 4 || kids[1].name !== "[" || kids[3].name !== "]" || kids[2].name === ":" || kids[2].name === ",") return null;
  return [kids[0], kids[2]];
}

/** for 문의 (반복 변수 이름, 반복할 것). 반복 변수가 이름 하나가 아니면(for a, b in …) null */
function forParts(node: SyntaxNode, ctx: ParseContext): { target: string; iter: SyntaxNode } | null {
  const kids = children(node).filter((k) => k.name !== "Comment");
  const inAt = kids.findIndex((k) => k.name === "in");
  if (kids[0]?.name !== "for" || inAt !== 2 || kids[1].name !== "VariableName" || !kids[3] || kids[3].name === "Body") return null;
  return { target: ctx.src.slice(kids[1]), iter: kids[3] };
}

const one = (b: BlockJson, consumed = 1): Converted => ({ blocks: [b], tops: [], consumed });
const none = (consumed = 1): Converted => ({ blocks: [], tops: [], consumed });
// 복합문 조각은 Body 끝의 줄바꿈까지 담기므로 끝 공백을 뗀다 (code_stmt 생성기가 줄바꿈을 붙인다)
const unknown = (node: SyntaxNode, ctx: ParseContext): Converted => { ctx.markUnparsed(node); return one(codeStmt(ctx.src.dedent(node).replace(/\s+$/, ""))); };

function convertStatement(node: SyntaxNode, ctx: ParseContext, topLevel: boolean): Converted {
  const text = ctx.src.slice(node).trim();
  switch (node.name) {
    case "ImportStatement":
      return isKnownImport(text) ? none() : unknown(node, ctx);

    case "AssignStatement": {
      // 준비 줄(Pin·PWM·SoftI2C …)은 convertDevice 가 먼저 접는다
      const kids = children(node);
      if (kids.length !== 3 || ctx.src.slice(kids[1]) !== "=") return unknown(node, ctx);
      const [target, , value] = kids;
      if (target.name === "VariableName") {
        const name = ctx.src.slice(target);
        // items = [] / items = [1, 2, 3] → 리스트 만들기 (항목은 대괄호 안 원문 그대로, 여러 줄이면 코드 식으로)
        if (value.name === "ArrayExpression" && !ctx.devices.has(name)) {
          const inner = ctx.src.text.slice(value.from + 1, value.to - 1).trim();
          if (!inner) return one(block("list_create", varField(name, ctx)));
          if (!inner.includes("\n")) return one(block("list_create_from", { ...varField(name, ctx), ITEMS: inner }));
        }
        return one(varSet(ctx.varId(name), convertExpr(value, ctx)));
      }
      // items[0] = 5 → n번째 항목 정하기
      const sub = subscriptParts(target);
      if (sub && sub[0].name === "VariableName" && isListVariable(ctx.src.slice(sub[0]), ctx)) {
        const name = ctx.src.slice(sub[0]);
        return one(block("list_set", varField(name, ctx), { I: convertExpr(sub[1], ctx, "Number"), V: convertExpr(value, ctx) }));
      }
      return unknown(node, ctx);
    }

    case "UpdateStatement": {
      // count += 1 → 만큼 바꾸기. -= 같은 다른 연산자는 코드로
      const kids = children(node);
      if (kids.length === 3 && kids[0].name === "VariableName" && ctx.src.slice(kids[1]) === "+=") {
        return one(block("var_change", varField(ctx.src.slice(kids[0]), ctx), { DELTA: convertExpr(kids[2], ctx, "Number") }));
      }
      return unknown(node, ctx);
    }

    case "BreakStatement":
      return one(block("flow_break"));

    case "ContinueStatement":
      return one(block("flow_continue"));

    case "ExpressionStatement": {
      const expr = node.firstChild;
      if (!expr || expr.name !== "CallExpression") return unknown(node, ctx);
      const device = matchCall(expr, ctx, "actions");
      if (device) return one(device);
      const { callee, args, plain } = callParts(expr);
      if (!plain) return unknown(node, ctx);
      const member = memberParts(callee, ctx);
      if (member) {
        const { obj, prop } = member;
        if (obj === "time" && args.length === 1) {
          if (prop === "sleep") return one(block("flow_wait", undefined, { SEC: convertExpr(args[0], ctx, "Number") }));
          if (prop === "sleep_ms") return one(block("flow_wait_ms", undefined, { MS: convertExpr(args[0], ctx, "Number") }));
          if (prop === "sleep_us") return one(block("flow_wait_us", undefined, { US: convertExpr(args[0], ctx, "Number") }));
        }
        // 장치 변수가 아닌 이름의 append·insert·pop·remove·clear → 리스트 블록 (장치 메서드는 위 matchCall 이 먼저 본다)
        const method = Object.hasOwn(LIST_METHODS, prop) ? LIST_METHODS[prop] : undefined;
        if (method && method.inputs.length === args.length && isListVariable(obj, ctx)) {
          const inputs = Object.fromEntries(method.inputs.map((input, k) => [input.name, convertExpr(args[k], ctx, input.check)]));
          return one(block(method.type, varField(obj, ctx), inputs));
        }
        return unknown(node, ctx);
      }
      if (callee.name === "VariableName") {
        const name = ctx.src.slice(callee);
        const fn = ctx.functions.get(name);
        if (fn && args.length === fn.params.length) return one(callBlock("procedures_callnoreturn", name, fn.params, args, ctx));
      }
      return unknown(node, ctx);
    }

    case "WhileStatement": {
      if (hasElseClause(node)) return unknown(node, ctx);
      const cond = operands(node)[0];
      const body = children(node).find((k) => k.name === "Body") ?? null;
      if (!cond) return unknown(node, ctx);
      const DO = convertBody(body, ctx);
      if (cond.name === "Boolean" && ctx.src.slice(cond) === "True") return one(block("flow_repeat_forever", undefined, { DO }));
      const kids = children(cond);
      // while not X: 만 "~할 때까지" (while not a and b: 는 (not a) and b 라서 아니다)
      if (cond.name === "UnaryExpression" && isWholeNot(cond) && kids[1]) return one(block("controls_whileUntil", { MODE: "UNTIL" }, { BOOL: convertExpr(kids[1], ctx, "Boolean"), DO }));
      return one(block("controls_whileUntil", { MODE: "WHILE" }, { BOOL: convertExpr(cond, ctx, "Boolean"), DO }));
    }

    case "ForStatement": {
      if (hasElseClause(node)) return unknown(node, ctx);
      const parts = forParts(node, ctx);
      if (!parts) return unknown(node, ctx);
      const { target, iter } = parts;
      const body = children(node).find((k) => k.name === "Body") ?? null;
      // 반복 변수는 몸통에서 변수 블록으로 받는다 (코드 식으로 남기지 않는다)
      const VAR = varField(target, ctx);
      const range = iter.name === "CallExpression" ? callParts(iter) : null;
      if (range && ctx.src.slice(range.callee) === "range") {
        if (!range.plain) return unknown(node, ctx);
        const { args } = range;
        // flow_repeat_n 은 늘 `for i in range(n):` 을 쓰므로 반복 변수가 i 일 때만. 다른 이름이면 0 부터 바꾸며 반복
        if (args.length === 1 && target === "i") return one(block("flow_repeat_n", undefined, { TIMES: convertExpr(args[0], ctx, "Number"), DO: convertBody(body, ctx) }));
        if (args.length === 1) return one(block("flow_for_range", VAR, { FROM: num(0), TO: convertExpr(args[0], ctx, "Number"), DO: convertBody(body, ctx) }));
        if (args.length === 2) return one(block("flow_for_range", VAR, { FROM: convertExpr(args[0], ctx, "Number"), TO: convertExpr(args[1], ctx, "Number"), DO: convertBody(body, ctx) }));
        // range(a, b, step) 은 블록에 자리가 없다
        return unknown(node, ctx);
      }
      return one(block("flow_for_each", VAR, { LIST: convertExpr(iter, ctx), DO: convertBody(body, ctx) }));
    }

    case "IfStatement": {
      const inputs: Record<string, BlockJson | undefined> = {};
      let elseIfCount = -1;
      let hasElse = false;
      let pendingCond: BlockJson | null = null;
      for (const k of children(node)) {
        if (k.name === "if" || k.name === "elif") { elseIfCount++; continue; }
        if (k.name === "else") { hasElse = true; continue; }
        if (k.name === "Body") {
          if (hasElse) inputs.ELSE = convertBody(k, ctx);
          else { inputs[`IF${elseIfCount}`] = pendingCond ?? undefined; inputs[`DO${elseIfCount}`] = convertBody(k, ctx); pendingCond = null; }
          continue;
        }
        if (k.name !== "Comment") pendingCond = convertExpr(k, ctx, "Boolean");
      }
      const extra = elseIfCount > 0 || hasElse ? { ...(elseIfCount > 0 ? { elseIfCount } : {}), ...(hasElse ? { hasElse } : {}) } : undefined;
      return one(block("controls_if", undefined, inputs, extra));
    }

    case "FunctionDefinition": {
      const { name, params, body, simple } = functionParts(node, ctx);
      if (!topLevel || !simple || ctx.duplicateDefs.has(node.from)) return unknown(node, ctx);
      if (isFoldedHelper(name, ctx)) return none();
      const stmts = body ? bodyStatements(body) : [];
      const last = stmts[stmts.length - 1];
      let RETURN: BlockJson | undefined;
      let bodyStmts = stmts;
      if (returnsValue(body)) { RETURN = convertExpr(operands(last)[0], ctx); bodyStmts = stmts.slice(0, -1); }
      const STACK = bodyStmts.every((s) => s.name === "PassStatement") ? undefined : chain(convertStatements(bodyStmts, ctx, false).blocks);
      const def = block(RETURN ? "procedures_defreturn" : "procedures_defnoreturn", { NAME: name }, { STACK, RETURN }, { params: params.map((p) => ({ name: p, id: ctx.varId(p) })) });
      return { blocks: [], tops: [def], consumed: 1 };
    }

    case "PassStatement":
      return one(codeStmt("pass"));

    default:
      return unknown(node, ctx);
  }
}
