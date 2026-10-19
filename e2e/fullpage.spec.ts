import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/*
 * lib-v1.0.6 풀페이지 배치: 폭 4종(폰 390 · 태블릿 세로 820 · 태블릿 가로 1180 · 노트북 1440)에서
 * 챕터·단계·목록 화면이 가로로 넘치지 않고, 넓은 화면(≥1024)의 챕터 화면은 소개 칸과 단계 지도 칸이 나란히 놓인다.
 * 스크린샷은 .superpowers/sdd/2026-10-19-fullpage/shots/ 에 남긴다 (눈으로 확인용).
 */

const KEY = "esp32-blocklab:v1";
const SHOTS = ".superpowers/sdd/2026-10-19-fullpage/shots";
const SIZES = [
  { name: "390-phone", width: 390, height: 844 },
  { name: "820-tablet-portrait", width: 820, height: 1180 },
  { name: "1180-tablet-landscape", width: 1180, height: 820 },
  { name: "1440-laptop", width: 1440, height: 900 },
] as const;

/** 미션 단계(편집기)까지 열리도록 앞 단계를 끝낸 기록으로 시작한다 */
async function seedDone(page: Page, chapterId: string, stepIds: string[]) {
  const records = Object.fromEntries(stepIds.map((id) => [id, { status: "done", input: {}, attempts: 0, updatedAt: "2026-10-19T00:00:00.000Z" }]));
  const progress = JSON.stringify({ version: 1, chapters: { [chapterId]: records } });
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(key, value);
      sessionStorage.setItem("seeded", "1");
    }
  }, [KEY, progress] as const);
}

/** 문서와 화면 뿌리(스크롤 칸 포함) 어디에도 가로 넘침이 없다 */
async function expectNoHorizontalOverflow(page: Page) {
  const over = await page.evaluate(() => {
    const out: string[] = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) out.push(`document ${de.scrollWidth} > ${de.clientWidth}`);
    for (const el of document.querySelectorAll<HTMLElement>("[data-testid=chapter-page], [data-testid=chapter-steps], [data-testid=chapter-intro], [data-testid=track-page], [data-testid=step-guide], [data-testid=step-activity]")) {
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.dataset.testid} ${el.scrollWidth} > ${el.clientWidth}`);
    }
    return out;
  });
  expect(over).toEqual([]);
}

mkdirSync(SHOTS, { recursive: true });

for (const size of SIZES) {
  test.describe(`${size.name} (${size.width}×${size.height})`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("챕터 화면: 넘침 없음, 넓으면 두 칸 나란히, 첫 화면에 단계 카드", async ({ page }) => {
      await page.goto("/#/track/17-ultrasonic");
      const steps = page.getByTestId("chapter-steps");
      const intro = page.getByTestId("chapter-intro");
      await expect(steps).toBeVisible();
      await expect(page.getByTestId("chapter-cover").locator("svg[role=img]")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const s = (await steps.boundingBox())!;
      const i = (await intro.boundingBox())!;
      if (size.width >= 1024) {
        // 두 칸이 나란히: x 가 다르고 위쪽 선이 같다
        expect(Math.abs(s.x - i.x)).toBeGreaterThan(200);
        expect(Math.abs(s.y - i.y)).toBeLessThan(2);
        expect(i.x).toBeLessThan(s.x);
      } else {
        // 쌓기: 단계 지도가 먼저(위), 소개가 다음
        expect(Math.abs(s.x - i.x)).toBeLessThan(2);
        expect(i.y).toBeGreaterThan(s.y);
      }

      // 첫 화면에 다 보이는 단계 카드 수 (스크롤 없이)
      const visible = await page.evaluate((h) => {
        return [...document.querySelectorAll("[data-testid^=step-row-]")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.top >= 0 && r.bottom <= h;
        }).length;
      }, size.height);
      const total = await page.locator("[data-testid^=step-row-]").count();
      test.info().annotations.push({ type: "first-screen-steps", description: `${visible} / ${total}` });
      console.log(`[fullpage] ${size.name} 챕터 첫 화면 단계 카드 ${visible} / ${total}`);
      // 노트북·태블릿 가로는 9단계가 모두, 태블릿 세로는 절반 넘게, 폰은 둘 이상
      const min = size.width >= 1024 ? total : size.width >= 768 ? Math.ceil(total / 2) : 2;
      expect(visible).toBeGreaterThanOrEqual(min);

      // 터치 대상 44px 이상: 시작 버튼·단계 카드
      expect((await page.getByTestId("chapter-start").boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await page.getByTestId("step-row-problem").getByRole("link").boundingBox())!.height).toBeGreaterThanOrEqual(44);

      await page.screenshot({ path: `${SHOTS}/chapter-${size.name}.png` });

      // 단계가 많은 챕터(자동문 14단계, 부 2개)도 재 본다
      await page.goto("/#/track/10-auto-door");
      await expect(page.getByTestId("step-row-problem")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const many = await page.evaluate((h) => {
        const rows = [...document.querySelectorAll("[data-testid^=step-row-]")];
        return { visible: rows.filter((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= h; }).length, total: rows.length };
      }, size.height);
      console.log(`[fullpage] ${size.name} 자동문 첫 화면 단계 카드 ${many.visible} / ${many.total}`);
      // 노트북(1440×900)은 14단계 모두, 태블릿 가로(1180×820)는 11단계 이상 (마지막 한 줄만 스크롤)
      if (size.width >= 1400) expect(many.visible).toBe(many.total);
      else if (size.width >= 1024) expect(many.visible).toBeGreaterThanOrEqual(11);
      await page.screenshot({ path: `${SHOTS}/chapter-door-${size.name}.png` });
    });

    test("단계 화면(미션 편집기): 넘침 없음, 편집기 높이 넉넉", async ({ page }) => {
      await seedDone(page, "17-ultrasonic", ["problem", "analysis", "predict", "run", "readcheck"]);
      await page.goto("/#/track/17-ultrasonic/mission");
      const editor = page.getByTestId("track-editor");
      await expect(editor).toBeVisible();
      await expect(page.locator(".blocklySvg").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const box = (await editor.boundingBox())!;
      console.log(`[fullpage] ${size.name} 편집기 ${Math.round(box.width)}×${Math.round(box.height)}`);
      expect(box.height).toBeGreaterThanOrEqual(440);
      if (size.width >= 1024) {
        const guide = (await page.getByTestId("step-guide").boundingBox())!;
        const activity = (await page.getByTestId("step-activity").boundingBox())!;
        expect(guide.x).toBeLessThan(activity.x);
        // 활동 칸이 화면의 60% 이상
        expect(activity.width / size.width).toBeGreaterThan(0.6);
      }
      await page.screenshot({ path: `${SHOTS}/step-${size.name}.png` });
    });

    test("트랙 목록: 넘침 없음, 카드 격자 전체 폭", async ({ page }) => {
      await page.goto("/#/track");
      const panel = page.getByTestId("track-panel-sensor").or(page.getByTestId("track-panel-fusion"));
      await expect(panel.locator("[data-testid^=chapter-card-]").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const card = (await panel.locator("[data-testid^=chapter-card-]").first().boundingBox())!;
      const cols = await page.evaluate(() => {
        const cards = [...document.querySelectorAll("[data-testid^=chapter-card-]")].filter((el) => (el as HTMLElement).offsetParent);
        const top = cards[0]?.getBoundingClientRect().top;
        return cards.filter((el) => Math.abs(el.getBoundingClientRect().top - top) < 2).length;
      });
      console.log(`[fullpage] ${size.name} 목록 열 수 ${cols}, 카드 폭 ${Math.round(card.width)}`);
      expect(cols).toBe(size.width >= 1024 ? 3 : size.width >= 640 ? 2 : 1);
      await page.screenshot({ path: `${SHOTS}/list-${size.name}.png` });
    });
  });
}

test("트랙 목록 찾기: 초음파를 넣으면 결과가 걸러지고 맞은 곳이 보이며, 지우면 탭으로 돌아온다", async ({ page }) => {
  await page.goto("/#/track");
  const search = page.getByTestId("chapter-search");
  await expect(search).toBeVisible();
  await search.fill("초음파");
  const results = page.getByTestId("search-results");
  await expect(results).toBeVisible();
  await expect(page.getByTestId("track-panel-sensor")).toHaveCount(0);
  const ultra = results.getByTestId("chapter-card-17-ultrasonic");
  await expect(ultra).toBeVisible();
  await expect(ultra.getByTestId("search-match")).toContainText("제목");
  await expect(ultra.locator("mark").first()).toHaveText("초음파");
  await expect(results.getByTestId("chapter-card-10-auto-door")).toBeVisible();
  await expect(results.getByTestId("chapter-card-01-led")).toHaveCount(0);
  const count = await results.locator("[data-testid^=chapter-card-]").count();
  expect(count).toBeGreaterThan(1);
  expect(count).toBeLessThan(20);
  await expect(page.getByTestId("search-count")).toContainText(`찾은 챕터 ${count}개`);
  await page.screenshot({ path: `${SHOTS}/search-1440.png` });

  // 초성 · 여러 낱말(AND)
  await search.fill("ㅊㅇㅍ 서보");
  await expect(results.getByTestId("chapter-card-10-auto-door")).toBeVisible();
  await expect(results.getByTestId("chapter-card-17-ultrasonic")).toHaveCount(0);

  // 없는 낱말
  await search.fill("없는낱말이다");
  await expect(results).toContainText("맞는 챕터가 없어요");

  // Esc 로 지우면 탭 목록으로
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(page.getByTestId("search-results")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "센서 트랙" })).toBeVisible();
});
