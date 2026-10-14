import { describe, expect, it } from "vitest";
import {
  CATEGORY_COLORS, SPREAD_HALF, SPREAD_HALF_WIDE, SPREAD_LIGHTNESS_LIMIT, colourDistance, deviceColourPlan, hueDistance, oklch, spreadHues,
} from "@/blocks/colors";
import { DEVICES, DEVICE_CATEGORIES } from "./registry";
import type { DeviceSpec } from "./types";

/** 같은 카테고리 두 장치 색, 장치 색과 다른 카테고리 색의 최소 지각 거리 (OKLab ΔE; 0.02 쯤이 겨우 보이는 차이) */
const MIN_DISTANCE = 0.06;

/** 카테고리 안 툴박스 순서 (toBlocks.ts 의 byToolboxOrder 와 같다) */
const inCategory = (c: string): DeviceSpec[] =>
  DEVICES.map((d, i) => ({ d, i }))
    .filter(({ d }) => d.category === c)
    .sort((a, b) => (a.d.toolboxOrder ?? Infinity) - (b.d.toolboxOrder ?? Infinity) || a.i - b.i)
    .map(({ d }) => d);

const PLAN = deviceColourPlan(DEVICE_CATEGORIES.map(({ id }) => [id, inCategory(id).length] as const));

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

      it("다른 카테고리 색과도 눈에 띄게 다르다", () => {
        for (const d of devices)
          for (const [other, c] of Object.entries(CATEGORY_COLORS)) {
            if (other === id || c.primary === base) continue;
            expect(colourDistance(d.colour, c.primary), `${d.id} ${d.colour} / ${other} ${c.primary}`).toBeGreaterThanOrEqual(MIN_DISTANCE);
          }
      });

      it("카테고리 색 계열이다 (색상 ±30°, 장치 6개 이상은 ±45°, 밝기 ±0.12)", () => {
        const c = oklch(base);
        const half = devices.length > 5 ? SPREAD_HALF_WIDE : SPREAD_HALF;
        for (const d of devices) {
          const x = oklch(d.colour);
          expect(hueDistance(x.h, c.h), `${d.id} 색상`).toBeLessThanOrEqual(half + 1);
          expect(Math.abs(x.l - c.l), `${d.id} 밝기`).toBeLessThanOrEqual(SPREAD_LIGHTNESS_LIMIT + 1e-6);
        }
      });

      it("deviceColourPlan 의 색을 툴박스 순서대로 쓴다 (첫 장치 = 카테고리 색)", () => {
        // 장치를 더하거나 빼면 이 카테고리(와 뒤 카테고리) 장치들의 colour 를 deviceColourPlan 결과로 다시 적는다
        expect(devices.map((d) => d.colour)).toEqual(PLAN[id]);
        expect(devices[0].colour).toBe(base.toLowerCase());
      });
    });
  }
});

it("카테고리가 다른 장치끼리도 눈에 띄게 다르다", () => {
  for (let i = 0; i < DEVICES.length; i++)
    for (let j = i + 1; j < DEVICES.length; j++) {
      const [a, b] = [DEVICES[i], DEVICES[j]];
      if (a.category === b.category) continue;
      expect(colourDistance(a.colour, b.colour), `${a.id} ${a.colour} / ${b.id} ${b.colour}`).toBeGreaterThanOrEqual(MIN_DISTANCE);
    }
});

describe("spreadHues", () => {
  it("n 이 0 이하면 빈 배열, 1 이면 base 를 소문자로", () => {
    expect(spreadHues("#5B9A1A", 0)).toEqual([]);
    expect(spreadHues("#5B9A1A", 1)).toEqual(["#5b9a1a"]);
  });

  it("avoid 의 색에서도 떨어진다", () => {
    const avoid = ["#19baea"];
    for (const c of spreadHues("#00b6b1", 5, avoid).slice(1)) expect(colourDistance(c, avoid[0]), c).toBeGreaterThanOrEqual(MIN_DISTANCE);
  });

  it("n 개를 돌려주고 첫째는 base 그대로, 나머지는 서로 다르다", () => {
    expect(spreadHues("#5b9a1a", 1)).toEqual(["#5b9a1a"]);
    const cs = spreadHues("#5b9a1a", 8);
    expect(cs).toHaveLength(8);
    expect(cs[0]).toBe("#5b9a1a");
    expect(new Set(cs).size).toBe(8);
    for (const c of cs) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("색상은 base 에서 ±30° 안(6개 이상은 ±45°)으로 벌어지고, 서로 MIN_DISTANCE 이상 떨어진다", () => {
    for (const [base, n, half] of [["#1d4ed8", 5, 30], ["#5b9a1a", 8, 45]] as const) {
      const h = oklch(base).h;
      const cs = spreadHues(base, n);
      expect(Math.max(...cs.map((c) => hueDistance(oklch(c).h, h)))).toBeLessThanOrEqual(half + 1);
      for (let i = 0; i < cs.length; i++)
        for (let j = i + 1; j < cs.length; j++) expect(colourDistance(cs[i], cs[j]), `${cs[i]} ${cs[j]}`).toBeGreaterThanOrEqual(MIN_DISTANCE);
    }
  });

  it("아주 밝은 노랑도 바래지 않는다 (채도가 base 의 70% 이상)", () => {
    const c = oklch("#ffd500").c;
    for (const x of spreadHues("#ffd500", 4)) expect(oklch(x).c, x).toBeGreaterThanOrEqual(c * 0.7);
  });
});
