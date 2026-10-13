import { checkAnswer } from "./judge";
import type { ReadQuestion, Step } from "./schema";

/*
 * 글 입력형 단계의 학생 입력 모양과 "완료" 조건. 화면(src/app/track)은 입력을 StepRecord.input 에 그대로 저장한다.
 * 편집기 단계(run·mission·debug·design)는 아직 화면이 없어 학생이 "건너뛰기"로 끝낸다(계획 3B 에서 교체).
 */

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
};
export type EditorInput = { skipped?: boolean };

export const EDITOR_STEP_TYPES = ["run", "mission", "debug", "design"] as const;
export function isEditorStep(step: Step): boolean {
  return (EDITOR_STEP_TYPES as readonly string[]).includes(step.type);
}

export const filled = (s: unknown): boolean => typeof s === "string" && s.trim().length > 0;

export function analysisFilled(input: AnalysisInput): boolean {
  return filled(input.know) && filled(input.decide) && filled(input.act);
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

/** 완료 버튼을 켤 수 있는지. 편집기 단계는 false (건너뛰기 버튼으로만 끝낸다) */
export function canComplete(step: Step, input: Record<string, unknown>): boolean {
  switch (step.type) {
    case "problem":
      return step.questions.every((_, i) => filled((input as ProblemInput).answers?.[i]));
    case "predict":
      return step.blanks.every((_, i) => filled((input as PredictInput).answers?.[i]));
    case "analysis": {
      const a = input as AnalysisInput;
      return analysisFilled(a) && a.revealed === true;
    }
    case "readcheck": {
      const results = (input as ReadCheckInput).results ?? [];
      return step.questions.every((_, i) => results[i] === true);
    }
    case "reflect":
      return step.prompts.every((_, i) => filled((input as ReflectInput).prompts?.[i]));
    default:
      return false;
  }
}
