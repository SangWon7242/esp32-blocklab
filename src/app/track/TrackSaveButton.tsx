import { createContext, useContext } from "react";
import { SaveProjectButton } from "../lab/SaveProjectButton";
import { stepDefaultTitle } from "../lab/saveProject";

/*
 * 트랙 편집기 단계의 「작품으로 저장」 (lib-v1.0.3). 단계 화면(StepBody)이 어느 챕터·단계인지 알려 주고,
 * 편집기(TrackEditor)는 머리줄에 이 단추를 둔다. 단계 활동 컴포넌트(미션·디버깅·설계 조립·자유 실행)는 손대지 않는다.
 */

export type ProjectSaveTarget = { chapterId: string; defaultTitle: string };

export const ProjectSaveTargetContext = createContext<ProjectSaveTarget | null>(null);

/** 단계 화면이 알려 줄 저장 대상: 챕터 id 와 기본 제목 "<챕터 제목> — <단계 제목>" */
export function projectSaveTarget(chapter: { id: string; title: string }, step: { title: string }): ProjectSaveTarget {
  return { chapterId: chapter.id, defaultTitle: stepDefaultTitle(chapter.title, step.title) };
}

/** 단계 화면 안이고, 호스트 onSaveProject 가 있고, 열람 모드가 아닐 때만 보인다 */
export function TrackSaveButton({ getProgram }: { getProgram(): { code: string; blocksJson: unknown } }) {
  const target = useContext(ProjectSaveTargetContext);
  if (!target) return null;
  return <SaveProjectButton getProgram={getProgram} defaultTitle={target.defaultTitle} chapterId={target.chapterId} />;
}
