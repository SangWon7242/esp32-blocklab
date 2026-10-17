import { expect, test } from "@playwright/test";
import { openSample } from "./sample";

/*
 * lib-v1.0.1: Blockly media(효과음·sprites.svg·아이콘)는 바깥(static.blockly.com) 대신 자기 주소 <base>blocklab/media/ 에서 읽는다.
 * 허브 CSP(connect-src·img-src 'self')에 막히지 않게.
 */
test("Blockly media 를 자기 주소에서 읽는다", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (/blockly\.com|blockly-demo\.appspot\.com/.test(url)) outside.push(url);
  });
  await openSample(page);
  const host = page.getByTestId("blockly-host");
  await expect(host.locator(".blocklyMainBackground")).toBeVisible();
  // 확대 단추·휴지통 그림이 자기 주소의 sprites.svg 를 가리킨다
  const href = await host
    .locator(".blocklyZoom image, .blocklyTrash image")
    .first()
    .evaluate((el) => el.getAttributeNS("http://www.w3.org/1999/xlink", "href") ?? el.getAttribute("href"));
  expect(href).toMatch(/\/blocklab\/media\/sprites\.svg$/);
  const svg = await page.request.get(href!);
  expect(svg.status()).toBe(200);
  expect(await svg.text()).toContain("<svg");
  const mp3 = await page.request.get("/blocklab/media/click.mp3");
  expect(mp3.status()).toBe(200);
  expect(outside).toEqual([]);
});
