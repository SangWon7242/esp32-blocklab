/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { registerBlocks } from "@/blocks";
import { workspaceJsonToCode, type WorkspaceJson } from "@/codegen";
import { codeToBlocks } from "@/parser";
import type { BlockJson } from "@/parser/types";
import { parseChapter, type LoadedChapter } from "./content";
import { allSteps } from "./gating";
import { DESIGN_FAIL, gradeBlank, gradeBlanks, scatterStartBody } from "./design";
import { judge } from "./judge";
import type { StepOf } from "./schema";

const root = join(process.cwd(), "content/chapters");
const chapters: Record<string, LoadedChapter> = {};
beforeAll(() => {
  registerBlocks();
  for (const dir of ["01-led", "10-auto-door"]) {
    const files: Record<string, string> = {};
    for (const f of readdirSync(join(root, dir)).filter((f) => f.endsWith(".py"))) files[f] = readFileSync(join(root, dir, f), "utf8");
    chapters[dir] = parseChapter(readFileSync(join(root, dir, "chapter.yaml"), "utf8"), files, dir);
  }
});

describe("gradeBlank", () => {
  it("숫자 답은 첫 숫자를 tolerance 범위로 비교한다", () => {
    expect(gradeBlank({ answer: 1 }, "1")).toBe(true);
    expect(gradeBlank({ answer: 1 }, "1초")).toBe(true);
    expect(gradeBlank({ answer: 1 }, "2")).toBe(false);
    expect(gradeBlank({ answer: "15 cm" }, "15")).toBe(true);
    expect(gradeBlank({ answer: "15 cm", tolerance: 2 }, "16cm")).toBe(true);
    expect(gradeBlank({ answer: "15 cm", tolerance: 2 }, "18")).toBe(false);
    expect(gradeBlank({ answer: "0.3" }, ".3")).toBe(true);
    expect(gradeBlank({ answer: "0.3" }, "삼")).toBe(false);
  });

  it("글 답은 공백을 무시하고, 괄호 속·앞 말도 받는다", () => {
    expect(gradeBlank({ answer: "잰다" }, " 잰다 ")).toBe(true);
    expect(gradeBlank({ answer: "잰다" }, "본다")).toBe(false);
    expect(gradeBlank({ answer: "문(서보)" }, "문")).toBe(true);
    expect(gradeBlank({ answer: "문(서보)" }, "서보")).toBe(true);
    expect(gradeBlank({ answer: "문(서보)" }, "문 (서보)")).toBe(true);
  });

  it("answer 가 없으면 비어 있지 않은 글이면 맞다", () => {
    expect(gradeBlank({}, "아무 말")).toBe(true);
    expect(gradeBlank({}, "  ")).toBe(false);
    expect(gradeBlank(undefined, "x")).toBe(true);
  });

  it("gradeBlanks: 빈칸 없는 줄은 null", () => {
    const step = allSteps(chapters["01-led"]).find((s) => s.type === "design") as StepOf<"design">;
    expect(gradeBlanks(step, [undefined, undefined, "1", undefined, "3"])).toEqual([null, null, true, null, false]);
  });
});

const tops = (json: unknown) => (json as { blocks: { blocks: BlockJson[] } }).blocks.blocks;

/** 흩어 둔 조각을 순서대로 시작 블록에 잇는다 (학생이 맞게 조립한 것) */
function reassemble(json: unknown, order: BlockJson[]): WorkspaceJson {
  const ws = structuredClone(json) as { blocks: { blocks: BlockJson[] } };
  const list = ws.blocks.blocks;
  const start = list.find((b) => b.type === "start_program")!;
  const pieces = order.map((p) => list.find((b) => b === p || (b.x === p.x && b.y === p.y && b.type === p.type))!);
  pieces.forEach((p, i) => {
    delete (p as { disabledReasons?: string[] }).disabledReasons;
    if (pieces[i + 1]) p.next = { block: pieces[i + 1] };
  });
  start.inputs = { ...(start.inputs ?? {}), BODY: { block: pieces[0] } };
  ws.blocks.blocks = list.filter((b) => !pieces.includes(b));
  return ws as unknown as WorkspaceJson;
}

describe("scatterStartBody", () => {
  for (const [chapterId, file] of [["01-led", "step4_blink_loop.py"], ["10-auto-door", "step2_door.py"]] as const) {
    it(`${chapterId}: 시작 블록만 남고 조각은 꺼져 있으며, 맞는 순서로 이으면 codeEquals 를 통과한다`, () => {
      const target = chapters[chapterId].files[file];
      const r = codeToBlocks(target);
      if (!r.ok) throw new Error("parse");
      const original = tops(r.json).find((b) => b.type === "start_program")!;
      const expectedOrder: string[] = [];
      for (let b = original.inputs?.BODY?.block; b; b = b.next?.block) expectedOrder.push(JSON.stringify({ ...b, next: undefined }));

      let seed = 0.37;
      const rand = () => (seed = (seed * 9301 + 0.49297) % 1);
      const scattered = scatterStartBody(r.json, rand);
      const list = tops(scattered);
      const start = list.find((b) => b.type === "start_program")!;
      expect(start.inputs?.BODY).toBeUndefined();
      expect(start).toMatchObject({ movable: false, deletable: false });
      const pieces = list.filter((b) => b.type !== "start_program" && b.type !== "func_def" && (b as { disabledReasons?: string[] }).disabledReasons);
      expect(pieces).toHaveLength(expectedOrder.length);
      for (const p of pieces) expect(p.next).toBeUndefined();

      // 흩어 둔 채로는 시작 블록 몸통이 비어 있어 판정에 실패한다
      const rule = [{ codeEquals: { file }, fail: DESIGN_FAIL }];
      expect(judge(rule, { code: workspaceJsonToCode(scattered as WorkspaceJson) }, chapters[chapterId].files).pass).toBe(false);

      const strip = (b: BlockJson) => {
        const { x: _x, y: _y, disabledReasons: _d, ...rest } = b as BlockJson & { disabledReasons?: string[] };
        return JSON.stringify({ ...rest, next: undefined });
      };
      const inOrder = expectedOrder.map((key) => pieces.find((p) => strip(p) === JSON.stringify({ ...JSON.parse(key), x: undefined, y: undefined, next: undefined }) || strip(p) === key)!);
      expect(inOrder.every(Boolean)).toBe(true);
      const code = workspaceJsonToCode(reassemble(scattered, inOrder));
      expect(judge(rule, { code }, chapters[chapterId].files)).toEqual({ pass: true, failures: [] });
    });
  }
});
