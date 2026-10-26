import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/*
 * 코치 편집기 (lib-v1.1.0, CoachEditorView) — 체험판 숨은 화면 #/coach-editor-demo 로 본다.
 * 초기 코드, onProgramChange(1초 디바운스), 제안 상자(적용·닫기, 같은 id 다시 안 띄움), 가짜 보드 실행 → onRunEnd,
 * highlightLines 강조, 보기만, 화면 폭별 가로 넘침.
 */

const SHOTS = path.resolve(".superpowers/sdd/2026-10-26-plan14/shots");

async function openDemo(page: Page, query = "") {
  await page.goto(`/#/coach-editor-demo${query}`);
  await expect(page.getByTestId("coach-editor")).toBeVisible();
  await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
}

const codePanel = (page: Page) => page.getByTestId("code-panel");
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** 가로 넘침이 없다 (페이지 전체) */
async function expectNoHorizontalOverflow(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
}

test("초기 코드가 실리고, 처음에는 내보내지 않다가 편집 1초 뒤 onProgramChange", async ({ page }) => {
  await openDemo(page);
  await expect(codePanel(page)).toContainText('print("start")');
  // 처음 실린 프로그램은 내보내지 않는다
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("demo-program-count")).toHaveText("0");
  await expect(page.getByTestId("demo-program")).toHaveText("아직 없음");

  await page.getByRole("tab", { name: "코드" }).click();
  await codePanel(page).locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("print(7)\n");
  // 디바운스 동안은 아직 0
  await page.waitForTimeout(600);
  await expect(page.getByTestId("demo-program-count")).toHaveText("0");
  await expect(page.getByTestId("demo-program")).toContainText("print(7)");
  // 코드 모드에서는 programForSave 규칙: 친 글이 작업판이 다시 만든 코드와 다르면(빈 줄 등) blocksJson 은 null
  await expect(page.getByTestId("demo-program")).not.toContainText("문법 오류");
  await expect(page.getByTestId("demo-program-count")).toHaveText("1");

  // 문법 오류면 블록 없음·문법 오류로 내보낸다
  await page.keyboard.type("if x\n");
  await expect(page.getByTestId("demo-program")).toContainText("문법 오류 · 블록 없음");
});

test("제안 상자: 닫기는 그대로, 같은 id 는 다시 안 띄우고, 적용하면 코드가 바뀐다", async ({ page }) => {
  await openDemo(page);
  await page.getByTestId("demo-proposal-1").click();
  const box = page.getByTestId("coach-proposal");
  await expect(box).toBeVisible();
  await expect(page.getByTestId("coach-proposal-stats")).toHaveText("더한 줄 2개 · 지운 줄 0개");
  await expect(page.getByTestId("coach-proposal-note")).toContainText("끝났다는 글");
  const added = box.locator('[data-kind="add"]');
  await expect(added).toHaveCount(2);
  // 색만이 아니라 기호(+)와 줄 번호로도 구분된다
  await expect(added.first()).toContainText("+");
  await expect(added.first()).toContainText("6");
  await expect(added.first()).toContainText("# [F1] 불 켜기");

  await page.getByTestId("coach-proposal-close").click();
  await expect(box).toHaveCount(0);
  await expect(page.getByTestId("demo-decision")).toContainText("p1 닫기");
  await expect(codePanel(page)).not.toContainText('print("done")');
  // 같은 id 는 다시 띄우지 않는다
  await page.getByTestId("demo-proposal-1").click();
  await expect(box).toHaveCount(0);

  // 블록으로 바뀌지 않는 제안은 코드 모드로 연다
  await page.getByTestId("demo-proposal-2").click();
  await expect(box).toBeVisible();
  await expect(box.locator('[data-kind="del"]').first()).toContainText("−");
  await page.getByTestId("coach-proposal-apply").click();
  await expect(box).toHaveCount(0);
  await expect(page.getByTestId("demo-decision")).toContainText("p2 적용");
  await expect(page.getByRole("tab", { name: "코드" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("parse-error")).toBeVisible();
  await expect(codePanel(page)).toContainText("if x");
});

test("제안 적용: 편집기 코드·블록이 제안 코드로 바뀌고 결정에 새 프로그램이 실린다", async ({ page }) => {
  await openDemo(page);
  await page.getByTestId("demo-proposal-1").click();
  await page.getByTestId("coach-proposal-apply").click();
  await expect(page.getByTestId("coach-proposal")).toHaveCount(0);
  await expect(codePanel(page)).toContainText('print("done")');
  await expect(codePanel(page)).toContainText("# [F1] 불 켜기");
  await expect(page.getByTestId("demo-decision")).toContainText("p1 적용");
  await expect(page.getByTestId("demo-decision")).toContainText("print(\\\"done\\\")");
  await expect(page.getByTestId("blockly-host").locator(".blocklyText", { hasText: "done" }).first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "블록" })).toHaveAttribute("aria-selected", "true");
  // 적용도 편집이라 1초 뒤 onProgramChange 로 나간다
  await expect(page.getByTestId("demo-program")).toContainText("print(\\\"done\\\")");
});

test("가짜 보드 실행 → onRunEnd source fake, 성공·오류", async ({ page }) => {
  await openDemo(page, "?device=fake");
  // 보드에 저장·작품 저장 단추는 없다
  await expect(button(page, "보드에 저장")).toHaveCount(0);
  await expect(page.getByTestId("save-project-button")).toHaveCount(0);
  await button(page, "보드 연결").click();
  await expect(page.getByTestId("device-status")).toHaveText("연결됨");
  await button(page, "실행").click();
  await expect(page.getByTestId("demo-run")).toContainText("fake · 성공");
  await expect(page.getByTestId("demo-run")).toContainText("start");

  await page.getByRole("tab", { name: "코드" }).click();
  await codePanel(page).locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type('print(1)\nraise ValueError("x")\n');
  await button(page, "실행").click();
  await expect(page.getByTestId("demo-run")).toContainText("fake · 실패 · 2줄 ValueError: x");
});

test("highlightLines 는 코드 칸 줄을 칠하고, 보기만이면 편집·실행을 막는다", async ({ page }) => {
  await openDemo(page);
  await page.getByTestId("demo-highlight").click();
  const marks = codePanel(page).locator(".cm-lint-mark");
  await expect(marks).toHaveCount(2);
  await expect(marks.first()).toHaveText("led = Pin(26, Pin.OUT)");
  await page.getByTestId("demo-highlight-clear").click();
  await expect(marks).toHaveCount(0);

  await page.getByTestId("demo-readonly").click();
  await expect(page.getByTestId("blocks-readonly")).toBeVisible();
  await expect(page.getByTestId("device-status")).toHaveCount(0);
  await page.getByRole("tab", { name: "코드" }).click();
  await expect(codePanel(page).locator(".cm-content")).toHaveAttribute("aria-readonly", "true");
  await codePanel(page).locator(".cm-content").click();
  await page.keyboard.type("zzz");
  await expect(codePanel(page)).not.toContainText("zzz");
  await page.getByTestId("demo-proposal-1").click();
  await expect(page.getByTestId("coach-proposal-apply")).toBeDisabled();
});

for (const width of [390, 820, 1180, 1440]) {
  test(`화면 폭 ${width}: 제안 상자·강조가 있어도 가로 넘침이 없다`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : width < 1000 ? 1180 : 900 });
    await openDemo(page);
    await page.getByTestId("demo-highlight").click();
    await page.getByTestId("demo-proposal-1").click();
    await expect(page.getByTestId("coach-proposal")).toBeVisible();
    await expect(page.getByTestId("coach-proposal-apply")).toBeInViewport();
    await expect(page.getByTestId("coach-proposal-close")).toBeInViewport();
    await expectNoHorizontalOverflow(page);
    // 편집기가 부모 높이를 채운다 (코드 칸 또는 작업판이 보인다)
    const editor = await page.getByTestId("coach-editor").boundingBox();
    expect(editor && editor.height).toBeGreaterThan(300);
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `coach-editor-${width}.png`) });
  });
}
