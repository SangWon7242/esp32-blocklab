import { expect, test, type Page } from "@playwright/test";

const KEY = "esp32-blocklab:v1";
const SETTINGS = "esp32-blocklab:settings";
const CHAPTER = "10-auto-door";

/** 앞 단계들을 끝낸 기록(과 설정)으로 시작한다 (첫 로드 때만 깐다 — 화면에서 저장한 것을 덮지 않게) */
async function seedDone(page: Page, stepIds: string[], settings?: Record<string, unknown>) {
  const records = Object.fromEntries(
    stepIds.map((id) => [id, { status: "done", input: {}, attempts: 0, updatedAt: "2026-10-14T00:00:00.000Z" }]),
  );
  const progress = JSON.stringify({ version: 1, chapters: { [CHAPTER]: records } });
  await page.addInitScript(([key, value, settingsKey, settingsValue]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(key, value);
      if (settingsValue) localStorage.setItem(settingsKey, settingsValue);
      sessionStorage.setItem("seeded", "1");
    }
  }, [KEY, progress, SETTINGS, settings ? JSON.stringify(settings) : ""] as const);
}

/** 가짜 보드로 단계를 연다 */
async function openStep(page: Page, stepId: string) {
  await page.goto(`/#/track/${CHAPTER}/${stepId}?device=fake`);
  await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
}

/** 코드 모드에서 코드를 통째로 바꾼다 (자동 들여쓰기 없이 글 그대로 넣는다) */
async function replaceCode(page: Page, text: string) {
  await page.getByRole("tab", { name: "코드" }).click();
  await page.getByTestId("code-panel").locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(text);
}

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

test("실행 단계: 지정 코드가 실려 있고, 가짜 보드에서 실행하면 완료된다", async ({ page }) => {
  await seedDone(page, ["problem", "analysis", "predict"]);
  await openStep(page, "run1");
  await expect(page.getByTestId("code-panel")).toContainText("def get_distance():");
  // 트랙에서는 보드에 저장하지 않는다
  await expect(button(page, "보드에 저장")).toHaveCount(0);
  // 체험판에는 「작품으로 저장」도 없다 (호스트 onSaveProject 없음, lib-v1.0.3)
  await expect(page.getByTestId("save-project-button")).toHaveCount(0);
  await expect(button(page, "완료")).toBeDisabled();

  await button(page, "보드 연결").click();
  await expect(page.getByTestId("device-status")).toHaveText("연결됨");
  await button(page, "실행").click();
  await expect(page.getByText("완료한 단계예요")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("실행에 성공했어요")).toBeVisible();
  await expect(page.getByRole("link", { name: "다음" })).toBeVisible();
});

test("미션 단계: 판정 실패 → 힌트 → 코드 모드에서 고치기 → 통과 → 완료, 다시 열면 고친 코드가 남아 있다", async ({ page }) => {
  await seedDone(page, ["problem", "analysis", "predict", "run1", "readcheck1"]);
  await openStep(page, "mission1");
  await expect(page.getByText("15cm보다 가까워지면")).toBeVisible();
  // 힌트는 판정에 실패한 뒤에만
  await expect(page.getByTestId("mission-hint")).toHaveCount(0);
  await expect(button(page, "완료")).toBeDisabled();

  await button(page, "판정").click();
  const failures = page.getByTestId("judge-failures");
  await expect(failures).toContainText("거리를 판단하는 if 줄이 있나요?");
  await expect(failures).toContainText("가까울 때 찍을 말이 '가까워요!' 인가요?");
  await expect(page.getByTestId("mission-hint")).toContainText("한 칸 더 들여쓰기");
  await expect(button(page, "완료")).toBeDisabled();

  await replaceCode(page, 'd = 20\nif d < 15:\n    print("가까워요!")\n');
  await button(page, "판정").click();
  await expect(page.getByText("통과했어요")).toBeVisible();
  await expect(failures).toHaveCount(0);
  await expect(button(page, "완료")).toBeEnabled();
  await button(page, "완료").click();
  await expect(page.getByText("완료한 단계예요")).toBeVisible();

  // 저장한 프로그램을 다시 연다
  await page.reload();
  await expect(page.getByTestId("code-panel")).toContainText('print("가까워요!")');
});

test("미션 단계: 통과한 판정에 주의(기다리기 없는 반복·준비만 한 장치)가 붙어도 완료는 그대로 된다", async ({ page }) => {
  await seedDone(page, ["problem", "analysis", "predict", "run1", "readcheck1"]);
  await openStep(page, "mission1");
  await expect(page.getByTestId("judge-notes")).toHaveCount(0);

  // 규칙은 통과하지만 trig 를 준비만 하고, 반복 안에 기다리기가 없다
  await replaceCode(page, 'from machine import Pin\ntrig = Pin(13, Pin.OUT)\nd = 20\nwhile True:\n    if d < 15:\n        print("가까워요!")\n');
  await button(page, "판정").click();
  await expect(page.getByText("통과했어요")).toBeVisible();
  await expect(page.getByTestId("judge-failures")).toHaveCount(0);
  const notes = page.getByTestId("judge-notes");
  await expect(notes).toContainText("주의 (통과에는 영향 없음)");
  await expect(notes).toContainText("반복 안에 기다리기가 없으면 보드가 바빠져요");
  await expect(notes).toContainText("trig 는 준비만 하고 쓰지 않았어요");
  await expect(button(page, "완료")).toBeEnabled();
});

test("디버깅 단계: 설명을 저장하기 전에는 잠겨 있고, 저장하면 고장 코드가 실린 편집기로 고쳐서 통과한다", async ({ page }) => {
  await seedDone(page, ["problem", "analysis", "predict", "run1", "readcheck1", "mission1"]);
  await page.goto(`/#/track/${CHAPTER}/debug1?device=fake`);

  const fixes = [
    "trig = Pin(13, Pin.OUT)\necho = Pin(12, Pin.IN)\n",
    'if d < 15:\n    print("가까워요!")\n',
    "trig.value(1)\ntime.sleep_us(10)\ntrig.value(0)\n",
  ];
  for (let i = 0; i < fixes.length; i++) {
    await page.getByRole("tab", { name: `증상 ${i + 1}` }).click();
    await expect(page.getByTestId("editor-locked")).toBeVisible();
    await expect(page.getByTestId("track-editor")).toHaveCount(0);
    await expect(button(page, "설명 저장")).toBeDisabled();
    await page.getByLabel("왜 이런 증상일까?").fill(`증상 ${i + 1} 에 대한 내 생각`);
    await button(page, "설명 저장").click();

    await expect(page.getByTestId("editor-locked")).toHaveCount(0);
    await expect(page.getByTestId("blockly-host").locator(".blocklyMainBackground")).toBeVisible();
    if (i === 0) {
      // 고장 코드가 실려 있고, 그대로 판정하면 되묻기 문장이 나온다
      await expect(page.getByTestId("code-panel")).toContainText("trig = Pin(12, Pin.OUT)");
      await button(page, "판정").click();
      await expect(page.getByTestId("judge-failures")).toContainText("쏘는 선과 듣는 선");
      await expect(button(page, "완료")).toBeDisabled();
    }
    await replaceCode(page, fixes[i]);
    await button(page, "판정").click();
    await expect(page.getByTestId("judge-failures")).toHaveCount(0);
    await expect(page.getByText(/이 증상은 고쳤어요|모든 증상을 고쳤어요/)).toBeVisible();
  }
  await expect(page.getByText("모든 증상을 고쳤어요")).toBeVisible();
  await button(page, "완료").click();
  await expect(page.getByText("완료한 단계예요")).toBeVisible();
});

test("미션 단계 + 설명 관문: 설정을 켜면 판정 통과만으로는 완료되지 않고(확인 대기), 교사 모드에서 설명 확인을 누르면 완료된다", async ({ page }) => {
  await seedDone(page, ["problem", "analysis", "predict", "run1", "readcheck1"], { explainGate: true });
  await openStep(page, "mission1");
  await replaceCode(page, 'd = 20\nif d < 15:\n    print("가까워요!")\n');
  await button(page, "판정").click();

  // 통과 문구가 관문 문구로 바뀌고, 학생에게는 대기 배지만 보인다. 완료는 아직 못 누른다
  const gateText = page.getByText("통과했어요. 선생님께 1분 설명을 하고 확인을 받아요");
  await expect(gateText).toBeVisible();
  await expect(page.getByTestId("judge-failures")).toHaveCount(0);
  await expect(page.getByTestId("explain-gate")).toContainText("선생님 확인 대기");
  await expect(button(page, "설명 확인")).toHaveCount(0);
  await expect(button(page, "완료")).toBeDisabled();
  await expect(page.getByTestId("step-awaiting")).toHaveText("확인 대기");

  // 챕터 단계 목록에서도 "확인 대기" 로 구분된다
  await page.goto(`/#/track/${CHAPTER}`);
  const row = page.getByTestId("step-row-mission1");
  await expect(row).toHaveAttribute("data-state", "awaiting");
  await expect(row).toContainText("확인 대기");

  // 교사 모드를 켜고 돌아오면 "설명 확인" 버튼이 보인다
  await page.goto("/#/settings");
  await page.getByLabel("교사 모드").click();
  await openStep(page, "mission1");
  await expect(gateText).toBeVisible();
  await button(page, "설명 확인").click();
  await expect(page.getByTestId("explain-confirmed")).toContainText("선생님 확인 완료");
  await expect(page.getByText("통과했어요. 아래 완료를 누르세요.")).toBeVisible();
  await expect(page.getByTestId("step-awaiting")).toHaveCount(0);
  await expect(button(page, "완료")).toBeEnabled();
  await button(page, "완료").click();
  await expect(page.getByText("완료한 단계예요")).toBeVisible();

  await page.goto(`/#/track/${CHAPTER}`);
  await expect(row).toHaveAttribute("data-state", "done");
});
