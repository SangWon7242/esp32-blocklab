import { issueAt, realBlocks } from "../walk";
import type { FlatBlock, LintContext, Rule } from "../types";

/** 몸통(DO)에 멈추기·건너뛰기를 담을 수 있는 반복 블록 */
const LOOPS = new Set(["flow_repeat_forever", "flow_repeat_n", "controls_whileUntil", "flow_for_each", "flow_for_range"]);
/** 함수 몸통에서 멈춘다: 함수를 반복 안에서 불러도 def 안의 break 는 SyntaxError */
const DEFS = new Set(["procedures_defnoreturn", "procedures_defreturn"]);

/** 블록을 담은 블록을 거슬러 올라가 반복의 몸통 안에 있는지 */
function insideLoop(ctx: LintContext, b: FlatBlock): boolean {
  let cur: FlatBlock | undefined = b;
  while (cur?.parentId) {
    const parent = ctx.byId.get(cur.parentId);
    if (!parent || DEFS.has(parent.type)) return false;
    if (LOOPS.has(parent.type) && cur.inputName === "DO") return true;
    cur = parent;
  }
  return false;
}

/** 반복 밖의 멈추기(break)·건너뛰기(continue)는 파이썬이 SyntaxError 로 거절한다 */
export const breakOutsideLoop: Rule = (ctx) =>
  realBlocks(ctx).flatMap((b) => {
    if (b.type !== "flow_break" && b.type !== "flow_continue") return [];
    if (insideLoop(ctx, b)) return [];
    const word = b.type === "flow_break" ? "break" : "continue";
    // 파이썬(MicroPython) 오류 모양: SyntaxError: 'break' outside loop
    return [issueAt(ctx, b, "break-outside-loop", "error", "반복 안에서만 쓸 수 있어요", `SyntaxError: '${word}' outside loop`)];
  });

/** 반복 변수를 학생이 고르는 반복 (VAR 칸) */
const VAR_LOOPS = new Set(["flow_for_each", "flow_for_range"]);

/** 바깥 반복 중 반복 변수가 i 인 것 (함수 몸통에서 멈춘다: def 안의 i 는 따로) */
function outerLoopUsingI(ctx: LintContext, b: FlatBlock): FlatBlock | undefined {
  let cur: FlatBlock | undefined = b;
  while (cur?.parentId) {
    const parent = ctx.byId.get(cur.parentId);
    if (!parent || DEFS.has(parent.type)) return undefined;
    if (VAR_LOOPS.has(parent.type) && cur.inputName === "DO" && ctx.varName(parent.fields.VAR) === "i") return parent;
    cur = parent;
  }
  return undefined;
}

/** n번 반복은 늘 `for i in range(n):` 이라 바깥 반복의 i 를 덮어쓴다 (안쪽 반복이 끝나면 바깥 i 가 n-1 이 된다) */
export const repeatReusesI: Rule = (ctx) =>
  realBlocks(ctx).flatMap((b) =>
    b.type === "flow_repeat_n" && outerLoopUsingI(ctx, b)
      ? [issueAt(ctx, b, "repeat-reuses-i", "warning", "바깥 반복도 i 를 쓰고 있어요. 안쪽 반복의 i 가 바깥 i 를 덮어써요", "Warning: inner loop reuses 'i' of the outer loop")]
      : [],
  );
