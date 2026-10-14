import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, colourDistance, hueDistance, oklch, spreadHues } from "@/blocks/colors";
import { DEVICES, DEVICE_CATEGORIES } from "./registry";
import type { DeviceSpec } from "./types";

/** 같은 카테고리 두 장치 색의 최소 지각 거리 (OKLab ΔE; 0.02 쯤이 겨우 보이는 차이) */
const MIN_DISTANCE = 0.035;
/** 카테고리 색 계열: 카테고리 색과 OKLCH 색상 차 ±35° 안, 밝기 차 0.12 안 */
const MAX_HUE_DIFF = 35;
const MAX_LIGHTNESS_DIFF = 0.12;

/** 카테고리 안 툴박스 순서 (toBlocks.ts 의 byToolboxOrder 와 같다) */
const inCategory = (c: string): DeviceSpec[] =>
  DEVICES.map((d, i) => ({ d, i }))
    .filter(({ d }) => d.category === c)
    .sort((a, b) => (a.d.toolboxOrder ?? Infinity) - (b.d.toolboxOrder ?? Infinity) || a.i - b.i)
    .map(({ d }) => d);

describe("장치별 블록 색", () => {
  it("모든 장치에 #rrggbb 색이 있다", () => {
    for (const d of DEVICES) expect(d.colour, d.id).toMatch(/^#[0-9a-f]{6}$/);
  });

  for (const { id, label } of DEVICE_CATEGORIES) {
    describe(label, () => {
      const devices = inCategory(id);
      const base = CATEGORY_COLORS[id].primary;

      it("같은 카테고리 장치끼리 눈에 띄게 다르다", () => {
        for (let i = 0; i < devices.length; i++)
          for (let j = i + 1; j < devices.length; j++) {
            const [a, b] = [devices[i], devices[j]];
            expect(colourDistance(a.colour, b.colour), `${a.id} ${a.colour} / ${b.id} ${b.colour}`).toBeGreaterThanOrEqual(MIN_DISTANCE);
          }
      });

      it("카테고리 색 계열이다 (색상 ±35°, 밝기 ±0.12)", () => {
        const c = oklch(base);
        for (const d of devices) {
          const x = oklch(d.colour);
          expect(hueDistance(x.h, c.h), `${d.id} 색상`).toBeLessThanOrEqual(MAX_HUE_DIFF);
          expect(Math.abs(x.l - c.l), `${d.id} 밝기`).toBeLessThanOrEqual(MAX_LIGHTNESS_DIFF);
        }
      });

      it("spreadHues(카테고리 색, 장치 수) 를 툴박스 순서대로 쓴다 (첫 장치 = 카테고리 색)", () => {
        // 장치를 더하거나 빼면 이 카테고리 장치들의 colour 를 spreadHues 결과로 다시 적는다
        expect(devices.map((d) => d.colour)).toEqual(spreadHues(base, devices.length));
        expect(devices[0].colour).toBe(base.toLowerCase());
      });
    });
  }
});

describe("spreadHues", () => {
  it("n 개를 돌려주고 첫째는 base 그대로, 나머지는 서로 다르다", () => {
    expect(spreadHues("#5b9a1a", 1)).toEqual(["#5b9a1a"]);
    const cs = spreadHues("#5b9a1a", 8);
    expect(cs).toHaveLength(8);
    expect(cs[0]).toBe("#5b9a1a");
    expect(new Set(cs).size).toBe(8);
    for (const c of cs) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("색상은 base 에서 ±30° 안으로 벌어진다", () => {
    const h = oklch("#1d4ed8").h;
    const hs = spreadHues("#1d4ed8", 5).map((c) => hueDistance(oklch(c).h, h));
    expect(Math.max(...hs)).toBeLessThanOrEqual(31);
    expect(Math.max(...hs)).toBeGreaterThan(10);
  });

  it("아주 밝은 노랑도 바래지 않는다 (채도가 base 의 70% 이상)", () => {
    const c = oklch("#ffd500").c;
    for (const x of spreadHues("#ffd500", 4)) expect(oklch(x).c, x).toBeGreaterThanOrEqual(c * 0.7);
  });
});
