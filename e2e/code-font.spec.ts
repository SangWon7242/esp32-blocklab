import { expect, test, type Page } from "@playwright/test";
import { openSample } from "./sample";

/*
 * 코드 글꼴·글자 크기 (lib-v1.0.5): 코드 칸은 D2Coding(자체 포함 woff2, 200), 글자 크기 단추·설정 화면 조절이 CodeMirror 에 반영되고
 * localStorage(blocklab.codeFontSize)에 남는다. 최대 크기(30px)에서 폰 390px·데스크톱 1440px 페이지가 가로로 넘치지 않는다.
 */

const KEY = "blocklab.codeFontSize";
const PROGRESS_KEY = "esp32-blocklab:v1";
const MAX = 30;

const codeLine = (page: Page) => page.getByTestId("code-panel").locator(".cm-line").first();
const fontSizeOf = (page: Page) => codeLine(page).evaluate((el) => getComputedStyle(el).fontSize);

async function seedReadcheck(page: Page) {
  const records = Object.fromEntries(["problem", "analysis", "predict", "run"].map((id) => [id, { status: "done", input: {}, attempts: 0, updatedAt: "2026-10-14T00:00:00.000Z" }]));
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(key, value);
      sessionStorage.setItem("seeded", "1");
    }
  }, [PROGRESS_KEY, JSON.stringify({ version: 1, chapters: { "01-led": records } })] as const);
}

async function pageOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test("코드 칸 글꼴은 D2Coding 이고 글꼴 파일을 자기 주소에서 받는다", async ({ page }) => {
  const fontResponse = page.waitForResponse((r) => r.url().endsWith("/blocklab/fonts/D2Coding-Regular.woff2"));
  await openSample(page);
  const response = await fontResponse;
  expect(response.status()).toBe(200);
  const family = await page.getByTestId("code-panel").locator(".cm-scroller").evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toMatch(/^"?D2Coding"?,/);
  expect(await codeLine(page).evaluate((el) => getComputedStyle(el).fontVariantLigatures)).toBe("none");
  await expect.poll(() => page.evaluate(() => document.fonts.check('16px "D2Coding"', "while"))).toBe(true);
  expect(await fontSizeOf(page)).toBe("16px");
});

test("글자 크기 단추로 키우면 CodeMirror 에 반영되고 새로 고쳐도 남는다", async ({ page }) => {
  await openSample(page);
  await page.getByTestId("code-font-size-button").click();
  const popover = page.locator('[data-slot="popover-content"]');
  await expect(popover.getByTestId("code-font-size-value")).toHaveText("16px");
  await popover.getByRole("button", { name: "글자 키우기" }).click();
  await popover.getByRole("button", { name: "글자 키우기" }).click();
  await expect(popover.getByTestId("code-font-size-value")).toHaveText("18px");
  await page.screenshot({ path: "test-results/code-font/popover-1400.png" });
  await expect.poll(() => fontSizeOf(page)).toBe("18px");
  // 줄 번호 칸도 같은 크기, 줄 높이는 1.6 배
  const gutter = await page.getByTestId("code-panel").locator(".cm-gutters").evaluate((el) => getComputedStyle(el).fontSize);
  expect(gutter).toBe("18px");
  expect(await codeLine(page).evaluate((el) => getComputedStyle(el).lineHeight)).toBe("28.8px");
  // 줄 번호가 줄과 같은 높이에 선다 (편집기가 바뀐 줄 높이를 다시 잼)
  await expect.poll(() => page.getByTestId("code-panel").evaluate((p) => {
    const lines = [...p.querySelectorAll(".cm-line")].map((l) => Math.round(l.getBoundingClientRect().top));
    const nums = [...p.querySelectorAll(".cm-lineNumbers .cm-gutterElement")].filter((g) => g.textContent).map((g) => Math.round(g.getBoundingClientRect().top));
    return nums.slice(-lines.length).every((t, i) => Math.abs(t - lines[i]) <= 1) && nums.length >= lines.length;
  })).toBe(true);
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe("18");

  // 슬라이더는 키보드로도 (End = 최대)
  await popover.getByRole("slider").focus();
  await page.keyboard.press("End");
  await expect(popover.getByTestId("code-font-size-value")).toHaveText(`${MAX}px`);
  await expect(popover.getByRole("button", { name: "글자 키우기" })).toBeDisabled();
  await expect.poll(() => fontSizeOf(page)).toBe(`${MAX}px`);

  await page.reload();
  await expect.poll(() => fontSizeOf(page)).toBe(`${MAX}px`);
  await page.getByTestId("code-font-size-button").click();
  await page.locator('[data-slot="popover-content"]').getByRole("button", { name: /기본값/ }).click();
  await expect.poll(() => fontSizeOf(page)).toBe("16px");
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
});

test("설정 화면에서 바꾼 크기를 단계 안 읽기 전용 코드도 따른다", async ({ page }) => {
  await seedReadcheck(page);
  await page.goto("/#/settings");
  const field = page.getByTestId("code-font-size");
  await expect(field).toBeVisible();
  await field.getByRole("button", { name: "글자 키우기" }).click();
  await expect(field.getByTestId("code-font-size-value")).toHaveText("17px");
  await field.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/code-font/settings-1400.png" });
  await page.goto("/#/track/01-led/readcheck");
  await expect.poll(() => fontSizeOf(page)).toBe("17px");
  await expect(page.locator("figure").getByTestId("code-font-size-button")).toBeVisible();
});

test("저장된 값이 범위 밖이면 고정, 이상하면 기본값", async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, "99"), KEY);
  await openSample(page);
  await expect.poll(() => fontSizeOf(page)).toBe(`${MAX}px`);
  await page.addInitScript((k) => localStorage.setItem(k, "크게"), KEY);
  await page.reload();
  await expect.poll(() => fontSizeOf(page)).toBe("16px");
});

for (const width of [390, 1440]) {
  test(`최대 크기(${MAX}px)에서 ${width}px 화면이 가로로 넘치지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, String(MAX)] as const);
    await seedReadcheck(page);

    // 자유 코딩 코드 칸 (폰은 「코드」 탭)
    await page.goto("/#/lab");
    await page.getByRole("tab", { name: "코드" }).click();
    const content = page.getByTestId("code-panel").locator(".cm-content");
    await content.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText("from machine import Pin\nimport time\n\nled = Pin(26, Pin.OUT)  # 26번 핀에 LED 를 연결\nwhile True:\n    led.value(1)\n    time.sleep(0.5)\n    led.value(0)\n    time.sleep(0.5)\n");
    await expect.poll(() => fontSizeOf(page)).toBe(`${MAX}px`);
    await expect(page.getByTestId("code-font-size-button")).toBeInViewport();
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    // 긴 줄은 줄바꿈 대신 코드 칸 안 가로 스크롤
    const scroller = page.getByTestId("code-panel").locator(".cm-scroller");
    if (width < 768) expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    const lineHeights = await page.getByTestId("code-panel").locator(".cm-line").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    expect(new Set(lineHeights).size).toBe(1); // 한 줄이 두 줄로 접히지 않는다
    await page.screenshot({ path: `test-results/code-font/lab-${width}-max.png` });

    // 단계 안 읽기 전용 코드 (가장 좁은 코드 칸)
    await page.goto("/#/track/01-led/readcheck");
    await expect.poll(() => fontSizeOf(page)).toBe(`${MAX}px`);
    const cols = await page.getByTestId("code-panel").evaluate((panel) => {
      const scroller = panel.querySelector(".cm-scroller") as HTMLElement;
      const gutters = panel.querySelector(".cm-gutters") as HTMLElement;
      const charW = parseFloat(getComputedStyle(panel.querySelector(".cm-line")!).fontSize) / 2; // D2Coding 반각 = 0.5em
      return Math.floor((scroller.clientWidth - gutters.offsetWidth) / charW);
    });
    expect(cols).toBeGreaterThanOrEqual(20);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    const figure = page.locator("figure", { has: page.getByTestId("code-panel") });
    await figure.scrollIntoViewIfNeeded();
    await expect(figure.getByTestId("code-font-size-button")).toBeInViewport();
    await page.screenshot({ path: `test-results/code-font/readcheck-${width}-max.png` });
  });
}
