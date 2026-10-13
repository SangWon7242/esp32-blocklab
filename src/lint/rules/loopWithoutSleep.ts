import { issueAt, realBlocks, subtree } from "../walk";
import type { FlatBlock, LintContext, Rule } from "../types";

/** 이 블록이 있으면 반복이 쉬어 간다 (기다리기와 안에서 기다리는 장치 명령) */
const SLEEPERS = new Set(["flow_wait", "flow_wait_ms", "flow_wait_us", "dev_led_blink", "dev_beeper_tone", "dev_beeper_note", "dev_flow_run"]);
const LOOPS = new Set(["flow_repeat_forever", "controls_whileUntil"]);

/**
 * 블록들 중 쉬어 가는 것이 있는지. 코드 블록은 글에 sleep 이 있으면, 함수 호출은 그 함수 몸통이 쉬어 가면 친다.
 * defs 는 함수 이름 → 정의 블록, seen 은 재귀 호출 막기.
 */
function sleeps(ctx: LintContext, blocks: FlatBlock[], defs: Map<string, FlatBlock>, seen: Set<string>): boolean {
  return blocks.some((x) => {
    if (SLEEPERS.has(x.type)) return true;
    if (x.type === "code_stmt" || x.type === "code_expr") return /\bsleep/.test(String(x.fields.CODE ?? ""));
    if (x.type === "procedures_callnoreturn" || x.type === "procedures_callreturn") {
      const name = (x.extraState as { name?: unknown } | undefined)?.name;
      const def = typeof name === "string" ? defs.get(name) : undefined;
      if (!def || seen.has(def.id)) return false;
      seen.add(def.id);
      return sleeps(ctx, subtree(ctx, def.inputs.STACK?.block), defs, seen);
    }
    return false;
  });
}

/**
 * 계속 반복·조건 반복의 몸통(안쪽 블록 전부)에 기다리기가 없다.
 * 몸통이 빈 조건 반복(`while not echo.value(): pass`)은 핀 신호를 기다리는 꼴이라 보지 않는다 (수업 초음파 함수).
 */
export const loopWithoutSleep: Rule = (ctx) => {
  const blocks = realBlocks(ctx);
  const defs = new Map<string, FlatBlock>();
  for (const b of blocks) if (b.type === "procedures_defnoreturn" || b.type === "procedures_defreturn") defs.set(String(b.fields.NAME ?? ""), b);
  return blocks.flatMap((b) =>
    LOOPS.has(b.type) && !(b.type === "controls_whileUntil" && !b.inputs.DO?.block) && !sleeps(ctx, subtree(ctx, b.inputs.DO?.block), defs, new Set())
      ? [issueAt(ctx, b, "loop-without-sleep", "warning", "반복 안에 기다리기가 없으면 보드가 바빠져요", "Warning: loop without sleep")]
      : [],
  );
};
