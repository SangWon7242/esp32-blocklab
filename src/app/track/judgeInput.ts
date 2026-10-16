import { codeToBlocks } from "@/parser";
import type { JudgeInput } from "@/track/judge";
import { canonicalLines } from "./canonical";

/** 편집기가 돌려준 프로그램 (TrackEditorHandle.getProgram) */
export type EditorProgramLike = { code: string; blocksJson?: unknown };

/**
 * 미션·디버깅 판정에 넘길 입력 한 곳에서 만들기.
 * 코드 모드에서 blocksJson 이 비어 있으면(처음 깐 코드가 블록으로 안 바뀌었거나 작업판이 없을 때) codeToBlocks(code) 로 채워,
 * blocks·useBlock·maxBlocks 규칙이 블록 모드와 같은 기준으로 판정되게 한다. 파싱이 안 되면 그대로(블록 규칙은 실패).
 * codeEquals 비교용 canonical 은 화면 쪽 canonicalLines.
 */
export function judgeInputOf(program: EditorProgramLike, output: string): JudgeInput {
  return { code: program.code, blocksJson: program.blocksJson ?? blocksFromCode(program.code), output, canonical: canonicalLines };
}

function blocksFromCode(code: string): unknown {
  try {
    const r = codeToBlocks(code);
    return r.ok ? r.json : undefined;
  } catch {
    return undefined;
  }
}
