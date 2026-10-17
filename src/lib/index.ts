/*
 * ESP32 블록랩 라이브러리 입구 (계획 13 인터페이스 계약). `npm run build:lib` → dist-lib/index.js + style.css.
 * 호스트(dlab-learning-hub)는 BlocklabProvider 로 감싸고 *View 를 그린다. 순수 API(loadChapters·judge·codeToBlocks…)는
 * 서버(Node)에서도 import 만으로 쓸 수 있다 — 화면은 lazy 조각이어서 import 때 DOM 을 건드리지 않는다.
 * 다만 React 클라이언트 코드(Provider·SubmitCard)도 함께 내보내므로 Next 라우트 핸들러(react-server)는 "./core" 입구(@blocklab/core)를 쓴다 (lib-v1.0.2).
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
/* Blockly media 주소 (기본 "/blocklab/media/"). Provider 밖에서 loadBlockTools·ProjectPreview 를 쓸 때 먼저 부른다 */
export { DEFAULT_BLOCKLY_MEDIA_PATH, blocklyMediaPath, setBlocklyMediaPath } from "@/host/mediaPath";

/* 화면 */
export { ChapterView, LabView, StepView, TrackListView, type ChapterViewProps, type LabInitialProgram, type LabViewProps, type StepViewProps, type TrackListViewProps } from "./views";
/* 제출·열람 화면 — Blockly·CodeMirror 를 바로 불러오지 않으므로 lazy 없이 내보낸다 (ProjectPreview 의 블록 그림은 useEffect 안 동적 import) */
export { ChapterReviewView } from "@/app/review/ChapterReviewView";
export { CodeView, ProjectPreview } from "@/app/review/ProjectPreview";
export { SubmitCard, SubmitCardView, canSubmitChapter, SUBMIT_TEXT, type SubmitStatus } from "@/app/track/SubmitCard";

/*
 * Blockly 가 필요한 도구 (canonicalLines·blocksToCode·renderBlockSvg). 순수 경로에 실으면 Node import 가 Blockly 를 끌고 오므로
 * 브라우저에서만 이 함수로 불러온다: `const { canonicalLines } = await loadBlockTools()`.
 */
export const loadBlockTools = (): Promise<typeof import("./blockTools")> => import("./blockTools");
export type BlockTools = typeof import("./blockTools");

/* 순수 API 전부 (콘텐츠·판정·진행·스냅숏·NOTE_* 문장·AI 프롬프트·LIB_VERSION). 서버는 "./core" 입구를 바로 쓴다 */
export * from "./core";
/* localStorage 를 쓰는 진행 저장소 (브라우저 전용이라 core 에는 없다) */
export { LocalProgressStore } from "@/track/progress";
