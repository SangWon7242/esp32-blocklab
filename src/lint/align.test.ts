/// <reference types="node" />
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { registerBlocks } from "@/blocks";
import { workspaceJsonToCode } from "@/codegen";
import { codeToBlocks } from "@/parser";
import { alignLines } from "./align";

beforeAll(() => registerBlocks());

/** text 와 똑같은(앞뒤 공백·주석 무시) 줄의 번호들 (1부터) */
const linesOf = (code: string, text: string) =>
  code.split("\n").flatMap((l, i) => (l.replace(/#.*$/, "").trim() === text ? [i + 1] : []));

describe("alignLines", () => {
  const source = readFileSync(join(process.cwd(), "content/chapters/10-auto-door/step3_auto_door.py"), "utf8");
  const parsed = codeToBlocks(source);
  if (!parsed.ok) throw new Error("수업 파일이 파싱되지 않음");
  const generated = workspaceJsonToCode(parsed.json);
  const aligned = alignLines(generated, source);

  it("step3_auto_door: 재생성 코드 줄이 원문의 맞는 줄로 간다", () => {
    for (const text of ["while True:", "if d < 15:", "d = get_distance()", "time.sleep_ms(300)"]) {
      const [g] = linesOf(generated, text);
      const [s] = linesOf(source, text);
      expect(aligned.get(g), text).toBe(s);
    }
    // 같은 글의 줄은 앞에서부터 차례로 짝짓는다 (준비 줄의 닫기 → 반복 안의 닫기)
    const genOpen = linesOf(generated, "servo.duty_u16(8100)");
    const srcOpen = linesOf(source, "servo.duty_u16(8100)");
    expect(genOpen.map((g) => aligned.get(g))).toEqual(srcOpen);
    const genClose = linesOf(generated, "servo.duty_u16(1638)");
    const srcClose = linesOf(source, "servo.duty_u16(1638)");
    expect(srcClose).toHaveLength(2);
    expect(genClose.map((g) => aligned.get(g))).toEqual(srcClose);
  });

  it("짝지은 줄은 글이 같고, 원문의 주석·빈 줄은 짝이 없다", () => {
    const gen = generated.split("\n");
    const src = source.split("\n");
    const bare = (l: string) => l.replace(/#.*$/, "").trim();
    for (const [g, s] of aligned) expect(bare(src[s - 1])).toBe(bare(gen[g - 1]));
    const targets = new Set(aligned.values());
    src.forEach((line, i) => {
      if (!bare(line)) expect(targets.has(i + 1)).toBe(false);
    });
  });

  it("공백·따옴표·주석 차이는 무시하고, 원문에 없는 줄은 넣지 않는다", () => {
    const m = alignLines('x = Pin(1, Pin.OUT)\nprint("hi")\nled.value(1)\n', "# 머리말\nx=Pin(1,Pin.OUT)  # 핀\n\nprint('hi')\n");
    expect([...m]).toEqual([[1, 2], [2, 4]]);
  });

  it("순서가 바뀐 줄은 아직 짝 없는 앞쪽 줄과 짝짓는다", () => {
    const m = alignLines("a = 1\nb = 2\nc = 3\n", "b = 2\na = 1\nc = 3\n");
    expect([...m]).toEqual([[1, 2], [2, 1], [3, 3]]);
  });
});
