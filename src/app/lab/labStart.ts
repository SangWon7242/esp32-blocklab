import type { LabInitialProgram } from "@/lib/views";
import { codeToBlocks } from "@/parser";
import type { WorkspaceJson } from "@/parser/types";
import { contentFile } from "@/track/files";
import { START_ONLY_CODE } from "./sample";

/*
 * 자유 코딩 화면을 처음 열 때 편집기에 무엇을 싣는가 (EditorWorkbench 는 마운트할 때 한 번만 읽는다).
 * 차례: 호스트가 넘긴 작품(initialProgram, lib-v1.0.3) > 블록 사전 예시(exampleType) > 콘텐츠 코드(codeRef) > 빈 프로그램.
 */

/** 호스트가 불러온 작품 (허브: ?project=<id>). 꼴은 라이브러리 계약 LabViewProps.initialProgram 하나에서 정한다 */
export type { LabInitialProgram };

export type LabStart = {
  initialCode: string;
  initialBlocks?: WorkspaceJson;
  initialExample?: string;
  /** "code" 면 코드 모드로 연다 (작품 코드를 블록으로 바꾸지 못할 때, lib-v1.0.4) */
  initialSource?: "code";
};

/** 작업판 JSON 으로 실을 만한가: 객체이고 맨 위 블록이 하나 이상 */
export function usableBlocksJson(value: unknown): value is WorkspaceJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const blocks = (value as { blocks?: { blocks?: unknown } }).blocks?.blocks;
  return Array.isArray(blocks) && blocks.length > 0;
}

export function labStart(opts: { initialProgram?: LabInitialProgram | null; example?: string; codeRef?: string | null }): LabStart {
  const program = opts.initialProgram;
  if (program && typeof program.code === "string") {
    // 블록으로 바꾸지 못하는 코드(문법 오류): 친 글을 코드 모드에 그대로 둔다. lib-v1.0.3 이 오류 전 블록을 함께 저장한
    // 작품도 그 블록이 친 글을 덮지 않게 blocksJson 은 쓰지 않는다
    if (!codeToBlocks(program.code).ok) return { initialCode: program.code, initialSource: "code" };
    return usableBlocksJson(program.blocksJson)
      ? { initialCode: program.code, initialBlocks: program.blocksJson }
      : { initialCode: program.code };
  }
  if (opts.example !== undefined) return { initialCode: START_ONLY_CODE, initialExample: opts.example };
  return { initialCode: contentFile(opts.codeRef ?? null) ?? START_ONLY_CODE };
}
