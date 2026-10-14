import { expect, type Page } from "@playwright/test";
import { SAMPLE_CODE } from "../src/app/lab/sample";

/**
 * 자유 코딩을 LED 1초 깜빡이기(SAMPLE_CODE)가 블록으로 놓인 상태로 연다. 처음 화면은 시작 블록만 있으므로 코드 모드에서
 * 샘플을 붙여 넣고(자동 들여쓰기가 끼지 않게 insertText) 블록 모드로 돌아온다. 코드 패널은 작업판이 만든 코드 = SAMPLE_CODE
 */
export async function openSample(page: Page, url = "/#/lab"): Promise<void> {
  await page.goto(url);
  const host = page.getByTestId("blockly-host");
  await expect(host.locator(".blocklyMainBackground")).toBeVisible();
  await page.getByRole("tab", { name: "코드" }).click();
  await page.getByTestId("code-panel").locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(SAMPLE_CODE);
  await page.getByRole("tab", { name: "블록" }).click();
  await expect(page.getByText("블록을 놓으면 코드가 바로 바뀝니다")).toBeVisible();
  await expect(host.locator("g.esp_pin_write")).toHaveCount(2);
  await expect(page.getByTestId("code-panel")).toContainText("led = Pin(26, Pin.OUT)");
}
