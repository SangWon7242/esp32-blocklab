import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readDevices } from "./circuit";
import { sceneFor } from "./testing";

const ROOT = join(import.meta.dirname, "../../../content/chapters");

describe("배선 장면 → 장치 (핀 번호)", () => {
  it("1장 LED 는 26번, 17장 초음파는 Trig 13 · Echo 12 · LED 26", () => {
    expect(readDevices(sceneFor("01-led")!).filter((d) => d.kind === "led").map((d) => (d as { pin: number }).pin)).toEqual([26]);
    const d17 = readDevices(sceneFor("17-ultrasonic")!);
    expect(d17.find((d) => d.kind === "ultrasonic")).toMatchObject({ trig: 13, echo: 12 });
    expect(d17.find((d) => d.kind === "led")).toMatchObject({ pin: 26 });
  });
  it("두 보드판의 장치 핀이 같다 (3D 장면이 있는 챕터 전부)", () => {
    for (const id of readdirSync(ROOT)) {
      const a = sceneFor(id, "plus"), b = sceneFor(id, "devkit");
      if (!a || !b) continue;
      const pins = (s: typeof a) => readDevices(s).map((d) => JSON.stringify({ ...d, part: undefined, color: undefined })).sort();
      expect(pins(a), id).toEqual(pins(b));
    }
  });
  it("확장 보드판도 장치 핀이 기본 판과 같다 (P13 S · I2C D21 · P4 기둥 …)", () => {
    let n = 0;
    for (const id of readdirSync(ROOT)) {
      const a = sceneFor(id, "plus"), x = sceneFor(id, "expansion");
      if (!a || !x) continue;
      n++;
      const pins = (s: typeof a) => readDevices(s).map((d) => JSON.stringify({ ...d, part: undefined, color: undefined })).sort();
      expect(pins(x), id).toEqual(pins(a));
    }
    expect(n).toBeGreaterThanOrEqual(2);
  });
});
