/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { workspaceJsonToCode } from "@/codegen";
import { codeToBlocks, normalizeCode } from "./index";

const root = join(__dirname, "../../content/chapters");
const files = readdirSync(root).flatMap((dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith(".py")).map((f) => join(dir, f)));

/** 글자 그대로 왕복해야 하는 챕터(블록 꼴에 맞춰 쓴 파일). 나머지 챕터의 선생님 원본은 함수 위치·import 순서가 달라 표준 꼴 안정성만 본다 */
const EXACT_CHAPTERS: string[] = []; // 비어 있으면 모든 챕터가 글자 그대로 왕복해야 한다 (계획 10)

describe("코드 → 블록 → 코드 왕복", () => {
  it("수업 파일이 14개 이상 있다", () => expect(files.length).toBeGreaterThanOrEqual(14));

  for (const file of files) {
    const exact = EXACT_CHAPTERS.length === 0 || EXACT_CHAPTERS.some((c) => file.startsWith(c + "/"));
    it(`${file}${exact ? "" : " (표준 꼴 안정)"}`, () => {
      const src = readFileSync(join(root, file), "utf8");
      const r = codeToBlocks(src);
      expect(r.ok, "파싱 성공").toBe(true);
      if (!r.ok) return;
      const out = workspaceJsonToCode(r.json);
      if (exact) {
        expect(normalizeCode(out)).toEqual(normalizeCode(src));
        expect(r.unparsed.length, JSON.stringify(r.unparsed)).toBe(0);
      } else {
        // 두 번째 왕복은 첫 번째와 같아야 한다 (판정의 canonicalLines 가 이 성질에 기댄다)
        const again = codeToBlocks(out);
        expect(again.ok, "두 번째 파싱 성공").toBe(true);
        if (!again.ok) return;
        expect(normalizeCode(workspaceJsonToCode(again.json))).toEqual(normalizeCode(out));
        // 원문의 내용 줄(import·주석·빈 줄 제외)은 순서만 다를 뿐 모두 남아 있어야 한다
        const body = (code: string) => normalizeCode(code).filter((l) => !/^(from\s+\S+\s+)?import\s/.test(l)).sort();
        expect(body(out)).toEqual(body(src));
      }
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
