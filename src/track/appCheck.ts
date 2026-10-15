import type { AppApi, AppReadQuestion, StepOf } from "./schema";

/*
 * 앱 만들기(app) 단계의 순수 함수: 프롬프트 채우기, 붙여넣은 HTML 검사, 읽기 체크 채점, 완료 조건.
 * 화면(src/app/track/steps/AppStep.tsx)과 슬라이드(scripts/slides/deck.ts)가 함께 쓴다 (scripts 도 읽으므로 "@/" 별칭 없이).
 */

type AppStepDef = StepOf<"app">;

/** 붙여넣기 크기 기본 한도 (바이트, UTF-8). 보드 플래시와 웹서버 응답을 생각한 크기 */
export const APP_DEFAULT_MAX_BYTES = 12000;

/** 학생이 적은 화면 설계 세 칸 (칸마다 글 그대로, 한 줄에 하나씩) */
export type AppDesignInput = { show?: string; buttons?: string; changes?: string };

/** app 단계 입력 (StepRecord.input) */
export type AppInput = {
  design?: AppDesignInput;
  /** 붙여넣은 AI 결과 (글 그대로) */
  html?: string;
  /** 마지막으로 "검사"한 글. html 과 다르면 검사가 낡은 것 (결과는 이 글에서 다시 계산한다) */
  checkedHtml?: string;
  /** 보드에 index.html 로 저장한 글 (선택) */
  savedHtml?: string;
  /** 읽기 체크 문항마다 학생 답 (choice 는 선택지 번호를 글로) */
  answers?: string[];
  /** 마지막 "확인" 결과. 답을 고치면 그 문항 결과는 지운다 */
  results?: (boolean | null)[];
};

export const APP_DESIGN_BOXES = [
  { key: "show", label: "보여 줄 값", help: "화면에 어떤 값을 보여 줄까요?" },
  { key: "buttons", label: "누를 버튼", help: "어떤 버튼을 둘까요?" },
  { key: "changes", label: "바뀌는 모습", help: "값에 따라 무엇이 바뀌나요? (색, 글자 등)" },
] as const;
export type AppDesignKey = (typeof APP_DESIGN_BOXES)[number]["key"];

/** 칸 글 → 항목 (한 줄에 하나, 빈 줄 빼고) */
export function designItems(text: string | undefined): string[] {
  return (text ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
}

/** 주소의 경로 부분 (/cmd?led=on → /cmd) */
export function apiBasePath(path: string): string {
  return path.split("?")[0] || path;
}

/** 프롬프트 빈칸 자리에 학생 칸이 비었을 때 넣는 표시 */
export const PROMPT_BLANK = "___";

/** {{ip}} 자리: 앱은 보드가 내주므로 늘 상대 주소로 묻게 한다 */
export const PROMPT_IP_TEXT = "이 페이지를 내준 보드(상대 주소)";

const readApis = (api: readonly AppApi[]) => api.filter((a) => a.method === "읽기");
const commandApis = (api: readonly AppApi[]) => api.filter((a) => a.method === "명령");

/**
 * 프롬프트 템플릿의 {{...}} 을 약속표·학생 설계로 채운다.
 * missing = 템플릿이 쓰는데 학생 칸이 비어 있는 설계 칸 (다 채워야 복사할 수 있다).
 */
export function fillPrompt(template: string, api: readonly AppApi[], design: AppDesignInput): { text: string; missing: AppDesignKey[] } {
  const missing: AppDesignKey[] = [];
  const student = (key: AppDesignKey) => {
    const items = designItems(design[key]);
    if (!items.length) {
      if (!missing.includes(key)) missing.push(key);
      return PROMPT_BLANK;
    }
    return items.join(", ");
  };
  const values: Record<string, () => string> = {
    ip: () => PROMPT_IP_TEXT,
    data: () => readApis(api).map((a) => (a.fields?.length ? `${a.path}(JSON: ${a.fields.join(", ")})` : a.path)).join(", ") || "(없음)",
    commands: () => commandApis(api).map((a) => (a.note ? `${a.path}(${a.note})` : a.path)).join(", ") || "(없음)",
    show: () => student("show"),
    buttons: () => student("buttons"),
    changes: () => student("changes"),
  };
  const text = template.replace(/\{\{\s*([^}]*?)\s*\}\}/g, (all, key: string) => (values[key] ? values[key]() : all)).replace(/\n+$/, "");
  return { text, missing };
}

export type AppCheckOptions = { maxBytes: number; mustUse: string[] };

/** 검사 설정: 기본(크기 한도, 약속표 주소의 경로) + 챕터가 덧붙인 mustUse (중복 없이) */
export function appCheckOptions(step: Pick<AppStepDef, "api" | "checks">): AppCheckOptions {
  const mustUse: string[] = [];
  for (const s of [...step.api.map((a) => apiBasePath(a.path)), ...(step.checks?.mustUse ?? [])]) if (!mustUse.includes(s)) mustUse.push(s);
  return { maxBytes: step.checks?.maxBytes ?? APP_DEFAULT_MAX_BYTES, mustUse };
}

/** 검사 항목 하나. fail 은 실패 때 보일 되묻기 한 줄 (정답을 말하지 않는다) */
export type AppCheckItem = { id: string; label: string; pass: boolean; fail?: string };

/** 검사 항목 이름 목록 (슬라이드용) */
export function appCheckLabels(opts: AppCheckOptions): string[] {
  return checkAppHtml("", opts).map((c) => c.label);
}

/** AI 답을 통째로 붙였을 때 앞뒤 ``` 울타리를 걷는다 */
export function stripCodeFence(text: string): string {
  const m = /^\s*```[\w-]*[^\S\n]*\n([\s\S]*?)\n?```\s*$/.exec(text);
  return m ? m[1] : text;
}

export const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

/** SVG·XHTML 이름표(xmlns) 주소는 요청이 아니므로 바깥 주소로 치지 않는다 */
const NAMESPACE = /^https?:\/\/www\.w3\.org\//i;

/** 글 속 바깥 주소 (http://·https://·//로 시작하는 src·href) */
export function externalUrls(html: string): string[] {
  const found: string[] = [];
  for (const m of html.matchAll(/\bhttps?:\/\/[^\s"'`<>)]+/gi)) if (!NAMESPACE.test(m[0])) found.push(m[0]);
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*["']?(\/\/[^\s"'<>]+)/gi)) found.push(m[1]);
  return found;
}

/**
 * 붙여넣은 HTML 검사. 모든 항목을 돌려준다 (통과도 함께 — 화면은 통과/실패 목록을 보인다).
 * - 한 파일: <html 이 있다
 * - <script src=…> 로 다른 파일을 불러오지 않는다 (보드에는 index.html 하나만)
 * - <link href=…> 로 바깥 주소를 불러오지 않는다
 * - http://·https:// 바깥 주소가 없다 (ESP32 상대 주소만. xmlns 이름표는 예외)
 * - 약속 주소(mustUse)를 모두 쓴다
 * - 크기 ≤ maxBytes (UTF-8 바이트)
 * - <iframe·eval( 이 없다
 */
export function checkAppHtml(text: string, opts: AppCheckOptions, api: readonly AppApi[] = []): AppCheckItem[] {
  const html = stripCodeFence(text);
  const items: AppCheckItem[] = [];
  const add = (id: string, label: string, pass: boolean, fail: string) => items.push(pass ? { id, label, pass } : { id, label, pass, fail });

  add("one-file", "한 파일짜리 HTML", /<html[\s>]/i.test(html),
    "`<html` 로 시작하는 전체 파일인가요? AI 답에서 코드 부분을 처음부터 끝까지 붙여 넣었는지 확인해 보세요");
  add("no-script-src", "다른 파일의 스크립트를 불러오지 않기", !/<script\b[^>]*\bsrc\s*=/i.test(html),
    "`<script src=…>` 는 다른 파일을 불러와요. 보드에는 index.html 하나만 올라가는데, 그 파일은 어디서 올까요?");
  add("no-external-link", "바깥 스타일·글꼴을 불러오지 않기", !/<link\b[^>]*\bhref\s*=\s*["']?\s*(?:https?:)?\/\//i.test(html),
    "`<link href=…>` 가 바깥 주소에서 무언가를 불러와요. 폰이 보드에만 연결돼 있으면 그 주소에 갈 수 있을까요?");
  const urls = externalUrls(html);
  add("relative-only", "ESP32 상대 주소만 쓰기", urls.length === 0,
    `\`${urls[0] ?? ""}\` 는 어느 컴퓨터의 주소인가요? 이 페이지를 내준 보드에 물으려면 주소를 어떻게 써야 할까요?`);
  for (const path of opts.mustUse) {
    const owner = api.find((a) => apiBasePath(a.path) === path);
    const fail = owner?.method === "읽기"
      ? `이 페이지는 어느 주소에서 값을 가져오나요? 약속표의 \`${path}\` 가 코드에 보이지 않아요`
      : owner?.method === "명령"
        ? `버튼을 누르면 어느 주소로 요청을 보내나요? 약속표의 \`${path}\` 가 코드에 보이지 않아요`
        : `약속한 \`${path}\` 가 코드에 보이지 않아요. 약속표와 다시 맞춰 볼까요?`;
    add(`must-use:${path}`, `약속 주소 \`${path}\` 쓰기`, html.includes(path), fail);
  }
  const bytes = utf8Bytes(html);
  add("size", `크기 ${opts.maxBytes} 바이트 이하`, bytes <= opts.maxBytes,
    `지금 ${bytes} 바이트예요. 보드에 넣기엔 커요. AI에게 무엇을 빼 달라고 하면 될까요?`);
  add("no-iframe", "`<iframe` 쓰지 않기", !/<iframe\b/i.test(html),
    "`<iframe` 은 다른 페이지를 통째로 끌어와요. 이 앱에 꼭 필요한가요? 없이 만들어 달라고 해 보세요");
  add("no-eval", "`eval(` 쓰지 않기", !/\beval\s*\(/.test(html),
    "`eval(` 은 글자를 코드로 바꿔 실행해요. 왜 위험할까요? 없이 만들어 달라고 해 보세요");
  return items;
}

/** 단계 설정으로 검사 */
export function checkAppStep(step: Pick<AppStepDef, "api" | "checks">, text: string): AppCheckItem[] {
  return checkAppHtml(text, appCheckOptions(step), step.api);
}

/** 지금 붙여 둔 글을 검사했고 모두 통과했는지 (검사 뒤 글을 고치면 false) */
export function appCheckPassed(step: Pick<AppStepDef, "api" | "checks">, input: AppInput): boolean {
  if (typeof input.checkedHtml !== "string" || input.checkedHtml !== input.html || !input.html.trim()) return false;
  return checkAppStep(step, input.checkedHtml).every((c) => c.pass);
}

/** 읽기 체크 채점: choice 는 선택지 번호, text 는 쓰기만 하면 통과 (교사가 확인) */
export function gradeAppReadCheck(questions: readonly AppReadQuestion[], answers: readonly (string | undefined)[]): boolean[] {
  return questions.map((q, i) => {
    const given = (answers[i] ?? "").trim();
    if (q.kind === "text") return given.length > 0;
    return given !== "" && Number(given) === q.answer;
  });
}

/** 완료 조건: 검사 통과 + 읽기 체크 모두 통과 (보드 저장은 선택) */
export function appCompleted(step: AppStepDef, input: AppInput): boolean {
  return appCheckPassed(step, input) && step.readcheck.every((_, i) => input.results?.[i] === true);
}
