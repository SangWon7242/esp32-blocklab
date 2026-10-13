import { issueAt, TOP_OK } from "../walk";
import type { Rule } from "../types";

/** 시작 블록·함수 정의 밖에 떨어진 최상위 블록 (그 줄의 머리에 한 번). 다른 규칙은 떨어진 블록을 보지 않는다 */
export const orphan: Rule = (ctx) =>
  ctx.blocks.flatMap((b) =>
    b.topLevel && !b.shadow && !TOP_OK.has(b.type)
      ? [issueAt(ctx, b, "orphan", "warning", "시작 블록에 붙이지 않은 블록은 실행되지 않아요", "Warning: orphan block ignored")]
      : [],
  );
