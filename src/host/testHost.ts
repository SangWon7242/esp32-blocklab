import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyProgress, type Progress, type ProgressStore, type StepRecord } from "@/track/progress";
import { BlocklabProvider, type HostProps } from "./HostContext";

/*
 * 테스트용 가짜 호스트. 화면을 react-dom/server 로 그려 볼 때 BlocklabProvider 를 채운다 (testing-library 없음).
 * 저장소는 메모리에만 두고 무엇을 저장했는지 기록한다.
 */

export class MemoryProgressStore implements ProgressStore {
  progress: Progress = emptyProgress();
  readonly saved: { chapterId: string; stepId: string; record: StepRecord }[] = [];
  async load() {
    return this.progress;
  }
  async saveStep(chapterId: string, stepId: string, record: StepRecord) {
    this.saved.push({ chapterId, stepId, record });
    (this.progress.chapters[chapterId] ??= {})[stepId] = record;
  }
  async saveLabProject(lab: unknown) {
    this.progress.lab = lab;
  }
  async exportJson() {
    return JSON.stringify(this.progress);
  }
  async importJson() {}
  async clear() {
    this.progress = emptyProgress();
  }
}

export const fakeNav: HostProps["nav"] = {
  href: { track: () => "/t", chapter: (id) => `/t/${id}`, step: (id, s) => `/t/${id}/${s}`, lab: () => "/lab" },
  go: () => {},
};

export function fakeHost(over: Partial<HostProps> = {}): HostProps {
  return {
    user: null,
    mode: "student",
    store: new MemoryProgressStore(),
    settings: { teacherMode: false, fakeBoard: true, explainGate: false },
    nav: fakeNav,
    ...over,
  };
}

/** 가짜 호스트 안에서 서버 렌더 */
export function renderWithHost(element: ReactElement, over: Partial<HostProps> = {}): string {
  return renderToStaticMarkup(createElement(BlocklabProvider, { ...fakeHost(over), children: element }));
}
