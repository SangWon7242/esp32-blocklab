import { workspaceJsonToCodeWithMap, type WorkspaceJson } from "@/codegen";
import { lint } from "@/lint";
import { codeToBlocks } from "@/parser";
import { leftoverFromStart, unusedSetup } from "@/track/notes";
import type { Rule } from "@/track/schema";

export type JudgeNotesInput = {
  /** 판정한 프로그램 (편집기 getProgram). 블록 모드면 blocksJson 이 살아 있는 작업판, 코드 모드면 마지막 성공 파싱 */
  program: { code: string; blocksJson?: unknown };
  /** 미션 시작 코드(`code:` 파일 글). 없으면 "거의 바꾸지 않았어요" 를 보지 않는다 (디버깅 증상) */
  startCode?: string;
  rules: readonly Rule[];
};

const hasBlocks = (json: unknown): json is WorkspaceJson =>
  !!json && typeof json === "object" && Array.isArray((json as { blocks?: { blocks?: unknown[] } }).blocks?.blocks) && (json as { blocks: { blocks: unknown[] } }).blocks.blocks.length > 0;

/**
 * 검사(lint)의 warning 문장(ko). 블록 모드(작업판이 낸 코드가 판정한 코드와 같다)면 작업판 JSON 을, 아니면 코드를 블록으로 바꾼
 * JSON 을 검사한다 — 판정한 바로 그 코드를 본다. 파싱·생성이 안 되면 빈 목록 (주의는 덤이라 판정을 막지 않는다).
 */
export function lintWarnings(program: JudgeNotesInput["program"]): string[] {
  try {
    let json: WorkspaceJson | null = null;
    let map: ReturnType<typeof workspaceJsonToCodeWithMap>["map"] | null = null;
    if (hasBlocks(program.blocksJson)) {
      const r = workspaceJsonToCodeWithMap(program.blocksJson);
      if (r.code === program.code) {
        json = program.blocksJson;
        map = r.map;
      }
    }
    if (!json) {
      const parsed = codeToBlocks(program.code);
      if (!parsed.ok) return [];
      json = parsed.json;
      map = workspaceJsonToCodeWithMap(json).map;
    }
    return [...new Set(lint(json, map).filter((i) => i.level === "warning").map((i) => i.ko))];
  } catch {
    return [];
  }
}

/** 통과한 판정에 덧붙일 주의: 검사 warning → 준비만 한 장치 → 시작 코드 그대로. 겹치는 문장은 하나만 */
export function judgeNotes({ program, startCode, rules }: JudgeNotesInput): string[] {
  const notes = [...lintWarnings(program), ...unusedSetup(program.code)];
  if (startCode !== undefined) notes.push(...leftoverFromStart(startCode, program.code, rules));
  return [...new Set(notes)];
}
