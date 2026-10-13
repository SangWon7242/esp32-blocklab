import { issueAt, realBlocks } from "../walk";
import type { Rule } from "../types";

const TOP_OK = new Set(["start_program", "procedures_defnoreturn", "procedures_defreturn"]);

/** 시작 블록·함수 정의 밖에 떨어진 최상위 블록 (그 줄의 머리에 한 번) */
export const orphan: Rule = (ctx) =>
  realBlocks(ctx).flatMap((b) =>
    b.topLevel && !TOP_OK.has(b.type)
      ? [issueAt(ctx, b, "orphan", "warning", "시작 블록에 붙이지 않은 블록은 실행되지 않아요", "Warning: orphan block ignored")]
      : [],
  );
