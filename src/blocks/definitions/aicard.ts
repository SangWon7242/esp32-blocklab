import { AI_CARD_IDS, AI_CARD_LABELS } from "@/aicard/cards";

/*
 * 행사용 「AI 카드」 블록 (lib-v1.7.0). 노트북 AI 가 카드를 알아보면 보드에서 on_card("<색>") 을 부른다.
 * - aicard_on_card: 「AI 가 카드를 보면」 = `def on_card(card):` + 몸통 (맨 바깥, 하나만)
 * - aicard_card:    「AI 가 본 카드」 = `card`
 * - aicard_name:    「[빨강 카드▼]」 = `"red"` … `"none"`
 * 코드 ↔ 블록: src/parser/statements.ts (def on_card(card):) · expressions.ts (card, 카드 이름 글자)
 */
export const aiCardBlocks: Record<string, unknown>[] = [
  {
    type: "aicard_on_card",
    message0: "AI 가 카드를 보면",
    message1: "%1",
    args1: [{ type: "input_statement", name: "BODY" }],
    style: "aicard_blocks",
    hat: "cap",
    tooltip: "노트북 AI 가 카드를 알아볼 때마다 이 안의 블록을 실행합니다. 코드: def on_card(card):",
  },
  {
    type: "aicard_card",
    message0: "AI 가 본 카드",
    output: "String",
    style: "aicard_blocks",
    tooltip: "AI 가 지금 본 카드 이름 (card). 「카드 이름」 블록과 같은지 견주어 보세요.",
  },
  {
    type: "aicard_name",
    message0: "%1",
    args0: [{ type: "field_dropdown", name: "CARD", options: AI_CARD_IDS.map((id) => [AI_CARD_LABELS[id], id]) }],
    output: "String",
    style: "aicard_blocks",
    tooltip: "카드 이름: \"red\" 빨강, \"yellow\" 노랑, \"green\" 초록, \"blue\" 파랑, \"purple\" 보라, \"none\" 카드 없음",
  },
];
