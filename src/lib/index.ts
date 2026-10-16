/*
 * ESP32 블록랩 라이브러리 입구 (계획 13 인터페이스 계약). `npm run build:lib` → dist-lib/index.js + style.css.
 * 호스트(dlab-learning-hub)는 BlocklabProvider 로 감싸고 *View 를 그린다. 순수 API(loadChapters·judge·codeToBlocks…)는
 * 서버(Node)에서도 import 만으로 쓸 수 있다 — 화면은 lazy 조각이어서 import 때 DOM 을 건드리지 않는다.
 */
import "../index.css";

/* 호스트 어댑터 */
export {
  BlocklabProvider,
  HostLink,
  MISSING_HOST_MESSAGE,
  useHost,
  useReadOnly,
  withQuery,
  type AiClient,
  type HostMode,
  type HostProps,
  type HostUser,
  type NavigateOptions,
  type Navigator,
  type SettingsSource,
} from "@/host/HostContext";

/* 화면 */
export { ChapterView, LabView, StepView, TrackListView, type ChapterViewProps, type LabViewProps, type StepViewProps, type TrackListViewProps } from "./views";
// TODO(A2): 제출·열람 화면과 스냅숏 함수는 A2 가 만든다. 파일이 생기면 주석을 푼다.
// export { ChapterReviewView } from "@/app/track/ChapterReviewView";
// export { ProjectPreview } from "@/app/track/ProjectPreview";
// export { chapterSnapshot, textAnswersOf, judgeSnapshot, type TextAnswer, type JudgeSummary } from "@/track/snapshot";
export type { ChapterSnapshot } from "@/track/snapshot";

/* 콘텐츠·판정·진행 (순수) */
export { getChapter, loadChapters, type LoadedChapter } from "@/track/content";
export { allSteps, stepStates, type StepState } from "@/track/gating";
export { judge, type JudgeInput, type JudgeResult } from "@/track/judge";
export { codeToBlocks } from "@/parser";
export {
  LocalProgressStore,
  emptyProgress,
  parseProgress,
  type Progress,
  type ProgressStore,
  type StepRecord,
} from "@/track/progress";
export type { Chapter, Step, StepType, TrackId } from "@/track/schema";
export { TRACKS, TRACK_NAME, chaptersInTrack, isTrackId } from "@/track/tracks";

/* AI 프롬프트 (허브 서버가 같은 글로 모델을 부른다) */
export {
  SYSTEM_PROMPT,
  debugMessage,
  parseReview,
  reflectMessage,
  type AiReview,
  type DebugRequest,
  type ReflectRequest,
} from "@/ai/claude";

/** package.json 의 version (vite.lib.config.ts 가 넣는다). 소스에서 바로 쓸 때는 개발 표시 */
export const LIB_VERSION: string = typeof __LIB_VERSION__ === "string" ? __LIB_VERSION__ : "0.0.0-dev";
