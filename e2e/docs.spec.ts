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

test("?block= 으로 들어오면 그 카드로 스크롤한다", async ({ page }) => {
  await page.goto("/#/docs?block=flow_wait");
  const card = page.locator('[data-testid="block-doc-card"][data-type="flow_wait"]');
  await expect(card).toBeInViewport();
  await expect(card).toBeFocused();
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
