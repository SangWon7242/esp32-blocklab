import { describe, expect, it, vi } from "vitest";
import { askClaude, buildRequest, CLAUDE_URL, debugMessage, DEFAULT_MODEL, parseReview, reflectMessage, SYSTEM_PROMPT } from "./claude";

const okResponse = (text: string) => ({ ok: true, status: 200, json: async () => ({ content: [{ type: "text", text }] }) });

describe("buildRequest", () => {
  it("Messages API 헤더와 JSON 본문을 만든다", () => {
    const [url, init] = buildRequest("sk-test", "", "안녕");
    expect(url).toBe(CLAUDE_URL);
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "content-type": "application/json",
      "x-api-key": "sk-test",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    });
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(DEFAULT_MODEL);
    expect(DEFAULT_MODEL).toBe("claude-sonnet-5-5");
    expect(body.system).toBe(SYSTEM_PROMPT);
    expect(body.messages).toEqual([{ role: "user", content: "안녕" }]);
    expect(body.max_tokens).toBeGreaterThan(0);
  });

  it("시스템 프롬프트는 정답 코드를 금지하고 질문 3개를 요구한다", () => {
    expect(SYSTEM_PROMPT).toContain("정답 코드");
    expect(SYSTEM_PROMPT).toContain("질문을 정확히 3개");
    expect(SYSTEM_PROMPT).toContain("\"questions\"");
  });
});

describe("메시지", () => {
  it("reflect: 코드, 줄별 설명(줄 순서·코드 줄과 함께), 성찰 4개를 담는다", () => {
    const msg = reflectMessage({
      code: "import time\nwhile True:\n    time.sleep(1)\n",
      lines: { 3: "1초 쉰다", 2: "계속 반복", 1: "  " },
      reflections: [
        { prompt: "막힌 곳", answer: "들여쓰기" },
        { prompt: "내가 해 본 것", answer: "" },
        { prompt: "결국 원인은", answer: "콜론" },
        { prompt: "다음엔 여기부터 본다", answer: "오류 줄" },
      ],
    });
    expect(msg).toContain("```python\nimport time\nwhile True:\n    time.sleep(1)\n```");
    expect(msg).toContain("2번 줄 `while True:` → 계속 반복\n3번 줄 `time.sleep(1)` → 1초 쉰다");
    expect(msg).not.toContain("1번 줄");
    expect(msg).toContain("1. 막힌 곳: 들여쓰기");
    expect(msg).toContain("2. 내가 해 본 것: (비어 있음)");
    expect(msg).toContain("4. 다음엔 여기부터 본다: 오류 줄");
  });

  it("debug: 증상, 고장 코드, 학생 생각을 담는다", () => {
    const msg = debugMessage({ code: "if d < 15\n    pass", symptom: "문이 안 열려요", explanation: "숫자가 틀렸다" });
    expect(msg).toContain("[증상] 문이 안 열려요");
    expect(msg).toContain("```python\nif d < 15\n    pass\n```");
    expect(msg).toContain("[학생 생각] 숫자가 틀렸다");
    expect(msg).toContain("질문 3개만");
  });
});

describe("parseReview", () => {
  it("앞뒤 말과 코드 울타리가 있어도 JSON 객체를 읽는다", () => {
    const text = "점검 결과예요\n```json\n{\"correct\":[\"반복을 알았다\"],\"missing\":[\"\", \"핀 번호\"],\"questions\":[\"a?\",\"b?\",\"c?\",\"d?\"]}\n```";
    expect(parseReview(text)).toEqual({ correct: ["반복을 알았다"], missing: ["핀 번호"], questions: ["a?", "b?", "c?"] });
  });

  it("빠진 배열은 빈 배열로, 질문이 없거나 JSON 이 아니면 throw", () => {
    expect(parseReview("{\"questions\":[\"왜?\"]}")).toEqual({ correct: [], missing: [], questions: ["왜?"] });
    expect(() => parseReview("{\"correct\":[]}")).toThrow("질문이 없어요");
    expect(() => parseReview("모르겠어요")).toThrow("찾지 못했어요");
    expect(() => parseReview("{ 깨진 }")).toThrow("읽지 못했어요");
  });
});

describe("askClaude (가짜 fetch)", () => {
  it("요청을 보내고 text 블록을 이어 붙여 읽는다", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: "{\"correct\":[],\"missing\":[]," }, { type: "text", text: "\"questions\":[\"q1\",\"q2\",\"q3\"]}" }] }),
    }));
    const review = await askClaude({ apiKey: "k", model: "claude-x", message: "m" }, fetchMock);
    expect(review.questions).toEqual(["q1", "q2", "q3"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(CLAUDE_URL);
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k");
    expect(JSON.parse(init.body as string).model).toBe("claude-x");
  });

  it("401 이면 키 확인, 그 밖의 오류는 API 메시지, 연결 실패도 메시지로 throw", async () => {
    await expect(askClaude({ apiKey: "bad", model: "", message: "m" }, async () => ({ ok: false, status: 401, json: async () => ({}) })))
      .rejects.toThrow("API 키를 확인해 주세요");
    await expect(askClaude({ apiKey: "k", model: "", message: "m" }, async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "bad model" } }) })))
      .rejects.toThrow("bad model");
    await expect(askClaude({ apiKey: "k", model: "", message: "m" }, async () => { throw new TypeError("network"); }))
      .rejects.toThrow("연결하지 못했어요");
    await expect(askClaude({ apiKey: "k", model: "", message: "m" }, async () => okResponse("no json")))
      .rejects.toThrow("찾지 못했어요");
  });
});
