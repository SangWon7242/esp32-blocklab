/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { registerBlocks } from "@/blocks";
import { workspaceJsonToCodeWithMap } from "@/codegen";
import { codeToBlocks } from "@/parser";
import { lint } from "./index";

beforeAll(() => registerBlocks());

const root = join(process.cwd(), "content/chapters");
const files = readdirSync(root).flatMap((dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith(".py")).map((f) => join(dir, f)));

describe("수업 파일에는 오류·주의가 없다", () => {
  for (const file of files) {
    it(file, () => {
      const r = codeToBlocks(readFileSync(join(root, file), "utf8"));
      if (!r.ok) throw new Error("파싱 실패");
      const { map } = workspaceJsonToCodeWithMap(r.json);
      expect(lint(r.json, map).filter((i) => i.level !== "info")).toEqual([]);
    });
  }
});

describe("src/lint 는 Blockly·React·생성기에 기대지 않는다", () => {
  const dir = join(process.cwd(), "src/lint");
  const sources = [...readdirSync(dir), ...readdirSync(join(dir, "rules")).map((f) => join("rules", f))].filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  for (const f of sources) {
    it(f, () => {
      const text = readFileSync(join(dir, f), "utf8");
      expect(text).not.toMatch(/from\s+["'](blockly|react)/);
      expect(text).not.toMatch(/from\s+["']@\/(blocks|components|app)/);
      expect(text).not.toMatch(/from\s+["']@\/codegen(\/(?!linemap)[^"']*)?["']/);
    });
  }
});
