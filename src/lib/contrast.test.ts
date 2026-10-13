import { describe, expect, it } from "vitest";
import { ENTRY_COLORS } from "@/blocks/colors";
import { DARK_TEXT, LIGHT_TEXT, relativeLuminance, textColourOn } from "./contrast";

const ratio = (a: string, b: string) => {
  const [x, y] = [relativeLuminance(a)!, relativeLuminance(b)!].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("textColourOn", () => {
  it("밝은 카테고리 색에는 진한 글자, 어두운 색에는 흰 글자", () => {
    expect(textColourOn(ENTRY_COLORS.CALC.primary)).toBe(DARK_TEXT);
    expect(textColourOn(ENTRY_COLORS.FLOW.primary)).toBe(DARK_TEXT);
    expect(textColourOn(ENTRY_COLORS.HARDWARE.primary)).toBe(DARK_TEXT);
    expect(textColourOn(ENTRY_COLORS.JUDGE.primary)).toBe(LIGHT_TEXT);
    expect(textColourOn("#000000")).toBe(LIGHT_TEXT);
    expect(textColourOn("#ffffff")).toBe(DARK_TEXT);
  });

  it("모든 카테고리 primary 색에서 글자 대비가 4.5:1 이상", () => {
    for (const [name, c] of Object.entries(ENTRY_COLORS)) {
      expect(ratio(c.primary, textColourOn(c.primary)), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("읽지 못하는 색은 흰 글자", () => {
    expect(relativeLuminance("")).toBeNull();
    expect(textColourOn("")).toBe(LIGHT_TEXT);
  });
});
