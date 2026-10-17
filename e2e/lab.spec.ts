import { expect, test, type Page } from "@playwright/test";
import { openSample } from "./sample";

/** 작업판에 그 글자가 든 블록이 그려질 때까지 (코드 → 블록 변환이 끝났다는 신호) */
const blockWithText = (page: Page, text: string) =>
  page.getByTestId("blockly-host").locator(".blocklyBlockCanvas .blocklyText", { hasText: text });

test("블록이 코드로, 코드가 블록으로 바뀐다", async ({ page }) => {
  await openSample(page);
  await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
  const code = page.getByTestId("code-panel");
  await expect(code).toContainText("led = Pin(26, Pin.OUT)");
  await expect(code).toContainText("while True:");
  // 체험판에는 호스트 onSaveProject 가 없어 「작품으로 저장」이 없다 (lib-v1.0.3)
  await expect(page.getByTestId("save-project-button")).toHaveCount(0);

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
  await openSample(page);
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
  // 낮은 창에서는 핀 팔레트가 넘쳐 스크롤바가 필요하다 (넓이는 넓은 화면 배치 그대로)
  await page.setViewportSize({ width: 1400, height: 520 });
  await page.goto("/#/lab");
  // 글자 span 은 포인터를 받지 않으므로 카테고리 줄(div)을 누른다
  const category = (name: string) => page.locator(".blocklyToolboxCategory").filter({ hasText: new RegExp(`^${name}$`) });
  const flyout = page.locator(".blocklyToolboxFlyout");
  const flyoutBar = page.locator(".blocklyFlyoutScrollbar").first();
  await category("핀").click();
  await expect(flyoutBar).toBeVisible();
  await page.locator(".blocklyMainBackground").click({ position: { x: 700, y: 150 } });
  await expect(flyout).toBeHidden();
  await expect(flyoutBar).toBeHidden();
  await page.setViewportSize({ width: 1400, height: 900 });
  // 판단 팔레트는 화면에 다 들어가므로 스크롤바를 그리지 않는다 (흐름은 계획 6 에서 반복 블록이 늘어 넘친다)
  await category("판단").click();
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

test("좁은 화면에서는 블록과 코드가 탭으로 바뀐다", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto("/#/lab");
  const host = page.getByTestId("blockly-host");
  await expect(host.locator(".blocklyMainBackground")).toBeVisible();
  await expect(page.getByTestId("code-panel")).toBeHidden();
  // 처음 열 때부터(탭을 바꾸지 않아도) 작업판이 폭을 다 쓴다 (숨긴 코드 패널 자리가 빈 칸으로 남지 않는다)
  await expect.poll(async () => (await host.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(780);
  // 빈 바탕을 끌어 작업판을 옮겨 둔다 (숨겼다 보여도 이 자리가 남아야 한다)
  const program = host.locator("svg.blocklySvg > g.blocklyWorkspace > g.blocklyBlockCanvas > .blocklyDraggable").first();
  const bg = (await host.boundingBox())!;
  await page.mouse.move(bg.x + bg.width - 60, bg.y + bg.height - 60);
  await page.mouse.down();
  await page.mouse.move(bg.x + bg.width - 60 + 150, bg.y + bg.height - 60 + 40, { steps: 10 });
  await page.mouse.up();
  const before = (await program.boundingBox())!;

  await page.getByRole("tab", { name: "코드" }).click();
  await expect(page.getByTestId("code-panel")).toBeVisible();
  await expect(host).toBeHidden();
  // 헤더가 가로 스크롤을 만들지 않는다
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);

  // 다시 블록으로 오면 작업판이 (숨겨졌던 동안 언마운트되지 않고) 화면 크기에 맞게 다시 그려진다
  await page.getByRole("tab", { name: "블록" }).click();
  await expect(host).toBeVisible();
  await expect(page.getByTestId("code-panel")).toBeHidden();
  const hostBox = (await host.boundingBox())!;
  await expect.poll(async () => (await host.locator("svg.blocklySvg").boundingBox())?.width).toBeCloseTo(hostBox.width, 0);
  const after = (await program.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
});

test("코드 패널을 접었다 펼 수 있다", async ({ page }) => {
  await page.goto("/#/lab");
  await page.getByRole("button", { name: "코드 패널 접기" }).click();
  await expect(page.getByTestId("code-panel")).toBeHidden();
  await page.getByRole("button", { name: "코드 패널 펼치기" }).click();
  await expect(page.getByTestId("code-panel")).toBeVisible();

  // 블록 패널도 접으면 코드 패널이 화면을 다 쓴다
  await page.getByRole("button", { name: "블록 패널 접기" }).click();
  await expect(page.getByTestId("blockly-host")).toBeHidden();
  await page.getByRole("button", { name: "블록 패널 펼치기" }).click();
  await expect(page.getByTestId("blockly-host")).toBeVisible();

  // 하단 패널은 처음엔 접혀 있고 펼치면 안내가 보인다 (예시 프로그램에는 문제가 없다)
  await expect(page.getByText("문제가 없어요")).toBeHidden();
  await page.getByRole("button", { name: "하단 패널 펼치기" }).click();
  await expect(page.getByText("문제가 없어요")).toBeVisible();
  await page.getByRole("button", { name: "하단 패널 접기" }).click();
  await expect(page.getByText("문제가 없어요")).toBeHidden();
});

/** 코드 모드에서 코드를 통째로 바꾼다 */
async function replaceCode(page: Page, text: string) {
  await page.getByRole("tab", { name: "코드" }).click();
  await page.getByTestId("code-panel").locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text);
}

/** led 를 준비했다가 블록 모드에서 준비 블록을 지워, 준비 없이 led 켜기만 남긴다 */
async function writeWithoutSetup(page: Page) {
  await page.goto("/#/lab");
  const host = page.getByTestId("blockly-host");
  await expect(host.locator(".blocklyMainBackground")).toBeVisible();
  await replaceCode(page, "led = Pin(26, Pin.OUT)\nled.value(1)\n");
  await expect(host.locator("g.esp_pin_setup")).toHaveCount(1);
  await expect(host.locator("g.esp_pin_write")).toHaveCount(1);
  await page.getByRole("tab", { name: "블록" }).click();
  await expect(page.getByText("블록을 놓으면 코드가 바로 바뀝니다")).toBeVisible();
  // 준비 블록의 "핀" 글자를 눌러 고른 뒤 지운다 (아래 블록은 위로 붙는다)
  await host.locator("g.esp_pin_setup .blocklyText", { hasText: /^핀$/ }).click();
  await page.keyboard.press("Delete");
  await expect(host.locator("g.esp_pin_setup")).toHaveCount(0);
}

test("준비 없이 led 를 켜면 블록에 경고가 뜨고 문제 패널에 한글로 나온다", async ({ page }) => {
  await writeWithoutSetup(page);
  const host = page.getByTestId("blockly-host");
  const write = host.locator("g.esp_pin_write");
  await expect(write).toHaveClass(/\blint-error\b/);
  await expect(write.locator(".blocklyIconGroup")).toHaveCount(1);
  // 오류가 처음 생기면 하단 패널이 저절로 펼쳐진다
  await expect(page.getByRole("tab", { name: "문제 1" })).toBeVisible();
  const item = page.getByTestId("problem-item");
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("led 를 먼저 준비해 주세요");
  await expect(item).toContainText("1줄");
  // 콘솔은 영어
  await page.getByRole("tab", { name: /콘솔/ }).click();
  await expect(page.getByTestId("console-entry").first()).toContainText("NameError: name 'led' is not defined");
});

test("문제 항목을 누르면 코드 줄이 강조된다", async ({ page }) => {
  await writeWithoutSetup(page);
  await page.getByTestId("problem-item").first().click();
  const focus = page.getByTestId("code-panel").locator(".cm-lint-focus");
  await expect(focus).toHaveCount(1);
  await expect(focus).toHaveText("led.value(1)");
  await expect(page.getByTestId("blockly-host").locator("g.esp_pin_write")).toHaveClass(/\bblocklySelected\b/);
});

test("블록을 선택하면 그 코드 줄이 강조된다", async ({ page }) => {
  await openSample(page);
  const host = page.getByTestId("blockly-host");
  await expect(host.locator(".blocklyMainBackground")).toBeVisible();
  // 첫 "켜기" 블록의 왼쪽 가장자리(입력 칸이 아닌 곳)를 누른다
  const on = host.locator("g.esp_pin_write").first();
  const shape = (await on.locator(":scope > path.blocklyPath").boundingBox())!;
  await page.mouse.click(shape.x + 4, shape.y + 10);
  await expect(on).toHaveClass(/\bblocklySelected\b/);
  const code = page.getByTestId("code-panel");
  const focus = code.locator(".cm-lint-focus");
  await expect(focus).toHaveCount(1);
  await expect(focus).toHaveText("    led.value(1)");
  // 7번째 줄
  await expect(code.locator(".cm-line").nth(6)).toHaveClass(/\bcm-lint-focus\b/);
  // 빈 바탕을 누르면 강조가 사라진다
  const bg = (await host.boundingBox())!;
  await page.mouse.click(bg.x + bg.width - 120, bg.y + 40);
  await expect(focus).toHaveCount(0);
});

test("코드 모드의 콘솔은 영어로 문법 오류를 보여 준다", async ({ page }) => {
  await openSample(page);
  await page.getByRole("tab", { name: "코드" }).click();
  await page.getByTestId("code-panel").locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("if x\n");
  await expect(page.getByTestId("parse-error")).toBeVisible();
  await page.getByRole("tab", { name: /콘솔/ }).click();
  const entry = page.getByTestId("console-entry").first();
  await expect(entry).toContainText("SyntaxError: invalid syntax");
  await expect(entry).toContainText('File "main.py", line 11');
  await entry.click();
  const focus = page.getByTestId("code-panel").locator(".cm-lint-focus");
  await expect(focus).toHaveCount(1);
  await expect(focus).toHaveText("if x");
});

test("코드 모드에서 줄 번호를 눌러도 다음 글자는 코드 편집기로 간다", async ({ page }) => {
  await openSample(page);
  const host = page.getByTestId("blockly-host");
  await expect(host.locator(".blocklyMainBackground")).toBeVisible();
  const blocksBefore = await host.locator(".blocklyBlockCanvas .blocklyDraggable").count();
  await page.getByRole("tab", { name: "코드" }).click();
  const code = page.getByTestId("code-panel");
  await code.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  // 7번째 줄(led.value(1)) 번호를 누르면 그 줄이 강조된다
  await code.locator(".cm-lineNumbers .cm-gutterElement", { hasText: /^7$/ }).click();
  await expect(code.locator(".cm-lint-focus")).toHaveText("    led.value(1)");
  // 이어서 친 글자와 Backspace 는 코드 편집기로 간다 (숨은 작업판의 블록을 지우지 않는다)
  await page.keyboard.type("#");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("# 끝");
  await expect(code.locator(".cm-content")).toContainText("# 끝");
  await expect(page.getByTestId("blocks-overlay")).toBeVisible();
  await page.waitForTimeout(500); // 코드 debounce 뒤 작업판이 다시 올라온 다음에 센다
  const blocks = host.locator(".blocklyBlockCanvas .blocklyDraggable");
  expect(await blocks.count()).toBe(blocksBefore);

  // 문제 항목(바꾸지 못한 줄 = 코드 블록)을 눌러도 숨은 블록에 키보드 포커스가 가지 않는다 (Backspace·Delete 가 블록을 지우지 않는다)
  await page.keyboard.type("\np = Pin(40, Pin.OUT)\n");
  await page.getByRole("button", { name: "하단 패널 펼치기" }).click();
  const item = page.getByTestId("problem-item").filter({ hasText: "블록으로 바꾸지 못했어요" });
  await expect(item).toHaveCount(1);
  const count = await blocks.count();
  await item.click();
  await expect(code.locator(".cm-lint-focus")).toHaveText("p = Pin(40, Pin.OUT)");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  await page.waitForTimeout(300);
  expect(await blocks.count()).toBe(count);
});

test("블록 모드에서 줄 번호를 누르면 그 블록이 파란 표시로 보이고 선택된다", async ({ page }) => {
  await openSample(page);
  const host = page.getByTestId("blockly-host");
  await expect(host.locator(".blocklyMainBackground")).toBeVisible();
  const code = page.getByTestId("code-panel");
  await page.waitForTimeout(300); // 첫 검사(100ms 뒤)가 끝나 줄 ↔ 블록 지도가 생긴 다음에 누른다
  await code.locator(".cm-lineNumbers .cm-gutterElement", { hasText: /^7$/ }).click();
  await expect(code.locator(".cm-line").nth(6)).toHaveClass(/\bcm-lint-focus\b/);
  const on = host.locator("g.esp_pin_write").first();
  await expect(on).toHaveClass(/\blint-focus\b/);
  // 블록 모드에서는 줄 번호를 눌러도 편집기가 포커스를 가져가지 않아 블록 선택이 남는다
  await expect(on).toHaveClass(/\bblocklySelected\b/);
  await expect(host.locator(".lint-focus")).toHaveCount(1);
  // 선택된 블록이어도 파란 표시가 이긴다: 블록 테두리는 흰 선 + 바깥 파란 띠(filter), zelos 선택 빛(blocklyPathSelected)은 숨김
  const marks = await on.locator(":scope > path.blocklyPath").evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return { selected: el.classList.contains("blocklyPathSelected"), stroke: s.stroke, filter: s.filter, display: s.display };
    }),
  );
  const main = marks.find((m) => !m.selected)!;
  expect(main.stroke).toBe("rgb(255, 255, 255)");
  expect(main.filter).toContain("rgb(37, 99, 235)");
  expect(marks.filter((m) => m.selected).map((m) => m.display)).toEqual(["none"]);
  // 키보드로 블록을 옮겨 다니는 중(Blockly 가 blocklyKeyboardNavigation 을 달고 활성 블록 테두리를 칠한다)에도 같은 표시
  const keyboardMark = await on.locator(":scope > path.blocklyPath:not(.blocklyPathSelected)").evaluate((el) => {
    const nav = el.closest(".injectionDiv")!.parentElement!;
    nav.classList.add("blocklyKeyboardNavigation");
    const s = getComputedStyle(el);
    const mark = [s.stroke, s.filter];
    nav.classList.remove("blocklyKeyboardNavigation");
    return mark;
  });
  expect(keyboardMark[0]).toBe("rgb(255, 255, 255)");
  expect(keyboardMark[1]).toContain("rgb(37, 99, 235)");
  // 빈 바탕을 누르면 표시도 사라진다
  const bg = (await host.boundingBox())!;
  await page.mouse.click(bg.x + bg.width - 120, bg.y + 40);
  await expect(host.locator(".lint-focus")).toHaveCount(0);
});

test("코드 모드에서 문제 항목을 누르면 숨은 블록에 표시만 하고 포커스는 작업판 밖에 둔다", async ({ page }) => {
  await page.goto("/#/lab");
  const host = page.getByTestId("blockly-host");
  await expect(host.locator(".blocklyMainBackground")).toBeVisible();
  await replaceCode(page, "led = Pin(34, Pin.OUT)\nled.value(1)\n");
  await expect(host.locator("g.esp_pin_setup")).toHaveCount(1);
  const item = page.getByTestId("problem-item").filter({ hasText: "입력만 할 수 있어요" });
  await expect(item).toHaveCount(1);
  await item.click();
  await expect(page.getByTestId("code-panel").locator(".cm-lint-focus")).toHaveText("led = Pin(34, Pin.OUT)");
  await expect(host.locator("g.esp_pin_setup")).toHaveClass(/\blint-focus\b/);
  expect(await host.evaluate((el) => el.contains(document.activeElement))).toBe(false);
});
