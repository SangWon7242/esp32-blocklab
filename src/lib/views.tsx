import { lazy, Suspense, type ReactNode } from "react";
import type { TrackId } from "@/track/schema";

/*
 * 라이브러리 화면 (계획 13 인터페이스 계약). 화면 컴포넌트는 Blockly·CodeMirror 를 끌고 오므로 lazy 로 받아,
 * dist-lib/index.js 를 Node(허브 서버)에서 import 해 순수 API(judge·loadChapters…)만 써도 DOM 을 건드리지 않는다.
 * 호스트 쪽에서도 화면을 처음 열 때만 그 조각을 받는다.
 * 화면 뿌리(트랙·챕터·단계·자유 코딩)는 bg-background(기본 흰색)를 칠한다 (lib-v1.0.5) — `.blocklab` 루트가 display:contents 라
 * 칠하지 않으면 호스트 body 색(허브 #fffaf1 크림색)이 비친다. 호스트가 --host-background 를 주면 그 색.
 */

const TrackPage = lazy(() => import("@/app/track/TrackPage").then((m) => ({ default: m.TrackPage })));
const ChapterPage = lazy(() => import("@/app/track/ChapterPage").then((m) => ({ default: m.ChapterPage })));
const StepPage = lazy(() => import("@/app/track/StepPage").then((m) => ({ default: m.StepPage })));
const LabPage = lazy(() => import("@/app/lab/LabPage").then((m) => ({ default: m.LabPage })));

export type TrackListViewProps = {
  /** 호스트가 주소(?track=)에서 읽은 탭. 없거나 모르는 값이면 마지막으로 본 탭(없으면 센서 트랙) */
  track?: string | null;
  /** 탭을 바꾸면 호스트가 주소에 남긴다. 없으면 화면 안에서만 바뀐다 */
  onTrackChange?(track: TrackId): void;
};
export type ChapterViewProps = { chapterId: string };
export type StepViewProps = { chapterId: string; stepId: string };
export type LabViewProps = {
  /** 블록 사전의 "편집기에서 열어 보기": 그 블록의 예시 프로그램을 싣는다 */
  exampleType?: string | null;
  /** 콘텐츠 코드 "<챕터 id>/<파일>" 로 시작한다 (편집기 단계의 "정답 코드 열기") */
  codeRef?: string | null;
  /** 예시를 실은 뒤 호스트가 주소에서 example 을 지울 수 있게 알린다 */
  onExampleLoaded?(): void;
  /**
   * 호스트가 불러온 작품 (lib-v1.0.3). 처음 열 때 한 번만 싣는다 — exampleType·codeRef 보다 먼저.
   * blocksJson 이 있으면 작업판 JSON 으로, 없으면 code 를 블록으로 바꿔 싣는다. title 은 「작품으로 저장」의 기본 제목.
   * code 를 블록으로 바꾸지 못하면(문법 오류) blocksJson 은 쓰지 않고 코드 모드로 열어 친 글을 그대로 둔다 (lib-v1.0.4).
   * 「작품으로 저장」은 코드 모드에서 code 가 블록과 맞지 않으면 blocksJson 을 null 로 넘긴다 (lib-v1.0.4)
   * 값이 바뀌어도 다시 싣지 않는다(학생 편집을 덮지 않게). 다른 작품을 열려면 LabView 의 key 를 바꾼다
   */
  initialProgram?: LabInitialProgram | null;
};

/** LabViewProps.initialProgram 의 꼴 */
export type LabInitialProgram = { code: string; blocksJson?: unknown; title?: string };

function Loading({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="p-8 text-muted-foreground">불러오는 중…</div>}>{children}</Suspense>;
}

/** 챕터 목록 (트랙 탭). track·onTrackChange 를 주면 탭을 호스트 주소와 맞출 수 있다 */
export function TrackListView(props: TrackListViewProps = {}) {
  return (
    <Loading>
      <TrackPage {...props} />
    </Loading>
  );
}

/** 챕터 화면 (표지·준비물·원리·단계 격자) */
export function ChapterView(props: ChapterViewProps) {
  return (
    <Loading>
      <ChapterPage {...props} />
    </Loading>
  );
}

/** 단계 화면 (안내·활동·판정) */
export function StepView(props: StepViewProps) {
  return (
    <Loading>
      <StepPage {...props} />
    </Loading>
  );
}

/** 자유 코딩 (Blockly 편집기 + 보드) */
export function LabView(props: LabViewProps = {}) {
  return (
    <Loading>
      <LabPage {...props} />
    </Loading>
  );
}
