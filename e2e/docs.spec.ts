import { expect, test, type Page } from "@playwright/test";

/** 작업판(팔레트 말고)에 그려진, 그 글자가 든 블록 글자 */
const workspaceText = (page: Page, text: string) =>
  page.getByTestId("blockly-host").locator(".blocklyBlockCanvas .blocklyText", { hasText: text });

const docMenuItem = (page: Page) =>
  page.locator(".blocklyContextMenu [role=menuitem]", { hasText: "이 블록 설명 보기" });

test("블록을 우클릭해 이 블록 설명 보기를 연다", async ({ page }) => {
  await page.goto("/#/lab?device=fake");
  const wait = workspaceText(page, "초 기다리기").first();
  await expect(wait).toBeVisible();
  await wait.click({ button: "right" });
  await docMenuItem(page).click();

  const dialog = page.getByTestId("block-doc-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("time.sleep(1)");
  await expect(dialog).toContainText("무슨 뜻인가요");
  await expect(dialog).toContainText("예시 프로그램");
  await expect(dialog.getByRole("link", { name: "블록 사전에서 보기" })).toBeVisible();

  await dialog.getByRole("button", { name: "닫기" }).click();
  await expect(dialog).toHaveCount(0);
});

test("팔레트 블록도 설명을 볼 수 있다", async ({ page }) => {
  await page.goto("/#/lab?device=fake");
  await expect(workspaceText(page, "초 기다리기").first()).toBeVisible();
  await page.getByRole("treeitem", { name: "흐름" }).click();
  const flyoutBlock = page.locator(".blocklyFlyout .blocklyText", { hasText: "밀리초 기다리기" }).first();
  await expect(flyoutBlock).toBeVisible();
  await flyoutBlock.click({ button: "right" });
  await docMenuItem(page).click();
  const dialog = page.getByTestId("block-doc-dialog");
  await expect(dialog).toContainText("time.sleep_ms(500)");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("자유 코딩에서는 예시를 편집기에 열 수 있다", async ({ page }) => {
  await page.goto("/#/lab?device=fake");
  const wait = workspaceText(page, "초 기다리기").first();
  await expect(wait).toBeVisible();
  await wait.click({ button: "right" });
  await docMenuItem(page).click();

  const dialog = page.getByTestId("block-doc-dialog");
  await dialog.getByRole("button", { name: "예시를 편집기에 열기" }).click();
  await expect(page.getByText("지금 작업판을 예시 프로그램으로 바꿀까요?")).toBeVisible();
  await page.getByRole("button", { name: "바꾸기" }).click();

  await expect(dialog).toHaveCount(0);
  const code = page.getByTestId("code-panel");
  await expect(code).toContainText('print("one")');
  await expect(code).toContainText("import time");
  await expect(code).not.toContainText("led = Pin(26, Pin.OUT)");
  await expect(workspaceText(page, "one")).toBeVisible();
});
