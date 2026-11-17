/*
 * OLED 화면 그리기 (0.96인치 128×64, 글자 한 줄 = 8 점). 3D 의 작은 화면 · 현장 모형 · 크게 보기가 함께 쓴다.
 * 실물처럼 검은 바탕에 하늘빛 점 글자. 줄이 길면 화면 밖으로 넘치지 않게 글자 폭을 줄인다.
 */

export const OLED_BG = "#030a1c";
export const OLED_INK = "#9fd8ff";

/** lines 를 (w × h) 캔버스에 그린다. 여덟 줄까지, 한 줄 16글자가 화면 폭에 맞게 */
export function paintOled(g: CanvasRenderingContext2D, w: number, h: number, lines: string[] | null, opts: { pad?: number; dots?: boolean } = {}) {
  const pad = opts.pad ?? Math.round(w * 0.04);
  g.fillStyle = OLED_BG;
  g.fillRect(0, 0, w, h);
  if (opts.dots) {
    // 크게 볼 때: 점(픽셀) 격자가 아주 옅게 보인다
    g.fillStyle = "rgba(159,216,255,0.05)";
    const step = (w - pad * 2) / 128;
    for (let x = pad; x < w - pad; x += step * 2) g.fillRect(x, pad, 1, h - pad * 2);
  }
  if (!lines?.length) return;
  const rows = Math.min(8, Math.max(lines.length, 4));
  const lh = (h - pad * 2) / rows;
  const size = Math.round(lh * 0.82);
  g.fillStyle = OLED_INK;
  g.textBaseline = "top";
  g.shadowColor = "rgba(159,216,255,0.55)";
  g.shadowBlur = Math.max(1, size * 0.12);
  lines.slice(0, 8).forEach((line, n) => {
    g.font = `700 ${size}px ui-monospace, "D2Coding", monospace`;
    const room = w - pad * 2;
    const tw = g.measureText(line).width;
    if (tw > room) g.font = `700 ${Math.max(6, Math.floor((size * room) / tw))}px ui-monospace, "D2Coding", monospace`;
    g.fillText(line, pad, pad + n * lh + (lh - size) / 2);
  });
  g.shadowBlur = 0;
}
