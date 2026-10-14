import { findActionByBlock, findValueByBlock } from "@/devices/registry";
import { josa } from "../labels";
import { inputTarget, issueAt, realBlocks } from "../walk";
import type { Rule } from "../types";

/** 레지스트리 range 가 있는 값 칸에 숫자 블록(그림자 포함, 괄호 블록 안도)이 범위 밖 값으로 들어 있다. 변수·식은 보지 않는다 */
export const valueRange: Rule = (ctx) =>
  realBlocks(ctx).flatMap((b) => {
    const spec = findActionByBlock(b.type) ?? findValueByBlock(b.type);
    if (!spec?.range) return [];
    return Object.entries(spec.range).flatMap(([input, r]) => {
      let target = inputTarget(ctx, b, input);
      // 괄호 블록 (90) 은 안의 숫자를 본다
      while (target?.type === "calc_paren") target = inputTarget(ctx, target, "X");
      if (target?.type !== "math_number") return [];
      const raw = target.fields.NUM;
      const n = typeof raw === "number" ? raw : Number(raw);
      if (raw === "" || raw === null || raw === undefined || !Number.isFinite(n) || (n >= r.min && n <= r.max)) return [];
      return [issueAt(ctx, b, "value-range", "error", `${josa(r.label.ko, ["은", "는"])} ${r.min}~${r.max} 사이여야 해요`, `ValueError: ${r.label.en} must be ${r.min}..${r.max}`)];
    });
  });
