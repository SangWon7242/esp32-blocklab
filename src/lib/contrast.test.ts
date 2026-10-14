import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, ENTRY_COLORS } from "@/blocks/colors";
import { DEVICES } from "@/devices/registry";
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

  it("카테고리 열 15개 색(고른 타일·블록 사전 배지)에서 고른 글자색의 대비가 4.5:1 이상", () => {
    for (const [id, c] of Object.entries(CATEGORY_COLORS)) {
      expect(ratio(c.primary, textColourOn(c.primary)), `${id} ${c.primary}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("버튼·스위치 색은 흰 글자로 4.5:1 을 넘는다", () => {
    expect(textColourOn(CATEGORY_COLORS.switch.primary)).toBe(LIGHT_TEXT);
    expect(ratio(CATEGORY_COLORS.switch.primary, LIGHT_TEXT)).toBeGreaterThanOrEqual(4.5);
  });

  it("장치 블록 색(블록 사전 제목 알약)에서도 고른 글자색의 대비가 4.5:1 이상", () => {
    for (const d of DEVICES) expect(ratio(d.colour, textColourOn(d.colour)), `${d.id} ${d.colour}`).toBeGreaterThanOrEqual(4.5);
  });

  it("읽지 못하는 색은 흰 글자", () => {
    expect(relativeLuminance("")).toBeNull();
    expect(textColourOn("")).toBe(LIGHT_TEXT);
  });
});
