import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 파서(src/parser)는 장치 선언을 불러오므로 선언 쪽 파일이 Blockly 를 불러오면 파서에도 Blockly 가 실린다.
 * 선언·레지스트리·타입·import 규칙 파일에는 blockly import 가 없어야 한다 (테스트 파일은 제외).
 */
const dir = join(process.cwd(), "src/devices");
const files = [
  ...readdirSync(join(dir, "specs")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => join("specs", f)),
  "registry.ts", "types.ts", "imports.ts",
];

describe("장치 선언은 Blockly 를 불러오지 않는다", () => {
  it("검사할 파일이 있다", () => {
    expect(files).toEqual(expect.arrayContaining([join("specs", "pin.ts"), join("specs", "led.ts"), join("specs", "switch.ts"), "registry.ts"]));
  });
  for (const f of files) {
    it(f, () => {
      const text = readFileSync(join(dir, f), "utf8");
      expect(text).not.toMatch(/from\s+["']blockly/);
      expect(text).not.toMatch(/import\(\s*["']blockly/);
      expect(text).not.toMatch(/require\(\s*["']blockly/);
    });
  }
});
