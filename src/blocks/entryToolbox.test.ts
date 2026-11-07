import { describe, expect, it } from "vitest";
import { clampFlyoutWidth, FLYOUT_MIN_WIDTH } from "./entryToolbox";

describe("clampFlyoutWidth (팔레트 폭을 작업판 안으로)", () => {
  it("좁은 팔레트는 그대로", () => {
    expect(clampFlyoutWidth(300, 1000)).toBe(300);
  });
  it("넓은 함수 블록 때문에 늘어난 팔레트는 작업판의 70% 로 줄인다", () => {
    expect(clampFlyoutWidth(831, 800)).toBe(560);
  });
  it("작업판이 좁아도 아래 한계(240)까지는 두되, 작업판보다 넓게는 두지 않는다", () => {
    expect(clampFlyoutWidth(831, 294)).toBe(FLYOUT_MIN_WIDTH);
    expect(clampFlyoutWidth(831, 200)).toBe(200);
  });
  it("작업판 폭을 모르면(0) 건드리지 않는다", () => {
    expect(clampFlyoutWidth(831, 0)).toBe(831);
  });
});
