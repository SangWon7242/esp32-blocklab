import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CODE_FONT_STACK } from "@/host/codeFontSize";

/*
 * 코드 글꼴·기본 색 (lib-v1.0.5): index.css 의 @font-face(D2Coding)·글꼴 스택·리가처 끄기, 글꼴 파일·라이선스, muted-foreground 대비.
 */

const root = path.resolve(import.meta.dirname, "../..");
const css = readFileSync(path.join(root, "src/index.css"), "utf8");
const fonts = path.join(root, "public/blocklab/fonts");

describe("코드 글꼴 D2Coding", () => {
  it("@font-face 가 /blocklab/fonts/ 의 woff2 를 font-display: swap 으로 부른다", () => {
    const face = /@font-face\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(face).toMatch(/font-family:\s*"D2Coding"/);
    expect(face).toMatch(/font-display:\s*swap/);
    const url = /url\("([^"]+)"\)\s*format\("woff2"\)/.exec(face)?.[1];
    expect(url).toBe("/blocklab/fonts/D2Coding-Regular.woff2");
    const file = path.join(fonts, path.basename(url!));
    expect(existsSync(file)).toBe(true);
    // WOFF2 머리(wOF2)
    expect(readFileSync(file).subarray(0, 4).toString("latin1")).toBe("wOF2");
    expect(statSync(file).size).toBeGreaterThan(100_000);
  });

  it("라이선스 OFL.txt 를 글꼴과 함께 둔다", () => {
    const ofl = readFileSync(path.join(fonts, "OFL.txt"), "utf8");
    expect(ofl).toMatch(/SIL OPEN FONT LICENSE Version 1\.1/i);
    expect(ofl).toContain("NAVER");
  });

  it("글꼴 스택은 D2Coding 먼저, 코드(font-mono·code·pre)는 리가처를 끈다", () => {
    expect(CODE_FONT_STACK).toBe('"D2Coding", "D2Coding ligature", ui-monospace, "SF Mono", Menlo, Consolas, monospace');
    expect(css).toContain(`--blocklab-font-code: ${CODE_FONT_STACK};`);
    expect(css).toContain("--font-mono: var(--blocklab-font-code);");
    expect(css).toMatch(/code, kbd, samp, pre, \.font-mono \{[^}]*font-variant-ligatures: none/);
    expect(css).toContain("--blocklab-code-font-size: 16px;");
  });
});

/** 무채색 oklch(L 0 0) 의 상대 휘도 = L³ (OKLab → 선형 sRGB) */
const lum = (l: number) => l ** 3;
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
function token(block: string, name: string): number {
  const m = new RegExp(`--${name}: var\\(--host-${name}, oklch\\(([\\d.]+) 0 0\\)\\)`).exec(block);
  if (!m) throw new Error(`${name} 토큰이 무채색 oklch 가 아니에요`);
  return Number(m[1]);
}

describe("기본 토큰은 흰색·무채색이고 흐린 글자도 AA(4.5:1)", () => {
  const light = /:root \{([\s\S]*?)\n\}/.exec(css)![1];
  const dark = /\.dark \{([\s\S]*?)\n\}/.exec(css)![1];

  it("밝은 테마: 바탕·카드·팝오버는 흰색, muted-foreground 는 흰 바탕·muted 바탕 모두 4.5:1 이상", () => {
    for (const t of ["background", "card", "popover"]) expect(token(light, t)).toBe(1);
    const fg = lum(token(light, "muted-foreground"));
    expect(ratio(fg, lum(token(light, "background")))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(fg, lum(token(light, "muted")))).toBeGreaterThanOrEqual(4.5);
  });

  it("어두운 테마: muted-foreground 가 바탕·카드·muted 위 4.5:1 이상", () => {
    const fg = lum(token(dark, "muted-foreground"));
    for (const t of ["background", "card", "muted"]) expect(ratio(fg, lum(token(dark, t)))).toBeGreaterThanOrEqual(4.5);
  });

  it("토큰 기본값에 색조(베이지·크림) 가 없다 — 경고·차트 밖 shadcn 토큰은 모두 chroma 0", () => {
    const decls = [...light.matchAll(/--([\w-]+): var\(--host-[\w-]+, (oklch\([^)]*\))\)/g)];
    expect(decls.length).toBeGreaterThan(20);
    for (const [, name, value] of decls) {
      if (name === "destructive") continue;
      expect(value, name).toMatch(/^oklch\([\d.]+ 0 0( \/ [\d.%]+)?\)$/);
    }
  });
});
