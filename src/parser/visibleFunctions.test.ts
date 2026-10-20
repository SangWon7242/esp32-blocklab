/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeToBlocks } from "./index";
import { PENDING_LIB_MIGRATION } from "./pendingLibMigration";
import type { BlockJson } from "./types";

/**
 * 보호 테스트: 수업 코드의 함수가 블록 화면에서 숨지 않는다 ("블록으로 짠 코드는 실제 파이썬 코드로, 실제 코드는 블록으로").
 * 모든 수업 파일(content/chapters/*\/*.py)에서
 * - 코드 블록(code_stmt·code_expr)이 하나도 없고,
 * - 파일의 맨 바깥 `def 이름` 이 모두 같은 이름의 함수 정의 블록이 된다 (장치 준비 안으로 접혀 사라지지 않는다).
 * 보드 라이브러리로 옮길 옛 꼴의 수업 파일(PENDING_LIB_MIGRATION)은 다음 단계에서 고칠 때까지 건너뛴다.
 */

const root = join(__dirname, "../../content/chapters");
const files = readdirSync(root).flatMap((dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith(".py")).map((f) => `${dir}/${f}`));

/** 블록 JSON 아래(값 입력·몸통·next)의 모든 블록 type */
function allTypes(b: BlockJson | undefined, out: string[] = []): string[] {
  if (!b) return out;
  out.push(b.type);
  for (const input of Object.values(b.inputs ?? {})) { allTypes(input.block, out); allTypes(input.shadow, out); }
  allTypes(b.next?.block, out);
  return out;
}

describe("수업 파일의 함수는 모두 함수 블록으로 보인다", () => {
  it("수업 파일이 있고, 건너뛰는 목록의 파일은 모두 실제로 있다", () => {
    expect(files.length).toBeGreaterThan(100);
    for (const f of PENDING_LIB_MIGRATION) expect(files, f).toContain(f);
  });

  for (const file of files) {
    const pending = PENDING_LIB_MIGRATION.includes(file);
    (pending ? it.skip : it)(`${file}${pending ? " (PENDING_LIB_MIGRATION)" : ""}`, () => {
      const src = readFileSync(join(root, file), "utf8");
      const r = codeToBlocks(src);
      expect(r.ok, "파싱 성공").toBe(true);
      if (!r.ok) return;
      const tops = r.json.blocks.blocks as BlockJson[];
      const types = tops.flatMap((t) => allTypes(t));
      expect(types.filter((t) => t === "code_stmt" || t === "code_expr"), "코드 블록").toEqual([]);
      expect(r.unparsed).toEqual([]);
      const defs = [...src.matchAll(/^def (\w+)\(/gm)].map((m) => m[1]);
      const blocks = tops.filter((t) => t.type === "procedures_defnoreturn" || t.type === "procedures_defreturn").map((t) => (t.fields as { NAME?: string } | undefined)?.NAME);
      expect(blocks, "맨 바깥 def → 함수 정의 블록").toEqual(defs);
    });
  }
});
