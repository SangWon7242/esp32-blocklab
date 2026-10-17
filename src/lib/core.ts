/*
 * ESP32 블록랩 서버 입구 `core` (lib-v1.0.2). `npm run build:lib` → dist-lib/core.js + core.d.ts.
 * 허브 Next 라우트 핸들러(react-server 층)가 정적으로 import 해도 되도록 React·DOM·Blockly·CodeMirror·CSS 를 전혀 끌어오지 않는다.
 *   허브: `import { judgeSnapshot } from "@blocklab/core"`
 * index.ts(화면 입구)는 이 파일을 통째로 다시 내보낸다 — 콘텐츠 같은 큰 조각은 두 입구가 같은 chunks/ 파일을 함께 쓴다.
 * 여기에 넣는 모듈은 React·DOM 전역(window·document·localStorage)을 import 때 건드리면 안 된다 (scripts/lib-smoke.mjs 가 검사).
 */

/* 콘텐츠·판정·진행 (순수) */
export { getChapter, loadChapters, type LoadedChapter } from "@/track/content";
export { allSteps, stepStates, type StepState } from "@/track/gating";
export { judge, type JudgeInput, type JudgeResult } from "@/track/judge";
export { codeToBlocks } from "@/parser";
export { emptyProgress, parseProgress, type Progress, type ProgressStore, type StepRecord } from "@/track/progress";
export type { Chapter, Step, StepType, TrackId } from "@/track/schema";
export { TRACKS, TRACK_NAME, chaptersInTrack, isTrackId } from "@/track/tracks";

/* 제출 스냅숏·글 답·다시 판정 (허브 서버가 judgeSnapshot 으로 결과를 다시 계산한다) */
export {
  EXPLAIN_MEMO_PROMPT,
  NOTE_NO_PROGRAM,
  NOTE_OUTPUT_RULES,
  NOTE_SCREEN_FAILED,
  NOTE_SCREEN_PASSED,
  NOTE_SKIPPED,
  chapterSnapshot,
  hasRun,
  isJudgedStep,
  isSkipped,
  judgeSnapshot,
  savedPrograms,
  textAnswersOf,
  type ChapterSnapshot,
  type JudgeSnapshotOptions,
  type JudgeStepSummary,
  type JudgeSummary,
  type TextAnswer,
} from "@/track/snapshot";
export type { SavedProgram } from "@/track/completion";

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
