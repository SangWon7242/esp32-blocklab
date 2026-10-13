import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/* src/device 는 React·Blockly 를 모르고, 프로토콜 쪽 파일은 브라우저 전역(DOM·Web Serial)도 모른다. */
const dir = join(process.cwd(), "src/device");
const sources = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const DOM_FREE = ["types.ts", "base.ts", "rawRepl.ts", "traceback.ts", "fake.ts"];

describe("src/device 경계", () => {
  it("검사할 파일이 있다", () => {
    expect(sources).toEqual(expect.arrayContaining([...DOM_FREE, "webSerial.ts", "libs.ts"]));
  });
  for (const f of sources) {
    it(`${f}: react·blockly 를 불러오지 않는다`, () => {
      const text = readFileSync(join(dir, f), "utf8");
      expect(text).not.toMatch(/from\s+["'](react|blockly)/);
      expect(text).not.toMatch(/import\(\s*["'](react|blockly)/);
      expect(text).not.toMatch(/from\s+["']@\/(app|components|blocks)\//);
    });
  }
  for (const f of DOM_FREE) {
    it(`${f}: navigator·window·document 를 쓰지 않는다`, () => {
      const text = readFileSync(join(dir, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(text).not.toMatch(/\b(navigator|window|document)\b/);
    });
  }
});
