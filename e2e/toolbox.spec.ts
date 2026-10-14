import { expect, test } from "@playwright/test";

const CATEGORIES = ["시작", "흐름", "판단", "계산", "변수", "함수", "핀", "LED", "버튼·스위치", "센서", "소리", "모터", "화면", "입력장치", "코드"];
/** src/blocks/colors.ts 의 CATEGORY_COLORS.led·flow */
const LED_COLOUR = "rgb(255, 213, 0)";
const FLOW_COLOUR = "rgb(25, 186, 234)";
const WHITE = "rgb(255, 255, 255)";
/** src/lib/contrast.ts 의 DARK_TEXT (#171717): 밝은 카테고리 색 위 글자 */
const DARK = "rgb(23, 23, 23)";

test("처음 열면 작업판에는 시작 블록만 있고 코드는 비어 있다", async ({ page }) => {
  await page.goto("/#/lab");
  const host = page.getByTestId("blockly-host");
  await expect(host.locator(".blocklyMainBackground")).toBeVisible();
  const blocks = host.locator("svg.blocklySvg > g.blocklyWorkspace > g.blocklyBlockCanvas > .blocklyDraggable");
  await expect(blocks).toHaveCount(1);
  await expect(blocks.first()).toContainText("프로그램이 시작되면");
  const code = page.getByTestId("code-panel");
  await expect(code).toBeVisible();
  await expect(code.locator(".cm-content")).not.toContainText("import");
  await expect(code.locator(".cm-content")).not.toContainText("Pin(");
});

test("카테고리 열: 15개 타일에 아이콘, 고른 타일은 카테고리 색으로 채우고 글자는 대비가 큰 색", async ({ page }) => {
  await page.goto("/#/lab");
  const toolbox = page.locator(".blocklyToolbox");
  await expect(toolbox).toBeVisible();
  const rows = toolbox.locator(".blocklyToolboxCategory");
  await expect(rows).toHaveCount(15);
  await expect(rows).toHaveText(CATEGORIES);
  for (let i = 0; i < 15; i++) await expect(rows.nth(i).locator(".entryCategoryIcon svg")).toHaveCount(1);
  expect(Math.round((await toolbox.boundingBox())!.width)).toBe(84);

  const row = (name: string) => rows.filter({ hasText: new RegExp(`^${name}$`) });
  const bg = (name: string) => row(name).evaluate((el) => getComputedStyle(el).backgroundColor);
  const fg = (name: string) => row(name).evaluate((el) => getComputedStyle(el).color);

  // 고르기 전: 흰 열 위의 진회색 글자, 아이콘은 카테고리 색
  expect(await bg("LED")).not.toBe(LED_COLOUR);
  await expect(row("LED").locator(".entryCategoryIcon")).toHaveCSS("color", LED_COLOUR);

  await row("LED").click();
  await expect(page.locator(".blocklyToolboxFlyout")).toBeVisible();
  await expect(row("LED")).toHaveCSS("background-color", LED_COLOUR);
  // LED 노랑 위에는 흰 글자가 읽히지 않으므로 진한 글자·아이콘
  expect(await fg("LED")).toBe(DARK);
  await expect(row("LED").locator(".entryCategoryIcon")).toHaveCSS("color", DARK);

  await row("흐름").click();
  await expect(row("흐름")).toHaveCSS("background-color", FLOW_COLOUR);
  expect(await fg("흐름")).toBe(DARK);
  // 앞서 고른 LED 타일은 흰 바탕으로 돌아온다 (배경을 칠하지 않아 열의 흰색이 보인다)
  await expect(row("LED")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expect(await fg("LED")).not.toBe(WHITE);
  await expect(row("LED").locator(".entryCategoryIcon")).toHaveCSS("color", LED_COLOUR);
  await expect(toolbox).toHaveCSS("background-color", WHITE);

  // 어두운 카테고리 색(판단 #4562f5) 위에는 흰 글자·아이콘
  await row("판단").click();
  expect(await fg("판단")).toBe(WHITE);
  await expect(row("판단").locator(".entryCategoryIcon")).toHaveCSS("color", WHITE);

  // 열이 화면보다 길면 열 안에서 스크롤해 마지막 타일(코드)까지 닿는다
  expect(await toolbox.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await row("코드").click();
  await expect(row("코드")).toBeInViewport();
  await expect(row("코드")).toHaveCSS("background-color", "rgb(138, 163, 178)");
  expect(await toolbox.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

test("센서 카테고리의 장치 블록은 장치마다 색이 다르다", async ({ page }) => {
  await page.goto("/#/lab");
  await page.locator(".blocklyToolbox .blocklyToolboxCategory").filter({ hasText: /^센서$/ }).click();
  const flyout = page.locator(".blocklyToolboxFlyout");
  await expect(flyout).toBeVisible();
  // 준비 블록(최상위 블록의 바깥 path)의 채움색. 조도·가변저항·소리·불꽃·서미스터·LM35·초음파·DHT11 = 8가지
  const setupFills = await flyout.locator("g.blocklyBlockCanvas > g.blocklyDraggable > path.blocklyPath").evaluateAll((paths) =>
    paths.map((p) => p.getAttribute("fill") ?? ""),
  );
  expect(new Set(setupFills).size).toBeGreaterThanOrEqual(8);
});
