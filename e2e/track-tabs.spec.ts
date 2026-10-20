import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { parse } from "yaml";

const KEY = "esp32-blocklab:v1";
const SETTINGS = "esp32-blocklab:settings";

/** 진행 기록·설정으로 시작한다 (첫 로드 때만 깐다 — 화면에서 저장한 것을 덮지 않게) */
async function seed(page: Page, chapters: Record<string, string[]>, settings?: Record<string, unknown>) {
  const records = Object.fromEntries(
    Object.entries(chapters).map(([ch, ids]) => [
      ch,
      Object.fromEntries(ids.map((id) => [id, { status: "done", input: {}, attempts: 0, updatedAt: "2026-10-15T00:00:00.000Z" }])),
    ]),
  );
  const progress = JSON.stringify({ version: 1, chapters: records });
  await page.addInitScript(([key, value, settingsKey, settingsValue]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(key, value);
      if (settingsValue) localStorage.setItem(settingsKey, settingsValue);
      sessionStorage.setItem("seeded", "1");
    }
  }, [KEY, progress, SETTINGS, settings ? JSON.stringify(settings) : ""] as const);
}

/**
 * 개발 서버가 내주는 chapter.yaml(?raw → `export default "..."`)의 order 줄 뒤에 YAML 줄을 끼운다.
 * 콘텐츠 파일을 건드리지 않고 초안·교사 메모를 시험하려고.
 */
async function patchChapterYaml(page: Page, chapterId: string, order: number, extraYaml: string) {
  await page.route(new RegExp(`/content/chapters/${chapterId}/chapter\\.yaml\\?`), async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const needle = `order: ${order}\\n`;
    if (!body.includes(needle)) throw new Error(`${chapterId} 모듈에서 "${needle}" 을 찾지 못했습니다`);
    const inject = JSON.stringify(extraYaml).slice(1, -1);
    await route.fulfill({ response, body: body.replace(needle, `${needle}${inject}`) });
  });
}

async function requiredStepIds(chapterId: string): Promise<string[]> {
  const raw = parse(await readFile(`content/chapters/${chapterId}/chapter.yaml`, "utf8")) as {
    parts: { steps: { id: string; optional?: boolean }[] }[];
  };
  return raw.parts.flatMap((p) => p.steps).filter((s) => !s.optional).map((s) => s.id);
}

const panel = (page: Page, track: string) => page.getByTestId(`track-panel-${track}`);
const cards = (page: Page, track: string) => panel(page, track).locator("[data-testid^='chapter-card-']");

test("트랙 화면: 두 탭, 센서 트랙 S1~S23, 교과 융합 트랙 F1~F16 와 먼저 할 챕터, 탭은 주소와 브라우저에 기억", async ({ page }) => {
  await page.goto("/#/track");
  await expect(page.getByRole("tab")).toHaveText(["센서 트랙", "교과 융합 트랙"]);
  await expect(page.getByRole("tab", { name: "센서 트랙" })).toHaveAttribute("aria-selected", "true");
  await expect(cards(page, "sensor").getByTestId("chapter-label")).toHaveText(Array.from({ length: 23 }, (_, i) => `S${i + 1}`));

  await page.getByRole("tab", { name: "교과 융합 트랙" }).click();
  await expect(page).toHaveURL(/#\/track\?track=fusion$/);
  await expect(cards(page, "fusion")).toHaveCount(16);
  await expect(cards(page, "fusion").getByTestId("chapter-label")).toHaveText(Array.from({ length: 16 }, (_, i) => `F${i + 1}`));
  for (const id of ["08-access-control", "09-oled-access", "10-auto-door"]) {
    await expect(page.getByTestId(`chapter-card-${id}`).getByTestId("chapter-prerequisites")).toContainText("먼저 할 챕터");
  }

  const door = page.getByTestId("chapter-card-10-auto-door");
  await expect(door.getByTestId("chapter-subjects")).toContainText("과학");
  await expect(door.getByTestId("chapter-subjects")).toContainText("SDG 11");
  await expect(door).toContainText("2차시");
  // 먼저 할 센서 챕터(이제 모두 있다)는 번호와 함께 링크로
  const ultrasonic = door.getByTestId("prerequisite-17-ultrasonic");
  await expect(ultrasonic).toHaveAttribute("data-state", "todo");
  await expect(ultrasonic).toContainText("S14");
  await expect(ultrasonic.getByRole("link")).toHaveCount(1);

  // 있는 챕터는 링크 (아직 안 함)
  const access = page.getByTestId("chapter-card-09-oled-access").getByTestId("prerequisite-08-access-control");
  await expect(access).toHaveAttribute("data-state", "todo");
  await access.getByRole("link").click();
  await expect(page).toHaveURL(/#\/track\/08-access-control$/);

  // 챕터 목록으로 돌아가면 그 챕터의 트랙 탭, 주소 없이 열어도 마지막 탭
  await page.getByRole("link", { name: "챕터 목록" }).click();
  await expect(page).toHaveURL(/#\/track\?track=fusion$/);
  await page.goto("/#/track");
  await expect(page.getByRole("tab", { name: "교과 융합 트랙" })).toHaveAttribute("aria-selected", "true");
  await page.goto("/#/track?track=sensor");
  await expect(page.getByRole("tab", { name: "센서 트랙" })).toHaveAttribute("aria-selected", "true");
});

test("먼저 할 챕터를 다 끝내면 완료로 보인다 (잠그지는 않는다)", async ({ page }) => {
  await seed(page, { "08-access-control": await requiredStepIds("08-access-control") });
  await page.goto("/#/track?track=fusion");
  await expect(page.getByTestId("chapter-card-09-oled-access").getByTestId("prerequisite-08-access-control")).toHaveAttribute("data-state", "done");

  // 먼저 할 챕터를 안 했어도 융합 챕터의 첫 단계는 열려 있다
  await page.goto("/#/track/10-auto-door");
  await expect(page.getByTestId("step-row-problem")).toHaveAttribute("data-state", "open");
});

test("챕터 화면 hero: 트랙 배지·번호·교과·SDG·차시·먼저 할 챕터", async ({ page }) => {
  await page.goto("/#/track/10-auto-door");
  const track = page.getByTestId("chapter-track");
  await expect(track).toContainText("교과 융합 트랙");
  await expect(track).toContainText("F3");
  await expect(page.getByTestId("chapter-subjects")).toContainText("수학");
  await expect(page.getByTestId("chapter-subjects")).toContainText("SDG 11");
  await expect(page.getByText("2차시")).toBeVisible();
  await expect(page.getByTestId("prerequisite-18-servo")).toHaveAttribute("data-state", "todo");
  await expect(page.getByTestId("teacher-notes")).toHaveCount(0);
});

test("초안 챕터: 목록에서는 교사 모드에서만 (초안 배지), 주소로는 누구나 열린다", async ({ page }) => {
  await patchChapterYaml(page, "07-fan", 7, "status: draft\n");
  await page.goto("/#/track?track=sensor");
  await expect(cards(page, "sensor")).toHaveCount(22);
  await expect(page.getByTestId("chapter-card-07-fan")).toHaveCount(0);

  await page.goto("/#/track/07-fan");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("작은 선풍기");
  await expect(page.getByTestId("chapter-track")).toContainText("초안");
  await expect(page.getByTestId("step-row-problem")).toHaveAttribute("data-state", "open");
});

test("초안 챕터와 교사 메모는 교사 모드에서 보인다", async ({ page }) => {
  await seed(page, {}, { teacherMode: true });
  await patchChapterYaml(page, "07-fan", 7, "status: draft\n");
  await patchChapterYaml(page, "10-auto-door", 10, "teacherNotes: |\n  **준비** 서보 날개를 미리 0도로 맞춰 두세요.\n");
  await page.goto("/#/track?track=sensor");
  await expect(cards(page, "sensor")).toHaveCount(23);
  const fan = page.getByTestId("chapter-card-07-fan");
  await expect(fan).toHaveAttribute("data-status", "draft");
  await expect(fan).toContainText("초안");

  await page.goto("/#/track/10-auto-door");
  const notes = page.getByTestId("teacher-notes");
  await expect(notes).toContainText("교사 메모");
  await expect(notes.locator("strong")).toHaveText("준비");
  await expect(notes).toContainText("서보 날개를 미리 0도로");
});
