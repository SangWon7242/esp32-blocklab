import { parser } from "@lezer/python";
import type { SyntaxNode } from "@lezer/common";

/*
 * 메이커 데이 「색깔 카드 AI」 코딩 단계 (lib-v1.7.0). 노트북 AI 가 카드를 알아보면 보드에서 `on_card("<색>")` 을 부른다.
 * 보드가 할 일은 아이가 블록으로 만든 `def on_card(card): …` 가 정한다. RGB 준비(set_color, 핀 R27·G25·B26)는 호스트가
 * 연결 때 먼저 올리므로 아이 코드는 PWM 핀을 만들지 않고 set_color 만 부른다.
 * 이 파일은 순수(React·DOM·Blockly 없음)라 서버 입구(core)에서도 쓴다.
 */

/** AI 가 알아보는 카드 (on_card 에 넘어오는 글). "none" 은 카드가 없을 때 */
export const AI_CARD_IDS = ["red", "yellow", "green", "blue", "purple", "none"] as const;
export type AiCardId = (typeof AI_CARD_IDS)[number];

/** 카드 이름 블록 드롭다운에 보이는 글 */
export const AI_CARD_LABELS: Record<AiCardId, string> = {
  red: "빨강 카드",
  yellow: "노랑 카드",
  green: "초록 카드",
  blue: "파랑 카드",
  purple: "보라 카드",
  none: "카드 없음",
};

export const isAiCardId = (s: string): s is AiCardId => (AI_CARD_IDS as readonly string[]).includes(s);

/** 이벤트 함수 이름과 매개변수 (`def on_card(card):`) */
export const AI_CARD_FUNCTION = "on_card";
export const AI_CARD_PARAM = "card";

/** 호스트가 보드에 미리 올려 두는 것: RGB 장치(red·green·blue PWM)와 set_color(r, g, b) 도우미 */
export const AI_CARD_HOST_DEVICES: readonly string[] = ["rgb"];
export const AI_CARD_HOST_HELPERS: readonly string[] = ["set_color"];

/** 코딩 단계 시작 뼈대: 빨강 한 줄 */
export function aiCardStarterCode(): string {
  return ['def on_card(card):', '    if card == "red":', "        set_color(255, 0, 0)", ""].join("\n");
}

export type AiCardCheck =
  | { ok: true }
  | { ok: false; reason: "syntax"; line: number; message: string }
  | { ok: false; reason: "missing" | "duplicate" | "params"; line?: number; message: string };

const lineOf = (code: string, pos: number) => code.slice(0, pos).split("\n").length;

function childrenOf(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let c = node.firstChild; c; c = c.nextSibling) out.push(c);
  return out;
}

/**
 * 아이 코드를 보드에 올려도 되는지: 문법 오류가 없고, 맨 바깥에 `def on_card(card):` 가 꼭 하나 있다 (매개변수 하나).
 * AiCardEditor 의 onChange(code, ok) 의 ok 가 이것이다.
 */
export function checkAiCardCode(code: string): AiCardCheck {
  const tree = parser.parse(code);
  let errorAt = -1;
  tree.iterate({ enter(n) { if (errorAt < 0 && n.type.isError) errorAt = n.from; } });
  if (errorAt >= 0) return { ok: false, reason: "syntax", line: lineOf(code, errorAt), message: "문법 오류가 있어요. 이 줄을 다시 읽어 보세요." };
  const defs = childrenOf(tree.topNode).filter((n) => {
    if (n.name !== "FunctionDefinition") return false;
    const name = childrenOf(n).find((k) => k.name === "VariableName");
    return !!name && code.slice(name.from, name.to) === AI_CARD_FUNCTION;
  });
  if (defs.length === 0) return { ok: false, reason: "missing", message: "「AI 가 카드를 보면」 블록이 없어요." };
  if (defs.length > 1) return { ok: false, reason: "duplicate", line: lineOf(code, defs[1].from), message: "「AI 가 카드를 보면」 블록은 하나만 있어야 해요." };
  const params = childrenOf(defs[0]).find((k) => k.name === "ParamList");
  const names = params ? childrenOf(params).filter((p) => p.name !== "(" && p.name !== ")" && p.name !== ",") : [];
  if (names.length !== 1 || names[0].name !== "VariableName") return { ok: false, reason: "params", line: lineOf(code, defs[0].from), message: "on_card 는 카드 하나(card)를 받아야 해요." };
  return { ok: true };
}
