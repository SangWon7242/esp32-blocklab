import { issueAt, realBlocks } from "../walk";
import type { Rule } from "../types";

/** 블록으로 바꾸지 못해 글 그대로 둔 코드 블록 */
export const rawCode: Rule = (ctx) =>
  realBlocks(ctx).flatMap((b) =>
    b.type === "code_stmt" || b.type === "code_expr"
      ? [issueAt(ctx, b, "raw-code", "info", "이 코드는 블록으로 바꾸지 못했어요. 그대로 실행됩니다", "Note: raw code kept as-is")]
      : [],
  );
