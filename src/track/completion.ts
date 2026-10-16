import { appCompleted, type AppInput } from "./appCheck";
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
  /** 마지막으로 판정한 코드 (코드가 바뀌면 판정 결과를 지운다) */
  judgedCode?: string;
  /** 통과한 판정에 덧붙인 주의 (검사 warning·notes.ts). 완료를 막지 않는다 */
  notes?: string[];
  /** 1분 설명 관문(설정 explainGate): 교사가 "설명 확인"을 눌렀는지. 코드를 바꾸면 판정과 함께 지운다 */
  explained?: boolean;
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
  /** 증상마다 마지막으로 판정한 코드 */
  judgedCodes?: (string | null)[];
  /** 증상마다 마지막 판정의 fail 문장 */
  failures?: (string[] | null)[];
  /** 증상마다 판정 통과 */
  passed?: boolean[];
  /** 증상마다 통과한 판정에 덧붙인 주의. 완료를 막지 않는다 */
  notes?: (string[] | null)[];
  /** 1분 설명 관문: 모든 증상을 고친 뒤 교사가 "설명 확인"을 눌렀는지 (단계에 하나) */
  explained?: boolean;
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
  /** 마지막으로 판정한 코드 */
  judgedCode?: string;
};

/**
 * 판정한 뒤 학생이 코드를 바꿨는지. 바뀌었으면 지난 판정(통과·실패 문장)은 낡았으므로 지운다
 * (통과한 뒤 코드를 망가뜨려도 완료 버튼이 켜져 있지 않게).
 */
export function judgeIsStale(judgedCode: string | null | undefined, code: string): boolean {
  return typeof judgedCode === "string" && judgedCode !== code;
}

/** 미션·설계: 코드가 바뀌었을 때의 입력 변경 (프로그램 저장 + 낡은 판정·교사 확인 지우기) */
export function onEditedProgram<
  T extends { passed?: boolean; failures?: string[] | null; judgedCode?: string; notes?: string[]; explained?: boolean },
>(cur: T, program: SavedProgram): Partial<T> {
  if (!judgeIsStale(cur.judgedCode, program.code)) return { program } as unknown as Partial<T>;
  return { program, passed: false, failures: null, judgedCode: undefined, notes: undefined, explained: undefined } as unknown as Partial<T>;
}

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

/** 완료 조건에 끼는 설정 (화면 쪽 설정 저장소를 여기서 import 하지 않고 값만 받는다) */
export type CompleteOptions = {
  /** 1분 설명 관문: mission·debug 는 판정 통과에 더해 교사 "설명 확인"(explained) 이 있어야 완료 */
  explainGate?: boolean;
};

/** mission·debug 의 판정이 통과했는지 (관문을 보기 전 조건). 다른 유형은 false */
export function judgePassed(step: Step, input: Record<string, unknown>): boolean {
  switch (step.type) {
    case "mission":
      return (input as MissionInput).passed === true;
    case "debug":
      return step.symptoms.every((_, i) => (input as DebugInput).passed?.[i] === true);
    default:
      return false;
  }
}

/** 관문이 켜진 mission·debug 가 판정은 통과했지만 아직 교사 "설명 확인"을 받지 않았는지 ("확인 대기") */
export function awaitingExplain(step: Step, input: Record<string, unknown>, opts?: CompleteOptions): boolean {
  if (opts?.explainGate !== true) return false;
  if (step.type !== "mission" && step.type !== "debug") return false;
  return judgePassed(step, input) && (input as MissionInput | DebugInput).explained !== true;
}

/**
 * 완료 버튼을 켤 수 있는지. run 은 실행 성공, mission 은 판정 통과, debug 는 모든 증상 통과, design 은 조립 판정 통과,
 * app 은 붙여넣기 검사 통과 + 읽기 체크 통과 (보드 저장은 선택).
 * opts.explainGate 가 켜져 있으면 mission·debug 는 교사 "설명 확인"(explained) 까지 있어야 한다.
 */
export function canComplete(step: Step, input: Record<string, unknown>, opts?: CompleteOptions): boolean {
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
    case "debug":
      return judgePassed(step, input) && !awaitingExplain(step, input, opts);
    case "design":
      return (input as DesignInput).passed === true;
    case "app":
      return appCompleted(step, input as AppInput);
    default:
      return false;
  }
}
