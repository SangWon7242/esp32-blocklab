import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChapterPage } from "@/app/track/ChapterPage";
import { StepPage } from "@/app/track/StepPage";
import { Reflect } from "@/app/track/steps/Reflect";
import { TrackPage } from "@/app/track/TrackPage";
import { getChapter } from "@/track/content";
import { allSteps } from "@/track/gating";
import type { StepRecord } from "@/track/progress";
import { MISSING_HOST_MESSAGE, useHost, withQuery, type AiClient } from "./HostContext";
import { MemoryProgressStore, renderWithHost } from "./testHost";

/*
 * 호스트 어댑터: Provider 가 없으면 바로 알리고, review(열람) 모드는 학생 기록을 저장 없이 모든 단계를 열어 보여 준다.
 * 화면은 react-dom/server 로 그린다 (testing-library 없음).
 */

const CHAPTER = "01-led";
const now = "2026-10-16T00:00:00.000Z";
const rec = (input: Record<string, unknown>, status: StepRecord["status"] = "done"): StepRecord => ({ status, input, attempts: 1, updatedAt: now });

const records: Record<string, StepRecord> = {
  problem: rec({ answers: ["불이 깜빡이면 신호를 보낼 수 있어요", "1초마다"] }),
  mission: rec({ program: { code: "from machine import Pin\nled = Pin(2, Pin.OUT)\n", blocksJson: null }, passed: true, failures: [], judgedCode: "x" }),
  reflect: rec({ lines: { 1: "핀을 가져온다" }, prompts: ["들여쓰기"] }, "open"),
};

const fakeAi: AiClient = {
  reflect: async () => ({ correct: [], missing: [], questions: ["?"] }),
  debug: async () => ({ correct: [], missing: [], questions: ["?"] }),
};

describe("BlocklabProvider 가 없을 때", () => {
  it("useHost 는 분명한 오류를 낸다", () => {
    function Probe() {
      useHost();
      return null;
    }
    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(MISSING_HOST_MESSAGE);
    expect(() => renderToStaticMarkup(createElement(TrackPage))).toThrow(MISSING_HOST_MESSAGE);
  });
});

describe("withQuery", () => {
  it("?·& 를 가려 붙이고 값의 / 는 그대로 둔다", () => {
    expect(withQuery("#/lab", { code: "01-led/led.py" })).toBe("#/lab?code=01-led/led.py");
    expect(withQuery("/x?a=1", { track: "fusion", none: undefined })).toBe("/x?a=1&track=fusion");
    expect(withQuery("/x", {})).toBe("/x");
  });
});

describe("review(열람) 모드", () => {
  const chapter = getChapter(CHAPTER)!;

  it("챕터 화면: 열람 배지, 모든 단계 열림, 기록은 reviewRecords 에서", () => {
    const store = new MemoryProgressStore();
    const html = renderWithHost(createElement(ChapterPage, { chapterId: CHAPTER }), { mode: "review", reviewRecords: records, store });
    expect(html).toContain('data-testid="review-badge"');
    expect(html).toContain("열람 모드");
    expect(html).not.toContain("교사 모드 — 모든 단계가 열려 있어요");
    for (const step of allSteps(chapter)) {
      const m = html.match(new RegExp(`data-testid="step-row-${step.id}" data-state="([a-z]+)"`));
      expect(m, step.id).not.toBeNull();
      expect(m![1], step.id).not.toBe("locked");
    }
    expect(html).toMatch(/data-testid="step-row-problem" data-state="done"/);
    expect(html).toContain("기록 보기");
    expect(store.saved).toHaveLength(0);
  });

  it("단계 화면(글): 배지·끈 입력·학생 글, 완료·건너뛰기 없음, 저장 없음", () => {
    const store = new MemoryProgressStore();
    const html = renderWithHost(createElement(StepPage, { chapterId: CHAPTER, stepId: "problem" }), { mode: "review", reviewRecords: records, store });
    expect(html).toContain('data-testid="review-badge"');
    expect(html).toContain('data-testid="review-activity"');
    expect(html).toMatch(/<fieldset disabled/);
    expect(html).toContain("불이 깜빡이면 신호를 보낼 수 있어요");
    expect(html).not.toContain("완료</button>");
    expect(html).not.toContain("건너뛰기");
    expect(html).toContain("완료한 단계예요");
    expect(store.saved).toHaveLength(0);
  });

  it("단계 화면(미션): 판정 버튼 대신 결과, 편집기 대신 저장한 코드", () => {
    const html = renderWithHost(createElement(StepPage, { chapterId: CHAPTER, stepId: "mission" }), { mode: "review", reviewRecords: records });
    expect(html).not.toContain("판정</button>");
    expect(html).toContain("통과했어요");
    expect(html).toContain("저장한 프로그램");
    expect(html).not.toContain('data-testid="track-editor"');
  });

  it("단계 화면(성찰): AI 가 있어도 버튼은 숨고 기록이 없는 단계도 열린다", () => {
    const html = renderWithHost(createElement(StepPage, { chapterId: CHAPTER, stepId: "reflect" }), { mode: "review", reviewRecords: records, ai: fakeAi });
    expect(html).not.toContain("내 설명 점검 받기");
    expect(html).toContain("핀을 가져온다");
    expect(html).toContain('data-testid="step-not-done"');
  });
});

describe("AI 점검 버튼", () => {
  it("학생 모드: 호스트 ai 가 없으면 숨고, 있으면 보인다", () => {
    const html = (ai?: AiClient) => renderWithHost(createElement(ReflectProbe), { ai });
    expect(html(undefined)).not.toContain("내 설명 점검 받기");
    expect(html(fakeAi)).toContain("내 설명 점검 받기");
  });
});

/** 성찰 단계 활동만 (StepPage 는 저장소를 비동기로 읽어 서버 렌더에서는 빈 화면이므로) */
function ReflectProbe() {
  const chapter = getChapter(CHAPTER)!;
  const step = allSteps(chapter).find((s) => s.type === "reflect")!;
  return createElement(Reflect, { step: step as never, chapter, input: {}, onInput: () => {}, teacherMode: false, attempts: 0, onComplete: () => {} });
}
