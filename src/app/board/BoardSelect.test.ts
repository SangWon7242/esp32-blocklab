import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderWithHost } from "@/host/testHost";
import { getChapter, loadChapters } from "@/track/content";
import { BOARD_SELECT_TEXT, BoardSelect, chapterShowsBoardSelect } from "./BoardSelect";

/*
 * 보드 고르는 칸 (react-dom/server): radiogroup 의미, 두 칸의 긴 이름(aria-label), 서버 렌더 기본값 plus, 이모지 없음.
 * 실제로 눌러 바꾸기·방향키는 e2e(e2e/board.spec.ts)가 본다.
 */

const EMOJI = /\p{Extended_Pictographic}/u;

describe("BoardSelect", () => {
  it("radiogroup + 라디오 두 개, plus 가 골라져 있다 (서버 렌더)", () => {
    const html = renderToStaticMarkup(createElement(BoardSelect));
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="ESP32 Plus 확장 보드"');
    expect(html).toContain('aria-label="기본 보드 (DevKit 30핀)"');
    expect(html).toMatch(/aria-checked="true"[^>]*data-testid="board-option-plus"|data-testid="board-option-plus"[^>]*aria-checked="true"/);
    expect(html).toContain('data-board="plus"');
    expect(html).toContain(BOARD_SELECT_TEXT.label);
    // 눈에 보이는 이름과 라디오 그룹이 이어져 있다
    const labelId = /<span id="([^"]+)"/.exec(html)?.[1];
    expect(labelId).toBeTruthy();
    expect(html).toContain(`aria-labelledby="${labelId}"`);
    expect(EMOJI.test(html)).toBe(false);
  });

  it("compact 는 글 라벨 대신 aria-label, 호스트 안에서도 그린다", () => {
    const html = renderWithHost(createElement(BoardSelect, { compact: true }));
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain(`aria-label="${BOARD_SELECT_TEXT.label}"`);
    expect(html).toContain(">Plus<");
    expect(html).toContain(">기본<");
  });

  it("배선도가 있는 챕터에만 보인다", () => {
    expect(chapterShowsBoardSelect(getChapter("10-auto-door")!)).toBe(true);
    expect(loadChapters().filter((c) => c.wiring).every(chapterShowsBoardSelect)).toBe(true);
    // 배선도·기본 보드 그림·captionDevkit·보드별 준비물이 하나도 없으면 숨긴다
    const door = getChapter("10-auto-door")!;
    const plain = { ...door, id: "zz-none", wiring: undefined, materials: [{ name: "LED" }], parts: [{ id: "p", title: "p", steps: [] }] };
    expect(chapterShowsBoardSelect(plain)).toBe(false);
  });
});
