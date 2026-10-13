import { expect, test, type Page } from "@playwright/test";

/** 작업판에 그 글자가 든 블록이 그려질 때까지 (코드 → 블록 변환이 끝났다는 신호) */
const blockWithText = (page: Page, text: string) =>
  page.getByTestId("blockly-host").locator(".blocklyBlockCanvas .blocklyText", { hasText: text });

test("블록이 코드로, 코드가 블록으로 바뀐다", async ({ page }) => {
  await page.goto("/#/lab");
  await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
  const code = page.getByTestId("code-panel");
  await expect(code).toContainText("led = Pin(26, Pin.OUT)");
  await expect(code).toContainText("while True:");

  await page.getByRole("tab", { name: "코드" }).click();
  await expect(page.getByTestId("blocks-overlay")).toBeVisible();
  const editor = code.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type('\nprint("hello")\n');
  // debounce 뒤 파싱이 끝나 작업판에 hello 블록이 생긴 다음에 오류 배지가 없는지 본다
  await expect(blockWithText(page, "hello")).toBeVisible();
  await expect(page.getByTestId("parse-error")).toHaveCount(0);

  await page.getByRole("tab", { name: "블록" }).click();
  await expect(page.getByText("블록을 놓으면 코드가 바로 바뀝니다")).toBeVisible();
  await expect(code).toContainText('print("hello")');
});

test("문법 오류는 배지로 알려 준다", async ({ page }) => {
  await page.goto("/#/lab");
  await page.getByRole("tab", { name: "코드" }).click();
  const editor = page.getByTestId("code-panel").locator(".cm-content");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\nif d < 15\n");
  await expect(page.getByTestId("parse-error")).toBeVisible();
});

test("코드를 치자마자 블록 탭으로 가도 마지막 입력이 남는다", async ({ page }) => {
  await page.goto("/#/lab");
  await page.getByRole("tab", { name: "코드" }).click();
  const code = page.getByTestId("code-panel");
  await code.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type('\nprint("fast")');
  // 기다리지 않고 바로 (debounce 300ms 안에) 블록 탭으로
  await page.getByRole("tab", { name: "블록" }).click();
  await expect(blockWithText(page, "fast")).toBeVisible();
  await expect(page.getByText("블록을 놓으면 코드가 바로 바뀝니다")).toBeVisible();
  await expect(code).toContainText('print("fast")');
});
