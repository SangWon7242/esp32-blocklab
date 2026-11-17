import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sceneFor } from "@/track/sim/testing";
import { buildAssembly } from "./assembly";

const ids = readdirSync(join(import.meta.dirname, "../../../../content/chapters")).filter((d) => /^\d/.test(d));

describe("조립 순서", () => {
  for (const id of ids) {
    for (const board of ["plus", "devkit"] as const) {
      const scene = sceneFor(id, board);
      if (!scene) continue;
      it(`${id} ${board}: 부품 · 선이 모두 한 단계에 한 번씩`, () => {
        const a = buildAssembly(scene);
        if (process.env.ASM_DEBUG) console.log(`\n## ${id} ${board}\n` + a.steps.map((s, i) => `${i + 1}. ${s.title}\n` + s.lines.map((l) => `   - ${l.text}`).join("\n")).join("\n"));
        expect(a.partStep.every((s) => s >= 1)).toBe(true);
        expect(a.wireStep.every((s) => s >= 1)).toBe(true);
        expect(a.steps.reduce((n, s) => n + s.wires.length, 0)).toBe(scene.wires.length);
        expect(a.steps.reduce((n, s) => n + s.parts.length, 0)).toBe(scene.parts.length);
        // 처음은 보드만, 그 뒤 단계는 무언가를 꽂거나 잇는다
        expect(a.steps[0].parts.length + a.steps[0].wires.length).toBe(0);
        expect(a.steps.slice(1).every((s) => s.parts.length + s.wires.length > 0)).toBe(true);
      });
    }
  }
});
