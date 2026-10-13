import { expect, test, type Page, type Route } from "@playwright/test";

const KEY = "esp32-blocklab:v1";
const SETTINGS = "esp32-blocklab:settings";
const API = "https://api.anthropic.com/v1/messages";

/** 앞 단계들을 끝낸 기록(과 설정)으로 시작한다 (첫 로드 때만 깐다 — 화면에서 저장한 것을 덮지 않게) */
async function seed(page: Page, chapter: string, stepIds: string[], settings?: Record<string, unknown>) {
  const records = Object.fromEntries(
    stepIds.map((id) => [id, { status: "done", input: {}, attempts: 0, updatedAt: "2026-10-14T00:00:00.000Z" }]),
  );
  const progress = JSON.stringify({ version: 1, chapters: { [chapter]: records } });
  await page.addInitScript(([key, value, settingsKey, settingsValue]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(key, value);
      if (settingsValue) localStorage.setItem(settingsKey, settingsValue);
      sessionStorage.setItem("seeded", "1");
    }
  }, [KEY, progress, SETTINGS, settings ? JSON.stringify(settings) : ""] as const);
}

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/**
 * 개발 서버의 작업판 훅(window.__blocklabWorkspace)으로 흩어진 블록을 시작 블록에 type 순서대로 잇는다.
 * 블록 끌어 놓기는 e2e 에서 위치에 민감해 흔들리므로, 학생이 끌어 잇는 것과 같은 연결을 Blockly API 로 만든다.
 */
async function connectInOrder(page: Page, types: string[]) {
  await page.evaluate((order) => {
    type B = { type: string; previousConnection: { } | null; nextConnection: { connect(c: unknown): void } | null; getInput(n: string): { connection: { connect(c: unknown): void } } | null };
    const ws = (window as unknown as { __blocklabWorkspace: { getTopBlocks(ordered: boolean): B[] } }).__blocklabWorkspace;
    const tops = ws.getTopBlocks(false);
    const start = tops.find((b) => b.type === "start_program")!;
    const pieces = order.map((t) => tops.find((b) => b.type === t && b !== start)!);
    start.getInput("BODY")!.connection.connect(pieces[0].previousConnection);
    for (let i = 1; i < pieces.length; i++) pieces[i - 1].nextConnection!.connect(pieces[i].previousConnection);
  }, types);
}

test("설계 단계: 빈칸 채점 → 번역표 → 흩어진 블록을 이어 조립하면 판정을 통과하고 완료된다", async ({ page }) => {
  await seed(page, "01-led", ["problem", "analysis", "predict", "run", "readcheck", "mission"]);
  await page.goto("/#/track/01-led/design?device=fake");

  // ① 빈칸: 틀린 빈칸은 표시되고 번역표가 아직 안 열린다
  await page.getByLabel("3번 줄 빈칸").fill("1");
  await page.getByLabel("5번 줄 빈칸").fill("2");
  await button(page, "빈칸 확인").click();
  await expect(page.getByText("표시한 빈칸을 다시 생각해 보세요")).toBeVisible();
  await expect(page.getByTestId("design-table")).toHaveCount(0);
  await page.getByLabel("5번 줄 빈칸").fill("1초");
  await button(page, "빈칸 확인").click();
  await expect(page.getByText("빈칸을 모두 채웠어요")).toBeVisible();

  // ② 번역표 (읽기 전용) → 확인했어요
  await expect(page.getByTestId("design-table")).toContainText("led.value(1)");
  await expect(page.getByTestId("design-assembly")).toHaveCount(0);
  await button(page, "확인했어요").click();

  // ③ 조립: 필수 단계라 건너뛰기 없음, 블록으로만 (코드 탭 꺼짐), 흩어 둔 블록에 "떨어진 블록" 경고 없음
  await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
  await expect(button(page, "건너뛰기")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "코드" })).toBeDisabled();
  await expect(page.getByTestId("bottom-panel").getByRole("tab", { name: /^문제/ })).toHaveText("문제");
  await expect(button(page, "완료")).toBeDisabled();
  await expect(page.getByTestId("code-panel")).not.toContainText("while True:");
  await button(page, "판정").click();
  await expect(page.getByTestId("judge-failures")).toContainText("순서나 값이 설계도와 달라요");

  await connectInOrder(page, ["esp_pin_setup", "flow_repeat_forever"]);
  await expect(page.getByTestId("code-panel")).toContainText("while True:");
  await button(page, "판정").click();
  await expect(page.getByText("설계도대로 조립했어요")).toBeVisible();
  await expect(button(page, "완료")).toBeEnabled();

  // 통과한 뒤 블록을 떼어 내면 판정이 낡아 완료가 다시 꺼진다
  await page.evaluate(() => {
    type B = { type: string; unplug(): void };
    const ws = (window as unknown as { __blocklabWorkspace: { getAllBlocks(ordered: boolean): B[] } }).__blocklabWorkspace;
    ws.getAllBlocks(false).find((b) => b.type === "flow_repeat_forever")!.unplug();
  });
  await expect(page.getByTestId("code-panel")).not.toContainText("while True:");
  await expect(button(page, "완료")).toBeDisabled({ timeout: 5_000 });
  await expect(page.getByText("설계도대로 조립했어요")).toHaveCount(0);

  // 떼어 낸 반복 블록을 다시 준비 블록 아래에 잇는다
  await page.evaluate(() => {
    type B = { type: string; previousConnection: unknown; nextConnection: { connect(c: unknown): void } };
    const ws = (window as unknown as { __blocklabWorkspace: { getAllBlocks(ordered: boolean): B[] } }).__blocklabWorkspace;
    const all = ws.getAllBlocks(false);
    all.find((b) => b.type === "esp_pin_setup")!.nextConnection.connect(all.find((b) => b.type === "flow_repeat_forever")!.previousConnection);
  });
  await expect(page.getByTestId("code-panel")).toContainText("while True:");
  await button(page, "판정").click();
  await expect(page.getByText("설계도대로 조립했어요")).toBeVisible();
  await button(page, "완료").click();
  await expect(page.getByText("완료한 단계예요")).toBeVisible();

  // 다시 열면 조립한 작업판이 남아 있다
  await page.reload();
  await expect(page.getByTestId("code-panel")).toContainText("while True:");
});

const REVIEW = { correct: ["반복을 잘 설명했어요"], missing: ["핀 번호"], questions: ["LED 는 몇 번 핀일까?", "1초는 어디서 정할까?", "끄는 줄이 없으면?"] };

/** Claude API 를 가로챈다 (CORS 사전 요청 포함). 받은 요청을 모은다 */
async function fakeClaude(page: Page, status = 200) {
  const requests: { headers: Record<string, string>; body: { model: string; messages: { content: string }[] } }[] = [];
  await page.route(API, async (route: Route) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    requests.push({ headers: route.request().headers(), body: route.request().postDataJSON() });
    if (status !== 200) return route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify({ error: { message: "invalid x-api-key" } }) });
    return route.fulfill({
      status: 200,
      headers: cors,
      contentType: "application/json",
      body: JSON.stringify({ content: [{ type: "text", text: `점검했어요\n${JSON.stringify(REVIEW)}` }] }),
    });
  });
  return requests;
}

test("AI 점검: 키가 있으면 성찰 단계에서 내 설명을 보내고 되묻는 질문을 카드로 보여 주고 저장한다", async ({ page }) => {
  await seed(page, "01-led", ["problem", "analysis", "predict", "run", "readcheck", "mission", "design"], { claudeApiKey: "sk-ant-test-fake" });
  const requests = await fakeClaude(page);
  await page.goto("/#/track/01-led/reflect");
  await page.getByLabel(/번 줄 설명/).first().fill("핀 기능을 가져온다");
  await page.getByLabel("1. 막힌 곳").fill("들여쓰기");

  await button(page, "내 설명 점검 받기").click();
  const card = page.getByTestId("ai-review");
  await expect(card).toContainText("LED 는 몇 번 핀일까?");
  await expect(card).toContainText("끄는 줄이 없으면?");
  await expect(card).toContainText("반복을 잘 설명했어요");

  expect(requests).toHaveLength(1);
  expect(requests[0].headers["x-api-key"]).toBe("sk-ant-test-fake");
  expect(requests[0].headers["anthropic-version"]).toBe("2023-06-01");
  expect(requests[0].headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  expect(requests[0].body.model).toBe("claude-sonnet-5-5");
  expect(requests[0].body.messages[0].content).toContain("핀 기능을 가져온다");
  expect(requests[0].body.messages[0].content).toContain("1. 막힌 곳: 들여쓰기");

  // 응답은 단계 기록에 남는다
  await page.reload();
  await expect(page.getByTestId("ai-review")).toContainText("1초는 어디서 정할까?");
});

test("AI 점검: 키가 없으면 버튼이 없고, 디버깅의 질문 받기 실패는 알림만 띄운다", async ({ page }) => {
  await seed(page, "01-led", ["problem", "analysis", "predict", "run", "readcheck", "mission", "design"]);
  await page.goto("/#/track/01-led/reflect");
  await expect(page.getByRole("heading", { name: "오늘 한 생각", exact: true })).toBeVisible();
  await expect(button(page, "내 설명 점검 받기")).toHaveCount(0);

  await page.goto("/#/settings");
  await page.getByLabel("교사용 Claude API 키").fill("sk-ant-wrong");
  await expect(page.getByLabel("모델")).toHaveValue("claude-sonnet-5-5");
  await page.getByLabel("교사 모드").click();
  await fakeClaude(page, 401);
  await page.goto("/#/track/10-auto-door/debug1?device=fake");
  await expect(button(page, "질문 3개만 받기")).toBeDisabled();
  await page.getByLabel("왜 이런 증상일까?").fill("핀 번호가 틀린 것 같다");
  await button(page, "질문 3개만 받기").click();
  await expect(page.getByText("AI 점검에 실패했어요 (API 키를 확인해 주세요)")).toBeVisible();
  await expect(page.getByTestId("ai-review")).toHaveCount(0);
  // 진행은 막지 않는다: 설명 저장 → 편집기
  await button(page, "설명 저장").click();
  await expect(page.getByTestId("track-editor")).toBeVisible();
});
