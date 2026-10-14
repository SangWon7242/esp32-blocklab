import { expect, test, type Page } from "@playwright/test";

/** 계획 6: 판단·계산·변수·리스트·흐름 블록 */

/** 카테고리 줄(div)을 누른다 (글자 span 은 포인터를 받지 않는다) */
const category = (page: Page, name: string) =>
  page.locator(".blocklyToolboxCategory").filter({ hasText: new RegExp(`^${name}$`) });
const flyout = (page: Page) => page.locator(".blocklyToolboxFlyout");

test("코드 모드의 리스트 프로그램이 리스트·각 항목 반복 블록이 되고 코드는 그대로다", async ({ page }) => {
  await page.goto("/#/lab");
  const host = page.getByTestId("blockly-host");
  await expect(host.locator(".blocklyMainBackground")).toBeVisible();
  const program = "items = []\nitems.append(3)\nfor item in items:\n    print(item)";

  await page.getByRole("tab", { name: "코드" }).click();
  const content = page.getByTestId("code-panel").locator(".cm-content");
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  // 한 번에 넣어 편집기의 자동 들여쓰기가 끼어들지 않게 한다
  await page.keyboard.insertText(program);
  await expect(host.locator("g.flow_for_each")).toHaveCount(1);

  await page.getByRole("tab", { name: "블록" }).click();
  await expect(page.getByText("블록을 놓으면 코드가 바로 바뀝니다")).toBeVisible();
  await expect(host.locator("g.list_create")).toHaveCount(1);
  await expect(host.locator("g.list_append")).toHaveCount(1);
  await expect(host.locator("g.flow_for_each")).toHaveCount(1);
  await expect(host.locator("g.code_stmt, g.code_expr")).toHaveCount(0);
  // 블록에서 다시 만든 코드가 친 코드와 같다
  await expect.poll(async () => (await content.innerText()).trim()).toBe(program);
});

test("변수를 만들면 변수 팔레트에 '만큼 바꾸기' 블록이 나온다", async ({ page }) => {
  await page.goto("/#/lab");
  await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
  page.on("dialog", (dialog) => void dialog.accept("score"));
  await category(page, "변수").click();
  await expect(flyout(page)).toBeVisible();
  await expect(flyout(page)).not.toContainText("만큼 바꾸기");
  await flyout(page).getByText("변수 만들기").click();
  await expect(flyout(page)).toContainText("score");
  await expect(flyout(page)).toContainText("만큼 바꾸기");
});

test("리스트 타일을 누르면 리스트 블록 팔레트가 열린다", async ({ page }) => {
  await page.goto("/#/lab");
  await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
  const tile = category(page, "리스트");
  await expect(tile).toHaveCount(1);
  await expect(tile.locator(".entryCategoryIcon svg")).toHaveCount(1);
  await tile.click();
  await expect(flyout(page)).toBeVisible();
  await expect(flyout(page)).toContainText("추가하기");
  await expect(flyout(page)).toContainText("(0부터)");
});
