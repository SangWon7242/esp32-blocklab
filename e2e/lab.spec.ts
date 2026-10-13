import { expect, test } from "@playwright/test";

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
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\nled.value(0)\n");
  await expect(page.getByTestId("parse-error")).toHaveCount(0);

  await page.getByRole("tab", { name: "블록" }).click();
  await expect(code).toContainText("led.value(0)");
});

test("문법 오류는 배지로 알려 준다", async ({ page }) => {
  await page.goto("/#/lab");
  await page.getByRole("tab", { name: "코드" }).click();
  const editor = page.getByTestId("code-panel").locator(".cm-content");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\nif d < 15\n");
  await expect(page.getByTestId("parse-error")).toBeVisible();
});
