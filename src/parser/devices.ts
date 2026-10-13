import type { SyntaxNode } from "@lezer/common";
import { DEVICES, setupSpecs } from "@/devices/registry";
import type { DeviceSpec, HelperSpec, Part, SetupSpec, Values } from "@/devices/types";
import { block } from "./builders";
import type { ParseContext } from "./context";
import { callParts, convertExpr, memberParts, type Check } from "./expressions";
import { isStandardBody } from "./patterns";
import { parseSubExpr } from "./subexpr";
import type { BlockJson } from "./types";

/*
 * 레지스트리(src/devices)의 패턴으로 문장·식을 장치 블록으로 바꾸는 도우미.
 * - 준비(lines):   최상위 연속 문장 texts[i..] 에 정규식을 차례로. 도우미가 있는 선언은 ctx.folded 일 때만.
 * - 명령(lines):   어느 깊이에서든 연속 문장에. method·call 보다 먼저 본다.
 * - method:       등록된 장치 변수 `obj.name(args)`. obj 의 kind 가 objKinds(기본: 자기 장치 준비의 kind)에 있어야.
 * - call:         `name(args)`. 그 장치가 준비돼 있어야(도우미가 있으면 접혀 있어야).
 * - expr:         값 식 전체 텍스트에 정규식. objPart 가 있으면 그룹 1이 맞는 kind 의 장치 변수여야.
 * 같은 꼴에 여러 선언이 맞으면 DEVICES 순서(우선순위)로 앞의 것.
 */

export type DeviceSetupSpec = SetupSpec & { device: DeviceSpec };
export type SetupMatch = { spec: DeviceSetupSpec; fields: Values; vars: string[]; consumed: number };

/** 정규식들을 texts[i..] 에 차례로 맞춘다. 정규식이 없거나 하나라도 안 맞으면 null */
function execLines(lines: RegExp[], texts: string[], i: number): RegExpExecArray[] | null {
  if (!lines.length || i + lines.length > texts.length) return null;
  const ms: RegExpExecArray[] = [];
  for (let k = 0; k < lines.length; k++) {
    lines[k].lastIndex = 0;
    const m = lines[k].exec(texts[i + k]);
    if (!m) return null;
    ms.push(m);
  }
  return ms;
}

/** 이 준비 선언의 줄들이 texts[i..] 에 맞고 필드가 유효한지 (도우미·접기 여부는 보지 않는다) */
export function setupLinesAt(spec: SetupSpec, texts: string[], i: number): { fields: Values; vars: string[] } | null {
  const ms = execLines(spec.pattern.lines, texts, i);
  if (!ms) return null;
  const fields = spec.pattern.fields(ms);
  return fields ? { fields, vars: spec.pattern.vars(ms) } : null;
}

/** 최상위 문장 텍스트 texts[i..] 에 맞는 첫 준비 선언. 도우미가 있는 선언은 ctx.folded 에 그 장치가 있을 때만 */
export function matchSetupAt(texts: string[], i: number, ctx: ParseContext): SetupMatch | null {
  for (const spec of setupSpecs()) {
    if (spec.helpers?.length && !ctx.folded.has(spec.device.id)) continue;
    const hit = setupLinesAt(spec, texts, i);
    if (hit) return { spec, ...hit, consumed: spec.pattern.lines.length };
  }
  return null;
}

/** 도우미 본문을 비교용으로: 2칸 단위 들여쓰기를 뗀 줄 (파서의 bodyLines 와 같은 꼴) */
const standardBody = (h: HelperSpec): string[] => h.body.map((l) => l.trim());
const paramList = (params: string): string => params.split(",").map((p) => p.trim()).filter(Boolean).join(",");

/** 최상위 def 가 이 도우미와 이름·매개변수·표준 본문까지 같은지 */
export function isStandardHelper(h: HelperSpec, def: { params: string[]; body: SyntaxNode | null } | undefined, ctx: ParseContext): boolean {
  return !!def && !!def.body && def.params.join(",") === paramList(h.params) && isStandardBody(def.body, ctx, standardBody(h));
}

/** 접힌 장치의 도우미 이름인지 (그 def 는 블록을 만들지 않는다) */
export function isFoldedHelper(name: string, ctx: ParseContext): boolean {
  return DEVICES.some((d) => ctx.folded.has(d.id) && d.setup?.helpers?.some((h) => h.name === name));
}

/** 변수 이름이 이 장치 패턴이 받는 kind 로 등록돼 있는지 */
function kindOk(ctx: ParseContext, name: string | undefined, kinds: string[] | undefined, d: DeviceSpec): boolean {
  const dev = name === undefined ? undefined : ctx.devices.get(name);
  return !!dev && (kinds ?? (d.setup ? [d.setup.kind] : [])).includes(dev.kind);
}

/** 장치를 쓸 수 있는지: 준비가 없는 묶음(print)은 늘, 도우미가 있으면 접혀 있을 때, 아니면 준비 줄이 접혔을 때 */
function devicePresent(d: DeviceSpec, ctx: ParseContext): boolean {
  if (!d.setup) return true;
  if (d.setup.helpers?.length) return ctx.folded.has(d.id);
  for (const v of ctx.devices.values()) if (v.deviceId === d.id) return true;
  return false;
}

const checkOf = (p: Part): Check | undefined => (p.kind === "value" ? p.check : undefined);

/**
 * parts 순서대로 블록을 만든다. 변수 필드는 { id }, 핀·숫자는 숫자, 나머지 필드는 글 그대로.
 * 값 입력은 nodes 에 노드가 있으면 그 식을, 아니면 vals 의 글을 다시 파싱해 (line: 그 글이 있던 원문 줄)
 */
function buildBlock(type: string, parts: Part[], vals: Values, ctx: ParseContext, line: number, nodes = new Map<string, SyntaxNode>()): BlockJson {
  const fields: Record<string, unknown> = {};
  const inputs: Record<string, BlockJson | undefined> = {};
  for (const p of parts) {
    if (p.kind === "value") {
      const node = nodes.get(p.name);
      if (node) inputs[p.name] = convertExpr(node, ctx, checkOf(p));
      else if (vals[p.name] !== undefined) inputs[p.name] = parseSubExpr(vals[p.name], ctx, checkOf(p), line);
      continue;
    }
    const raw = vals[p.name];
    if (raw === undefined) continue;
    if (p.kind === "var") fields[p.name] = { id: ctx.varId(raw) };
    else if (p.kind === "pin" || p.kind === "number") fields[p.name] = Number(raw);
    else fields[p.name] = raw;
  }
  return block(type, fields, inputs);
}

/** 준비 블록 JSON */
export function setupBlock(spec: SetupSpec, fields: Values, ctx: ParseContext): BlockJson {
  return buildBlock(spec.blockType, spec.parts, fields, ctx, 1);
}

const isIntLiteral = (node: SyntaxNode, text: string) => node.name === "Number" && String(Number(text)) === text;

/**
 * 메서드·호출 인자를 parts(var 를 뺀 순서)와 1:1 로 맞춘다. allowed[j] 가 배열이면 인자 글이 그 안에 있어야 한다.
 * parts 보다 많은 인자는 allowed 가 있을 때만(고정 리터럴, 예: `oled.line(…, 1)` 의 1).
 */
function bindArgs(parts: Part[], allowed: (string[] | null)[], args: SyntaxNode[], ctx: ParseContext): { vals: Values; nodes: Map<string, SyntaxNode> } | null {
  const fieldParts = parts.filter((p) => p.kind !== "var");
  const vals: Values = {};
  const nodes = new Map<string, SyntaxNode>();
  for (let j = 0; j < args.length; j++) {
    const text = ctx.src.slice(args[j]);
    const ok = allowed[j];
    if (ok && !ok.includes(text)) return null;
    const part = fieldParts[j];
    if (!part) { if (!ok) return null; continue; }
    switch (part.kind) {
      case "value": nodes.set(part.name, args[j]); break;
      case "dropdown": if (!part.options.some(([, v]) => v === text)) return null; vals[part.name] = text; break;
      case "pin": if (!isIntLiteral(args[j], text) || Number(text) < 0 || Number(text) > 39) return null; vals[part.name] = text; break;
      case "number": if (!isIntLiteral(args[j], text)) return null; vals[part.name] = text; break;
      default: vals[part.name] = text; // text·colour: 코드 템플릿에 그대로 들어가는 글
    }
  }
  return { vals, nodes };
}

/** CallExpression 이 레지스트리의 명령(actions)/값(values) method·call 패턴에 맞으면 블록으로 */
export function matchCall(expr: SyntaxNode, ctx: ParseContext, which: "actions" | "values"): BlockJson | null {
  if (expr.name !== "CallExpression") return null;
  const { callee, args, plain } = callParts(expr);
  if (!plain) return null;
  const member = memberParts(callee, ctx);
  const plainName = callee.name === "VariableName" ? ctx.src.slice(callee) : null;
  const line = ctx.src.lineOf(expr.from);
  for (const d of DEVICES) for (const spec of d[which]) {
    const p = spec.pattern;
    if (p.kind === "method") {
      if (!member || member.prop !== p.name || args.length !== p.args.length) continue;
      if (p.objName !== undefined && member.obj !== p.objName) continue;
      if (!kindOk(ctx, member.obj, p.objKinds, d)) continue;
      const bound = bindArgs(spec.parts, p.args, args, ctx);
      if (!bound) continue;
      if (p.objPart) bound.vals[p.objPart] = member.obj;
      return buildBlock(spec.blockType, spec.parts, bound.vals, ctx, line, bound.nodes);
    }
    if (p.kind === "call") {
      if (plainName !== p.name || args.length !== p.args.length || !devicePresent(d, ctx)) continue;
      const bound = bindArgs(spec.parts, p.args, args, ctx);
      if (!bound) continue;
      return buildBlock(spec.blockType, spec.parts, bound.vals, ctx, line, bound.nodes);
    }
  }
  return null;
}

/** 값 식 전체가 레지스트리의 expr 패턴에 맞으면 값 블록으로 */
export function matchExpr(node: SyntaxNode, ctx: ParseContext): BlockJson | null {
  const text = ctx.src.slice(node);
  for (const d of DEVICES) for (const spec of d.values) {
    const p = spec.pattern;
    if (p.kind !== "expr") continue;
    p.regex.lastIndex = 0;
    const m = p.regex.exec(text);
    if (!m) continue;
    if (p.objPart ? !kindOk(ctx, m[1], p.objKinds, d) : !devicePresent(d, ctx)) continue;
    const extra = p.values ? p.values(m) : {};
    if (!extra) continue;
    const vals: Values = { ...(p.objPart ? { [p.objPart]: m[1] } : {}), ...extra };
    return buildBlock(spec.blockType, spec.parts, vals, ctx, ctx.src.lineOf(node.from));
  }
  return null;
}

/** 문장 nodes[i..](텍스트 texts[i..])가 레지스트리의 lines 명령 패턴에 맞으면 블록과 먹은 문장 수 */
export function matchActionLines(nodes: SyntaxNode[], texts: string[], i: number, ctx: ParseContext): { block: BlockJson; consumed: number } | null {
  for (const d of DEVICES) for (const spec of d.actions) {
    const p = spec.pattern;
    if (p.kind !== "lines") continue;
    const ms = execLines(p.lines, texts, i);
    if (!ms) continue;
    const vals = p.values(ms);
    if (!vals) continue;
    if (p.objPart ? !kindOk(ctx, vals[p.objPart], p.objKinds, d) : !devicePresent(d, ctx)) continue;
    return { block: buildBlock(spec.blockType, spec.parts, vals, ctx, ctx.src.lineOf(nodes[i].from)), consumed: p.lines.length };
  }
  return null;
}
