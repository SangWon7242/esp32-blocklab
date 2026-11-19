import { expect, test, type Page } from "@playwright/test";

/*
 * 핀 번호: 주석 자동 맞춤 + 다음 단계로 이어 받기 (src/track/pinComment.ts · pinCarry.ts).
 * 03-traffic-light 의 실행 단계에서 빨강 LED 를 13 → 15 로 바꾸면 그 줄 주석도 IO15 가 되고,
 * 다음 코드 단계(미션)의 시작 코드에 15 가 이어지며 안내 줄이 보인다. 「원래 핀으로」를 누르면 13 으로 돌아간다.
 */

const KEY = "esp32-blocklab:v1";
const CHAPTER = "03-traffic-light";

async function seedDone(page: Page, stepIds: string[]) {
  const records = Object.fromEntries(stepIds.map((id) => [id, { status: "done", input: {}, attempts: 0, updatedAt: "2026-11-19T00:00:00.000Z" }]));
  const progress = JSON.stringify({ version: 1, chapters: { [CHAPTER]: records } });
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(key, value);
      sessionStorage.setItem("seeded", "1");
    }
  }, [KEY, progress] as const);
}

async function openStep(page: Page, stepId: string) {
  await page.goto(`/#/track/${CHAPTER}/${stepId}?device=fake`);
  await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
}

/** 저장된 실행 단계 프로그램 (1초 뒤 저장) */
const savedRunCode = (page: Page) =>
  page.evaluate(([key, chapter]) => {
    const p = JSON.parse(localStorage.getItem(key) ?? "{}");
    return (p.chapters?.[chapter]?.run?.input?.program?.code as string | undefined) ?? "";
  }, [KEY, CHAPTER] as const);

const RED_15 = "led_red = Pin(15, Pin.OUT)  # IO15 → 빨강";
const RED_13 = "led_red = Pin(13, Pin.OUT)  # IO13 → 빨강";

test("코드 모드에서 핀 13 → 15: 주석도 따라가고, 다음 코드 단계에 이어지고, 「원래 핀으로」면 13", async ({ page }) => {
  await seedDone(page, ["problem", "analysis", "predict", "run", "readcheck"]);
  await openStep(page, "run");
  const code = page.getByTestId("code-panel");
  await expect(code).toContainText(RED_13);
  // 실행 단계는 원래 시작 코드라 안내가 없다
  await expect(page.getByTestId("pin-carry")).toHaveCount(0);

  // 코드 모드: led_red 줄의 13 을 지우고 15 를 친다 (지우는 사이 숫자가 비어도 주석이 따라간다)
  await page.getByRole("tab", { name: "코드" }).click();
  await code.locator(".cm-line", { hasText: "led_red = Pin(13" }).click();
  await page.keyboard.press("Home");
  for (let i = 0; i < "led_red = Pin(".length; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Delete");
  await page.keyboard.press("Delete");
  await page.keyboard.type("15");
  await expect(code).toContainText(RED_15);
  await expect.poll(() => savedRunCode(page), { timeout: 5_000 }).toContain(RED_15);

  // 다음 코드 단계(미션): 시작 코드에 15 가 이어지고 안내 줄
  await openStep(page, "mission");
  const notice = page.getByTestId("pin-carry");
  await expect(notice).toContainText("앞 단계에서 바꾼 핀을 이어서 썼어요");
  await expect(notice).toContainText("13번 → 15번");
  await expect(code).toContainText(RED_15);
  await expect(code).toContainText("led_yellow = Pin(14, Pin.OUT)  # IO14 → 노랑");

  // 「원래 핀으로」: 선생님 시작 코드(13)로
  await page.getByTestId("pin-carry-revert").click();
  await expect(code).toContainText(RED_13);
  await expect(notice).toHaveCount(0);
});

test("블록 모드에서 핀 칸 13 → 15: 블록 주석도 IO15", async ({ page }) => {
  await seedDone(page, ["problem", "analysis", "predict"]);
  await openStep(page, "run");
  const code = page.getByTestId("code-panel");
  await expect(code).toContainText(RED_13);
  // 개발 서버의 작업판 훅으로 핀 칸을 바꾼다 (사용자가 칸을 고친 것과 같은 BLOCK_CHANGE 이벤트)
  await page.evaluate(() => {
    type B = { getField(name: string): unknown; getFieldValue(name: string): unknown; setFieldValue(v: unknown, name: string): void; getCommentText(): string | null };
    const ws = (window as unknown as { __blocklabWorkspace: { getAllBlocks(ordered: boolean): B[] } }).__blocklabWorkspace;
    const red = ws.getAllBlocks(false).find((b) => b.getField("PIN") && Number(b.getFieldValue("PIN")) === 13 && b.getCommentText()?.includes("빨강"))!;
    red.setFieldValue(15, "PIN");
  });
  await expect(code).toContainText(RED_15);
  await expect(code).toContainText("led_yellow = Pin(14, Pin.OUT)  # IO14 → 노랑");
});
