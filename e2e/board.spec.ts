import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/*
 * 수업 보드 고르기: 챕터 화면 위의 고르는 칸(radiogroup) → 이 기기에 기억 → 다른 챕터·단계 화면에도 적용.
 * 기본 보드(devkit)를 고르면 배선 그림이 같은 이름의 .devkit.svg 로 바뀐다 (그림 <title> 이 "기본 보드" 로 시작).
 */

const BOARD_KEY = "esp32-blocklab:board";
const DOOR_DEVKIT_SVG = path.resolve(import.meta.dirname, "../content/chapters/10-auto-door/images/wiring-door.devkit.svg");

const boardGroup = (page: Page) => page.getByRole("radiogroup", { name: "수업 보드" }).first();
const plusRadio = (page: Page) => boardGroup(page).getByRole("radio", { name: "ESP32 Plus 확장 보드" });
const devkitRadio = (page: Page) => boardGroup(page).getByRole("radio", { name: "기본 보드 (DevKit 30핀)" });

test("보드를 고르면 기억되고, 다른 챕터·단계 화면에도 같은 값 · 방향키로 바꾼다", async ({ page }) => {
  await page.goto("/#/track/10-auto-door");
  await expect(plusRadio(page)).toHaveAttribute("aria-checked", "true");
  await expect(devkitRadio(page)).toHaveAttribute("aria-checked", "false");

  await devkitRadio(page).click();
  await expect(devkitRadio(page)).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate((k) => localStorage.getItem(k), BOARD_KEY)).toBe("devkit");

  // 새로 고쳐도, 다른 챕터에서도
  await page.reload();
  await expect(devkitRadio(page)).toHaveAttribute("aria-checked", "true");
  await page.goto("/#/track/01-led");
  await expect(devkitRadio(page)).toHaveAttribute("aria-checked", "true");

  // 단계 화면 윗줄의 작은 칸도 같은 값
  await page.goto("/#/track/10-auto-door/problem");
  await expect(page.getByTestId("board-select")).toHaveAttribute("data-board", "devkit");
  await expect(devkitRadio(page)).toHaveAttribute("aria-checked", "true");

  // 키보드: 고른 칸에 Tab 이 멈추고 방향키로 옮기면 바로 고른다
  await devkitRadio(page).focus();
  // (Radix 는 포커스를 다음 틱에 옮기고 그때 키가 눌려 있으면 고른다 — 사람처럼 잠깐 누른다)
  await page.keyboard.press("ArrowLeft", { delay: 80 });
  await expect(plusRadio(page)).toHaveAttribute("aria-checked", "true");
  await expect(plusRadio(page)).toBeFocused();
  expect(await page.evaluate((k) => localStorage.getItem(k), BOARD_KEY)).toBeNull();
});

test("배선이 없는 화면(실습실)에는 고르는 칸이 없다", async ({ page }) => {
  await page.goto("/#/lab");
  await expect(page.getByTestId("board-select")).toHaveCount(0);
});

test("기본 보드를 고르면 자동문 배선 그림이 기본 보드 그림으로 바뀐다", async ({ page }) => {
  test.skip(
    !existsSync(DOOR_DEVKIT_SVG),
    "content/chapters/10-auto-door/images/wiring-door.devkit.svg 가 아직 없음 (콘텐츠 작업에서 더한다)",
  );
  await page.goto("/#/track/10-auto-door");
  const wiring = page.getByTestId("chapter-wiring");
  await wiring.getByRole("button", { name: /배선 보기/ }).click();
  const title = () => wiring.getByTestId("illustration").locator("svg > title").first().textContent();
  expect((await title())?.trim().startsWith("기본 보드")).toBe(false);

  await devkitRadio(page).click();
  await expect(wiring.getByTestId("illustration")).toHaveAttribute("data-shown-image", "images/wiring-door.devkit.svg");
  expect((await title())?.trim().startsWith("기본 보드")).toBe(true);

  // 크게 보기 창도 같은 그림
  await wiring.getByTestId("illustration-zoom").click();
  const dialogTitle = await page.getByTestId("illustration-dialog").locator("svg > title").first().textContent();
  expect(dialogTitle?.trim().startsWith("기본 보드")).toBe(true);
});

test("폰 375px: 챕터·단계 화면에서 고르는 칸이 화면 안에 들어오고 가로 스크롤이 없다", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const url of ["/#/track/10-auto-door", "/#/track/10-auto-door/problem"]) {
    await page.goto(url);
    const select = page.getByTestId("board-select");
    await expect(select).toBeVisible();
    const box = await select.boundingBox();
    expect(box, url).not.toBeNull();
    expect(box!.x, url).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, url).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), url).toBe(true);
  }
  // 단계 화면 윗줄: 진행 위치 글도 잘리지 않는다
  const pos = await page.getByTestId("step-position").boundingBox();
  expect(pos!.x + pos!.width).toBeLessThanOrEqual(375);
  await devkitRadio(page).click();
  await expect(page.getByTestId("board-select")).toHaveAttribute("data-board", "devkit");
});
