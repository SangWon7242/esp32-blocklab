import type { SyntaxNode } from "@lezer/common";
import { block, chain, codeStmt, commentText, varSet, withComment } from "./builders";
import type { ParseContext } from "./context";
import { callBlock, callParts, convertExpr, memberParts } from "./expressions";
import { RE_DUTY, RE_FREQ, RE_I2C_SETUP, RE_OLED_SETUP, RE_PIN_SETUP, RE_PWM_SETUP, functionParts, isKnownImport, isValidPin, returnsValue } from "./patterns";
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
 * - 블록이 생기지 않는 문장(지운 import, 접힌 핀·함수) 앞의 주석 줄 → 다음 문장으로 넘김
 * - 파일 첫 문장이 import 면 그 앞 주석 줄 → 파일 머리말 (시작 블록 코멘트)
 * - 몸통 끝·파일 끝 주석 줄 → 바깥의 다음 문장 (없으면 버림)
 */
export function convertStatements(all: SyntaxNode[], ctx: ParseContext, topLevel: boolean): { blocks: BlockJson[]; tops: BlockJson[] } {
  const blocks: BlockJson[] = [];
  const tops: BlockJson[] = [];
  // 줄 끝 주석은 문장 사이에 형제로 끼어 있으므로 빼야 뒤따르는 문장(freq·duty_u16)을 바로 본다
  const nodes = all.filter((n) => n.name !== "Comment");
  let pending: string[] = [];
  for (let i = 0; i < nodes.length; ) {
    const node = nodes[i];
    const leading = [...pending, ...ctx.takeLeading(node.from)];
    pending = [];
    if (topLevel && i === 0 && node.name === "ImportStatement") ctx.header.push(...leading.splice(0));
    const r = convertStatement(node, nodes.slice(i + 1), ctx, topLevel);
    const consumed = Math.max(1, r.consumed);
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

/** while/for 의 else: 절. 블록에 자리가 없으므로 문장 전체를 code_stmt 로 남긴다 */
const hasElseClause = (node: SyntaxNode) => children(node).some((k) => k.name === "else");

const one = (b: BlockJson, consumed = 1): Converted => ({ blocks: [b], tops: [], consumed });
const none = (consumed = 1): Converted => ({ blocks: [], tops: [], consumed });
// 복합문 조각은 Body 끝의 줄바꿈까지 담기므로 끝 공백을 뗀다 (code_stmt 생성기가 줄바꿈을 붙인다)
const unknown = (node: SyntaxNode, ctx: ParseContext): Converted => { ctx.markUnparsed(node); return one(codeStmt(ctx.src.dedent(node).replace(/\s+$/, ""))); };

function convertStatement(node: SyntaxNode, following: SyntaxNode[], ctx: ParseContext, topLevel: boolean): Converted {
  const text = ctx.src.slice(node).trim();
  switch (node.name) {
    case "ImportStatement":
      return isKnownImport(text) ? none() : unknown(node, ctx);

    case "AssignStatement": {
      if (topLevel) {
        const pin = RE_PIN_SETUP.exec(text);
        if (pin && isValidPin(pin[2])) {
          if (ctx.ultrasonicFolded && pin[1] === "trig") return one(block("esp_ultrasonic_setup", { TRIG: Number(pin[2]), ECHO: ctx.echoPin }));
          if (ctx.ultrasonicFolded && pin[1] === "echo") return none();
          return one(block("esp_pin_setup", { PIN: Number(pin[2]), MODE: pin[3], VAR: { id: ctx.varId(pin[1]) } }));
        }
        const i2c = RE_I2C_SETUP.exec(text);
        if (i2c && ctx.oledFolded) return one(block("esp_oled_setup", { SCL: Number(i2c[1]), SDA: Number(i2c[2]) }));
        if (RE_OLED_SETUP.test(text) && ctx.oledFolded) return none();
        const pwm = RE_PWM_SETUP.exec(text);
        if (pwm && isValidPin(pwm[2])) {
          const [name, pinNo] = [pwm[1], Number(pwm[2])];
          const freq = following[0] ? RE_FREQ.exec(ctx.src.slice(following[0]).trim()) : null;
          const duty = following[1] ? RE_DUTY.exec(ctx.src.slice(following[1]).trim()) : null;
          if (freq && freq[1] === name) {
            if (freq[2] === "50" && duty && duty[1] === name && duty[2] === "1638") return one(block("esp_servo_setup", { VAR: { id: ctx.varId(name) }, PIN: pinNo }), 3);
            return one(block("esp_pwm_setup", { VAR: { id: ctx.varId(name) }, PIN: pinNo, FREQ: Number(freq[2]) }), 2);
          }
        }
      }
      const kids = children(node);
      if (kids.length === 3 && kids[0].name === "VariableName" && ctx.src.slice(kids[1]) === "=") {
        return one(varSet(ctx.varId(ctx.src.slice(kids[0])), convertExpr(kids[2], ctx)));
      }
      return unknown(node, ctx);
    }

    case "ExpressionStatement": {
      const expr = node.firstChild;
      if (!expr || expr.name !== "CallExpression") return unknown(node, ctx);
      const { callee, args, plain } = callParts(expr);
      if (!plain) return unknown(node, ctx);
      const member = memberParts(callee, ctx);
      if (member) {
        const { obj, prop } = member;
        const argText = args.length === 1 ? ctx.src.slice(args[0]) : null;
        if (prop === "value" && ctx.pins.has(obj) && (argText === "0" || argText === "1")) return one(block("esp_pin_write", { VAR: { id: ctx.varId(obj) }, VALUE: argText }));
        if (prop === "duty_u16" && ctx.servos.has(obj) && (argText === "8100" || argText === "1638")) return one(block("esp_servo_door", { VAR: { id: ctx.varId(obj) }, ACTION: argText }));
        if (prop === "duty_u16" && (ctx.pwms.has(obj) || ctx.servos.has(obj)) && args.length === 1) return one(block("esp_pwm_duty", { VAR: { id: ctx.varId(obj) } }, { DUTY: convertExpr(args[0], ctx, "Number") }));
        if (obj === "time" && args.length === 1) {
          if (prop === "sleep") return one(block("flow_wait", undefined, { SEC: convertExpr(args[0], ctx, "Number") }));
          if (prop === "sleep_ms") return one(block("flow_wait_ms", undefined, { MS: convertExpr(args[0], ctx, "Number") }));
          if (prop === "sleep_us") return one(block("flow_wait_us", undefined, { US: convertExpr(args[0], ctx, "Number") }));
        }
        return unknown(node, ctx);
      }
      if (callee.name === "VariableName") {
        const name = ctx.src.slice(callee);
        if (name === "print" && args.length === 1) return one(block("esp_print", undefined, { VALUE: convertExpr(args[0], ctx) }));
        if (name === "print" && args.length === 2) return one(block("esp_print2", undefined, { A: convertExpr(args[0], ctx), B: convertExpr(args[1], ctx) }));
        if (name === "show" && ctx.oledFolded && args.length === 2) return one(block("esp_oled_show", undefined, { A: convertExpr(args[0], ctx), B: convertExpr(args[1], ctx) }));
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
      if (cond.name === "UnaryExpression" && ctx.src.slice(kids[0]) === "not" && kids[1]) return one(block("controls_whileUntil", { MODE: "UNTIL" }, { BOOL: convertExpr(kids[1], ctx, "Boolean"), DO }));
      return one(block("controls_whileUntil", { MODE: "WHILE" }, { BOOL: convertExpr(cond, ctx, "Boolean"), DO }));
    }

    case "ForStatement": {
      if (hasElseClause(node)) return unknown(node, ctx);
      const ops = operands(node); // [VariableName, iterable]
      const iter = ops[1];
      const body = children(node).find((k) => k.name === "Body") ?? null;
      // flow_repeat_n 은 늘 `for i in range(n):` 을 쓰므로 반복 변수가 i 일 때만 블록으로
      const target = ops[0]?.name === "VariableName" ? ctx.src.slice(ops[0]) : null;
      if (target === "i" && iter?.name === "CallExpression") {
        const { callee, args, plain } = callParts(iter);
        if (plain && ctx.src.slice(callee) === "range" && args.length === 1) return one(block("flow_repeat_n", undefined, { TIMES: convertExpr(args[0], ctx, "Number"), DO: convertBody(body, ctx) }));
      }
      return unknown(node, ctx);
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
      if ((name === "get_distance" && ctx.ultrasonicFolded) || (name === "show" && ctx.oledFolded)) return none();
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
