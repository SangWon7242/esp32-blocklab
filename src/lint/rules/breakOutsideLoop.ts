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
