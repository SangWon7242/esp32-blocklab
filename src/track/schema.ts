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

/** 코드 한 줄 (hasLine·notHas·order·count 가 비교하는 글. 앞뒤 공백·공백 수·따옴표 종류는 무시) */
const lineText = z.string().trim().min(1);
/** 그 줄이 속한 가장 가까운 블록 머리: while/for → loop, def → def, if/elif/else → if, 들여쓰기 0 → top */
export const LineInside = z.enum(["loop", "def", "if", "top"]);
export type LineInside = z.infer<typeof LineInside>;

/** 판정 규칙 하나. 실패하면 fail 문장(정답을 말하지 않는 되묻기)을 보여 준다 */
export const RuleSchema = z.union([
  z.object({ useBlock: z.array(z.string().min(1)).min(1), fail }).strict(),
  z.object({ codeMatches: regex, fail }).strict(),
  z.object({ codeEquals: z.object({ file: FileRef, tolerance: z.number().nonnegative().optional() }).strict(), fail }).strict(),
  z.object({ pinIs: z.object({ name: z.string().regex(/^[A-Za-z_]\w*$/), pin: z.number().int().nonnegative() }).strict(), fail }).strict(),
  z.object({ maxBlocks: z.number().int().positive(), fail }).strict(),
  z.object({ outputIncludes: z.string().min(1), fail }).strict(),
  z.object({ hasLine: z.object({ text: lineText, inside: LineInside.optional() }).strict(), fail }).strict(),
  z.object({ notHas: lineText, fail }).strict(),
  z.object({ order: z.array(lineText).min(2), fail }).strict(),
  z.object({
    count: z.object({ text: lineText, max: z.number().int().nonnegative().optional(), min: z.number().int().nonnegative().optional() }).strict()
      .refine((c) => c.max !== undefined || c.min !== undefined, "count 에는 max 나 min 가운데 하나는 있어야 합니다"),
    fail,
  }).strict(),
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

/** 코드 설명 한 줄: 코드 파일 원문의 줄 번호(1부터, 빈 줄·주석 포함) → 그 줄이 하는 일 (markdown 한 줄) */
export const CodeNoteSchema = z.object({ line: z.number().int().positive(), note: z.string().min(1) }).strict();
export type CodeNote = z.infer<typeof CodeNoteSchema>;
/** 코드 설명 목록 (Keyestudio 수업의 "코드 설명"). 줄 번호가 파일 줄 수 안인지는 parseChapter 가 검사 */
const codeNotes = z.array(CodeNoteSchema).min(1).optional();

export const RunStep = z.object({
  ...base,
  type: z.literal("run"),
  code: FileRef,
  /** 실행 결과: 코드를 올리면 무엇이 보이는지 (안내 칸 "이렇게 되면 성공" 카드, markdown) */
  expected: z.string().min(1).optional(),
  codeNotes,
}).strict();

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
  codeNotes,
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
  /** 시작 코드(code)가 이미 규칙을 모두 통과하는 미션임을 밝힌다 (content 테스트의 "시작 코드는 한 규칙은 실패" 보호에서 예외) */
  startPasses: z.boolean().optional(),
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

/** 앱 단계 프롬프트 템플릿의 빈칸 이름 ({{ip}} 등). 채우는 법은 src/track/appCheck.ts fillPrompt */
export const APP_PROMPT_KEYS = ["ip", "data", "commands", "show", "buttons", "changes"] as const;

/** 앱 약속표 한 줄: ESP32 웹서버가 내는 주소. 읽기 = 값(JSON)을 주는 주소, 명령 = 보드에 일을 시키는 주소 */
export const AppApiSchema = z.object({
  /** /data, /cmd?led=on 처럼 / 로 시작하는 상대 주소 */
  path: z.string().regex(/^\/\S*$/, "주소는 / 로 시작하고 빈칸이 없어야 합니다 (예: /data, /cmd?led=on)"),
  method: z.enum(["읽기", "명령"]),
  /** 읽기 주소가 주는 JSON 키 (예: temp, hum) */
  fields: z.array(z.string().min(1)).min(1).optional(),
  note: z.string().min(1).optional(),
}).strict();
export type AppApi = z.infer<typeof AppApiSchema>;

/** 결과 HTML 읽기 체크. choice 는 채점, text 는 학생 코드마다 답이 달라 채점하지 않고 교사가 확인한다(되묻기만) */
export const AppReadQuestion = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("choice"), q: z.string().min(1), options: z.array(z.string()).min(2), answer: z.number().int().nonnegative(), hint })
    .strict(),
  z.object({ kind: z.literal("text"), q: z.string().min(1), hint }).strict(),
]);
export type AppReadQuestion = z.infer<typeof AppReadQuestion>;

const designItems = z.array(z.string().min(1)).default([]);

/**
 * 앱 만들기(AI 바이브 코딩): 화면 설계 세 칸 → 약속표 → 프롬프트 복사 → AI 결과 붙여넣기·검사 → 보드에 index.html → 읽기 체크.
 */
export const AppStep = z.object({
  ...base,
  type: z.literal("app"),
  /** 약속표 (ESP32 코드와 맞춰 챕터가 적는다) */
  api: z.array(AppApiSchema).min(1),
  /** 화면 설계 세 칸의 보기 글 (학생 칸의 예시로만 보인다) */
  design: z.object({ show: designItems, buttons: designItems, changes: designItems }).strict(),
  /** {{ip}}·{{data}}·{{commands}}·{{show}}·{{buttons}}·{{changes}} 빈칸이 있는 프롬프트 */
  promptTemplate: z.string().min(1).superRefine((t, ctx) => {
    for (const m of t.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) {
      if (!(APP_PROMPT_KEYS as readonly string[]).includes(m[1])) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `프롬프트 빈칸 {{${m[1]}}} 은 없는 이름입니다 (${APP_PROMPT_KEYS.join(", ")})` });
      }
    }
  }),
  /** 붙여넣기 검사 (기본: 크기 12000 바이트, 약속표 주소 모두 사용). mustUse 는 기본에 덧붙는다 */
  checks: z.object({
    maxBytes: z.number().int().positive().optional(),
    mustUse: z.array(z.string().min(1)).min(1).optional(),
  }).strict().optional(),
  /** 결과 HTML 읽기 체크 1~3문항 */
  readcheck: z.array(AppReadQuestion).min(1).max(3).superRefine((qs, ctx) => {
    qs.forEach((q, i) => {
      if (q.kind === "choice" && q.answer >= q.options.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, "answer"], message: `답 ${q.answer} 이 선택지 범위 밖입니다` });
      }
    });
  }),
}).strict();

export const StepSchema = z.discriminatedUnion("type", [
  ProblemStep, AnalysisStep, PredictStep, RunStep, ReadCheckStep, MissionStep, DebugStep, DesignStep, ReflectStep, AppStep,
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

/** 챕터 id 모양 (폴더 이름, 예: 10-auto-door) */
export const ChapterId = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "챕터 id 는 영어 소문자·숫자·- 만 (예: 18-servo)");

/** 트랙: 센서 트랙(모듈 하나, 개념 하나) / 교과 융합 트랙(센서 묶기 → 교과·SDG 문제) */
export const TrackId = z.enum(["sensor", "fusion"]);
export type TrackId = z.infer<typeof TrackId>;

export const ChapterSchema = z.object({
  /** 폴더 이름과 같아야 한다 (예: 10-auto-door) */
  id: ChapterId,
  order: z.number().int(),
  title: z.string().min(1),
  /** 어느 트랙 목록에 보일지 */
  track: TrackId,
  /** 화면에 보일 번호 (센서 S1·S2…, 교과 융합 F1·F2…) */
  label: z.string().regex(/^[A-Z][0-9]{1,3}$/, "번호는 영어 대문자 하나 + 숫자 (예: S8, F3)"),
  /** 먼저 할 챕터 id (안내만 — 잠그지 않는다). 아직 없는 챕터 id 도 쓸 수 있고 목록에서 "준비 중"으로 보인다 */
  prerequisites: z.array(ChapterId).min(1).optional(),
  /** 연결 교과 (예: 과학, 수학) */
  subjects: z.array(z.string().min(1)).min(1).optional(),
  /** 유엔 지속가능발전목표 번호 1~17 */
  sdg: z.array(z.number().int().min(1).max(17)).min(1).optional(),
  /** 차시 수 */
  sessions: z.number().int().positive().optional(),
  /** draft 는 교사 모드에서만 목록에 보인다 (주소로는 누구나 열림) */
  status: z.enum(["draft", "published"]).default("published"),
  /** 교사 메모 (markdown). 교사 모드에서만 챕터 화면 아래에 보인다 */
  teacherNotes: z.string().min(1).optional(),
  subtitle: z.string().optional(),
  /** 챕터 화면·목록 카드의 한두 문장 소개 */
  summary: z.string().min(1).optional(),
  /** 표지 그림 */
  cover: ImageRef.optional(),
  /** 준비물(부품). image 는 작은 부품 그림 */
  materials: z.array(z.object({ name: z.string().min(1), image: ImageRef.optional(), note: z.string().min(1).optional() }).strict()).min(1).optional(),
  /** 배선도 */
  wiring: FigureSchema.optional(),
  /** 원리 (Keyestudio 수업의 "원리"): 챕터 화면 hero 아래 카드. body 는 markdown, image 는 왼쪽 그림 */
  principle: z.object({ body: z.string().min(1), image: ImageRef.optional() }).strict().optional(),
  goals: z.object({ content: z.string().min(1), thinking: z.string().min(1) }).strict().optional(),
  successCriteria: z.array(z.string().min(1)).optional(),
  parts: z.array(PartSchema).min(1),
}).strict();
export type Chapter = z.infer<typeof ChapterSchema>;
