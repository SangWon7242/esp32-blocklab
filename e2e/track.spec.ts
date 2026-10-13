import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const KEY = "esp32-blocklab:v1";

/** 앞 단계들을 끝낸 기록으로 시작한다 (첫 로드 때만 깐다 — 화면에서 저장한 것을 덮지 않게) */
async function seedDone(page: Page, chapterId: string, stepIds: string[]) {
  const records = Object.fromEntries(
    stepIds.map((id) => [id, { status: "done", input: {}, attempts: 0, updatedAt: "2026-10-14T00:00:00.000Z" }]),
  );
  const progress = JSON.stringify({ version: 1, chapters: { [chapterId]: records } });
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(key, value);
      sessionStorage.setItem("seeded", "1");
    }
  }, [KEY, progress] as const);
}

const stepRow = (page: Page, id: string) => page.getByTestId(`step-row-${id}`);
const completeButton = (page: Page) => page.getByRole("button", { name: "완료", exact: true });

test("챕터 목록 → 챕터 10 → 첫 단계 글 쓰고 완료 → 둘째 단계가 열린다", async ({ page }) => {
  await page.goto("/#/");
  await page.getByRole("link", { name: "트랙", exact: true }).click();
  const card = page.getByTestId("chapter-card-10-auto-door");
  await expect(card).toContainText("다가가면 열리는 자동문");
  await card.getByRole("link", { name: /시작하기/ }).click();

  await expect(page).toHaveURL(/#\/track\/10-auto-door$/);
  await expect(stepRow(page, "problem")).toHaveAttribute("data-state", "open");
  await expect(stepRow(page, "analysis")).toHaveAttribute("data-state", "locked");

  await stepRow(page, "problem").getByRole("link").click();
  await expect(page.getByTestId("step-position")).toHaveText("1 / 14");
  await expect(completeButton(page)).toBeDisabled();
  const boxes = page.getByRole("textbox");
  await expect(boxes).toHaveCount(3);
  await boxes.nth(0).fill("센서로 사람을 본다");
  await boxes.nth(1).fill("1m 쯤");
  await expect(completeButton(page)).toBeDisabled();
  await boxes.nth(2).fill("몇 초 뒤에");
  await completeButton(page).click();
  await expect(page.getByText("완료한 단계예요")).toBeVisible();

  await page.getByRole("link", { name: "다음" }).click();
  await expect(page).toHaveURL(/#\/track\/10-auto-door\/analysis$/);
  await expect(page.getByTestId("step-position")).toHaveText("2 / 14");

  // 조건 분석: 세 칸 → 예시 답 보기 → 체크 하나 이상이어야 완료
  const analysis = page.getByRole("textbox");
  await expect(page.getByRole("button", { name: "예시 답 보기" })).toBeDisabled();
  await analysis.nth(0).fill("거리");
  await analysis.nth(1).fill("몇 cm");
  await analysis.nth(2).fill("문 열기");
  await page.getByRole("button", { name: "예시 답 보기" }).click();
  await expect(page.getByTestId("analysis-answer")).toContainText("몇 cm부터 열 것인지");
  await expect(completeButton(page)).toBeDisabled();
  await page.getByLabel("그것이 몇 cm 떨어져 있는지").check();
  await completeButton(page).click();
  await expect(page.getByText("완료한 단계예요")).toBeVisible();

  // 새로 고쳐도 기록이 남아 있다
  await page.getByRole("link", { name: "다가가면 열리는 자동문" }).click();
  await expect(page).toHaveURL(/#\/track\/10-auto-door$/);
  await page.reload();
  await expect(stepRow(page, "problem")).toHaveAttribute("data-state", "done");
  await expect(stepRow(page, "analysis")).toHaveAttribute("data-state", "done");
  await expect(stepRow(page, "predict")).toHaveAttribute("data-state", "open");
});

test("잠긴 단계로 바로 가면 챕터로 돌아가며 알려 준다", async ({ page }) => {
  await page.goto("/#/track/10-auto-door/reflect");
  await expect(page).toHaveURL(/#\/track\/10-auto-door$/);
  await expect(page.getByText("앞 단계를 먼저 끝내 주세요")).toBeVisible();
});

test("읽기 체크: 틀리면 힌트, 고쳐서 맞히면 완료", async ({ page }) => {
  await seedDone(page, "10-auto-door", ["problem", "analysis", "predict", "run1"]);
  await page.goto("/#/track/10-auto-door/readcheck1");
  await expect(page.getByTestId("step-position")).toHaveText("5 / 14");
  await expect(page.getByTestId("code-panel")).toContainText("trig = Pin(13, Pin.OUT)");

  const q0 = page.getByTestId("readcheck-q-0");
  await expect(page.getByRole("button", { name: "확인" })).toBeDisabled();
  await q0.getByLabel("echo").check();
  await page.getByTestId("readcheck-q-1").getByRole("textbox").fill("2");
  await page.getByTestId("readcheck-q-2").getByRole("textbox").fill("2");
  await page.getByRole("button", { name: "확인" }).click();

  await expect(q0).toContainText("다시 생각해 보세요");
  await expect(q0).toContainText("힌트: trig 는 trigger(방아쇠)");
  await expect(page.getByTestId("readcheck-q-1")).toContainText("맞았어요");
  await expect(completeButton(page)).toBeDisabled();

  await q0.getByLabel("trig").check();
  await page.getByRole("button", { name: "확인" }).click();
  await expect(q0).toContainText("맞았어요");
  await expect(page.getByText("확인 2번").or(page.getByText("모두 맞았어요"))).toBeVisible();
  await completeButton(page).click();
  await expect(page.getByText("완료한 단계예요")).toBeVisible();

  const saved = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY)) ?? "{}");
  expect(saved.chapters["10-auto-door"].readcheck1).toMatchObject({ status: "done", attempts: 2 });
});

test("읽기 체크: 코드 줄 번호를 눌러 줄 문항에 답한다", async ({ page }) => {
  await seedDone(page, "01-led", ["problem", "analysis", "predict", "run"]);
  await page.goto("/#/track/01-led/readcheck");
  await page.getByTestId("readcheck-q-0").getByRole("textbox").fill("1");
  await page.getByTestId("readcheck-q-1").getByLabel("led.value(0)").check();
  await page.getByTestId("code-panel").locator(".cm-lineNumbers .cm-gutterElement", { hasText: /^8$/ }).click();
  await expect(page.getByTestId("line-answer-2")).toHaveText("고른 줄: 8번");
  await page.getByRole("button", { name: "확인" }).click();
  await expect(page.getByText("모두 맞았어요")).toBeVisible();
  await expect(completeButton(page)).toBeEnabled();
});

test("설정: 내보내기 JSON 에 진행 기록이 들어 있다", async ({ page }) => {
  await page.goto("/#/track/10-auto-door/problem");
  const boxes = page.getByRole("textbox");
  await boxes.nth(0).fill("내보내기 확인용 답");
  await boxes.nth(1).fill("나");
  await boxes.nth(2).fill("다");
  await completeButton(page).click();

  await page.getByRole("link", { name: "설정" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "내보내기" }).click()]);
  const text = await readFile(await download.path(), "utf8");
  const data = JSON.parse(text);
  expect(data.version).toBe(1);
  expect(data.chapters["10-auto-door"].problem.status).toBe("done");
  expect(text).toContain("내보내기 확인용 답");
});

test("선택 편집기 단계만 건너뛸 수 있고, 교사 모드면 자유 코딩에서 정답 코드를 연다", async ({ page }) => {
  // 필수 편집기 단계(설계)는 건너뛰기가 없다 — 판정을 통과해야 끝난다 (§8.3)
  await seedDone(page, "10-auto-door", ["problem", "analysis", "predict", "run1", "readcheck1", "mission1", "debug1", "design", "run2", "readcheck2", "mission2"]);
  await page.goto("/#/track/10-auto-door/design");
  await expect(page.getByText("1. 우리말 설계도의 빈칸 채우기")).toBeVisible();
  await expect(page.getByRole("link", { name: /정답 코드 열기/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "건너뛰기" })).toHaveCount(0);

  // 선택 단계(디버깅 ②)는 건너뛸 수 있다
  await page.goto("/#/track/10-auto-door/debug2");
  await page.getByRole("button", { name: "건너뛰기" }).click();
  await expect(page.getByText("완료한 단계예요")).toBeVisible();
  await expect(page.getByRole("link", { name: "다음" })).toBeVisible();

  await page.getByRole("link", { name: "설정" }).click();
  await page.getByLabel("교사 모드").click();
  await page.goto("/#/track/10-auto-door/design");
  await page.getByRole("link", { name: "정답 코드 열기 (step2_door.py)" }).click();
  await expect(page).toHaveURL(/#\/lab\?code=10-auto-door\/step2_door\.py$/);
  await expect(page.getByTestId("code-panel")).toContainText("def get_distance():");
});

test("설정: 교사 모드면 모든 단계가 열리고 예시 답이 바로 보인다", async ({ page }) => {
  await page.goto("/#/settings");
  await page.getByLabel("교사 모드").click();
  await page.goto("/#/track/10-auto-door");
  // 설정은 새로 고쳐도 남는다
  await page.reload();
  await expect(stepRow(page, "reflect")).toHaveAttribute("data-state", "open");
  await stepRow(page, "analysis").getByRole("link").click();
  await expect(page.getByTestId("analysis-answer")).toContainText("앞에 무언가 있는지");
  await expect(page.getByRole("button", { name: "예시 답 보기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "대조했어요" })).toBeDisabled();
});

test("설정: 가짜 보드를 켜면 자유 코딩이 가짜 장치로 연결된다, 잘못된 파일 불러오기는 알려 준다", async ({ page }) => {
  await page.goto("/#/settings");
  await page.getByLabel("가짜 보드").click();
  await page.getByTestId("import-file").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{\"version\": 2}") });
  await expect(page.getByText(/불러오지 못했어요: 지원하지 않는 버전/)).toBeVisible();

  await page.getByRole("link", { name: "자유 코딩" }).click();
  await page.getByRole("button", { name: "보드 연결", exact: true }).click();
  await expect(page.getByTestId("device-status")).toHaveText("연결됨");
});

test("localStorage 가 막힌 브라우저에서도 트랙이 열리고, 저장할 수 없다고 한 번 알려 준다", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("blocked", "SecurityError"); } });
  });
  await page.goto("/#/track/10-auto-door/problem");
  const boxes = page.getByRole("textbox");
  await boxes.nth(0).fill("가");
  await expect(page.getByText("이 브라우저에서는 기록을 저장할 수 없어요")).toHaveCount(1);
  await boxes.nth(1).fill("나");
  await boxes.nth(2).fill("다");
  await completeButton(page).click();
  await expect(page.getByText("완료한 단계예요")).toBeVisible();
  await page.getByRole("link", { name: "다음" }).click();
  await expect(page.getByTestId("step-position")).toHaveText("2 / 14");

  await page.getByRole("link", { name: "설정" }).click();
  await expect(page.getByText(/저장이 막혀 있어/)).toBeVisible();
});
