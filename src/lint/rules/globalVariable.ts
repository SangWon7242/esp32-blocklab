import { issueAt, realBlocks } from "../walk";
import type { FlatBlock, Issue, LintContext, Rule } from "../types";

const DEFS = new Set(["procedures_defnoreturn", "procedures_defreturn"]);

/**
 * 변수 이름에 새 값을 넣는(파이썬이 그 이름을 함수의 지역 변수로 보는) 블록: 정하기, 만큼 바꾸기(+=), 리스트 만들기.
 * 리스트에 추가·끼우기·지우기·n번째 정하기는 리스트 안을 고칠 뿐 이름에 새 값을 넣지 않으므로 global 이 없어도 된다.
 */
const ASSIGNS_VAR = new Set(["variables_set", "var_change", "list_create", "list_create_from"]);

/** 블록을 담은 함수 정의 블록 (함수 밖이면 undefined) */
function enclosingDef(ctx: LintContext, b: FlatBlock): FlatBlock | undefined {
  let cur: FlatBlock | undefined = b;
  while (cur?.parentId) {
    const parent = ctx.byId.get(cur.parentId);
    if (!parent) return undefined;
    if (DEFS.has(parent.type)) return parent;
    cur = parent;
  }
  return undefined;
}

/**
 * 전역 변수 쓰기(global) 블록 (계획 11):
 * - global-outside-function (오류): 함수 정의 블록 밖의 전역 변수 쓰기 → 함수 안에서만 뜻이 있다
 * - global-missing (주의): 함수 몸통이 바깥(함수 밖)에서도 값을 넣는 변수에 값을 넣는데, 그 함수에 그 변수의 전역 변수 쓰기가 없다
 *   → 함수를 부르면 UnboundLocalError (또는 바깥 값이 그대로). 바깥과 함수 안 양쪽에서 같은 이름에 값을 넣을 때만 알린다
 */
export const globalVariable: Rule = (ctx) => {
  const blocks = realBlocks(ctx);
  const outside = new Set<string>();
  const declared = new Map<string, Set<string>>();
  const inside: { block: FlatBlock; def: FlatBlock; name: string }[] = [];
  const issues: Issue[] = [];
  for (const b of blocks) {
    if (b.type === "var_global") {
      const def = enclosingDef(ctx, b);
      if (!def) {
        issues.push(issueAt(ctx, b, "global-outside-function", "error", "함수 안에서만 쓸 수 있어요", "'global' outside function"));
        continue;
      }
      const name = ctx.varName(b.fields.VAR);
      if (name) declared.set(def.id, (declared.get(def.id) ?? new Set()).add(name));
      continue;
    }
    if (!ASSIGNS_VAR.has(b.type)) continue;
    const name = ctx.varName(b.fields.VAR);
    if (!name) continue;
    const def = enclosingDef(ctx, b);
    if (def) inside.push({ block: b, def, name });
    else outside.add(name);
  }
  // 한 함수에서 같은 변수는 한 번만 (첫 블록에)
  const seen = new Set<string>();
  for (const { block, def, name } of inside) {
    const key = `${def.id}\u0000${name}`;
    if (!outside.has(name) || declared.get(def.id)?.has(name) || seen.has(key)) continue;
    seen.add(key);
    issues.push(issueAt(ctx, block, "global-missing", "warning", "함수 안에서 바깥 변수를 바꾸려면 전역 변수 블록이 필요해요", `Warning: assignment to outer variable '${name}' without 'global'`));
  }
  return issues;
};
