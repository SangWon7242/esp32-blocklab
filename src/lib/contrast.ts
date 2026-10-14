/** 카테고리 색 바탕 위 글자색: 흰색과 진한 회색(neutral-900) 가운데 대비가 큰 쪽 (WCAG 상대 휘도) */

export const DARK_TEXT = "#171717";
export const LIGHT_TEXT = "#ffffff";

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** "#rrggbb" 의 상대 휘도 (0 검정 ~ 1 흰색). 읽지 못하면 null */
export function relativeLuminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 0xff) + 0.0722 * channel(n & 0xff);
}

const DARK_LUMINANCE = relativeLuminance(DARK_TEXT)!;
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** 바탕색과 그 위 글자색(textColourOn)의 대비 (1~21). 색을 읽지 못하면 1 */
export function textContrastOn(background: string): number {
  const l = relativeLuminance(background);
  if (l === null) return 1;
  return Math.max(contrast(l, DARK_LUMINANCE), contrast(l, 1));
}

/**
 * 바탕색 위에서 더 잘 읽히는 글자색. 휘도가 약 0.18 을 넘는 밝은 바탕(흐름·계산·하드웨어…)은 진한 글자,
 * 어두운 바탕(판단)은 흰 글자. 색을 읽지 못하면 흰 글자
 */
export function textColourOn(background: string): string {
  const l = relativeLuminance(background);
  if (l === null) return LIGHT_TEXT;
  return contrast(l, DARK_LUMINANCE) > contrast(l, 1) ? DARK_TEXT : LIGHT_TEXT;
}

/** 두 색의 WCAG 대비 (1~21). 하나라도 읽지 못하면 1 */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return x === null || y === null ? 1 : contrast(x, y);
}

/** WCAG 비텍스트 대비 (아이콘·테두리) */
export const MIN_ICON_CONTRAST = 3;

/**
 * 바탕색(기본 흰색) 위 아이콘 색: colour 가 바탕과 min:1 이 안 되면 검정 쪽으로 조금씩(5%) 섞어 min:1 이 될 때까지 어둡게.
 * 색을 읽지 못하면 그대로
 */
export function iconColourOn(colour: string, background = "#ffffff", min = MIN_ICON_CONTRAST): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(colour.trim());
  if (!m || relativeLuminance(background) === null) return colour;
  const n = parseInt(m[1], 16);
  const rgb = [n >> 16, (n >> 8) & 0xff, n & 0xff];
  const hex = (amount: number) => `#${rgb.map((c) => Math.round(c * (1 - amount)).toString(16).padStart(2, "0")).join("")}`;
  for (let amount = 0; amount < 1; amount += 0.05) {
    const out = hex(amount);
    if (contrastRatio(out, background) >= min) return amount === 0 ? colour : out;
  }
  return "#000000";
}

/** 카테고리 색 알약·배지의 style (바탕색 + 읽히는 글자색) */
export const categoryColourStyle = (colour: string) => ({ backgroundColor: colour, color: textColourOn(colour) });
