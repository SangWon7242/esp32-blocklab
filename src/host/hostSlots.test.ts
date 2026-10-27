import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ChapterPage } from "@/app/track/ChapterPage";
import { StepPage } from "@/app/track/StepPage";
import type { StepRecord } from "@/track/progress";
import { renderWithHost } from "./testHost";

/*
 * 머리 줄 끼움 자리 (lib-v1.1.1): 호스트가 넘긴 headerStart·headerEnd 를 챕터·단계 화면 머리 줄의 맨 앞·맨 끝에 그린다.
 * 넘기지 않으면 머리 줄이 예전과 똑같다 (체험판). 저장소를 비동기로 읽는 학생 모드는 서버 렌더에서 빈 화면이라 열람 모드로 그린다.
 */

const CHAPTER = "01-led";
const records: Record<string, StepRecord> = {
  problem: { status: "done", input: { answers: ["a", "b"] }, attempts: 1, updatedAt: "2026-10-16T00:00:00.000Z" },
};
const slots = {
  headerStart: createElement("button", { type: "button", "aria-label": "학생 메뉴 열기" }, "M"),
  headerEnd: createElement("span", { role: "status" }, "저장됨"),
};

const chapter = (extra = {}) => renderWithHost(createElement(ChapterPage, { chapterId: CHAPTER }), { mode: "review", reviewRecords: records, ...extra });
const step = (extra = {}) => renderWithHost(createElement(StepPage, { chapterId: CHAPTER, stepId: "problem" }), { mode: "review", reviewRecords: records, ...extra });

describe("머리 줄 끼움 자리", () => {
  it("챕터 화면: 「챕터 목록」 앞에 headerStart, 줄 끝에 headerEnd", () => {
    const html = chapter({ slots });
    const start = html.indexOf('data-slot="blocklab-header-start"');
    const back = html.indexOf("챕터 목록");
    const end = html.indexOf('data-slot="blocklab-header-end"');
    expect(start).toBeGreaterThan(-1);
    expect(start).toBeLessThan(back);
    expect(end).toBeGreaterThan(back);
    expect(html).toContain('aria-label="학생 메뉴 열기"');
    expect(html).toContain("저장됨");
    // 머리띠(chapter-header) 안이다
    expect(html.indexOf('data-testid="chapter-header"')).toBeLessThan(start);
  });

  it("단계 화면: 돌아가기 링크 앞에 headerStart, 진행 n/m 뒤에 headerEnd", () => {
    const html = step({ slots });
    const start = html.indexOf('data-slot="blocklab-header-start"');
    const back = html.indexOf("단계 목록");
    const position = html.indexOf('data-testid="step-position"');
    const end = html.indexOf('data-slot="blocklab-header-end"');
    expect(start).toBeGreaterThan(-1);
    expect(start).toBeLessThan(back);
    expect(end).toBeGreaterThan(position);
    expect(html.indexOf('data-testid="step-guide"')).toBeGreaterThan(end);
  });

  it("한쪽만 넘기면 그쪽만 그린다", () => {
    const html = step({ slots: { headerEnd: slots.headerEnd } });
    expect(html).not.toContain('data-slot="blocklab-header-start"');
    expect(html).toContain('data-slot="blocklab-header-end"');
  });

  it("넘기지 않으면 머리 줄이 예전과 똑같다 (빈 slots 도 같다)", () => {
    for (const render of [chapter, step]) {
      const html = render();
      expect(html).not.toContain("blocklab-header-");
      expect(render({ slots: {} })).toBe(html);
    }
    // 챕터 목록 단추의 왼쪽 당김은 그대로
    expect(chapter()).toMatch(/class="[^"]*-ml-3[^"]*"[^>]*href="\/t\?track=/);
  });
});
