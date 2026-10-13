import { checkAnswer } from "./judge";
import type { ReadQuestion, Step } from "./schema";

/*
 * 글 입력형 단계의 학생 입력 모양과 "완료" 조건. 화면(src/app/track)은 입력을 StepRecord.input 에 그대로 저장한다.
 * 편집기 단계 run·mission·debug·design 은 편집기에서 실행·판정한 결과로 끝낸다 (건너뛰기도 된다).
 */

import type { SavedAiReview } from "@/ai/claude";

export type ProblemInput = { answers?: string[] };
export type PredictInput = { answers?: string[] };
export type AnalysisInput = {
  know?: string;
  decide?: string;
  act?: string;
  /** 예시 답을 펼쳤는지 (세 칸을 다 쓴 뒤에만 펼칠 수 있다) */
  revealed?: boolean;
  /** 예시 답 항목마다 "내 답에도 있다" 체크 ("know:0" → true) */
  matched?: Record<string, boolean>;
  /** 겹치는 항목이 없어도 "대조했어요"를 눌렀는지 */
  compared?: boolean;
};
export type ReadCheckInput = {
  /** 문항마다 학생 답 (숫자·선택지 번호·줄 번호를 글로) */
  answers?: string[];
  /** 마지막 "확인" 결과. 답을 고치면 그 문항 결과는 지운다 */
  results?: (boolean | null)[];
};
export type ReflectInput = {
  /** 줄 번호(1부터) → "이 줄은 ___" */
  lines?: Record<string, string>;
  prompts?: string[];
  /** "내 설명 점검 받기" AI 결과 */
  ai?: SavedAiReview;
};
export type EditorInput = { skipped?: boolean };

/** 단계 기록에 저장한 학생 프로그램 (다시 열면 복원) */
export type SavedProgram = { code: string; blocksJson?: unknown };

export type RunInput = EditorInput & {
  program?: SavedProgram;
  /** 보드(가짜 포함)에서 실행이 한 번 끝까지 성공했는지 */
  ran?: boolean;
};
export type MissionInput = EditorInput & {
  program?: SavedProgram;
  /** 마지막 판정에서 실패한 규칙의 fail 문장 */
  failures?: string[];
  /** 한 번이라도 판정에 실패했는지 (힌트는 그 뒤에만 보인다) */
  failedOnce?: boolean;
  /** 마지막 판정 통과 */
  passed?: boolean;
};
export type DebugInput = EditorInput & {
  /** 증상마다 "왜 이런 증상일까?" 설명 */
  explanations?: string[];
  /** 증상마다 설명을 저장했는지 (저장 전에는 편집기가 잠긴다) */
  saved?: boolean[];
  /** 증상마다 학생 프로그램 */
  programs?: (SavedProgram | null)[];
  /** 증상마다 "질문 3개만 받기" AI 결과 */
  ai?: (SavedAiReview | null)[];
  /** 증상마다 마지막 판정의 fail 문장 */
  failures?: (string[] | null)[];
  /** 증상마다 판정 통과 */
  passed?: boolean[];
};

/** 설계: ① 빈칸 ② 번역표 ③ 조립 판정 */
export type DesignInput = EditorInput & {
  /** 의사코드 줄마다 빈칸 답 (빈칸 없는 줄은 비어 있다) */
  blanks?: string[];
  /** 마지막 "확인"의 줄마다 채점 (빈칸 없는 줄은 null) */
  blankResults?: (boolean | null)[];
  /** 빈칸을 모두 맞혔다 → 번역표로 */
  blanksDone?: boolean;
  /** 번역표 "확인했어요" → 조립으로 */
  tableDone?: boolean;
  /** 조립 작업판 (다시 열면 블록 위치까지 복원) */
  program?: SavedProgram;
  passed?: boolean;
  failures?: string[] | null;
};

export const EDITOR_STEP_TYPES = ["run", "mission", "debug", "design"] as const;
export function isEditorStep(step: Step): boolean {
  return (EDITOR_STEP_TYPES as readonly string[]).includes(step.type);
}

export const filled = (s: unknown): boolean => typeof s === "string" && s.trim().length > 0;

export function analysisFilled(input: AnalysisInput): boolean {
  return filled(input.know) && filled(input.decide) && filled(input.act);
}

/** 예시 답과 대조했는지: 체크가 하나라도 있거나 "대조했어요"를 눌렀다 */
export function analysisCompared(input: AnalysisInput): boolean {
  return input.compared === true || Object.values(input.matched ?? {}).some(Boolean);
}

/** 학생이 적은 글을 문항 답 숫자로. 비었거나 숫자가 아니면 null */
export function parseGiven(text: string | undefined): number | null {
  if (text === undefined || text.trim() === "") return null;
  const n = Number(text.trim());
  return Number.isFinite(n) ? n : null;
}

/** 읽기 체크 채점: 문항마다 맞았는지 */
export function gradeReadCheck(questions: readonly ReadQuestion[], answers: readonly (string | undefined)[]): boolean[] {
  return questions.map((q, i) => {
    const given = parseGiven(answers[i]);
    return given !== null && checkAnswer(q, given);
  });
}

/** "이 줄은 ___" 을 쓸 줄 번호 (빈 줄·주석 줄 빼고, 1부터) */
export function explainableLines(code: string): number[] {
  return code
    .replace(/\n$/, "")
    .split("\n")
    .flatMap((line, i) => (line.trim() === "" || line.trim().startsWith("#") ? [] : [i + 1]));
}

/** 완료 버튼을 켤 수 있는지. run 은 실행 성공, mission 은 판정 통과, debug 는 모든 증상 통과, design 은 조립 판정 통과 */
export function canComplete(step: Step, input: Record<string, unknown>): boolean {
  switch (step.type) {
    case "problem":
      return step.questions.every((_, i) => filled((input as ProblemInput).answers?.[i]));
    case "predict":
      return step.blanks.every((_, i) => filled((input as PredictInput).answers?.[i]));
    case "analysis": {
      const a = input as AnalysisInput;
      return analysisFilled(a) && a.revealed === true && analysisCompared(a);
    }
    case "readcheck": {
      const results = (input as ReadCheckInput).results ?? [];
      return step.questions.every((_, i) => results[i] === true);
    }
    case "reflect":
      return step.prompts.every((_, i) => filled((input as ReflectInput).prompts?.[i]));
    case "run":
      return (input as RunInput).ran === true;
    case "mission":
      return (input as MissionInput).passed === true;
    case "debug":
      return step.symptoms.every((_, i) => (input as DebugInput).passed?.[i] === true);
    case "design":
      return (input as DesignInput).passed === true;
    default:
      return false;
  }
}
