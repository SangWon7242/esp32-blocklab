import { expect, test, type Page } from "@playwright/test";

/*
 * 확장 보드 (38핀 확장 보드 + DevKit 38핀): 보드 고르기 → 배선 그림 .expansion.svg · 3D 확장 보드 장면 · 점퍼 5V 안내.
 * 10장(초음파 · 서보)은 점퍼 5V 수업, 1장(LED)은 평소 자리 3.3V 라 안내가 없다.
 */

const BOARD_KEY = "esp32-blocklab:board";
const NOTICE = "이번 수업은 점퍼를 5V 쪽으로 옮겨요 (끝나면 3.3V 로)";
const boardGroup = (page: Page) => page.getByRole("radiogroup", { name: "수업 보드" }).first();
const expansionRadio = (page: Page) => boardGroup(page).getByRole("radio", { name: "확장 보드 (DevKit 38핀)" });

test("확장 보드를 고르면 자동문 배선 그림이 .expansion.svg 로, 점퍼 5V 안내가 보이고, 1장은 안내가 없다", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("esp32-blocklab:3d", "off"));
  await page.goto("/#/track/10-auto-door");
  await expansionRadio(page).click();
  await expect(expansionRadio(page)).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate((k) => localStorage.getItem(k), BOARD_KEY)).toBe("expansion");

  const wiring = page.getByTestId("chapter-wiring");
  await expect(wiring.getByTestId("illustration")).toHaveAttribute("data-shown-image", "images/wiring-door.expansion.svg");
  const title = await wiring.getByTestId("illustration").locator("svg > title").first().textContent();
  expect(title?.trim().startsWith("확장 보드")).toBe(true);
  await expect(wiring.getByTestId("jumper-notice")).toHaveText(NOTICE);

  // 배선 탭의 설명은 captionExpansion, 위에 점퍼 안내
  await page.getByRole("tab", { name: "배선" }).click();
  const info = page.getByTestId("chapter-wiring-info");
  await expect(info.getByTestId("jumper-notice")).toHaveText(NOTICE);
  await expect(info).toContainText("I2C 헤더 GND · VCC · D21 · D22");

  // 단계 화면(복사 · 실행 — 완성 코드): 장면 그림도 확장 보드판 + 안내
  await page.goto("/#/track/10-auto-door/run2");
  await expect(page.getByTestId("board-select")).toHaveAttribute("data-board", "expansion");
  const scene = page.locator('[data-testid="illustration"][data-image="images/wiring-door.svg"]').first();
  await expect(scene).toHaveAttribute("data-shown-image", "images/wiring-door.expansion.svg");
  await expect(scene.getByTestId("jumper-notice")).toHaveText(NOTICE);

  // 1장 LED: 점퍼 평소 자리 — 안내 없음
  await page.goto("/#/track/01-led");
  await expect(page.getByTestId("chapter-wiring").getByTestId("illustration")).toHaveAttribute("data-shown-image", "images/wiring-led.expansion.svg");
  await expect(page.getByTestId("jumper-notice")).toHaveCount(0);
});

test("3D: 확장 보드 장면 — 점퍼 5V 표시 · 핀 배치도 · 크게 보기 창의 3D 시뮬레이션", async ({ page }) => {
  // 시험 브라우저는 그래픽 가속이 없어 3D 가 꺼지므로 이 시험에서만 켠다
  await page.addInitScript((k) => { localStorage.setItem("esp32-blocklab:3d", "on"); localStorage.setItem(k, "expansion"); }, BOARD_KEY);
  await page.goto("/#/track/10-auto-door");
  const wiring = page.getByTestId("chapter-wiring");
  await expect(wiring.getByTestId("wiring-3d")).toBeVisible({ timeout: 20_000 });
  await wiring.getByTestId("wiring-3d-mode-circuit").click();
  await expect(wiring.getByTestId("wiring-3d-jumper")).toContainText("점퍼 5V");
  await wiring.getByTestId("wiring-3d-pinout-open").click();
  const dialog = wiring.getByTestId("wiring-3d-pinout");
  await expect(dialog).toContainText("확장 보드 (DevKit 38핀)");
  await expect(dialog.getByRole("img", { name: "확장 보드 (DevKit 38핀) 핀 배치도" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // 「그림」 → 크게 보기: 창은 3D 시뮬레이션이 먼저, 점퍼 안내도
  await wiring.getByTestId("wiring-view-picture").click();
  await expect(wiring.getByTestId("illustration")).toHaveAttribute("data-shown-image", "images/wiring-door.expansion.svg");
  await wiring.getByTestId("illustration-zoom").click();
  const zoom = page.getByTestId("illustration-dialog");
  await expect(zoom.getByTestId("illustration-view-3d")).toHaveAttribute("aria-selected", "true");
  await expect(zoom.getByTestId("wiring-3d")).toBeVisible({ timeout: 20_000 });
  await expect(zoom.getByTestId("jumper-notice")).toHaveText(NOTICE);
});

test("폰 390px: 보드 세 칸이 화면 안에 들어오고 가로 스크롤이 없다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of ["/#/track/10-auto-door", "/#/track/10-auto-door/problem"]) {
    await page.goto(url);
    const select = page.getByTestId("board-select");
    await expect(select).toBeVisible();
    for (const id of ["plus", "devkit", "expansion"]) {
      const box = await page.getByTestId(`board-option-${id}`).boundingBox();
      expect(box, `${url} ${id}`).not.toBeNull();
      expect(box!.x, `${url} ${id}`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${url} ${id}`).toBeLessThanOrEqual(390);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), url).toBe(true);
  }
  await expansionRadio(page).click();
  await expect(page.getByTestId("board-select")).toHaveAttribute("data-board", "expansion");
});
