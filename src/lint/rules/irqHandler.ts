import { issueAt, realBlocks, subtree } from "../walk";
import type { FlatBlock, Rule } from "../types";
import { sleeps } from "./loopWithoutSleep";

/** 인터럽트 블록: 함수 이름 칸(FUNC)의 함수를 버튼이 눌리는 순간 부른다 */
const IRQ_BLOCKS = new Set(["dev_button_irq"]);

/**
 * 인터럽트 블록의 함수 칸 (계획 11):
 * - irq-handler-missing (오류): 그 이름의 함수 정의 블록이 없다 → 버튼을 누르는 순간 NameError
 * - irq-handler-params (오류): 함수가 매개변수 하나(눌린 핀)를 받지 않는다 → 누르는 순간 TypeError
 * - irq-handler-sleep (주의): 함수 몸통(부르는 함수까지)에 기다리기가 있다 → 인터럽트 함수는 빨리 끝나야 한다
 */
export const irqHandler: Rule = (ctx) => {
  const blocks = realBlocks(ctx);
  const defs = new Map<string, FlatBlock>();
  for (const b of blocks) if (b.type === "procedures_defnoreturn" || b.type === "procedures_defreturn") defs.set(String(b.fields.NAME ?? ""), b);
  return blocks.flatMap((b) => {
    if (!IRQ_BLOCKS.has(b.type)) return [];
    const name = String(b.fields.FUNC ?? "").trim();
    const def = defs.get(name);
    if (!def)
      return [issueAt(ctx, b, "irq-handler-missing", "error", `${name} 함수가 없어요. 함수 블록으로 먼저 만들어 주세요`, `NameError: name '${name}' is not defined`)];
    const params = (def.extraState as { params?: unknown } | undefined)?.params;
    const count = Array.isArray(params) ? params.length : 0;
    if (count !== 1)
      return [issueAt(ctx, b, "irq-handler-params", "error", `인터럽트 함수 ${name} 는 매개변수 하나(pin)를 받아야 해요`, `TypeError: ${name}() must take 1 argument (pin)`)];
    if (sleeps(ctx, subtree(ctx, def.inputs.STACK?.block), defs, new Set([def.id])))
      return [issueAt(ctx, b, "irq-handler-sleep", "warning", "인터럽트 함수 안에서는 기다리면 안 돼요", `Warning: ${name}() sleeps inside an interrupt handler`)];
    return [];
  });
};
