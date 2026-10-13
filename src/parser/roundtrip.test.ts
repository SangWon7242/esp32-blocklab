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
