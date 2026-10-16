import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderWithHost } from "@/host/testHost";
import { isEditorStep } from "@/track/completion";
import { getChapter } from "@/track/content";
import { allSteps } from "@/track/gating";
import { SAVE_PROJECT_TEXT } from "../lab/saveProject";
import { ProjectSaveTargetContext, projectSaveTarget, TrackSaveButton } from "./TrackSaveButton";

/*
 * 챕터 단계의 「작품으로 저장」 (lib-v1.0.3): 단계 화면이 알려 준 챕터·단계가 있고, 호스트 onSaveProject 가 있고,
 * 열람 모드가 아닐 때만. 기본 제목 "<챕터 제목> — <단계 제목>", 저장 때 chapterId 를 함께 넘긴다.
 */

const onSaveProject = async () => {};
const getProgram = () => ({ code: "", blocksJson: null });
const led = getChapter("01-led")!;
const mission = allSteps(led).find((s) => s.type === "mission")!;

function render(host: Parameters<typeof renderWithHost>[1], inStep = true) {
  const btn = createElement(TrackSaveButton, { getProgram });
  const el = inStep ? createElement(ProjectSaveTargetContext.Provider, { value: projectSaveTarget(led, mission) }, btn) : btn;
  return renderWithHost(el, host);
}

describe("TrackSaveButton 보이기", () => {
  it("단계 화면 안 + onSaveProject 가 있으면 보인다", () => {
    const html = render({ onSaveProject });
    expect(html).toContain('data-testid="save-project-button"');
    expect(html).toContain(SAVE_PROJECT_TEXT.button);
  });

  it("onSaveProject 가 없으면(체험판) 없다", () => {
    expect(render({})).not.toContain("save-project-button");
  });

  it("열람 모드에는 없다", () => {
    expect(render({ onSaveProject, mode: "review", reviewRecords: {} })).not.toContain("save-project-button");
  });

  it("단계 화면 밖(저장 대상을 모르면)에는 없다", () => {
    expect(render({ onSaveProject }, false)).not.toContain("save-project-button");
  });
});

describe("projectSaveTarget", () => {
  it("챕터 id 와 '<챕터 제목> — <단계 제목>'", () => {
    expect(projectSaveTarget(led, mission)).toEqual({ chapterId: "01-led", defaultTitle: `${led.title} — ${mission.title}` });
  });

  it("편집기 단계(run·mission·debug·design)의 기본 제목이 모두 1~60자", () => {
    const types = new Set<string>();
    for (const id of ["01-led", "10-auto-door"]) {
      const chapter = getChapter(id)!;
      for (const step of allSteps(chapter).filter((s) => isEditorStep(s))) {
        types.add(step.type);
        const { defaultTitle } = projectSaveTarget(chapter, step);
        expect([...defaultTitle].length).toBeGreaterThan(0);
        expect([...defaultTitle].length).toBeLessThanOrEqual(60);
      }
    }
    expect(types.size).toBeGreaterThan(0);
  });
});
