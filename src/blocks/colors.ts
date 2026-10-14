import { LIGHT_TEXT, textColourOn, textContrastOn } from "@/lib/contrast";

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

/** 카테고리 열의 16개 카테고리 (하드웨어 8개는 장치 카테고리 id 와 같다) */
export type CategoryId =
  | "start" | "flow" | "judge" | "calc" | "variable" | "list" | "func"
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
 * 카테고리 색 (카테고리 열 타일·블록 사전 칩). 엔트리 6개 + 코드는 ENTRY_COLORS 그대로, 리스트와 하드웨어 8개는 카테고리마다
 * 다르게. 같은 계열은 명도를 벌린다: 시작(밝은 초록)·센서(어두운 올리브), 판단(밝은 파랑)·화면(짙은 파랑),
 * 계산(호박색)·LED(레몬색), 함수(주황)·모터(짙은 빨강)
 */
export const CATEGORY_COLORS: Record<CategoryId, CategoryColour> = {
  start: ENTRY_COLORS.START,
  flow: ENTRY_COLORS.FLOW,
  judge: ENTRY_COLORS.JUDGE,
  calc: ENTRY_COLORS.CALC,
  variable: ENTRY_COLORS.VARIABLE,
  // 리스트(보라): 변수(분홍 자주)·버튼·스위치(청보라) 사이. 장치 색과 ΔE 0.07 이상 떨어지고 흰 글자 4.5:1 이상
  list: shadesOf("#9c27b0"),
  func: ENTRY_COLORS.FUNC,
  pin: ENTRY_COLORS.HARDWARE,
  led: shadesOf("#c99c00"),
  switch: shadesOf("#6d3fe0"), // 계획서 #8a5cf6 은 흰 글자·검은 글자 모두 4.5:1 에 못 미쳐 어둡게
  sensor: shadesOf("#5b9a1a"),
  sound: shadesOf("#e4518c"),
  motor: shadesOf("#c92a2a"),
  display: shadesOf("#1d4ed8"),
  input: shadesOf("#8b6b3e"),
  code: ENTRY_COLORS.CODE,
};

export const CATEGORY_IDS = Object.keys(CATEGORY_COLORS) as CategoryId[];

/* ---------- 장치별 블록 색 ----------
 * 같은 카테고리 안 장치 블록은 카테고리 색 둘레(색상·밝기)에서 서로, 그리고 다른 카테고리 색과 눈에 띄게 떨어진 색을 고른다.
 * HSL 로 hue 를 돌리면 같은 L 이라도 노랑→빨강처럼 눈에 보이는 밝기가 크게 바뀌므로, 지각 균일 색 공간
 * OKLCH(L 밝기·C 채도·H 색상)에서 후보를 만들고 거리는 OKLab ΔE 로 잰다.
 */

export type Oklch = { l: number; c: number; h: number };

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** "#rrggbb" → OKLab [L, a, b] */
export function oklab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 0xff, n & 0xff].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** "#rrggbb" → OKLCH (h 는 0~360°) */
export function oklch(hex: string): Oklch {
  const [l, a, b] = oklab(hex);
  return { l, c: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

/** OKLCH → 선형 sRGB (범위를 벗어날 수 있다) */
function linearRgb({ l: L, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (c: Oklch) => linearRgb(c).every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** 이 밝기·색상에서 sRGB 로 낼 수 있는 가장 큰 채도 (c 이하) */
function maxChroma(l: number, h: number, c: number): number {
  if (inGamut({ l, c, h })) return c;
  let lo = 0;
  let hi = c;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut({ l, c: mid, h })) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * OKLCH → "#rrggbb". sRGB 밖이면 채도를 줄여 맞춘다. 다만 아주 밝은 색(노랑 근처)은 채도를 줄이면 살구색처럼
 * 바래므로, 채도가 원래의 80% 밑으로 떨어지면 밝기를 0.1 까지 낮춰 채도를 지킨다.
 */
export function fromOklch({ l, c, h }: Oklch): string {
  let best = { l, c: maxChroma(l, h, c) };
  for (let dl = 0.01; best.c < c * 0.8 && dl <= 0.1 + 1e-9; dl += 0.01) {
    const cc = maxChroma(l - dl, h, c);
    if (cc > best.c) best = { l: l - dl, c: cc };
  }
  const rgb = linearRgb({ l: best.l, c: best.c, h });
  return `#${rgb.map((v) => hex2(toGamma(Math.min(1, Math.max(0, v))) * 255)).join("")}`;
}

/** 두 색의 지각 거리 (OKLab ΔE; 0.02 쯤이 겨우 구별되는 차이) */
export function colourDistance(a: string, b: string): number {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** 두 색상(°)의 차 (0~180) */
export const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** spreadHues: 장치 색은 카테고리 색에서 색상(hue) ±30° 안 (장치가 6개 이상이면 ±45°) */
export const SPREAD_HALF = 30;
export const SPREAD_HALF_WIDE = 45;
/** spreadHues: 카테고리 색에서 밝기(OKLCH L) 를 ±0.1 까지 옮겨 본다 (글자 대비를 맞춘 뒤에도 ±0.12 안) */
export const SPREAD_LIGHTNESS = 0.1;
export const SPREAD_LIGHTNESS_LIMIT = 0.12;
/** spreadHues: 이만큼(OKLab ΔE) 떨어지면 충분하다고 보고, 그중 카테고리 색에 가장 가까운 색을 고른다 */
export const SPREAD_TARGET = 0.07;
/** 블록 사전 제목 알약 글자 대비 (WCAG AA 보통 글자) */
export const MIN_TEXT_CONTRAST = 4.5;

/** 후보 색 격자: 색상 3° · 밝기 0.02 간격 */
const HUE_GRID = 3;
const LIGHTNESS_GRID = 0.02;

/** 카테고리 색 base 계열의 후보 색 (색상 ±half, 밝기 ±SPREAD_LIGHTNESS, 채도는 base 의 70% 이상, 알약 글자 대비 4.5:1) */
function familyCandidates(base: string, half: number): string[] {
  const { l, c, h } = oklch(base);
  const out: string[] = [];
  for (let dh = -half; dh <= half + 1e-9; dh += HUE_GRID)
    for (let dl = -SPREAD_LIGHTNESS; dl <= SPREAD_LIGHTNESS + 1e-9; dl += LIGHTNESS_GRID) {
      const hue = (h + dh + 360) % 360;
      let li = l + dl;
      let hex = fromOklch({ l: li, c, h: hue });
      // 흰 글자도 진한 글자도 4.5:1 이 안 되면 흰 글자 쪽은 어둡게, 진한 글자 쪽은 밝게 (0.005 씩, 많아야 0.1)
      const step = textColourOn(hex) === LIGHT_TEXT ? -0.005 : 0.005;
      for (let t = 0; t < 20 && textContrastOn(hex) < MIN_TEXT_CONTRAST; t++) hex = fromOklch({ l: (li += step), c, h: hue });
      const x = oklch(hex);
      if (textContrastOn(hex) < MIN_TEXT_CONTRAST || Math.abs(x.l - l) > SPREAD_LIGHTNESS_LIMIT || x.c < c * 0.7) continue;
      if (!out.includes(hex)) out.push(hex);
    }
  return out;
}

/**
 * 카테고리 색 base 에서 n 가지 장치 색. 첫째는 base 그대로(카테고리 대표 장치 = 카테고리 타일 색), 그다음부터는 하나씩
 * 후보(familyCandidates) 가운데 이미 고른 색·avoid 의 색 모두와 가장 먼 색을 고른다. 다만 SPREAD_TARGET 만큼 떨어진
 * 후보가 여럿이면 그중 base 에 가장 가까운 색(카테고리 색 계열이 덜 흐려지게). 후보 순서가 정해져 있어 결과도 늘 같다.
 * avoid 에는 다른 카테고리 색과 앞 카테고리의 장치 색을 넣는다(deviceColourPlan). 장치 색은 이 결과를 카테고리 안
 * 툴박스 순서대로 src/devices/specs/*.ts 에 적어 둔다.
 */
export function spreadHues(base: string, n: number, avoid: readonly string[] = []): string[] {
  if (n <= 0) return [];
  const first = base.toLowerCase();
  const out = [first];
  if (n === 1) return out;
  const others = avoid.map((a) => a.toLowerCase()).filter((a) => a !== first);
  const candidates = familyCandidates(first, n > 5 ? SPREAD_HALF_WIDE : SPREAD_HALF);
  while (out.length < n) {
    let best = "";
    let bestScore = -Infinity;
    for (const c of candidates) {
      if (out.includes(c)) continue;
      const nearest = Math.min(...out.map((o) => colourDistance(c, o)), ...others.map((a) => colourDistance(c, a)));
      const score = Math.min(nearest, SPREAD_TARGET) - 0.01 * colourDistance(c, first);
      if (score > bestScore + 1e-9) [best, bestScore] = [c, score];
    }
    out.push(best);
  }
  return out;
}

/**
 * 하드웨어 카테고리 순서대로(counts 순서) 장치 색을 정한다. 각 카테고리는 모든 카테고리 색과 앞 카테고리에서 정한 장치 색을
 * 피한다 (예: 아날로그 핀 ↔ 흐름, PWM 핀 ↔ 온습도, 인체감지 ↔ OLED). 그래서 앞 카테고리에 장치를 더하면 뒤 카테고리 색도 바뀔 수 있다
 */
export function deviceColourPlan(counts: readonly (readonly [CategoryId, number])[]): Partial<Record<CategoryId, string[]>> {
  const categoryColours = Object.values(CATEGORY_COLORS).map((c) => c.primary);
  const plan: Partial<Record<CategoryId, string[]>> = {};
  const taken: string[] = [];
  for (const [id, n] of counts) {
    const colours = spreadHues(CATEGORY_COLORS[id].primary, n, [...categoryColours, ...taken]);
    plan[id] = colours;
    taken.push(...colours);
  }
  return plan;
}
