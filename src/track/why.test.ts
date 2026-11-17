import { describe, expect, it } from "vitest";
import { loadChapters } from "./content";
import { hasScene3D } from "./wiring3d";
import { WHY_CARDS, WHY_IDS, whyCards } from "./why";

describe("「왜 그럴까?」 카드", () => {
  it("챕터가 고른 카드는 모두 있는 카드다", () => {
    for (const ch of loadChapters()) for (const id of ch.why ?? []) expect(WHY_IDS, `${ch.id}: ${id}`).toContain(id);
  });
  it("카드마다 질문·한 줄 답·설명·안 하면 생기는 일이 있고 id 가 겹치지 않는다", () => {
    expect(new Set(WHY_IDS).size).toBe(WHY_CARDS.length);
    for (const c of WHY_CARDS) for (const k of ["question", "short", "body", "without"] as const) expect(c[k].length, `${c.id}.${k}`).toBeGreaterThan(10);
  });
  it("모르는 id 는 건너뛴다", () => {
    expect(whyCards(["led-resistor", "nope"]).map((c) => c.id)).toEqual(["led-resistor"]);
    expect(whyCards(undefined)).toEqual([]);
  });
  it("LED 를 쓰는 1장은 저항·GND 카드를, WiFi 를 쓰는 25장은 커패시터 카드를 보여 준다", () => {
    const by = Object.fromEntries(loadChapters().map((c) => [c.id, c.why ?? []]));
    expect(by["01-led"]).toEqual(["led-resistor", "gnd"]);
    expect(by["25-web-led"]).toContain("wifi-capacitor");
  });
});

describe("3D 배선 장면", () => {
  it("1장은 두 보드 모두 장면이 있고, 장면이 없는 그림은 false", () => {
    expect(hasScene3D("01-led", "images/wiring-led.svg")).toBe(true);
    expect(hasScene3D("01-led", "images/wiring-led.devkit.svg")).toBe(true);
    expect(hasScene3D("21-oled", "images/wiring-oled.svg")).toBe(false);
    expect(hasScene3D("01-led", "../x.svg")).toBe(false);
  });
});
