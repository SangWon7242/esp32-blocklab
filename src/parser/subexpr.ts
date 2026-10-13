import { parser } from "@lezer/python";
import { codeExpr } from "./builders";
import type { ParseContext } from "./context";
import { convertExpr, type Check } from "./expressions";
import { children } from "./tree";
import type { BlockJson } from "./types";

/**
 * 접힌 명령의 값 칸 글(정규식 그룹)을 다시 파싱해 값 블록으로. 식 하나가 아니거나 문법 오류면 code_expr(text)
 * (unparsed 표시는 하지 않는다 — 조각 자체는 접힌 명령의 일부). 식 안의 code_expr 조각은 원문 line 번째 줄로 표시한다.
 * src/devices 가 파서에 기대지 않도록(순환 import 방지) src/devices/subexpr.ts 대신 여기에 둔다.
 */
export function parseSubExpr(text: string, ctx: ParseContext, expect?: Check, line = 1): BlockJson {
  const src = text.trim();
  const tree = parser.parse(src);
  let error = false;
  tree.iterate({ enter(n) { if (n.type.isError) error = true; } });
  const stmts = children(tree.topNode);
  const expr = stmts.length === 1 && stmts[0].name === "ExpressionStatement" ? stmts[0].firstChild : null;
  if (error || !expr || expr.from !== 0 || expr.to !== src.length) return codeExpr(src);
  return ctx.withSource(src, line, () => convertExpr(expr, ctx, expect));
}
