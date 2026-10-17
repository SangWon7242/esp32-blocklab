import { codeToBlocks } from "@/parser";
import type { Chapter, Rule, Step, StepOf } from "./schema";
import type { LoadedChapter } from "./content";
import type {
  AnalysisInput, DebugInput, DesignInput, EditorInput, MissionInput, PredictInput, ProblemInput, ReflectInput, RunInput, SavedProgram,
} from "./completion";
import type { AppInput } from "./appCheck";
import { DESIGN_FAIL } from "./design";
import { allSteps } from "./gating";
import { judge, type JudgeInput } from "./judge";
import type { Progress, StepRecord } from "./progress";

/*
 * 제출(계획 13): 챕터 기록을 스냅숏으로 묶고, 글 답을 뽑고, 저장된 프로그램을 다시 판정한다.
 * 모두 순수 함수 — React·Blockly·DOM 없이 서버(Node)에서도 그대로 돈다 (src/track 규칙).
 */

/**
 * 제출용 챕터 스냅숏 (계획 13 인터페이스 계약). 호스트는 `onSubmit(chapterId, snapshot)` 으로 받는다.
 */
export type ChapterSnapshot = {
  chapterId: string;
  /** ISO 시각 */
  takenAt: string;
  /** stepId → 기록 */
  records: Record<string, StepRecord>;
  /** 편집기 단계가 저장한 프로그램. 디버깅은 증상마다 하나씩 (같은 stepId 가 증상 순서로 여러 번) */
  programs: { stepId: string; code: string }[];
};

/** 기록 입력에서 저장된 프로그램들 (미션·실행·설계는 하나, 디버깅은 증상마다). 단계 유형을 몰라도 모양으로 찾는다 */
export function savedPrograms(input: Record<string, unknown>): SavedProgram[] {
  const one = (input as { program?: unknown }).program;
  if (isProgram(one)) return [one];
  const many = (input as { programs?: unknown }).programs;
  if (Array.isArray(many)) return many.filter(isProgram);
  return [];
}

function isProgram(p: unknown): p is SavedProgram {
  return !!p && typeof p === "object" && typeof (p as SavedProgram).code === "string";
}

/** 진행 기록에서 한 챕터의 스냅숏을 뜬다. 기록은 복사해 두어 뒤에 저장이 이어져도 바뀌지 않는다 */
export function chapterSnapshot(progress: Progress, chapterId: string): ChapterSnapshot {
  const records = structuredClone(progress.chapters[chapterId] ?? {});
  const programs = Object.entries(records).flatMap(([stepId, rec]) => savedPrograms(rec.input).map((p) => ({ stepId, code: p.code })));
  return { chapterId, takenAt: new Date().toISOString(), records, programs };
}

/* ---------- 글 답 ---------- */

export type TextAnswer = {
  stepId: string;
  stepType: string;
  /** 단계 제목 */
  title: string;
  /** 학생에게 보인 질문·칸 이름 */
  prompt: string;
  /** 학생이 적은 글 (비어 있으면 "") */
  answer: string;
};

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** 조건 분석 세 칸의 이름 (화면 Analysis.tsx 와 같은 말) */
export const ANALYSIS_BOX_LABEL = { know: "알아야 할 것", decide: "정해야 할 것", act: "해야 할 것" } as const;
/** 앱 화면 설계 세 칸의 이름 (appCheck.ts APP_DESIGN_BOXES 와 같은 말) */
const APP_BOX_LABEL = { show: "보여 줄 값", buttons: "누를 버튼", changes: "바뀌는 모습" } as const;
/** 1분 설명 메모의 칸 이름 */
export const EXPLAIN_MEMO_PROMPT = "1분 설명 메모";

/**
 * 챕터의 글 답을 단계 순서대로 뽑는다 (AI 피드백·교사 열람용): 문제 질문, 조건 분석 세 칸, 예측 빈칸, 디버깅 "왜 이런 증상일까?",
 * 설계 의사코드 빈칸, 성찰 네 칸과 줄 설명, 앱 화면 설계 세 칸·글 문항, 그리고 1분 설명 메모(저장돼 있으면).
 * 기록이 있는 단계의 질문은 답이 비어 있어도 넣어("") 빠진 답이 보이게 하고, 줄 설명은 쓴 줄만 넣는다.
 * chapter 에 files 가 있으면(LoadedChapter) 줄 설명의 질문에 코드 줄을 함께 적는다.
 */
export function textAnswersOf(chapter: Chapter & { files?: Readonly<Record<string, string>> }, snapshot: ChapterSnapshot): TextAnswer[] {
  const out: TextAnswer[] = [];
  for (const step of allSteps(chapter)) {
    const rec = snapshot.records[step.id];
    if (!rec) continue;
    const input = rec.input;
    const add = (prompt: string, answer: unknown) => out.push({ stepId: step.id, stepType: step.type, title: step.title, prompt, answer: text(answer) });
    switch (step.type) {
      case "problem": {
        const a = (input as ProblemInput).answers ?? [];
        step.questions.forEach((q, i) => add(q, a[i]));
        break;
      }
      case "analysis": {
        const a = input as AnalysisInput;
        add(ANALYSIS_BOX_LABEL.know, a.know);
        add(ANALYSIS_BOX_LABEL.decide, a.decide);
        add(ANALYSIS_BOX_LABEL.act, a.act);
        break;
      }
      case "predict": {
        const a = (input as PredictInput).answers ?? [];
        step.blanks.forEach((b, i) => add(b.unit ? `${b.q} (${b.unit})` : b.q, a[i]));
        break;
      }
      case "debug": {
        const d = input as DebugInput;
        step.symptoms.forEach((s, i) => add(`증상 ${i + 1}. ${s.title} — 왜 이런 증상일까?`, d.explanations?.[i]));
        if (text(d.explainMemo)) add(EXPLAIN_MEMO_PROMPT, d.explainMemo);
        break;
      }
      case "mission": {
        const m = input as MissionInput;
        if (text(m.explainMemo)) add(EXPLAIN_MEMO_PROMPT, m.explainMemo);
        break;
      }
      case "design": {
        const blanks = (input as DesignInput).blanks ?? [];
        step.pseudocode.forEach((line, i) => {
          if (line.blank) add(line.text, blanks[i]);
        });
        break;
      }
      case "reflect": {
        const r = input as ReflectInput;
        const source = (chapter.files?.[step.lineExplain] ?? "").split("\n");
        const lines = r.lines ?? {};
        Object.keys(lines)
          .map(Number)
          .filter((n) => Number.isFinite(n) && text(lines[n]))
          .sort((a, b) => a - b)
          .forEach((n) => {
            const code = source[n - 1]?.trim();
            add(code ? `${n}번 줄 ${code}` : `${n}번 줄`, lines[n]);
          });
        const prompts = r.prompts ?? [];
        step.prompts.forEach((p, i) => add(p, prompts[i]));
        break;
      }
      case "app": {
        const a = input as AppInput;
        add(APP_BOX_LABEL.show, a.design?.show);
        add(APP_BOX_LABEL.buttons, a.design?.buttons);
        add(APP_BOX_LABEL.changes, a.design?.changes);
        step.readcheck.forEach((q, i) => {
          if (q.kind === "text") add(q.q, a.answers?.[i]);
        });
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/* ---------- 다시 판정 ---------- */

export type JudgeStepSummary = {
  stepId: string;
  type: string;
  /** null: 판정할 프로그램이 없다 (안 했거나 건너뜀) */
  passed: boolean | null;
  /** 실패한 규칙의 되묻기 문장 (디버깅은 "증상 n: " 을 앞에) */
  failures: string[];
  /** 판정에 영향이 없는 알림: 건너뜀·저장 없음·학생 화면 결과와 다름·저장된 주의 */
  notes: string[];
};
export type JudgeSummary = {
  steps: JudgeStepSummary[];
  /** 판정하는 단계(미션·디버깅·설계) 수 */
  missions: number;
  /** 그중 통과한 수 */
  passed: number;
};

export type JudgeSnapshotOptions = {
  /**
   * codeEquals(설계 조립) 비교용 표준 꼴. 화면은 Blockly 생성기를 거친 canonicalLines 를 넘길 수 있다.
   * 서버(Node)에서는 비워 두면 정규화 원문으로 비교한다 — 함수 정의 위치·import 순서가 선생님 파일과 다르면 실패할 수 있다.
   */
  canonical?: (code: string) => string[];
};

export const NOTE_SKIPPED = "건너뛴 단계예요";
export const NOTE_NO_PROGRAM = "저장한 프로그램이 없어요";
export const NOTE_OUTPUT_RULES = "실행 출력을 보는 규칙은 다시 판정하지 않았어요 (출력은 저장되지 않아요)";
/** 학생 화면의 마지막 판정과 다시 판정한 결과가 다를 때 */
export const NOTE_SCREEN_PASSED = "학생 화면의 마지막 판정은 통과였어요";
export const NOTE_SCREEN_FAILED = "학생 화면의 마지막 판정은 실패였어요";

/** 코드를 블록 JSON 으로 (못 바꾸면 undefined — 블록 규칙은 실패). 파서는 Blockly 없이 돈다 */
function blocksFromCode(code: string): unknown {
  try {
    const r = codeToBlocks(code);
    return r.ok ? r.json : undefined;
  } catch {
    return undefined;
  }
}

const hasBlocks = (json: unknown): boolean =>
  !!json && typeof json === "object" && Array.isArray((json as { blocks?: { blocks?: unknown[] } }).blocks?.blocks)
  && ((json as { blocks: { blocks: unknown[] } }).blocks.blocks.length > 0);

/** 판정 입력: 저장된 작업판 JSON 이 있으면 그것(블록 모드 그대로), 없으면 코드를 블록으로 바꾼 것 (화면의 judgeInputOf 와 같은 기준) */
function inputOf(program: SavedProgram, opts: JudgeSnapshotOptions): JudgeInput {
  return { code: program.code, blocksJson: hasBlocks(program.blocksJson) ? program.blocksJson : blocksFromCode(program.code), canonical: opts.canonical };
}

/** 실행 출력 규칙은 뺀다 (출력은 기록에 없다). 뺀 것이 있으면 true */
function withoutOutputRules(rules: readonly Rule[]): { rules: Rule[]; dropped: boolean } {
  const kept = rules.filter((r) => !("outputIncludes" in r));
  return { rules: kept, dropped: kept.length !== rules.length };
}

function judgeRules(rules: readonly Rule[], program: SavedProgram, files: LoadedChapter["files"], opts: JudgeSnapshotOptions, notes: string[]) {
  const { rules: kept, dropped } = withoutOutputRules(rules);
  if (dropped && !notes.includes(NOTE_OUTPUT_RULES)) notes.push(NOTE_OUTPUT_RULES);
  return judge(kept, inputOf(program, opts), files);
}

/** 학생 화면이 마지막으로 판정한 코드가 지금 코드와 같을 때만, 그 결과와 다르면 알린다 */
function compareWithScreen(notes: string[], passed: boolean, screenPassed: boolean | undefined, judgedCode: string | null | undefined, code: string) {
  if (screenPassed === undefined || judgedCode !== code || screenPassed === passed) return;
  notes.push(screenPassed ? NOTE_SCREEN_PASSED : NOTE_SCREEN_FAILED);
}

function summarizeMission(step: StepOf<"mission">, rec: StepRecord | undefined, files: LoadedChapter["files"], opts: JudgeSnapshotOptions): JudgeStepSummary {
  const m = (rec?.input ?? {}) as MissionInput;
  const notes: string[] = [];
  if (!m.program) return { stepId: step.id, type: step.type, passed: null, failures: [], notes: [m.skipped ? NOTE_SKIPPED : NOTE_NO_PROGRAM] };
  const r = judgeRules(step.rules, m.program, files, opts, notes);
  compareWithScreen(notes, r.pass, m.passed, m.judgedCode, m.program.code);
  if (r.pass && m.judgedCode === m.program.code) notes.push(...(m.notes ?? []));
  return { stepId: step.id, type: step.type, passed: r.pass, failures: r.failures, notes };
}

function summarizeDebug(step: StepOf<"debug">, rec: StepRecord | undefined, files: LoadedChapter["files"], opts: JudgeSnapshotOptions): JudgeStepSummary {
  const d = (rec?.input ?? {}) as DebugInput;
  const programs = step.symptoms.map((_, i) => d.programs?.[i] ?? null);
  if (programs.every((p) => !p)) return { stepId: step.id, type: step.type, passed: null, failures: [], notes: [d.skipped ? NOTE_SKIPPED : NOTE_NO_PROGRAM] };
  const notes: string[] = [];
  const failures: string[] = [];
  let passed = true;
  step.symptoms.forEach((symptom, i) => {
    const program = programs[i];
    const label = `증상 ${i + 1}`;
    if (!program) {
      passed = false;
      notes.push(`${label}: ${NOTE_NO_PROGRAM}`);
      return;
    }
    const r = judgeRules([...symptom.rules, ...step.rules], program, files, opts, notes);
    if (!r.pass) passed = false;
    failures.push(...r.failures.map((f) => `${label}: ${f}`));
    const screen = d.passed?.[i];
    const judged = d.judgedCodes?.[i];
    if (screen !== undefined && judged === program.code && screen !== r.pass) notes.push(`${label}: ${screen ? NOTE_SCREEN_PASSED : NOTE_SCREEN_FAILED}`);
    if (r.pass && judged === program.code) notes.push(...(d.notes?.[i] ?? []).map((n) => `${label}: ${n}`));
  });
  return { stepId: step.id, type: step.type, passed, failures, notes };
}

function summarizeDesign(step: StepOf<"design">, rec: StepRecord | undefined, files: LoadedChapter["files"], opts: JudgeSnapshotOptions): JudgeStepSummary {
  const d = (rec?.input ?? {}) as DesignInput;
  const notes: string[] = [];
  if (!d.program) return { stepId: step.id, type: step.type, passed: null, failures: [], notes: [d.skipped ? NOTE_SKIPPED : NOTE_NO_PROGRAM] };
  const r = judge([{ codeEquals: { file: step.targetCode }, fail: DESIGN_FAIL }], inputOf(d.program, opts), files);
  compareWithScreen(notes, r.pass, d.passed, d.judgedCode, d.program.code);
  return { stepId: step.id, type: step.type, passed: r.pass, failures: r.failures, notes };
}

/** 다시 판정하는 단계인가 (미션·디버깅·설계) */
export function isJudgedStep(step: Step): step is StepOf<"mission"> | StepOf<"debug"> | StepOf<"design"> {
  return step.type === "mission" || step.type === "debug" || step.type === "design";
}

/**
 * 스냅숏의 저장된 프로그램을 챕터 규칙으로 다시 판정한다 (미션은 rules, 디버깅은 증상 규칙 + 전체 규칙, 설계는 codeEquals targetCode).
 * 학생 화면이 남긴 passed 를 믿지 않고 코드로 다시 본다. Blockly 없이 judge + codeToBlocks 만 쓰므로 서버(Node)에서도 돈다.
 * 실행 출력 규칙(outputIncludes)은 출력이 기록에 없어 빼고 알린다.
 */
export function judgeSnapshot(chapter: LoadedChapter, snapshot: ChapterSnapshot, opts: JudgeSnapshotOptions = {}): JudgeSummary {
  const steps: JudgeStepSummary[] = [];
  for (const step of allSteps(chapter)) {
    if (!isJudgedStep(step)) continue;
    const rec = snapshot.records[step.id];
    if (step.type === "mission") steps.push(summarizeMission(step, rec, chapter.files, opts));
    else if (step.type === "debug") steps.push(summarizeDebug(step, rec, chapter.files, opts));
    else steps.push(summarizeDesign(step, rec, chapter.files, opts));
  }
  return { steps, missions: steps.length, passed: steps.filter((s) => s.passed === true).length };
}

/** 편집기 단계가 건너뛰었는지 (실행·미션·디버깅·설계 공통) */
export const isSkipped = (input: Record<string, unknown>): boolean => (input as EditorInput).skipped === true;
/** 실행 단계가 끝까지 실행됐는지 */
export const hasRun = (input: Record<string, unknown>): boolean => (input as RunInput).ran === true;
