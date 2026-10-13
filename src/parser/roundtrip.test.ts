/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { workspaceJsonToCode } from "@/codegen";
import { codeToBlocks, normalizeCode } from "./index";

const root = join(__dirname, "../../content/chapters");
const files = readdirSync(root).flatMap((dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith(".py")).map((f) => join(dir, f)));

describe("코드 → 블록 → 코드 왕복", () => {
  it("수업 파일이 14개 있다", () => expect(files).toHaveLength(14));

  for (const file of files) {
    it(file, () => {
      const src = readFileSync(join(root, file), "utf8");
      const r = codeToBlocks(src);
      expect(r.ok, "파싱 성공").toBe(true);
      if (!r.ok) return;
      const out = workspaceJsonToCode(r.json);
      expect(normalizeCode(out)).toEqual(normalizeCode(src));
      // step1_distance 는 두 줄짜리 get_distance 라서 time.ticks_* 식 3개가 코드 식으로 남는다
      const allowed = file.endsWith("step1_distance.py") ? 3 : 0;
      expect(r.unparsed.length, JSON.stringify(r.unparsed)).toBeLessThanOrEqual(allowed);
    });
  }
});

describe("최종 리뷰: 왕복에서 사라지던 코드", () => {
  const roundTrip = (src: string) => {
    const r = codeToBlocks(src);
    if (!r.ok) throw new Error(r.error.message);
    return workspaceJsonToCode(r.json);
  };

  it("C1 모르는 machine import 는 한 번만, 핀 준비보다 위에", () => {
    const out = roundTrip("from machine import Pin, UART\nuart = UART(Pin(34))\n");
    expect(out.match(/^from machine import .*$/gm)).toEqual(["from machine import Pin, UART"]);
    expect(normalizeCode(out)).toEqual(["from machine import Pin, UART", "uart = UART(Pin(34))"]);
    expect(roundTrip("from machine import Pin, UART\nled = Pin(2, Pin.OUT)\nled.value(1)\n")).toBe("from machine import Pin, UART\n\nled = Pin(2, Pin.OUT)\n\nled.value(1)\n");
    expect(normalizeCode(roundTrip("from machine import Pin as P\nimport time as t\nt.sleep(1)\n"))).toEqual(["from machine import Pin as P", "import time as t", "t.sleep(1)"]);
  });

  it("N1 남긴 from machine 줄이 주지 않는 이름은 따로 가져온다", () => {
    const out = roundTrip("from machine import Pin\nfrom machine import ADC\nled = Pin(2, Pin.OUT)\nadc = ADC(Pin(34))\n");
    const imported = (out.match(/^from machine import .*$/gm) ?? []).flatMap((l) => l.replace(/^from machine import /, "").split(",").map((n) => n.trim()));
    expect(imported.sort()).toEqual(["ADC", "Pin"]);
  });

  it("C2 이어진 비교는 그대로 돌아온다", () => {
    const src = "d = 3\nif 5 < d < 15:\n    print(d)\n";
    expect(roundTrip(src)).toBe(src);
  });
});

describe("최종 리뷰 I5: 주석 줄도 왕복", () => {
  /** 빈 줄을 빼고, 주석 앞 공백(열 맞춤)은 두 칸으로 */
  const lines = (code: string) => code.split("\n").map((l) => l.trimEnd().replace(/\s+#/, "  #")).filter((l) => l.length > 0);

  it("10-auto-door/extra1_led.py 의 머리말·줄 끝 주석이 순서대로 남는다", () => {
    const src = readFileSync(join(root, "10-auto-door/extra1_led.py"), "utf8");
    const r = codeToBlocks(src);
    if (!r.ok) throw new Error(r.error.message);
    expect(lines(workspaceJsonToCode(r.json))).toEqual(lines(src));
  });
});
