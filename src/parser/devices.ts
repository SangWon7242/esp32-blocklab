import type { SyntaxNode } from "@lezer/common";
import { DEVICES, setupSpecs, setupVars } from "@/devices/registry";
import type { ActionSpec, DeviceSpec, HelperSpec, Part, SetupSpec, Values } from "@/devices/types";
import { block } from "./builders";
import type { ParseContext } from "./context";
import { callParts, convertExpr, memberParts, type Check } from "./expressions";
import { compactParams, isStandardBody } from "./patterns";
import { parseSubExpr } from "./subexpr";
import type { BlockJson } from "./types";

/*
 * 레지스트리(src/devices)의 패턴으로 문장·식을 장치 블록으로 바꾸는 도우미.
 * - 준비(lines):   최상위 연속 문장 texts[i..] 에 정규식을 차례로. foldOnlyWith 가 있는 선언은 코드가 그 함수를 정의하거나 부를 때만.
 * - 명령(lines):   어느 깊이에서든 연속 문장에. method·call 보다 먼저 본다.
 * - method:       등록된 장치 변수 `obj.name(args)`. obj 의 kind 가 objKinds(기본: 자기 장치 준비의 kind)에 있어야.
 * - call:         `name(args)`. 그 장치가 준비돼 있어야.
 * 블록에 짧은 도우미(helpers)가 있으면 그 도우미들이 모두 표준 몸통의 최상위 def 로 있어야(ctx.standardHelpers) 맞는다.
 * 도우미 def 자체는 숨기지 않고 늘 함수 정의 블록이 된다.
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
  return fields ? { fields, vars: setupVars(spec, fields, ms) } : null;
}

/**
 * 제자리 준비(inPlace)의 변수 칸 중 준비가 만드는 이름이 아닌 것(PINVAR)은 이미 값이 정해진 학생 변수여야 한다
 * (for 반복 변수·대입한 이름. 장치 변수는 아니다). 모르는 이름이면 그 줄은 코드로 남는다.
 */
function inPlaceVarsKnown(spec: SetupSpec, fields: Values, ctx: ParseContext): boolean {
  const provided = new Set(spec.provides(fields));
  return spec.parts.every((p) => p.kind !== "var" || provided.has(fields[p.name]) || (ctx.hasVar(fields[p.name]) && !ctx.devices.has(fields[p.name])));
}

/**
 * 문장 텍스트 texts[i..] 에 맞는 첫 준비 선언. foldOnlyWith 가 있는 선언은 코드가 그 함수 이름을 정의하거나 부를 때만(ctx.calledNames).
 * inPlaceOnly 면(몸통 안) 제자리 준비만 본다. 제자리 준비는 변수 칸 이름이 아는 변수일 때만 맞는다.
 */
export function matchSetupAt(texts: string[], i: number, ctx: ParseContext, inPlaceOnly = false): SetupMatch | null {
  for (const spec of setupSpecs()) {
    if (inPlaceOnly && !spec.inPlace) continue;
    if (spec.foldOnlyWith && !spec.foldOnlyWith.some((n) => ctx.calledNames.has(n))) continue;
    const hit = setupLinesAt(spec, texts, i);
    if (!hit || (spec.inPlace && !inPlaceVarsKnown(spec, hit.fields, ctx))) continue;
    return { spec, ...hit, consumed: spec.pattern.lines.length };
  }
  return null;
}

/** 도우미 본문을 비교용으로: 2칸 단위 들여쓰기를 뗀 줄 (파서의 bodyLines 와 같은 꼴) */
const standardBody = (h: HelperSpec): string[] => h.body.map((l) => l.trim());

/** 최상위 def 가 이 도우미와 이름·매개변수(기본값까지 글자 그대로)·표준 본문까지 같은지 */
export function isStandardHelper(h: HelperSpec, def: { paramText: string; body: SyntaxNode | null } | undefined, ctx: ParseContext): boolean {
  return !!def && !!def.body && def.paramText === compactParams(h.params) && isStandardBody(def.body, ctx, standardBody(h));
}

/**
 * 장치 블록이 부르는 짧은 도우미들이 모두 코드에 표준 몸통의 최상위 def 로 있는지. 아니면 그 호출은 학생 함수 호출이다
 * (몸통을 바꾼 get_distance 를 거리 블록으로 보이면 블록이 뜻하는 것과 코드가 다르다).
 */
const helpersReady = (spec: { helpers?: HelperSpec[] }, ctx: ParseContext): boolean => (spec.helpers ?? []).every((h) => ctx.standardHelpers.has(h.name));

/** 변수 이름이 이 장치 패턴이 받는 kind 로 등록돼 있는지 */
function kindOk(ctx: ParseContext, name: string | undefined, kinds: string[] | undefined, d: DeviceSpec): boolean {
  const dev = name === undefined ? undefined : ctx.devices.get(name);
  return !!dev && (kinds ?? (d.setup ? [d.setup.kind] : [])).includes(dev.kind);
}

/** 장치를 쓸 수 있는지: 준비가 없는 묶음(print)은 늘, 아니면 준비 줄이 접혔을 때 */
function devicePresent(d: DeviceSpec, ctx: ParseContext): boolean {
  if (!d.setup) return true;
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
    if (!helpersReady(spec, ctx)) continue;
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
    if (!helpersReady(spec, ctx)) continue;
    const extra = p.values ? p.values(m) : {};
    if (!extra) continue;
    const vals: Values = { ...(p.objPart ? { [p.objPart]: m[1] } : {}), ...extra };
    return buildBlock(spec.blockType, spec.parts, vals, ctx, ctx.src.lineOf(node.from));
  }
  return null;
}

/** 한 줄 lines 명령 중 문장 글 text 에 맞는 것 (값 칸 검사까지). 준비·접기 여부는 보지 않는다 (survey 가 쓴다) */
function oneLineActions(text: string): ActionSpec[] {
  const out: ActionSpec[] = [];
  for (const d of DEVICES) for (const a of d.actions) {
    const p = a.pattern;
    if (p.kind !== "lines" || p.lines.length !== 1) continue;
    const ms = execLines(p.lines, [text], 0);
    if (ms && p.values(ms)) out.push(a);
  }
  return out;
}

/** 문장 글이 학생 변수에 값을 정하는 한 줄 명령 꼴이면 그 이름들 (`conn, path, query = web_accept(server)`) */
export const namesDefinedBy = (text: string): string[] => oneLineActions(text).flatMap((a) => a.defines ?? []);

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
    // 짧은 도우미를 부르는 명령은 그 도우미 def 가 표준 몸통으로 있을 때만 (matchCall 과 같다)
    if (!helpersReady(spec, ctx)) continue;
    return { block: buildBlock(spec.blockType, spec.parts, vals, ctx, ctx.src.lineOf(nodes[i].from)), consumed: p.lines.length };
  }
  return null;
}
