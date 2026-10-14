import { expect, test, type Page } from "@playwright/test";

/** 가짜 장치(?device=fake)로 연다: print 줄마다 200ms 쉬고 인자를 출력, raise 는 Traceback 을 흉내 낸다 */
async function openFake(page: Page) {
  await page.goto("/#/lab?device=fake");
  await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
}

/** 코드 모드에서 코드를 통째로 바꾼다 (debounce 를 기다리지 않는다: 실행·저장이 먼저 반영해야 한다) */
async function replaceCode(page: Page, text: string) {
  await page.getByRole("tab", { name: "코드" }).click();
  await page.getByTestId("code-panel").locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text);
}

const status = (page: Page) => page.getByTestId("device-status");
const rows = (page: Page) => page.getByTestId("console-entry");
/** 상단 보드 버튼 (콘솔 행도 button 이라 "실행" 은 "실행을 시작했어요" 와 겹치므로 이름이 딱 맞는 것만) */
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function connect(page: Page) {
  await expect(status(page)).toHaveText("끊김");
  // 연결 전에는 실행·저장·멈춤을 누를 수 없다
  await expect(button(page, "실행")).toBeDisabled();
  await button(page, "보드 연결").click();
  await expect(status(page)).toHaveText("연결됨");
  await expect(rows(page).filter({ hasText: "보드에 연결했어요" })).toHaveCount(1);
}

test("가짜 장치: 연결하면 배지가 연결됨, 실행하면 출력이 콘솔에 나온다", async ({ page }) => {
  await openFake(page);
  await connect(page);
  // print 5줄 (가짜 장치는 줄마다 200ms) → "실행 중" 이 1초 동안 보인다
  await replaceCode(page, "print(1)\nprint(2)\nprint(3)\nprint(4)\nprint(5)\n");
  await button(page, "실행").click();
  // 실행 중에는 실행·저장을 막고 멈춤은 열어 둔다
  await expect(status(page)).toHaveText("실행 중");
  await expect(button(page, "실행")).toBeDisabled();
  await expect(button(page, "멈춤")).toBeEnabled();
  await expect(rows(page).filter({ hasText: /^1$/ })).toHaveCount(1);
  await expect(rows(page).filter({ hasText: "실행이 끝났어요" })).toHaveCount(1);
  // 출력 순서 그대로
  const device = page.locator('[data-testid="console-entry"][data-kind]');
  await expect(device).toHaveText(["보드에 연결했어요", "실행을 시작했어요", "1", "2", "3", "4", "5", "실행이 끝났어요"]);
  await expect(status(page)).toHaveText("연결됨");
  await expect(page.getByRole("tab", { name: /콘솔/ })).toHaveAttribute("aria-selected", "true");

  // 지우기는 보드 행만 지운다
  await button(page, "보드 출력 지우기").click();
  await expect(page.locator('[data-testid="console-entry"][data-kind]')).toHaveCount(0);
});

test("가짜 장치: 보드 Traceback 은 영어 그대로 콘솔에, 그 줄을 강조한다", async ({ page }) => {
  await openFake(page);
  await connect(page);
  await replaceCode(page, 'print(1)\nraise ValueError("x")\nprint(2)\n');
  await button(page, "실행").click();
  const traceback = rows(page).filter({ hasText: "ValueError: x" });
  await expect(traceback).toHaveCount(1);
  await expect(traceback).toContainText('File "main.py", line 2');
  await expect(traceback).toHaveAttribute("data-kind", "stderr");
  await expect(rows(page).filter({ hasText: /^2$/ })).toHaveCount(0);
  const focus = page.getByTestId("code-panel").locator(".cm-lint-focus");
  await expect(focus).toHaveCount(1);
  await expect(focus).toHaveText('raise ValueError("x")');
  await expect(status(page)).toHaveText("연결됨");
});

test("가짜 장치: 멈춤을 누르면 실행이 멈춘다", async ({ page }) => {
  await openFake(page);
  await connect(page);
  await replaceCode(page, Array.from({ length: 20 }, (_, i) => `print(${i})`).join("\n"));
  await button(page, "실행").click();
  await expect(rows(page).filter({ hasText: /^0$/ })).toHaveCount(1);
  await button(page, "멈춤").click();
  await expect(rows(page).filter({ hasText: "실행을 멈췄어요" })).toHaveCount(1);
  await expect(status(page)).toHaveText("연결됨");
  await expect(rows(page).filter({ hasText: /^19$/ })).toHaveCount(0);
});

test("가짜 장치: 보드에 저장하면 없는 라이브러리를 먼저 올리고 main.py 를 저장한다", async ({ page }) => {
  await openFake(page);
  await connect(page);
  // 키패드 준비 블록은 keypad.py 가 필요하다 (가짜 보드에는 boot.py 뿐)
  await replaceCode(page, "from keypad import KeyPad\nkeypad = KeyPad(26, 25, 17, 16, 27, 14, 12, 13)\n");
  await button(page, "보드에 저장").click();
  await expect(rows(page).filter({ hasText: "main.py 저장 완료" })).toHaveCount(1);
  const lib = rows(page).filter({ hasText: "keypad.py 올리는 중…" });
  await expect(lib).toHaveCount(1);
  await expect(page.getByTestId("blockly-host").locator("g.dev_keypad_setup")).toHaveCount(1);
  await expect(status(page)).toHaveText("연결됨");

  // 두 번째 저장은 이미 있는 라이브러리를 다시 올리지 않는다
  await button(page, "보드 출력 지우기").click();
  await button(page, "보드에 저장").click();
  await expect(rows(page).filter({ hasText: "main.py 저장 완료" })).toHaveCount(1);
  await expect(lib).toHaveCount(0);
});

test("가짜 장치: 코드 모드에 문법 오류가 있으면 실행·저장하지 않고 안내한다", async ({ page }) => {
  await openFake(page);
  await connect(page);
  await replaceCode(page, "if x\n");
  await expect(page.getByTestId("parse-error")).toBeVisible();
  await button(page, "실행").click();
  await expect(page.getByText("문법 오류를 고친 뒤에 보드에 올릴 수 있어요")).toBeVisible();
  await button(page, "보드에 저장").click();
  await expect(rows(page).filter({ hasText: "실행을 시작했어요" })).toHaveCount(0);
  await expect(rows(page).filter({ hasText: "main.py 올리는 중…" })).toHaveCount(0);
  await expect(status(page)).toHaveText("연결됨");
});

test("가짜 장치: 맨 아래를 보고 있을 때만 새 출력으로 따라 내려간다", async ({ page }) => {
  await openFake(page);
  await connect(page);
  await replaceCode(page, Array.from({ length: 12 }, (_, i) => `print(${i})`).join("\n"));
  await button(page, "실행").click();
  const done = rows(page).filter({ hasText: "실행이 끝났어요" });
  await expect(done).toHaveCount(1);
  await expect(done).toBeInViewport();
  // 위로 올려 둔 채 다시 실행하면 그 자리에 머문다
  // 하단 패널의 스크롤 칸 (콘솔 목록 → 콘솔 → 탭 내용 → 스크롤 칸)
  const scroller = page.getByTestId("console-list").locator("xpath=../../..");
  expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight && el.scrollTop > 0)).toBe(true);
  await scroller.evaluate((el) => { el.scrollTop = 0; });
  await button(page, "실행").click();
  await expect(done).toHaveCount(2);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);
});

test("가짜 장치: 연결을 끊으면 배지가 끊김으로 돌아간다", async ({ page }) => {
  await openFake(page);
  await connect(page);
  await button(page, "연결 끊기").click();
  await expect(status(page)).toHaveText("끊김");
  await expect(button(page, "보드에 저장")).toBeDisabled();
});

test("가짜 장치: 실행 전에도 코드가 import 하는 라이브러리를 먼저 올린다", async ({ page }) => {
  await openFake(page);
  await connect(page);
  // 코드 모드에서 손으로 적은 import 도 라이브러리 필요로 본다 (블록 종류가 아니라 import 줄로)
  await replaceCode(page, "import ssd1306\nprint(1)\n");
  await button(page, "실행").click();
  await expect(rows(page).filter({ hasText: "ssd1306.py 올리는 중…" })).toHaveCount(1);
  await expect(rows(page).filter({ hasText: "실행을 시작했어요" })).toHaveCount(1);
  await expect(status(page)).toHaveText("연결됨");
  // 두 번째 실행은 같은 판이 이미 있으니 올리지 않는다
  await button(page, "실행").click();
  await expect(rows(page).filter({ hasText: "실행을 시작했어요" })).toHaveCount(2);
  await expect(rows(page).filter({ hasText: "ssd1306.py 올리는 중…" })).toHaveCount(1);
});
