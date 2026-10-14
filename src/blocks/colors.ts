/** entryjs EntryStatic.colorSet.block 에서 가져온 엔트리 카테고리 색 (기본 / 밝게 / 어둡게) */
export const ENTRY_COLORS = {
  START: { primary: "#00b400", secondary: "#3bce3b", tertiary: "#009400" },
  FLOW: { primary: "#19baea", secondary: "#6dddfe", tertiary: "#1498c0" },
  JUDGE: { primary: "#4562f5", secondary: "#99adff", tertiary: "#1b3ad8" },
  CALC: { primary: "#f4af18", secondary: "#ffde82", tertiary: "#ff7f00" },
  VARIABLE: { primary: "#dd47d8", secondary: "#f778f3", tertiary: "#b819b3" },
  FUNC: { primary: "#de5c04", secondary: "#ff7b22", tertiary: "#a14100" },
  HARDWARE: { primary: "#00b6b1", secondary: "#78d5d3", tertiary: "#008380" },
  CODE: { primary: "#8aa3b2", secondary: "#b8c7d1", tertiary: "#728997" },
} as const;

/** 카테고리 열의 15개 카테고리 (하드웨어 8개는 장치 카테고리 id 와 같다) */
export type CategoryId =
  | "start" | "flow" | "judge" | "calc" | "variable" | "func"
  | "pin" | "led" | "switch" | "sensor" | "sound" | "motor" | "display" | "input"
  | "code";

export type CategoryColour = { primary: string; secondary: string; tertiary: string };

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");

/** "#rrggbb" 를 target(흰색 255 / 검정 0) 쪽으로 amount(0~1) 만큼 섞는다 */
function mix(hex: string, target: number, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 0xff, n & 0xff].map((c) => c + (target - c) * amount);
  return `#${ch.map(hex2).join("")}`;
}

/** primary 하나로 밝은 secondary·어두운 tertiary 를 만든다 */
export function shadesOf(primary: string): CategoryColour {
  return { primary, secondary: mix(primary, 255, 0.4), tertiary: mix(primary, 0, 0.2) };
}

/**
 * 카테고리 색 (카테고리 열 타일·블록 사전 칩). 엔트리 6개 + 코드는 ENTRY_COLORS 그대로, 하드웨어 8개는 카테고리마다
 * 다르게. 같은 계열은 명도를 벌린다: 시작(밝은 초록)·센서(어두운 올리브), 판단(밝은 파랑)·화면(짙은 파랑),
 * 계산(호박색)·LED(레몬색), 함수(주황)·모터(짙은 빨강)
 */
export const CATEGORY_COLORS: Record<CategoryId, CategoryColour> = {
  start: ENTRY_COLORS.START,
  flow: ENTRY_COLORS.FLOW,
  judge: ENTRY_COLORS.JUDGE,
  calc: ENTRY_COLORS.CALC,
  variable: ENTRY_COLORS.VARIABLE,
  func: ENTRY_COLORS.FUNC,
  pin: ENTRY_COLORS.HARDWARE,
  led: shadesOf("#ffd500"),
  switch: shadesOf("#8a5cf6"),
  sensor: shadesOf("#5b9a1a"),
  sound: shadesOf("#e4518c"),
  motor: shadesOf("#c92a2a"),
  display: shadesOf("#1d4ed8"),
  input: shadesOf("#8b6b3e"),
  code: ENTRY_COLORS.CODE,
};

export const CATEGORY_IDS = Object.keys(CATEGORY_COLORS) as CategoryId[];
