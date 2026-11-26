import { expect, test } from "@playwright/test";

/*
 * 「펌웨어 설치」 (lib-v1.13.0). 가짜 보드(?device=fake)는 꽂혀 있고 MicroPython 이 없는 보드로 시작한다.
 * 진짜 Web Serial 로는 "연결되어 있지 않아요" 부터 보인다 (테스트 브라우저엔 허락한 보드가 없다).
 */

test("가짜 보드: 펌웨어가 없으면 설치하고, 다시 열면 이미 들어 있다고 알려 준다", async ({ page }) => {
  await page.goto("/#/track/01-led?device=fake");
  await page.getByTestId("firmware-button").click();
  const dialog = page.getByTestId("firmware-dialog");
  await expect(dialog).toHaveAttribute("data-view", "checked");
  await expect(dialog).toContainText("MicroPython 펌웨어가 없어요");
  await expect(dialog).toContainText("모두 지워져요");

  await dialog.getByTestId("firmware-install").click();
  await expect(dialog).toHaveAttribute("data-view", "flashing");
  await expect(dialog.getByTestId("firmware-phases")).toContainText("펌웨어 쓰기");
  // 설치하는 동안은 Esc 로 닫히지 않는다
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  await expect(dialog).toHaveAttribute("data-view", "done", { timeout: 15_000 });
  await expect(dialog).toContainText("설치를 마쳤어요");
  await dialog.getByTestId("firmware-done").click();
  await expect(dialog).toBeHidden();

  await page.getByTestId("firmware-button").click();
  await expect(page.getByTestId("firmware-dialog")).toContainText("펌웨어가 이미 들어 있어요");
});

test("진짜 보드: 허락한 보드가 없으면 연결되어 있지 않다고 먼저 알려 준다", async ({ page }) => {
  await page.goto("/#/track/01-led");
  await page.getByTestId("firmware-button").click();
  const dialog = page.getByTestId("firmware-dialog");
  await expect(dialog).toHaveAttribute("data-view", /no-board|unsupported/);
  if ((await dialog.getAttribute("data-view")) === "no-board") {
    await expect(dialog).toContainText("보드가 연결되어 있지 않아요");
    await expect(dialog.getByTestId("firmware-pick")).toBeVisible();
  }
});
