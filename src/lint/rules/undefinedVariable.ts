import { findSetupByBlock } from "@/devices/registry";
import { issueAt, realBlocks } from "../walk";
import type { Rule } from "../types";

/**
 * 값을 정한 적 없는 변수 읽기. 정한 것으로 치는 것: 어디든 그 변수의 variables_set, 함수 매개변수,
 * 준비 블록의 변수 칸, n번 반복이 있을 때의 i. 변수는 이름으로 맞춘다 (파이썬도 이름으로 찾는다).
 */
export const undefinedVariable: Rule = (ctx) => {
  const blocks = realBlocks(ctx);
  const defined = new Set<string>();
  const add = (n: string | undefined) => n && defined.add(n);
  for (const b of blocks) {
    if (b.type === "variables_set") add(ctx.varName(b.fields.VAR));
    else if (b.type === "flow_repeat_n") add("i");
    else if (b.type === "procedures_defnoreturn" || b.type === "procedures_defreturn") {
      const params = (b.extraState as { params?: unknown } | undefined)?.params;
      if (Array.isArray(params)) for (const p of params) add(ctx.varName(p));
    } else {
      const setup = findSetupByBlock(b.type);
      for (const part of setup?.parts ?? []) if (part.kind === "var") add(ctx.varName(b.fields[part.name]) ?? part.default);
    }
  }
  return blocks.flatMap((b) => {
    if (b.type !== "variables_get") return [];
    const name = ctx.varName(b.fields.VAR);
    return name && !defined.has(name)
      ? [issueAt(ctx, b, "undefined-variable", "warning", `${name} 는 아직 값을 정하지 않았어요`, `NameError: name '${name}' may be undefined`)]
      : [];
  });
};
