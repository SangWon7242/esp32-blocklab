import { expect, test, type Locator, type Page } from "@playwright/test";

/*
 * 보드를 바꿀 때 3D 시뮬레이션 (회귀 시험):
 *   - 3D 보기(WebGL 캔버스)는 하나 그대로 — 보드마다 새로 만들지 않는다 (만들 때마다 멈칫했다)
 *   - 그린 화면마다 3D 장면에 든 보드(data-drawn-boards)는 한 보드 것만 — 이전 보드가 남거나 겹친 프레임이 없다
 *   - 한 번 본 보드로 돌아가면 기다림(준비 중 표시) 없이 바로
 */

const DRAWN: Record<string, string> = { plus: "plus", devkit: "devkit", expansion: "expansion,devkit@expansion" };

/** 프레임마다 3D 보기 칸의 상태를 적는다 (캔버스 수 · 같은 캔버스인지 · 그린 보드 · 준비 중) */
async function watchFrames(page: Page, root: string) {
  await page.evaluate((sel) => {
    const w = window as unknown as { __frames: { canvases: number; same: boolean; drawn: string; pending: boolean }[]; __canvas?: HTMLCanvasElement };
    w.__frames = [];
    const tick = () => {
      const host = document.querySelector(sel);
      const view = host?.querySelector<HTMLElement>("[data-testid=wiring-3d]");
      const cs = host ? [...host.querySelectorAll("canvas")] : [];
      if (!w.__canvas && cs[0]) w.__canvas = cs[0];
      w.__frames.push({ canvases: cs.length, same: cs[0] === w.__canvas, drawn: view?.dataset.drawnBoards ?? "", pending: view?.dataset.pending === "true" });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, root);
}

const frames = (page: Page) => page.evaluate(() => (window as unknown as { __frames: { canvases: number; same: boolean; drawn: string; pending: boolean }[] }).__frames.splice(0));

async function switchTo(page: Page, view: Locator, board: string) {
  await page.getByTestId(`board-option-${board}`).first().click();
  await expect(view).toHaveAttribute("data-drawn-boards", DRAWN[board], { timeout: 20_000 });
  await expect(view).not.toHaveAttribute("data-pending", "true");
}

/** 그린 보드가 바뀐 차례 (빈 장면 · 같은 것 되풀이는 뺀다) */
function boardSeq(fs: { drawn: string }[]): string[] {
  const seq: string[] = [];
  for (const f of fs) if (f.drawn && f.drawn !== seq[seq.length - 1]) seq.push(f.drawn);
  return seq;
}

function expectClean(fs: { canvases: number; same: boolean; drawn: string; pending: boolean }[], label: string) {
  expect(fs.length, label).toBeGreaterThan(0);
  // 캔버스는 늘 하나, 처음 그 캔버스
  expect(fs.filter((f) => f.canvases !== 1 || !f.same), `${label}: 캔버스를 새로 만들었다`).toEqual([]);
  // 한 프레임에 두 보드 장면이 섞이지 않는다 (빈 것은 준비 중)
  const allowed = new Set(["", ...Object.values(DRAWN)]);
  expect(fs.filter((f) => !allowed.has(f.drawn)).map((f) => f.drawn), `${label}: 보드가 섞인 프레임`).toEqual([]);
}

test("챕터 작업대: 보드를 바꿔도 캔버스 하나, 이전 보드가 남지 않고, 본 보드는 바로", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => { localStorage.setItem("esp32-blocklab:3d", "on"); localStorage.removeItem("esp32-blocklab:board"); });
  await page.goto("/#/track/01-led");
  const stage = page.getByTestId("chapter-stage");
  const view = stage.getByTestId("wiring-3d");
  await expect(view).toHaveAttribute("data-drawn-boards", "plus", { timeout: 30_000 });
  await watchFrames(page, "[data-testid=chapter-stage]");

  // 처음 보는 보드: 준비 중 표시를 지나 한 번에 새 보드
  let prev = "plus";
  for (const b of ["devkit", "expansion", "plus"]) {
    await switchTo(page, view, b);
    const fs = await frames(page);
    expectClean(fs, `처음 ${b}`);
    // 이전 보드 → (준비 중) → 고른 보드, 한 번만 바뀐다 (임시로 그린 보드나 다른 보드가 끼지 않는다)
    expect(boardSeq(fs), `처음 ${b}`).toEqual(boardSeq(fs).length === 2 ? [DRAWN[prev], DRAWN[b]] : [DRAWN[b]]);
    prev = b;
  }
  // 이미 본 보드로: 준비 중 없이 바로, 그린 보드는 이전 것 → 새 것 한 번만 바뀐다
  for (const b of ["devkit", "expansion", "plus", "expansion"]) {
    await switchTo(page, view, b);
    const fs = await frames(page);
    expectClean(fs, `다시 ${b}`);
    expect(fs.filter((f) => f.pending).length, `다시 ${b}: 준비 중이 보였다`).toBe(0);
    const seq = boardSeq(fs);
    // 이전 보드 → 고른 보드, 한 번만 바뀐다 (사이에 다른 보드 · 빈 장면이 끼지 않는다)
    expect(seq, `다시 ${b}`).toEqual(seq.length === 2 ? [DRAWN[prev], DRAWN[b]] : [DRAWN[b]]);
    expect(fs.filter((f) => !f.drawn).length, `다시 ${b}: 빈 장면이 그려졌다`).toBe(0);
    prev = b;
  }
});

test("단계 화면 배선 그림의 3D 탭: 보드를 바꿔도 캔버스 하나, 이전 보드가 남지 않는다", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => { localStorage.setItem("esp32-blocklab:3d", "on"); localStorage.removeItem("esp32-blocklab:board"); });
  await page.goto("/#/track/01-led/problem");
  await page.getByTestId("step-kit").getByRole("button", { name: "부품과 배선" }).click();
  const figure = page.getByTestId("wiring-figure");
  await figure.getByTestId("wiring-3d-tab").click();
  const view = figure.getByTestId("wiring-3d").first();
  await expect(view).toHaveAttribute("data-drawn-boards", "plus", { timeout: 30_000 });
  await watchFrames(page, "[data-testid=wiring-figure]");
  for (const b of ["expansion", "devkit", "plus", "expansion"]) {
    await switchTo(page, view, b);
    expectClean(await frames(page), `단계 ${b}`);
  }
});
