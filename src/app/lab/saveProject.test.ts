import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { renderWithHost } from "@/host/testHost";
import { SaveProjectButton, SaveProjectForm } from "./SaveProjectButton";
import {
  checkProjectTitle, fitTitle, labDefaultTitle, PROJECT_TITLE_MAX, runSaveProject, SAVE_PROJECT_TEXT, stepDefaultTitle, type SaveProjectInput,
} from "./saveProject";

/*
 * 「작품으로 저장」 (lib-v1.0.3): 단추는 호스트 onSaveProject 가 있고 열람 모드가 아닐 때만. 제목은 1~60자(허브 cleanTitle 과 같은 규칙).
 * 저장은 호스트에 { title, code, blocksJson, chapterId? } 를 넘기는 것까지, 실패하면 대화상자 안 role=alert 문구.
 */

const onSaveProject = async (_p: SaveProjectInput) => {};
const program = () => ({ code: "print(1)", blocksJson: { blocks: { blocks: [] } } });
const button = (host: Parameters<typeof renderWithHost>[1], props: Partial<Parameters<typeof SaveProjectButton>[0]> = {}) =>
  renderWithHost(createElement(SaveProjectButton, { getProgram: program, defaultTitle: "자유 코딩 2026-10-17", ...props }), host);

describe("SaveProjectButton 보이기", () => {
  it("호스트 onSaveProject 가 있으면 단추가 보인다", () => {
    const html = button({ onSaveProject });
    expect(html).toContain('data-testid="save-project-button"');
    expect(html).toContain(`aria-label="${SAVE_PROJECT_TEXT.button}"`);
    expect(html).not.toContain('disabled=""');
  });

  it("onSaveProject 가 없으면(체험판) 없다", () => {
    expect(button({})).not.toContain("save-project-button");
  });

  it("열람(review) 모드에는 없다", () => {
    expect(button({ onSaveProject, mode: "review", reviewRecords: {} })).not.toContain("save-project-button");
  });

  it("demo 모드에서도 호스트가 저장을 주면 보인다", () => {
    expect(button({ onSaveProject, mode: "demo" })).toContain("save-project-button");
  });
});

describe("SaveProjectForm 상태", () => {
  const form = (over: Partial<Parameters<typeof SaveProjectForm>[0]> = {}) =>
    renderToStaticMarkup(createElement(SaveProjectForm, { title: "깜빡이", status: "idle", invalid: null, onTitleChange() {}, onSubmit() {}, onCancel() {}, ...over }));

  it("처음: 제목이 채워져 있고 저장 단추가 켜져 있다", () => {
    const html = form();
    expect(html).toContain('value="깜빡이"');
    expect(html).toContain(`3/${PROJECT_TITLE_MAX}`);
    expect(html).toContain(SAVE_PROJECT_TEXT.save);
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('role="alert"');
  });

  it("저장 중: 단추가 꺼지고 aria-busy, '저장 중'", () => {
    const html = form({ status: "saving" });
    expect(html).toContain('data-status="saving"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(SAVE_PROJECT_TEXT.saving);
    expect(html).toMatch(/type="submit" disabled="" aria-busy="true"/);
  });

  it("실패: 대화상자 안에 role=alert 실패 문구, 다시 누를 수 있다", () => {
    const html = form({ status: "failed" });
    expect(html).toContain('role="alert"');
    expect(html).toContain(SAVE_PROJECT_TEXT.failed);
    expect(SAVE_PROJECT_TEXT.failed).toBe("저장하지 못했어요. 잠시 뒤 다시 해 보세요.");
    expect(html).not.toContain('disabled=""');
  });

  it("제목 검사에 걸리면 칸이 aria-invalid 이고 까닭 문구", () => {
    const empty = form({ title: "  ", invalid: "empty" });
    expect(empty).toContain('aria-invalid="true"');
    expect(empty).toContain(SAVE_PROJECT_TEXT.emptyTitle);
    const long = form({ title: "가".repeat(61), invalid: "long" });
    expect(long).toContain(SAVE_PROJECT_TEXT.longTitle);
    expect(long).toContain(`61/${PROJECT_TITLE_MAX}`);
  });
});

describe("제목 검사 (1~60자)", () => {
  it("앞뒤 빈칸을 덜고 줄바꿈·연속 빈칸을 한 칸으로", () => {
    expect(checkProjectTitle("  내   첫\n작품 ")).toEqual({ ok: true, title: "내 첫 작품" });
  });

  it("빈 제목·빈칸만은 안 된다", () => {
    expect(checkProjectTitle("")).toEqual({ ok: false, reason: "empty" });
    expect(checkProjectTitle(" \n\t ")).toEqual({ ok: false, reason: "empty" });
  });

  it("1자와 60자는 되고 61자는 안 된다 (한글 한 자도 한 자)", () => {
    expect(checkProjectTitle("가")).toEqual({ ok: true, title: "가" });
    expect(checkProjectTitle("가".repeat(60))).toMatchObject({ ok: true });
    expect(checkProjectTitle("가".repeat(61))).toEqual({ ok: false, reason: "long" });
  });

  it("서로게이트 쌍 글자도 한 자로 센다", () => {
    expect(checkProjectTitle("\u{20BB7}".repeat(60))).toMatchObject({ ok: true });
  });
});

describe("기본 제목", () => {
  it("자유 코딩: '자유 코딩 YYYY-MM-DD'", () => {
    expect(labDefaultTitle(new Date(2026, 9, 7))).toBe("자유 코딩 2026-10-07");
  });

  it("단계: '<챕터 제목> — <단계 제목>', 60자를 넘으면 자른다", () => {
    expect(stepDefaultTitle("LED 켜기", "미션: 깜빡이기")).toBe("LED 켜기 — 미션: 깜빡이기");
    const long = stepDefaultTitle("가".repeat(40), "나".repeat(40));
    expect([...long].length).toBeLessThanOrEqual(PROJECT_TITLE_MAX);
    expect(checkProjectTitle(long).ok).toBe(true);
    expect(fitTitle("  a  b ")).toBe("a b");
  });
});

describe("저장 흐름 (runSaveProject)", () => {
  it("호스트에 제목·코드·블록을 넘기고 saved", async () => {
    const save = vi.fn(async (_p: SaveProjectInput) => {});
    expect(await runSaveProject(save, { title: "깜빡이", code: "x", blocksJson: { a: 1 } })).toBe("saved");
    expect(save).toHaveBeenCalledWith({ title: "깜빡이", code: "x", blocksJson: { a: 1 } });
  });

  it("챕터 단계면 chapterId 를 함께, 블록이 없으면 null", async () => {
    const save = vi.fn(async (_p: SaveProjectInput) => {});
    await runSaveProject(save, { title: "t", code: "x", blocksJson: undefined, chapterId: "01-led" });
    expect(save).toHaveBeenCalledWith({ title: "t", code: "x", blocksJson: null, chapterId: "01-led" });
  });

  it("호스트가 throw 하면 failed (라이브러리는 토스트를 띄우지 않는다)", async () => {
    const save = vi.fn(async () => {
      throw new Error("413");
    });
    expect(await runSaveProject(save, { title: "t", code: "x", blocksJson: null })).toBe("failed");
  });
});

describe("문구", () => {
  it("방향어·이모지가 없다", () => {
    for (const text of Object.values(SAVE_PROJECT_TEXT)) {
      expect(text).not.toMatch(/아래|위쪽|위에|위의|왼쪽|오른쪽/);
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
