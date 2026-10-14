/** 블록 사전의 자료 꼴. React·Blockly 에 기대지 않는다 */

/** 블록 제목 한 조각: 고정 글(text) 또는 학생이 바꾸는 칸(slot: 필드 값·값 칸 그림자 값, 빈 값 칸은 "") */
export type TitlePart = { kind: "text"; text: string } | { kind: "slot"; text: string };

/** 손으로 쓴 설명 (src/docs/content) */
export type BlockContent = {
  /** 학생에게 말하듯 2~4문장 */
  concept: string;
  /** 시작 블록 몸통에 해당하는 코드 (import 없이). 블록으로 되돌아가야 한다 */
  example: { title: string; code: string };
  tips?: string[];
};

export type BlockDoc = {
  type: string;
  /** name: 툴박스 카테고리 이름, colour: 카테고리 primary 색 */
  category: { id: string; name: string; colour: string };
  /** 블록 자체의 색 "#rrggbb" (장치 블록은 장치마다 다르다). 제목 알약 바탕 */
  colour: string;
  title: TitlePart[];
  /** 툴박스 항목 그대로 만든 블록 하나의 코드 (값 블록이면 식) */
  code: string;
  /** 같은 종류가 툴박스에 여러 번 있을 때 나머지 항목의 제목 */
  variants?: TitlePart[][];
  tooltip: string;
} & BlockContent;

export type DocCategory = { id: string; name: string; colour: string; blocks: BlockDoc[] };
