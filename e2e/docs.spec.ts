import { expect, test, type Page } from "@playwright/test";
import { openSample } from "./sample";

/** 작업판(팔레트 말고)에 그려진, 그 글자가 든 블록 글자 */
const workspaceText = (page: Page, text: string) =>
  page.getByTestId("blockly-host").locator(".blocklyBlockCanvas .blocklyText", { hasText: text });

const docMenuItem = (page: Page) =>
  page.locator(".blocklyContextMenu [role=menuitem]", { hasText: "이 블록 설명 보기" });

test("블록을 우클릭해 이 블록 설명 보기를 연다", async ({ page }) => {
  await openSample(page, "/#/lab?device=fake");
  const wait = workspaceText(page, "초 기다리기").first();
  await expect(wait).toBeVisible();
  await wait.click({ button: "right" });
  await docMenuItem(page).click();

  const dialog = page.getByTestId("block-doc-dialog");
  await expect(dialog).toBeVisible();
  // 제목은 우클릭한 블록을 지금 값 그대로 그린 그림 (편집기와 같은 렌더러)
  const picture = dialog.locator("svg.blocklySvg");
  await expect(picture).toHaveCount(1);
  await expect(picture.locator(".blocklyText", { hasText: "초 기다리기" })).toBeVisible();
  await expect(picture.locator(".blocklyText", { hasText: /^1$/ })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "1 초 기다리기" })).toBeAttached();
  await expect(dialog).toContainText("time.sleep(1)");
  await expect(dialog).toContainText("내 블록이 만드는 코드");
  await expect(dialog).toContainText("무슨 뜻인가요");
  await expect(dialog).toContainText("예시 프로그램");
  // 작업판을 잃지 않게 블록 사전은 새 탭으로 연다
  const docsLink = dialog.getByRole("link", { name: "블록 사전에서 보기" });
  await expect(docsLink).toBeVisible();
  await expect(docsLink).toHaveAttribute("href", "#/docs?block=flow_wait");
  await expect(docsLink).toHaveAttribute("target", "_blank");

  await dialog.getByRole("button", { name: "닫기" }).click();
  await expect(dialog).toHaveCount(0);
});

test("팔레트 블록도 설명을 볼 수 있다", async ({ page }) => {
  await openSample(page, "/#/lab?device=fake");
  await expect(workspaceText(page, "초 기다리기").first()).toBeVisible();
  await page.getByRole("treeitem", { name: "흐름" }).click();
  const flyoutBlock = page.locator(".blocklyFlyout .blocklyText", { hasText: "밀리초 기다리기" }).first();
  await expect(flyoutBlock).toBeVisible();
  await flyoutBlock.click({ button: "right" });
  await docMenuItem(page).click();
  const dialog = page.getByTestId("block-doc-dialog");
  await expect(dialog).toContainText("time.sleep_ms(500)");
  await expect(dialog.locator("svg.blocklySvg .blocklyText", { hasText: "밀리초 기다리기" })).toBeVisible();
  // 팔레트 블록은 학생이 놓은 블록이 아니다
  await expect(dialog).toContainText("이 블록이 만드는 코드");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("자유 코딩에서는 예시를 편집기에 열 수 있다", async ({ page }) => {
  await openSample(page, "/#/lab?device=fake");
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

test("블록 사전에서 찾아 예시를 편집기에서 연다", async ({ page }) => {
  await page.goto("/#/docs");
  const cards = page.getByTestId("block-doc-card");
  await expect(cards.first()).toBeVisible();
  await page.getByPlaceholder("블록 이름·코드·설명 검색").fill("깜빡");
  expect(await cards.count()).toBeGreaterThanOrEqual(1);
  const blink = page.locator('[data-testid="block-doc-card"][data-type="dev_led_blink"]');
  await expect(blink).toBeVisible();

  await blink.getByRole("button", { name: "예시 프로그램" }).click();
  await blink.getByRole("link", { name: "편집기에서 열어 보기" }).click();
  await expect(page).toHaveURL(/#\/lab/);
  // 실은 뒤에는 주소에서 ?example= 을 뺀다 (다시 읽어도 예시가 또 실리지 않게)
  await expect(page).not.toHaveURL(/example=/);

  await page.getByRole("tab", { name: "코드" }).click();
  const code = page.getByTestId("code-panel");
  await expect(code).toContainText("range(");
  await expect(code).toContainText("import time");
});

/** 넓은 화면 왼쪽 카테고리 목록의 버튼 */
const categoryButton = (page: Page, name: string) =>
  page.locator("aside").getByRole("navigation", { name: "블록 카테고리" }).getByRole("button", { name: new RegExp(`^${name}`) });

test("?block= 으로 들어오면 그 블록의 카테고리를 열고 카드로 스크롤한다", async ({ page }) => {
  await page.goto("/#/docs?block=flow_wait");
  const card = page.locator('[data-testid="block-doc-card"][data-type="flow_wait"]');
  await expect(card).toBeInViewport();
  await expect(card).toBeFocused();
  // 흐름 카테고리 한 페이지만 (다른 카테고리 카드는 없다)
  const sections = page.getByTestId("doc-category");
  await expect(sections).toHaveCount(1);
  await expect(sections).toHaveAttribute("data-category", "flow");
  await expect(sections.getByRole("heading", { level: 2, name: "흐름" })).toBeVisible();
  await expect(categoryButton(page, "흐름")).toHaveAttribute("aria-current", "page");
  // ?block 이 ?cat 보다 먼저
  await page.goto("/#/docs?cat=sensor&block=flow_wait");
  await expect(sections).toHaveAttribute("data-category", "flow");
  await expect(card).toBeInViewport();
});

test("블록 사전은 카테고리마다 한 페이지이고 뒤로 가기로 앞 카테고리로 돌아간다", async ({ page }) => {
  await page.goto("/#/docs");
  const sections = page.getByTestId("doc-category");
  // 주소에 카테고리가 없으면 첫 카테고리(시작)
  await expect(sections).toHaveCount(1);
  await expect(sections).toHaveAttribute("data-category", "start");
  await expect(categoryButton(page, "시작")).toHaveAttribute("aria-current", "page");

  await categoryButton(page, "흐름").click();
  await expect(page).toHaveURL(/cat=flow/);
  await expect(sections).toHaveAttribute("data-category", "flow");

  const sensor = categoryButton(page, "센서");
  await sensor.click();
  await expect(page).toHaveURL(/cat=sensor/);
  await expect(sections).toHaveCount(1);
  await expect(sections).toHaveAttribute("data-category", "sensor");
  await expect(sections.getByRole("heading", { level: 2, name: "센서" })).toBeVisible();
  // 센서 카드만: 모든 카드가 센서 칸 안에 있고, 흐름 카드는 없다
  const cards = page.getByTestId("block-doc-card");
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  await expect(sections.getByTestId("block-doc-card")).toHaveCount(n);
  await expect(page.locator('[data-testid="block-doc-card"][data-type="flow_wait"]')).toHaveCount(0);
  // 고른 버튼은 카테고리 색으로 채운다 (버튼 개수 표시는 그대로)
  await expect(sensor).toHaveAttribute("aria-current", "page");
  expect(await sensor.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  await expect(sensor).toContainText(String(n));

  await page.goBack();
  await expect(page).toHaveURL(/cat=flow/);
  await expect(sections).toHaveAttribute("data-category", "flow");
  await expect(categoryButton(page, "흐름")).toHaveAttribute("aria-current", "page");
});

test("검색 중에는 모든 카테고리에서 찾고, 지우면 그 카테고리로 돌아간다", async ({ page }) => {
  await page.goto("/#/docs?cat=flow");
  const sections = page.getByTestId("doc-category");
  await expect(sections).toHaveAttribute("data-category", "flow");
  const search = page.getByPlaceholder("블록 이름·코드·설명 검색");
  await search.fill("깜빡");
  // ?cat 을 무시하고 흐름 밖(LED)의 결과도 카테고리별 묶음으로
  await expect(page.locator('[data-testid="block-doc-card"][data-type="dev_led_blink"]')).toBeVisible();
  await expect(sections.filter({ has: page.locator('[data-type="dev_led_blink"]') })).toHaveAttribute("data-category", "led");
  // 검색 중에는 고른 카테고리 표시가 없다
  await expect(categoryButton(page, "흐름")).not.toHaveAttribute("aria-current", "page");
  const count = await page.getByTestId("block-doc-card").count();
  await expect(page.getByTestId("doc-count")).toHaveText(`${count}개`);
  await search.fill("");
  await expect(sections).toHaveCount(1);
  await expect(sections).toHaveAttribute("data-category", "flow");
});

test("좁은 화면: 카테고리 칩 줄만 가로로 넘기고 페이지는 가로로 넘치지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/#/docs?cat=sensor");
  // 넓은 화면의 왼쪽 목록은 숨겨져 있어 보이는 카테고리 목록은 칩 줄 하나
  const chips = page.getByRole("navigation", { name: "블록 카테고리" });
  await expect(chips).toBeVisible();
  const chip = chips.locator('[data-category="sensor"]');
  await expect(chip).toHaveAttribute("aria-current", "page");
  await expect(chip).toBeInViewport();
  expect(await chips.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await chips.locator('[data-category="flow"]').click();
  await expect(page).toHaveURL(/cat=flow/);
  await expect(page.getByTestId("doc-category")).toHaveAttribute("data-category", "flow");
});

test("블록 사전 카드의 제목은 팔레트와 같은 블록 그림이다", async ({ page }) => {
  await page.goto("/#/docs?block=flow_wait");
  const card = page.locator('[data-testid="block-doc-card"][data-type="flow_wait"]');
  // 편집기와 같은 렌더러·테마로 그린 SVG: 블록 글자와 그림자 값이 Blockly 글자(.blocklyText)로 들어 있다
  const picture = card.locator("svg.blocklySvg");
  await expect(picture).toHaveCount(1);
  await expect(picture.locator(".blocklyText", { hasText: "초 기다리기" })).toBeVisible();
  await expect(picture.locator(".blocklyText", { hasText: /^1$/ })).toBeVisible();
  // 블록 색과 흰 글자 (Blockly CSS 가 복제한 그림에도 먹는다)
  await expect(picture.locator("path.blocklyPath").first()).toHaveAttribute("fill", "#19baea");
  await expect(picture.locator(".blocklyText", { hasText: "초 기다리기" })).toHaveCSS("fill", "rgb(255, 255, 255)");
  // 화면 읽기용 제목 글
  await expect(card.getByRole("heading", { name: "1 초 기다리기" })).toBeAttached();
  // 다른 모양으로도 나오는 블록은 그 모양도 그림으로
  const ifCard = page.locator('[data-testid="block-doc-card"][data-type="controls_if"]');
  await ifCard.scrollIntoViewIfNeeded();
  await expect(ifCard.getByText("이런 이름으로도 나와요:")).toBeVisible();
  await expect(ifCard.locator("svg.blocklySvg")).toHaveCount(2);
  await expect(ifCard.locator("svg.blocklySvg").nth(1).locator(".blocklyText", { hasText: "아니면" })).toBeVisible();
});

test("이미 자유 코딩에 있을 때 주소만 ?example= 으로 바뀌어도 예시가 실린다", async ({ page }) => {
  await openSample(page);
  await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
  await page.getByRole("tab", { name: "코드" }).click();
  const code = page.getByTestId("code-panel");
  await expect(code).toContainText("led = Pin(26");
  // 화면을 다시 읽지 않고 해시만 바꾼다 (블록 사전 탭에서 링크를 누른 것과 같은 꼴)
  await page.evaluate(() => { location.hash = "#/lab?example=flow_wait_ms"; });
  await expect(code).toContainText("time.sleep_ms(");
  // 샘플(1초 깜빡이기)은 사라지고 예시(sleep_ms)가 실렸다
  await expect(code).not.toContainText("time.sleep(1)");
  await expect(page).not.toHaveURL(/example=/);
});
