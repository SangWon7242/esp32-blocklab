import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderWithHost } from "@/host/testHost";
import { getChapter } from "@/track/content";
import { allSteps, stepStates, type StepState } from "@/track/gating";
import { emptyProgress, type Progress, type StepRecord } from "@/track/progress";
import type { ChapterSnapshot } from "@/track/snapshot";
import { canSubmitChapter, SUBMIT_TEXT, SubmitCard, SubmitCardView } from "./SubmitCard";

/*
 * 제출 카드: 호스트 onSubmit 이 있고 필수 단계를 모두 끝냈을 때만 보인다. 상태별 문구는 SubmitCardView 로 본다 (react-dom/server).
 */

const now = "2026-10-16T02:00:00.000Z";
const rec = (status: StepRecord["status"], input: Record<string, unknown> = {}): StepRecord => ({ status, input, attempts: 1, updatedAt: now });

/** 챕터의 모든 단계를 done 으로 (except 는 open) */
function doneRecords(chapterId: string, except: string[] = []): Record<string, StepRecord> {
  const chapter = getChapter(chapterId)!;
  return Object.fromEntries(allSteps(chapter).map((s) => [s.id, rec(except.includes(s.id) ? "open" : "done", s.type === "mission" ? { program: { code: "x" } } : {})]));
}

function progressOf(chapterId: string, records: Record<string, StepRecord>): Progress {
  const p = emptyProgress();
  p.chapters[chapterId] = records;
  return p;
}

function render(chapterId: string, records: Record<string, StepRecord>, host: Parameters<typeof renderWithHost>[1] = {}, explainGate = false) {
  const chapter = getChapter(chapterId)!;
  const states = stepStates(chapter, records, false, { explainGate });
  return renderWithHost(createElement(SubmitCard, { chapter, states, progress: progressOf(chapterId, records) }), host);
}

const onSubmit = async (_id: string, _snap: ChapterSnapshot) => {};
/** 카드가 없다 (renderWithHost 는 .blocklab 루트 div 를 남긴다) */
const hidden = (html: string) => !html.includes("submit-card");

describe("canSubmitChapter", () => {
  it("필수 단계가 모두 done 이면 참, 선택 단계는 보지 않는다", () => {
    const door = getChapter("10-auto-door")!;
    const allDone = Object.fromEntries(allSteps(door).map((s) => [s.id, "done" as StepState]));
    expect(canSubmitChapter(door, allDone)).toBe(true);
    expect(canSubmitChapter(door, { ...allDone, debug2: "open", extra: "locked" })).toBe(true);
    expect(canSubmitChapter(door, { ...allDone, mission1: "awaiting" })).toBe(false);
    expect(canSubmitChapter(door, { ...allDone, reflect: "open" })).toBe(false);
  });
});

describe("SubmitCard 보이기", () => {
  it("onSubmit 이 있고 모두 끝냈으면 제출 버튼", () => {
    const html = render("01-led", doneRecords("01-led"), { onSubmit });
    expect(html).toContain('data-testid="submit-card"');
    expect(html).toContain('data-status="idle"');
    expect(html).toContain(SUBMIT_TEXT.title);
    expect(html).toContain(SUBMIT_TEXT.ready);
    expect(html).toMatch(/<button[^>]*>(?:(?!<\/button>).)*제출<\/button>/);
    expect(html).not.toContain(SUBMIT_TEXT.resubmit);
  });

  it("호스트 onSubmit 이 없으면(체험판) 없다", () => {
    expect(hidden(render("01-led", doneRecords("01-led")))).toBe(true);
  });

  it("열람 모드에는 없다", () => {
    expect(hidden(render("01-led", doneRecords("01-led"), { onSubmit, mode: "review", reviewRecords: doneRecords("01-led") }))).toBe(true);
  });

  it("필수 단계가 하나라도 남았으면 없다", () => {
    expect(hidden(render("01-led", doneRecords("01-led", ["reflect"]), { onSubmit }))).toBe(true);
  });

  it("설명 관문이 켜져 미션이 확인 대기면(판정은 통과) 없다", () => {
    const records = doneRecords("01-led");
    records.mission = rec("open", { program: { code: "x" }, passed: true });
    expect(hidden(render("01-led", records, { onSubmit }, true))).toBe(true);
  });

  it("선택 단계는 끝내지 않아도 보인다", () => {
    const html = render("10-auto-door", doneRecords("10-auto-door", ["debug2", "extra"]), { onSubmit });
    expect(html).toContain('data-testid="submit-card"');
  });
});

describe("SubmitCardView 상태 문구", () => {
  const view = (status: Parameters<typeof SubmitCardView>[0]["status"], submittedAt?: string) =>
    renderToStaticMarkup(createElement(SubmitCardView, { status, submittedAt, onSubmit: () => {} }));

  it("제출 중: 버튼이 꺼지고 '제출 중'", () => {
    const html = view("submitting");
    expect(html).toContain('data-status="submitting"');
    expect(html).toContain(SUBMIT_TEXT.submitting);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
  });

  it("제출 뒤: '제출했어요' 와 '다시 제출' 버튼", () => {
    const html = view("done", now);
    expect(html).toContain(SUBMIT_TEXT.done);
    expect(html).toContain(SUBMIT_TEXT.resubmit);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('disabled=""');
  });

  it("실패: 실패 문구와 '다시 제출' 버튼", () => {
    const html = view("failed");
    expect(html).toContain(SUBMIT_TEXT.failed);
    expect(html).toContain(SUBMIT_TEXT.resubmit);
    expect(html).toContain('role="alert"');
  });

  it("문구에 방향어·이모지가 없다", () => {
    for (const text of Object.values(SUBMIT_TEXT)) {
      expect(text).not.toMatch(/아래|위쪽|위에|위의|왼쪽|오른쪽/);
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
