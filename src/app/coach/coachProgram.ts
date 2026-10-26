import type { SaveProgram } from "../lab/editorSync";
import type { RunEndResult } from "../lab/useDevice";
import type { CoachProgram, CoachRunEvent } from "./types";

/*
 * 코치 편집기의 순수 도움 함수 (lib-v1.1.0): 편집기 상태 → CoachProgram, 실행 결과 → CoachRunEvent.
 */

/** onProgramChange 디바운스 (마지막 편집 뒤) */
export const COACH_PROGRAM_DELAY_MS = 1000;
/** 실행 증거에 남기는 보드 출력 길이 (끝에서부터) */
export const COACH_RUN_OUTPUT_LIMIT = 4096;

/** 저장용 프로그램(programForSave 규칙) → 코치 프로그램. 코드 모드 문법 오류면 blocksJson null, parseError true */
export function coachProgramOf(p: SaveProgram): CoachProgram {
  return { code: p.code, blocksJson: p.unconvertible ? null : p.blocksJson, parseError: p.unconvertible };
}

/** 같은 프로그램을 두 번 내보내지 않으려고 비교하는 열쇠 */
export function coachProgramKey(p: CoachProgram): string {
  return JSON.stringify([p.code, p.parseError, p.blocksJson]);
}

/** 보드 출력의 마지막 limit 자 */
export function tailOutput(output: string, limit = COACH_RUN_OUTPUT_LIMIT): string {
  return output.length > limit ? output.slice(output.length - limit) : output;
}

/** 실행 결과 → 코치 실행 증거. 오류 줄이 없으면(null) line 을 빼고, 멈춤은 ok false·error 없음 */
export function coachRunEvent(opts: { fake: boolean; result: RunEndResult; output: string; code: string; at?: Date }): CoachRunEvent {
  const { result } = opts;
  const event: CoachRunEvent = {
    source: opts.fake ? "fake" : "board",
    ok: result.ok,
    output: tailOutput(opts.output),
    code: opts.code,
    at: (opts.at ?? new Date()).toISOString(),
  };
  if (!result.ok && result.error) {
    event.error = result.error.line !== null ? { line: result.error.line, message: result.error.message } : { message: result.error.message };
  }
  return event;
}
