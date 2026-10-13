import { expect, test, type Page } from "@playwright/test";

/** 작업판에 그 글자가 든 블록이 그려질 때까지 (코드 → 블록 변환이 끝났다는 신호) */
const blockWithText = (page: Page, text: string) =>
  page.getByTestId("blockly-host").locator(".blocklyBlockCanvas .blocklyText", { hasText: text });

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
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type('\nprint("hello")\n');
  // debounce 뒤 파싱이 끝나 작업판에 hello 블록이 생긴 다음에 오류 배지가 없는지 본다
  await expect(blockWithText(page, "hello")).toBeVisible();
  await expect(page.getByTestId("parse-error")).toHaveCount(0);

  await page.getByRole("tab", { name: "블록" }).click();
  await expect(page.getByText("블록을 놓으면 코드가 바로 바뀝니다")).toBeVisible();
  await expect(code).toContainText('print("hello")');
});

test("문법 오류는 배지로 알려 준다", async ({ page }) => {
  await page.goto("/#/lab");
  await page.getByRole("tab", { name: "코드" }).click();
  const editor = page.getByTestId("code-panel").locator(".cm-content");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\nif d < 15\n");
  await expect(page.getByTestId("parse-error")).toBeVisible();
});

test("코드를 치자마자 블록 탭으로 가도 마지막 입력이 남는다", async ({ page }) => {
  await page.goto("/#/lab");
  await page.getByRole("tab", { name: "코드" }).click();
  const code = page.getByTestId("code-panel");
  await code.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type('\nprint("fast")');
  // 기다리지 않고 바로 (debounce 300ms 안에) 블록 탭으로
  await page.getByRole("tab", { name: "블록" }).click();
  await expect(blockWithText(page, "fast")).toBeVisible();
  await expect(page.getByText("블록을 놓으면 코드가 바로 바뀝니다")).toBeVisible();
  await expect(code).toContainText('print("fast")');
});

test("문법 오류가 있으면 블록 탭으로 가지 않고 친 코드를 지킨다", async ({ page }) => {
  await page.goto("/#/lab");
  await page.getByRole("tab", { name: "코드" }).click();
  const code = page.getByTestId("code-panel");
  await code.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\nif d < 15");
  await expect(page.getByTestId("parse-error")).toBeVisible();

  await page.getByRole("tab", { name: "블록" }).click();
  await expect(page.getByText("문법 오류를 고친 뒤에 블록으로 돌아갈 수 있어요")).toBeVisible();
  await expect(page.getByRole("tab", { name: "코드" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("blocks-overlay")).toBeVisible();
  await expect(code).toContainText("if d < 15");
  await expect(page.getByTestId("parse-error")).toBeVisible();
});

test("작업판에서 블록을 끌어 놓으면 탭을 바꾸지 않아도 코드가 바뀐다", async ({ page }) => {
  await page.goto("/#/lab");
  const host = page.getByTestId("blockly-host");
  await expect(host.locator(".blocklyMainBackground")).toBeVisible();
  const code = page.getByTestId("code-panel");
  await expect(code).toContainText("while True:");
  await expect(code).not.toContainText("time.sleep_us(10)");

  // 꾸러미가 프로그램 위를 덮으므로 빈 바탕을 끌어 프로그램을 오른쪽으로 옮긴다
  const bg = (await host.boundingBox())!;
  await page.mouse.move(bg.x + bg.width - 80, bg.y + bg.height - 80);
  await page.mouse.down();
  await page.mouse.move(bg.x + bg.width - 80 + 320, bg.y + bg.height - 80, { steps: 10 });
  await page.mouse.up();

  await host.locator(".blocklyToolboxCategory", { hasText: "흐름" }).click();
  const source = host.locator("svg.blocklyFlyout .blocklyDraggable", { hasText: "10마이크로초 기다리기" }).first();
  const from = (await source.boundingBox())!;
  // 반복 안 마지막 블록(뒤에 이어진 블록이 없어 글자가 딱 "1초 기다리기")의 아래에 놓는다
  const last = host.locator("svg.blocklySvg > g.blocklyWorkspace > g.blocklyBlockCanvas .blocklyDraggable").filter({ hasText: /^1초\s기다리기$/ });
  const to = (await last.boundingBox())!;
  expect(to.x).toBeGreaterThan(from.x + from.width); // 꾸러미 밖에 놓는다

  await page.mouse.move(from.x + 10, from.y + 10);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 20, { steps: 5 });
  await page.mouse.move(to.x + 10, to.y + to.height + 10, { steps: 20 });
  await page.mouse.up();

  await expect(code).toContainText("time.sleep_us(10)");
  await expect(code).toContainText("import time");
  await expect(page.getByRole("tab", { name: "블록" })).toHaveAttribute("aria-selected", "true");
  // 반복 안(4칸 들여쓰기)에 들어갔다
  const text = await code.locator(".cm-content").innerText();
  expect(text).toMatch(/\n {4}time\.sleep_us\(10\)/);
});

test("팔레트를 닫으면 팔레트 스크롤바도 사라진다", async ({ page }) => {
  await page.goto("/#/lab");
  // 글자 span 은 포인터를 받지 않으므로 카테고리 줄(div)을 누른다
  const category = (name: string) => page.locator(".blocklyToolboxCategory").filter({ hasText: new RegExp(`^${name}$`) });
  const flyout = page.locator(".blocklyToolboxFlyout");
  const flyoutBar = page.locator(".blocklyFlyoutScrollbar").first();
  // ESP32 팔레트는 블록이 많아 스크롤바가 필요하다
  await category("ESP32").click();
  await expect(flyoutBar).toBeVisible();
  await page.locator(".blocklyMainBackground").click({ position: { x: 600, y: 500 } });
  await expect(flyout).toBeHidden();
  await expect(flyoutBar).toBeHidden();
  // 흐름 팔레트는 화면에 다 들어가므로 스크롤바를 그리지 않는다
  await category("흐름").click();
  await expect(flyout).toBeVisible();
  await expect(flyoutBar).toBeHidden();
});

test("코드 ↔ 블록 전환과 코드 고치기는 작업판의 보던 자리를 그대로 둔다", async ({ page }) => {
  await page.goto("/#/lab");
  const host = page.getByTestId("blockly-host");
  await expect(host.locator(".blocklyMainBackground")).toBeVisible();
  const program = host.locator("svg.blocklySvg > g.blocklyWorkspace > g.blocklyBlockCanvas > .blocklyDraggable").first();
  // 빈 바탕을 끌어 작업판을 옮긴다
  const bg = (await host.boundingBox())!;
  await page.mouse.move(bg.x + bg.width - 80, bg.y + bg.height - 80);
  await page.mouse.down();
  await page.mouse.move(bg.x + bg.width - 80 + 200, bg.y + bg.height - 80 + 60, { steps: 10 });
  await page.mouse.up();
  const before = (await program.boundingBox())!;

  await page.getByRole("tab", { name: "코드" }).click();
  await page.getByTestId("code-panel").locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type('\nprint("stay")\n');
  await expect(blockWithText(page, "stay")).toBeVisible();
  await page.getByRole("tab", { name: "블록" }).click();
  await expect(page.getByText("블록을 놓으면 코드가 바로 바뀝니다")).toBeVisible();

  const after = (await program.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
});
