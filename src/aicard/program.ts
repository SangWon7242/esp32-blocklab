import type { LineMap } from "@/codegen/linemap";
import { lint, type Issue, type LintWorkspaceJson } from "@/lint";
import { codeToBlocks } from "@/parser";
import type { BlockJson, WorkspaceJson } from "@/parser/types";
import { AI_CARD_HOST_DEVICES } from "./cards";

/*
 * AiCardEditor 의 코드 ↔ 블록 (순수, Blockly 없음). 생성(블록 → 코드)은 src/codegen generateAiCardCode*.
 */

export type AiCardBlocks = { ok: true; json: WorkspaceJson } | { ok: false; line: number; message: string };

/**
 * 아이 코드 → 작업판 JSON. RGB 준비·set_color 는 호스트 것이라 `set_color(255, 0, 0)` 이 RGB 색 블록으로 돌아온다.
 * 맨 바깥 문장이 없으면 빈 「프로그램이 시작되면」 블록은 뺀다 (AI 카드 편집기에는 시작 블록이 없다).
 */
export function aiCardBlocksFromCode(code: string): AiCardBlocks {
  const r = codeToBlocks(code, { hostDevices: AI_CARD_HOST_DEVICES });
  if (!r.ok) return { ok: false, line: r.error.line, message: r.error.message };
  const blocks = r.json.blocks.blocks as BlockJson[];
  const kept = blocks.filter((b) => b.type !== "start_program" || b.inputs?.BODY?.block || b.icons);
  // 함수 블록은 시작 블록 오른쪽(x = 560…)에 놓였다. 시작 블록을 뺐으면 왼쪽 위로 당긴다
  if (kept.length !== blocks.length) kept.forEach((b, i) => { b.x = 40 + 520 * i; b.y = 40; });
  return { ok: true, json: { ...r.json, blocks: { ...r.json.blocks, blocks: kept } } };
}

/** AI 카드 편집기에서 보지 않는 검사: 시작 블록이 없다 · RGB 준비가 없다 (호스트가 RGB·set_color 를 준비한다) */
const SKIPPED = new Set(["no-start", "device-before-setup"]);

/**
 * AI 카드 작업판 검사: 기본 검사(src/lint)에서 시작 블록·장치 준비 검사를 빼고, 「AI 가 카드를 보면」 블록이 없으면 알린다.
 * 떨어진 블록 안내는 AI 카드 말로 바꾼다.
 */
export function aiCardIssues(json: LintWorkspaceJson, map: LineMap | null): Issue[] {
  const issues = lint(json, map)
    .filter((i) => !SKIPPED.has(i.id))
    .map((i) => (i.id === "orphan" ? { ...i, ko: "「AI 가 카드를 보면」 안에 넣어야 실행돼요" } : i));
  const hasEvent = (json.blocks?.blocks ?? []).some((b) => b.type === "aicard_on_card");
  if (!hasEvent) issues.unshift({ id: "aicard-missing", level: "error", ko: "「AI 가 카드를 보면」 블록을 놓아 주세요", en: "Error: on_card is not defined" });
  return issues;
}
