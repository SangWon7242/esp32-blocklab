/*
 * 코치 편집기 화면 계약 (계획 14 인터페이스 계약 — 블록랩 lib-v1.1.0). 허브의 코치 화면(만들기 배치)이 그린다.
 * 이 파일은 타입만 둔다 (Blockly·React 를 import 하지 않는다) — index 의 정적 그래프를 가볍게 지킨다.
 */

/** 편집기가 지금 담은 프로그램. 코드 모드에서 문법 오류면 blocksJson 은 null, parseError 는 true */
export type CoachProgram = { code: string; blocksJson: unknown | null; parseError: boolean };

/** 코치(AI)가 제안한 새 코드. code 는 편집기 전체를 바꿀 코드다. 같은 id 는 한 번 결정되면 다시 띄우지 않는다 */
export type CoachProposal = { id: string; code: string; note?: string };

/** 실행 한 번이 끝났을 때 (성공·오류·멈춤). 멈춤은 ok false 이고 error 가 없다 */
export type CoachRunEvent = {
  source: "board" | "fake";
  ok: boolean;
  error?: { line?: number; message: string };
  /** 보드 출력(stdout)의 마지막 4096자 */
  output: string;
  /** 실행한 코드 */
  code: string;
  /** 끝난 때 (ISO) */
  at: string;
};

export type CoachEditorViewProps = {
  /** 처음 마운트 때 한 번만 싣는다 (값이 바뀌어도 다시 싣지 않는다 — 다른 프로그램을 열려면 key 를 바꾼다) */
  initialProgram?: { code: string; blocksJson?: unknown | null } | null;
  /** 편집 뒤 1초 디바운스. 언마운트·탭 숨김 때 기다리던 것을 한 번 내보낸다. 처음 실린 프로그램은 내보내지 않는다 */
  onProgramChange?: (p: CoachProgram) => void;
  /** 있으면 지금 코드와의 줄 차이 상자를 띄운다. 자동으로 덮어쓰지 않는다 */
  proposal?: CoachProposal | null;
  /** 「적용」 이면 편집기에 넣은 뒤의 프로그램, 「닫기」 면 지금 프로그램 */
  onProposalDecision?: (id: string, accepted: boolean, program: CoachProgram) => void;
  onRunEnd?: (e: CoachRunEvent) => void;
  /** 1부터. 코드 칸에서 그 줄 범위 배경을 칠한다 (블록 작업판에는 칠하지 않는다) */
  highlightLines?: { start: number; end: number } | null;
  /** 편집·실행을 막는다 (보기만) */
  readOnly?: boolean;
};
