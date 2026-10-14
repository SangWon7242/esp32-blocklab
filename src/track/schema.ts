import { z } from "zod";

/*
 * 트랙 콘텐츠(content/chapters/<id>/chapter.yaml) 형식. 키 설명은 src/track/README.md.
 * 모든 객체는 strict — YAML 키 오타(cod: 등)는 검사에서 걸린다.
 */

/** 같은 폴더의 .py 파일 이름 (예: step1_distance.py) */
export const FileRef = z.string().regex(/^[\w.-]+\.py$/, "같은 폴더의 .py 파일 이름이어야 합니다");

/** 같은 폴더 images/ 의 .svg 파일 (예: images/wiring-led.svg) */
export const ImageRef = z.string().regex(/^images\/[\w.-]+\.svg$/, "images/<이름>.svg 꼴이어야 합니다");

/** 그림 하나 + 그 아래 설명 (선택) */
export const FigureSchema = z.object({ image: ImageRef, caption: z.string().min(1).optional() }).strict();
export type Figure = z.infer<typeof FigureSchema>;

const fail = z.string().min(1);

const regex = z.string().min(1).refine((s) => {
  try {
    new RegExp(s, "m");
    return true;
  } catch {
    return false;
  }
}, "정규식이 올바르지 않습니다");

/** 판정 규칙 하나. 실패하면 fail 문장(정답을 말하지 않는 되묻기)을 보여 준다 */
export const RuleSchema = z.union([
  z.object({ useBlock: z.array(z.string().min(1)).min(1), fail }).strict(),
  z.object({ codeMatches: regex, fail }).strict(),
  z.object({ codeEquals: z.object({ file: FileRef, tolerance: z.number().nonnegative().optional() }).strict(), fail }).strict(),
  z.object({ pinIs: z.object({ name: z.string().regex(/^[A-Za-z_]\w*$/), pin: z.number().int().nonnegative() }).strict(), fail }).strict(),
  z.object({ maxBlocks: z.number().int().positive(), fail }).strict(),
  z.object({ outputIncludes: z.string().min(1), fail }).strict(),
]);
export type Rule = z.infer<typeof RuleSchema>;

const base = {
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "단계 id 는 영어 소문자·숫자·- 만"),
  title: z.string().min(1),
  minutes: z.number().positive().optional(),
  /** 왼쪽 안내 칸에 보일 장면 그림 (body 위) */
  scene: FigureSchema.optional(),
  /** 왼쪽 안내 칸에 보일 markdown (문단·**굵게**·- 목록·1. 번호·`코드`) */
  body: z.string().optional(),
  /** "지금 할 일" 카드: 지금 할 일 1~4개 (체크 표시는 장식, 완료 조건은 유형별 규칙 그대로) */
  todo: z.array(z.string().min(1)).min(1).max(4).optional(),
  /** 건너뛸 수 있는 단계 (관문에서 다음 단계를 막지 않는다) */
  optional: z.boolean().optional(),
};

const lines = z.array(z.string().min(1)).min(1);

export const ProblemStep = z.object({ ...base, type: z.literal("problem"), questions: z.array(z.string().min(1)).min(1).max(3) }).strict();

export const AnalysisStep = z.object({
  ...base,
  type: z.literal("analysis"),
  /** 예시 답 (학생이 세 칸을 다 쓴 뒤에만 공개) */
  answer: z.object({ know: lines, decide: lines, act: lines }).strict(),
}).strict();

export const PredictStep = z.object({
  ...base,
  type: z.literal("predict"),
  code: FileRef,
  blanks: z.array(z.object({ q: z.string().min(1), unit: z.string().optional() }).strict()).min(1),
}).strict();

export const RunStep = z.object({ ...base, type: z.literal("run"), code: FileRef }).strict();

const hint = z.string().optional();
export const ReadQuestion = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("number"), q: z.string().min(1), answer: z.number(), hint }).strict(),
  z.object({ kind: z.literal("choice"), q: z.string().min(1), options: z.array(z.string()).min(2), answer: z.number().int().nonnegative(), hint })
    .strict(),
  /** answer = 코드 파일의 줄 번호 (1부터, 빈 줄·주석 포함 원문 기준) */
  z.object({ kind: z.literal("line"), q: z.string().min(1), answer: z.number().int().positive(), hint }).strict(),
]);
export type ReadQuestion = z.infer<typeof ReadQuestion>;

export const ReadCheckStep = z.object({
  ...base,
  type: z.literal("readcheck"),
  code: FileRef,
  questions: z.array(ReadQuestion).min(1),
}).strict();

export const MissionStep = z.object({
  ...base,
  type: z.literal("mission"),
  instructions: z.string().min(1),
  /** 편집기에 미리 깔 코드 */
  code: FileRef.optional(),
  hint: z.string().optional(),
  rules: z.array(RuleSchema).min(1),
  /** 정답 코드 (스스로 해 본 뒤 비교용) */
  answerCode: FileRef.optional(),
}).strict();

/** debug 는 mission 의 변형: 증상마다 고장 코드(글로 직접 적음)와 질문, 그 증상을 고친 코드에 걸 규칙 */
export const DebugStep = z.object({
  ...base,
  type: z.literal("debug"),
  symptoms: z.array(z.object({
    title: z.string().min(1),
    /** 고장 난 코드 조각 (파일 이름이 아니라 코드 그대로) */
    code: z.string().min(1),
    question: z.string().min(1),
    rules: z.array(RuleSchema).default([]),
  }).strict()).min(1),
  /** 증상 전체에 거는 규칙 (선택) */
  rules: z.array(RuleSchema).default([]),
  answerCode: FileRef.optional(),
}).strict();

export const DesignStep = z.object({
  ...base,
  type: z.literal("design"),
  /** 우리말 의사코드 줄. blank 가 있으면 text 의 __ 자리가 빈칸이고 answer 는 예시 답 */
  pseudocode: z.array(z.object({
    text: z.string().min(1),
    blank: z.object({ answer: z.union([z.string().min(1), z.number()]), tolerance: z.number().nonnegative().optional() }).strict().optional(),
  }).strict()).min(1),
  /** 번역표: [우리말, 코드] */
  translation: z.array(z.tuple([z.string().min(1), z.string().min(1)])).min(1),
  /** 조립해야 할 기대 코드 */
  targetCode: FileRef,
}).strict();

export const ReflectStep = z.object({
  ...base,
  type: z.literal("reflect"),
  /** 줄별 "이 줄은 ___" 을 쓸 완성 코드 */
  lineExplain: FileRef,
  prompts: z.array(z.string().min(1)).length(4),
}).strict();

export const StepSchema = z.discriminatedUnion("type", [
  ProblemStep, AnalysisStep, PredictStep, RunStep, ReadCheckStep, MissionStep, DebugStep, DesignStep, ReflectStep,
]);
export type Step = z.infer<typeof StepSchema>;
export type StepType = Step["type"];
export type StepOf<T extends StepType> = Extract<Step, { type: T }>;

export const PartSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  steps: z.array(StepSchema).min(1),
}).strict();
export type Part = z.infer<typeof PartSchema>;

export const ChapterSchema = z.object({
  /** 폴더 이름과 같아야 한다 (예: 10-auto-door) */
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  order: z.number().int(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  /** 챕터 화면·목록 카드의 한두 문장 소개 */
  summary: z.string().min(1).optional(),
  /** 표지 그림 */
  cover: ImageRef.optional(),
  /** 준비물(부품). image 는 작은 부품 그림 */
  materials: z.array(z.object({ name: z.string().min(1), image: ImageRef.optional(), note: z.string().min(1).optional() }).strict()).min(1).optional(),
  /** 배선도 */
  wiring: FigureSchema.optional(),
  goals: z.object({ content: z.string().min(1), thinking: z.string().min(1) }).strict().optional(),
  successCriteria: z.array(z.string().min(1)).optional(),
  parts: z.array(PartSchema).min(1),
}).strict();
export type Chapter = z.infer<typeof ChapterSchema>;
