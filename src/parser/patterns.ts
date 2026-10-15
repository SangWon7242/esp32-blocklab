import type { SyntaxNode } from "@lezer/common";
import { bodyStatements, children, operands } from "./tree";
import { normalizeCode } from "./normalize";
import type { ParseContext } from "./context";
import { isGeneratedImport } from "@/devices/imports";

/**
 * 생성기가 똑같이 다시 만드는 import 인지 (레지스트리의 import 규칙). 나머지는 code_stmt 로 남겨야 사라지지 않는다.
 * 준비 줄 정규식과 도우미 표준 본문은 레지스트리(src/devices)에 있고, 맞추기는 ./devices.ts 가 한다.
 */
export const isKnownImport = isGeneratedImport;

/** 함수 몸통의 문장들을 주석 없이, 들여쓰기 없이 한 줄씩 */
export function bodyLines(body: SyntaxNode, ctx: ParseContext): string[] {
  return bodyStatements(body).flatMap((s) => normalizeCode(ctx.src.slice(s)).map((l) => l.trim()));
}

/** 몸통이 표준 본문(들여쓰기를 뗀 줄들)과 같은지. 도우미 접기가 쓴다 */
export function isStandardBody(body: SyntaxNode, ctx: ParseContext, standard: string[]): boolean {
  const lines = bodyLines(body, ctx);
  return lines.length === standard.length && lines.every((l, i) => l === standard[i]);
}

/** 매개변수 목록 글을 견주기 좋게: 공백을 모두 뗀다 (`a, b=1` → `a,b=1`) */
export const compactParams = (params: string): string => params.replace(/\s+/g, "");

const SIMPLE_PARAM_TOKENS = new Set(["(", ")", ",", "VariableName"]);

/**
 * simple 은 함수 블록으로 옮길 수 있는지: 매개변수가 이름뿐이고(기본값·*args·**kw 없음),
 * 마지막 return 이 값을 둘 이상(`return a, b`) 돌려주지 않는다. 아니면 def 전체가 code_stmt 가 된다.
 */
export function functionParts(def: SyntaxNode, ctx: ParseContext): { name: string; params: string[]; paramText: string; body: SyntaxNode | null; simple: boolean } {
  const kids = children(def);
  const nameNode = kids.find((k) => k.name === "VariableName");
  const paramList = kids.find((k) => k.name === "ParamList");
  const body = kids.find((k) => k.name === "Body") ?? null;
  const params = paramList ? children(paramList).filter((p) => p.name === "VariableName").map((p) => ctx.src.slice(p)) : [];
  const stmts = body ? bodyStatements(body) : [];
  const last = stmts[stmts.length - 1];
  const tupleReturn = last?.name === "ReturnStatement" && operands(last).length > 1;
  const simple = (!paramList || children(paramList).every((p) => SIMPLE_PARAM_TOKENS.has(p.name))) && !tupleReturn;
  // 매개변수 목록 원문(괄호·공백을 뗀 것). 기본값이 있는 도우미(web_send 의 ctype="text/html")를 견줄 때 쓴다
  const paramText = paramList ? compactParams(ctx.src.slice(paramList).slice(1, -1)) : "";
  return { name: nameNode ? ctx.src.slice(nameNode) : "", params, paramText, body, simple };
}

/** 몸통의 마지막 문장이 값을 돌려주는 return 인지. 정의 블록 종류와 호출 블록 종류가 이 기준 하나를 함께 쓴다. */
export function returnsValue(body: SyntaxNode | null): boolean {
  const stmts = body ? bodyStatements(body) : [];
  const last = stmts[stmts.length - 1];
  return last?.name === "ReturnStatement" && operands(last).length > 0;
}
