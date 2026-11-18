import { issueAt } from "../walk";
import type { Rule } from "../types";

/**
 * 행사용 AI 카드 (lib-v1.7.0): 「AI 가 카드를 보면」(def on_card(card):) 은 하나만. 둘이면 뒤의 정의가 앞을 덮어
 * 어느 블록이 실행되는지 알 수 없다. 둘째부터 오류로 가리킨다.
 */
export const aiCardOnce: Rule = (ctx) =>
  ctx.blocks
    .filter((b) => b.type === "aicard_on_card" && b.topLevel && !b.shadow)
    .slice(1)
    .map((b) => issueAt(ctx, b, "aicard-duplicate", "error", "「AI 가 카드를 보면」 블록은 하나만 있어야 해요", "Error: on_card defined more than once"));
