import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CODE_FONT_TEXT, CodeFontSizeAdjuster, CodeFontSizeButton } from "@/components/editor/CodeFontSize";
import {
  clampCodeFontSize, codeFontSize, CODE_FONT_SIZE_DEFAULT, CODE_FONT_SIZE_KEY, CODE_FONT_SIZE_MAX, CODE_FONT_SIZE_MIN,
  forgetCodeFontSize, readStoredCodeFontSize, resetCodeFontSize, setCodeFontSize,
} from "./codeFontSize";
import { renderWithHost } from "./testHost";

/*
 * 코드 글자 크기 (lib-v1.0.5): 범위 고정·정수·localStorage 저장, 저장이 막히면 기본값. 조절 칸 문구에 이모지·방향어 없음.
 */

function memoryStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

function stubWindow(localStorage: unknown) {
  vi.stubGlobal("window", { localStorage, addEventListener() {}, removeEventListener() {} });
  forgetCodeFontSize();
}

afterEach(() => {
  vi.unstubAllGlobals();
  forgetCodeFontSize();
});

describe("clampCodeFontSize", () => {
  it("범위 안으로 고정하고 정수로 반올림한다", () => {
    expect(clampCodeFontSize(5)).toBe(CODE_FONT_SIZE_MIN);
    expect(clampCodeFontSize(999)).toBe(CODE_FONT_SIZE_MAX);
    expect(clampCodeFontSize(17.4)).toBe(17);
    expect(clampCodeFontSize(17.6)).toBe(18);
    expect(clampCodeFontSize("20")).toBe(20);
  });
  it("숫자가 아니면 기본값", () => {
    for (const v of [NaN, Infinity, "", "abc", null, undefined, {}, "16px"]) expect(clampCodeFontSize(v)).toBe(CODE_FONT_SIZE_DEFAULT);
  });
  it("기본값 16px, 최소 12px, 최대는 20자 이상 보이는 28px 이하", () => {
    expect(CODE_FONT_SIZE_DEFAULT).toBe(16);
    expect(CODE_FONT_SIZE_MIN).toBe(12);
    expect(CODE_FONT_SIZE_MAX).toBeGreaterThan(CODE_FONT_SIZE_DEFAULT);
    expect(CODE_FONT_SIZE_MAX).toBeLessThanOrEqual(32);
  });
});

describe("저장", () => {
  it("window 가 없으면(서버) 기본값", () => {
    expect(readStoredCodeFontSize()).toBe(CODE_FONT_SIZE_DEFAULT);
    expect(codeFontSize()).toBe(CODE_FONT_SIZE_DEFAULT);
  });

  it("저장한 값을 읽고, 바꾸면 범위 고정해 저장한다. 기본값으로 돌리면 지운다", () => {
    const s = memoryStorage({ [CODE_FONT_SIZE_KEY]: "20" });
    stubWindow(s);
    expect(codeFontSize()).toBe(20);
    expect(setCodeFontSize(100)).toBe(CODE_FONT_SIZE_MAX);
    expect(s.data.get(CODE_FONT_SIZE_KEY)).toBe(String(CODE_FONT_SIZE_MAX));
    expect(codeFontSize()).toBe(CODE_FONT_SIZE_MAX);
    expect(setCodeFontSize(13.2)).toBe(13);
    expect(s.data.get(CODE_FONT_SIZE_KEY)).toBe("13");
    expect(resetCodeFontSize()).toBe(CODE_FONT_SIZE_DEFAULT);
    expect(s.data.has(CODE_FONT_SIZE_KEY)).toBe(false);
  });

  it("저장된 값이 범위 밖·이상하면 고정하거나 기본값", () => {
    stubWindow(memoryStorage({ [CODE_FONT_SIZE_KEY]: "4" }));
    expect(codeFontSize()).toBe(CODE_FONT_SIZE_MIN);
    stubWindow(memoryStorage({ [CODE_FONT_SIZE_KEY]: "크게" }));
    expect(codeFontSize()).toBe(CODE_FONT_SIZE_DEFAULT);
  });

  it("localStorage 가 throw 하면 기본값, 바꾼 값은 이 화면에서만 유지", () => {
    const broken = {
      getItem() { throw new Error("SecurityError"); },
      setItem() { throw new Error("QuotaExceededError"); },
      removeItem() { throw new Error("SecurityError"); },
    };
    stubWindow(broken);
    expect(codeFontSize()).toBe(CODE_FONT_SIZE_DEFAULT);
    expect(() => setCodeFontSize(22)).not.toThrow();
    expect(codeFontSize()).toBe(22);
    forgetCodeFontSize();
    expect(codeFontSize()).toBe(CODE_FONT_SIZE_DEFAULT);
  });

  it("window.localStorage 접근 자체가 throw 해도 기본값", () => {
    vi.stubGlobal("window", Object.defineProperty({ addEventListener() {}, removeEventListener() {} }, "localStorage", { get() { throw new Error("blocked"); } }));
    forgetCodeFontSize();
    expect(codeFontSize()).toBe(CODE_FONT_SIZE_DEFAULT);
    expect(setCodeFontSize(18)).toBe(18);
  });
});

describe("조절 칸", () => {
  it("Provider 루트에 CSS 변수(기본 16px)를 둔다", () => {
    const html = renderWithHost(createElement("span"));
    expect(html).toContain('class="blocklab"');
    expect(html).toContain("--blocklab-code-font-size:16px");
  });

  it("슬라이더·지금 값·줄이기·키우기·기본값 단추를 그린다", () => {
    const html = renderWithHost(createElement(CodeFontSizeAdjuster));
    expect(html).toContain('data-testid="code-font-size"');
    expect(html).toContain('role="slider"');
    expect(html).toContain(`aria-valuemin="${CODE_FONT_SIZE_MIN}"`);
    expect(html).toContain(`aria-valuemax="${CODE_FONT_SIZE_MAX}"`);
    // 손잡이가 이름(코드 글자 크기)을 받는다. 지금 값 위치: (16-12)/(28-12) = 25%
    expect(html).toMatch(/role="slider"[^>]*aria-labelledby="[^"]+"/);
    expect(html).toContain(`right:${100 - ((CODE_FONT_SIZE_DEFAULT - CODE_FONT_SIZE_MIN) / (CODE_FONT_SIZE_MAX - CODE_FONT_SIZE_MIN)) * 100}%`);
    expect(html).toContain(`${CODE_FONT_SIZE_DEFAULT}px`);
    expect(html).toContain(`aria-label="${CODE_FONT_TEXT.smaller}"`);
    expect(html).toContain(`aria-label="${CODE_FONT_TEXT.larger}"`);
    expect(html).toContain(CODE_FONT_TEXT.reset);
    // 기본값이면 「기본값」 단추는 눌러도 바뀌지 않으니 꺼 둔다
    expect(html).toMatch(/disabled=""[^>]*>.*기본값/s);
  });

  it("머리줄 단추는 아이콘 단추 하나 (이름: 코드 글자 크기)", () => {
    const html = renderWithHost(createElement(CodeFontSizeButton));
    expect(html).toContain('data-testid="code-font-size-button"');
    expect(html).toContain(`aria-label="${CODE_FONT_TEXT.title}"`);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("<svg");
  });

  it("문구에 방향어·이모지가 없다", () => {
    const html = renderWithHost(createElement(CodeFontSizeAdjuster)) + renderWithHost(createElement(CodeFontSizeButton));
    const text = html.replace(/<[^>]+>/g, " ");
    for (const t of [...Object.values(CODE_FONT_TEXT), text]) {
      expect(t).not.toMatch(/아래|위쪽|위에|위의|왼쪽|오른쪽/);
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
