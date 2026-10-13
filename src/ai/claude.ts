/**
 * AI 점검 (설계 §10): 브라우저에서 Claude Messages API 를 직접 부른다. 키는 설정(localStorage)에만 있다.
 * React 없음 — 요청 만들기·응답 읽기만 하고 fetch 는 바꿔 끼울 수 있다 (테스트는 가짜 fetch).
 */

export const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
export const DEFAULT_MODEL = "claude-sonnet-5-5";

/** AI 가 돌려주는 점검 결과 */
export type AiReview = {
  /** 맞게 설명한 부분 */
  correct: string[];
  /** 빠졌거나 더 생각해 볼 부분 */
  missing: string[];
  /** 학생이 스스로 생각하게 하는 되묻는 질문 (3개) */
  questions: string[];
};

/** 저장하는 모양: 결과 + 받은 때 */
export type SavedAiReview = AiReview & { at: string };

export const SYSTEM_PROMPT = [
  "너는 ESP32 와 MicroPython 을 배우는 중학생을 돕는 코딩 선생님이다.",
  "절대로 정답 코드나 고친 코드를 쓰지 마라. 코드 줄을 그대로 옮겨 적거나 어떻게 고치라고 직접 알려 주지 마라.",
  "학생이 스스로 생각하게 만드는 되묻는 질문을 정확히 3개 만든다. 질문은 짧고 쉬운 우리말로, 학생 말투에 맞춘다.",
  "답은 다른 글 없이 JSON 객체 하나만 쓴다: {\"correct\": [문자열...], \"missing\": [문자열...], \"questions\": [문자열 3개]}.",
  "correct 는 학생이 맞게 설명한 부분, missing 은 빠졌거나 더 생각해 볼 부분이다. 해당하는 것이 없으면 빈 배열로 둔다.",
].join("\n");

export type ReflectRequest = {
  /** 줄별 설명을 쓴 완성 코드 */
  code: string;
  /** 줄 번호 → 학생 설명 */
  lines: Record<string, string>;
  /** 성찰 질문과 학생 글 */
  reflections: { prompt: string; answer: string }[];
};

export type DebugRequest = {
  /** 고장 난 코드 */
  code: string;
  /** 증상 제목 */
  symptom: string;
  /** 학생이 쓴 "왜 이런 증상일까?" */
  explanation: string;
};

/** reflect "내 설명 점검 받기"의 사용자 메시지 */
export function reflectMessage(req: ReflectRequest): string {
  const source = req.code.split("\n");
  const lines = Object.entries(req.lines)
    .filter(([, text]) => text.trim())
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([n, text]) => `${n}번 줄 \`${(source[Number(n) - 1] ?? "").trim()}\` → ${text.trim()}`);
  return [
    "아래는 학생이 완성한 코드와, 학생이 줄마다 쓴 설명, 그리고 성찰 글이다.",
    "맞게 설명한 부분과 빠진 부분을 짚고, 되묻는 질문 3개를 만들어 줘. 정답 코드는 쓰지 마.",
    "",
    "[코드]",
    "```python",
    req.code.replace(/\n+$/, ""),
    "```",
    "",
    "[줄별 설명]",
    lines.length ? lines.join("\n") : "(쓴 설명 없음)",
    "",
    "[성찰]",
    ...req.reflections.map((r, i) => `${i + 1}. ${r.prompt}: ${r.answer.trim() || "(비어 있음)"}`),
  ].join("\n");
}

/** debug "질문 3개만 받기"의 사용자 메시지 */
export function debugMessage(req: DebugRequest): string {
  return [
    "아래는 고장 난 코드와 그 증상, 그리고 학생이 쓴 원인 추측이다.",
    "어디부터 살펴볼지 스스로 생각하게 하는 질문 3개만 만들어 줘. 원인이나 고친 코드는 알려 주지 마. correct 와 missing 은 빈 배열로 둬.",
    "",
    `[증상] ${req.symptom}`,
    "",
    "[고장 난 코드]",
    "```python",
    req.code.replace(/\n+$/, ""),
    "```",
    "",
    `[학생 생각] ${req.explanation.trim() || "(비어 있음)"}`,
  ].join("\n");
}

/** Messages API 요청 (fetch 의 두 인자) */
export function buildRequest(apiKey: string, model: string, userMessage: string): [string, RequestInit] {
  return [
    CLAUDE_URL,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    },
  ];
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim()) : []);

/** 답 글에서 JSON 객체 하나를 찾아 점검 결과로 (코드 울타리·앞뒤 말이 있어도 된다) */
export function parseReview(text: string): AiReview {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 답에서 결과를 찾지 못했어요");
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("AI 답을 읽지 못했어요");
  }
  const o = (data ?? {}) as Record<string, unknown>;
  const review = { correct: strings(o.correct), missing: strings(o.missing), questions: strings(o.questions).slice(0, 3) };
  if (review.questions.length === 0) throw new Error("AI 답에 질문이 없어요");
  return review;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

/** Claude 를 부르고 점검 결과를 돌려준다. 실패하면 학생이 읽을 수 있는 메시지로 throw */
export async function askClaude(
  opts: { apiKey: string; model: string; message: string },
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
): Promise<AiReview> {
  const [url, init] = buildRequest(opts.apiKey, opts.model, opts.message);
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(url, init);
  } catch {
    throw new Error("AI 에 연결하지 못했어요. 인터넷 연결을 확인해 주세요");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // 본문이 JSON 이 아니면 아래에서 상태 코드로 알린다
  }
  if (!res.ok) {
    const detail = (body as { error?: { message?: string } } | null)?.error?.message;
    const hint = res.status === 401 ? "API 키를 확인해 주세요" : detail ?? `오류 ${res.status}`;
    throw new Error(`AI 점검에 실패했어요 (${hint})`);
  }
  const content = (body as { content?: { type: string; text?: string }[] } | null)?.content ?? [];
  const text = content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  return parseReview(text);
}
