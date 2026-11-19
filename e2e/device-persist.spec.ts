import { expect, test, type Page } from "@playwright/test";

/*
 * 트랙 단계를 넘겨도 보드 연결이 이어진다 (공유 장치 sharedDevice).
 * 단계를 넘기면 편집기가 다시 마운트되지만 장치는 화면 사이에서 하나라 「보드 연결」을 다시 누르지 않는다.
 */

const KEY = "esp32-blocklab:v1";
const SETTINGS = "esp32-blocklab:settings";
const CHAPTER = "10-auto-door";

/** 앞 단계들을 끝낸 기록과 가짜 보드 설정으로 시작한다 (「다음」 링크가 ?device=fake 를 넘기지 않아도 가짜 보드를 쓰게) */
async function seed(page: Page, stepIds: string[]) {
  const records: Record<string, unknown> = Object.fromEntries(
    stepIds.map((id) => [id, { status: "done", input: {}, attempts: 0, updatedAt: "2026-10-14T00:00:00.000Z" }]),
  );
  // 디버깅 단계는 설명을 저장해야 편집기가 열린다
  records.debug1 = { status: "open", input: { saved: [true] }, attempts: 0, updatedAt: "2026-10-14T00:00:00.000Z" };
  const progress = JSON.stringify({ version: 1, chapters: { [CHAPTER]: records } });
  await page.addInitScript(([key, value, settingsKey, settingsValue]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(key, value);
      localStorage.setItem(settingsKey, settingsValue);
      sessionStorage.setItem("seeded", "1");
    }
  }, [KEY, progress, SETTINGS, JSON.stringify({ fakeBoard: true })] as const);
}

async function openStep(page: Page, stepId: string) {
  await page.goto(`/#/track/${CHAPTER}/${stepId}?device=fake`);
  await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
}

async function replaceCode(page: Page, text: string) {
  await page.getByRole("tab", { name: "코드" }).click();
  await page.getByTestId("code-panel").locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(text);
}

const status = (page: Page) => page.getByTestId("device-status");
const rows = (page: Page) => page.getByTestId("console-entry");
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

const DONE = ["problem", "analysis", "predict", "run1", "readcheck1", "mission1"];

test("트랙: 보드를 연결하고 다음 단계로 가면 연결됨이 그대로, 연결 버튼 없이 바로 실행된다", async ({ page }) => {
  await seed(page, DONE);
  await openStep(page, "mission1");
  await expect(status(page)).toHaveText("끊김");
  await button(page, "보드 연결").click();
  await expect(status(page)).toHaveText("연결됨");

  await page.getByRole("link", { name: "다음" }).click();
  await expect(page).toHaveURL(/\/debug1/);
  await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
  // 새 화면에서 바로 연결됨 (연결 버튼 대신 연결 끊기)
  await expect(status(page)).toHaveText("연결됨");
  await expect(button(page, "보드 연결")).toHaveCount(0);
  await expect(button(page, "실행")).toBeEnabled();

  await replaceCode(page, "print(7)\n");
  await button(page, "실행").click();
  await expect(rows(page).filter({ hasText: "실행을 시작했어요" })).toHaveCount(1);
  await expect(rows(page).filter({ hasText: /^7$/ })).toHaveCount(1);
  await expect(rows(page).filter({ hasText: "실행이 끝났어요" })).toHaveCount(1);

  // 앞 단계로 돌아가도 연결됨, 콘솔(보드 행)은 화면마다 새로 시작한다
  await page.getByRole("link", { name: "이전" }).click();
  await expect(page).toHaveURL(/\/mission1/);
  await expect(status(page)).toHaveText("연결됨");
  await expect(rows(page).filter({ hasText: /^7$/ })).toHaveCount(0);

  // 「연결 끊기」를 누르면 끊기고, 다음 단계에서도 끊김
  await button(page, "연결 끊기").click();
  await expect(status(page)).toHaveText("끊김");
  await page.getByRole("link", { name: "다음" }).click();
  await expect(page).toHaveURL(/\/debug1/);
  await expect(status(page)).toHaveText("끊김");
});

test("트랙: 실행 중에 다음 단계로 가면 실행만 멈추고 연결은 이어진다", async ({ page }) => {
  await seed(page, DONE);
  await openStep(page, "mission1");
  await button(page, "보드 연결").click();
  await expect(status(page)).toHaveText("연결됨");
  // 가짜 보드는 print 줄마다 200ms 쉰다 → 20줄이면 4초 동안 실행 중
  await replaceCode(page, Array.from({ length: 20 }, (_, i) => `print(${i})`).join("\n"));
  await button(page, "실행").click();
  await expect(status(page)).toHaveText("실행 중");

  await page.getByRole("link", { name: "다음" }).click();
  await expect(page).toHaveURL(/\/debug1/);
  await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
  // 앞 단계 실행은 멈췄고(실행 중이 아니다) 연결은 그대로
  await expect(status(page)).toHaveText("연결됨");
  await expect(button(page, "실행")).toBeEnabled();
});
