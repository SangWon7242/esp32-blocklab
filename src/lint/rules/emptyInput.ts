import { blockLabel, requiredInputs } from "../labels";
import { issueAt, realBlocks } from "../walk";
import type { Rule } from "../types";

/** 꼭 채워야 하는 값 칸에 블록도 그림자도 없다 (블록마다 한 번) */
export const emptyInput: Rule = (ctx) =>
  realBlocks(ctx).flatMap((b) => {
    const missing = requiredInputs(b.type, b.extraState).find((name) => !b.inputs[name]?.block && !b.inputs[name]?.shadow);
    return missing === undefined
      ? []
      : [issueAt(ctx, b, "empty-input", "error", "이 칸에 값을 넣어 주세요", `SyntaxError: missing value for "${blockLabel(b.type)}"`)];
  });
