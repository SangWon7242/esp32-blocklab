import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, ArrowRight, Box, Cable, CheckCircle2, ChevronDown, Circle, Clock, Hourglass, Image as ImageIcon, Lightbulb, ListOrdered, Loader2, Lock, NotebookPen, Package, Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { HostLink, useHost, useHostSlots, withQuery } from "@/host/HostContext";
import { cn } from "@/lib/utils";
import { figureCaption, materialsForBoard } from "@/track/board";
import { getChapter, loadChapters, type LoadedChapter } from "@/track/content";
import { allSteps, stepStates, type StepState } from "@/track/gating";
import type { Step } from "@/track/schema";
import { TRACK_NAME } from "@/track/tracks";
import { canShow3D, hasScene3D } from "@/track/wiring3d";
import { useScene3D } from "./useScene3D";
import { BoardSelect, chapterShowsBoardSelect } from "../board/BoardSelect";
import { BOARD_IDS, useBoardChoice } from "../board/boardChoice";
import { useSettings } from "../settings/settings";
import { GuideBody } from "./GuideBody";
import { Illustration, JumperNotice, resolveBoardImage, shownJumperNotice } from "./Illustration";
import { SafetyNotice } from "./SafetyNotice";
import { PAGE_GUTTER } from "./layout";
import { MaterialChips } from "./Materials";
import { useChapterRecords, useProgress } from "./progressState";
import { ReviewBadge } from "./ReviewBadge";
import { STEP_TYPE_LABEL } from "./stepMeta";
import { StepTypeIcon } from "./StepTypeIcon";
import { SubmitCard } from "./SubmitCard";
import { WhyCards } from "./WhyCards";
import { DraftBadge, PrerequisiteList, Sessions, SubjectChips } from "./TrackMeta";

const STATE_ICON: Record<StepState, typeof Lock> = { locked: Lock, open: Circle, awaiting: Hourglass, done: CheckCircle2 };
const STATE_LABEL: Record<StepState, string> = { locked: "잠김", open: "열림", awaiting: "확인 대기", done: "완료" };
const STATE_COLOR: Record<StepState, string> = {
  locked: "text-muted-foreground",
  open: "text-muted-foreground",
  awaiting: "text-amber-700 dark:text-amber-400",
  done: "text-primary",
};

type ProgressChapters = Parameters<typeof PrerequisiteList>[0]["progressChapters"];

// three.js 는 3D 배선이 있는 챕터를 열 때만 받는다
const Wiring3DView = lazy(() => import("./wiring3d/Wiring3DView").then((m) => ({ default: m.Wiring3DView })));

/** 작업대 바탕: 밝은 종이색 (모눈은 3D 바닥에 그려져 장면과 함께 돈다). 어두운 화면에서는 짙은 회색 */
const STAGE_BG = "bg-[#f8f4ec] dark:bg-[#24262b]";

type PanelId = "steps" | "intro" | "wiring" | "principle";

/**
 * 챕터 화면 — 「작업대」 구조.
 * - 머리띠(전체 폭): 챕터 목록으로 · 트랙·번호 배지 · 제목 · 차시·교과 · 진행률 · 시작/이어서 하기
 * - 넓은 화면(lg ≥1024): 작업대(배선을 3D 로 크게, 나머지 폭) | 옆 칸(폭 clamp 400~600px): 단계 · 소개 · 배선 · 원리 탭
 *   3D 장면이 없는 챕터는 작업대에 배선 그림이, 배선이 없는 챕터는 표지 그림이 놓인다.
 * - 좁은 화면(<1024, 폰·태블릿 세로): 한 줄로 쌓고 머리띠 → 옆 칸(단계가 먼저) → 작업대 순서 (시작 버튼과 단계가 먼저 보이게)
 * 먼저 할 챕터는 안내만 하고 잠그지 않는다. 초안(draft)도 주소로는 그대로 열린다.
 * 열람(review) 모드는 호스트가 넘긴 학생 기록으로 모든 단계를 열어 보여 준다.
 */
export function ChapterPage({ chapterId }: { chapterId: string }) {
  const { nav, mode } = useHost();
  const slots = useHostSlots();
  const chapter = getChapter(chapterId);
  const progress = useProgress();
  const records = useChapterRecords(chapterId);
  const { teacherMode, explainGate } = useSettings();
  const review = mode === "review";
  const board = useBoardChoice();
  const [panel, setPanel] = useState<PanelId>("steps");
  const [view, setView] = useState<"3d" | "picture">("3d");
  const [no3d, setNo3d] = useState(false);
  // 이 기기에서 3D 를 보여 줄지는 화면이 뜬 뒤에 정한다 (그래픽 가속이 없으면 그림으로)
  useEffect(() => { if (!canShow3D()) setNo3d(true); }, []);
  const [infoBox, setInfoBox] = useState<HTMLDivElement | null>(null);
  // 고른 보드의 배선 그림에 3D 장면이 있으면 받아 둔다
  const shown = chapter?.wiring ? resolveBoardImage(chapterId, chapter.wiring.image, board) : undefined;
  const has3d = hasScene3D(chapterId, shown) && !no3d;
  // 단계 목록 · 머리띠가 먼저 그려지고 눌릴 수 있게, 처음 3D 는 브라우저가 한가해진 뒤에 올린다.
  // 보드를 바꾸면 3D 보기는 그대로 두고 장면만 바꾼다 (다른 보드 장면은 한가할 때 미리 받아 둔다)
  const siblings = chapter?.wiring ? BOARD_IDS.map((b) => resolveBoardImage(chapterId, chapter.wiring!.image, b)) : undefined;
  const { scene, pending } = useScene3D(chapterId, shown, { enabled: has3d, idle: true, siblings });
  const onUnsupported = useCallback(() => setNo3d(true), []);

  // 없는 챕터는 목록으로 돌려보낸다
  useEffect(() => {
    if (!chapter) nav.go(nav.href.track(), { replace: true });
  }, [chapter, nav]);
  if (!chapter || !progress || !records) return null;

  const steps = allSteps(chapter);
  const states = stepStates(chapter, records, teacherMode || review, { explainGate });
  const done = steps.filter((s) => states[s.id] === "done").length;
  // 이어서 하기: 아직 끝내지 않은 열린(확인 대기 포함) 단계 중 첫 번째 (다 끝냈으면 마지막 단계)
  const resume = steps.find((s) => states[s.id] === "open" || states[s.id] === "awaiting") ?? steps[steps.length - 1];
  const minutes = steps.reduce((n, s) => n + (s.minutes ?? 0), 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background text-foreground lg:overflow-hidden" data-testid="chapter-page">
      <header className={cn("shrink-0 border-b py-3 lg:py-4", PAGE_GUTTER)} data-testid="chapter-header">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* 호스트 끼움 자리 (lib-v1.1.1): 허브의 학생 메뉴 단추 등. 있으면 「챕터 목록」 의 왼쪽 당김(-ml-3)을 푼다 */}
          {slots.headerStart && <div className="-ml-1 flex shrink-0 items-center" data-slot="blocklab-header-start">{slots.headerStart}</div>}
          <Button variant="ghost" asChild className={cn("h-11 px-3 text-sm", !slots.headerStart && "-ml-3")}>
            <HostLink to={withQuery(nav.href.track(), { track: chapter.track })}><ArrowLeft className="size-4" />챕터 목록</HostLink>
          </Button>
          <div className="flex flex-wrap items-center gap-1.5" data-testid="chapter-track">
            <Badge variant="secondary">{TRACK_NAME[chapter.track]}</Badge>
            <Badge className="font-semibold">{chapter.label}</Badge>
            {chapter.status === "draft" && <DraftBadge />}
            {review && <ReviewBadge />}
            {teacherMode && !review && <Badge variant="outline">교사 모드 — 모든 단계가 열려 있어요</Badge>}
          </div>
          {/* 수업 보드 (배선이 있는 챕터만): 고르면 배선 그림·설명·준비물이 그 보드로 바뀌고 모든 챕터에 적용된다.
              뒤로 가기 줄의 오른쪽에 두어 머리띠 높이를 늘리지 않는다 (첫 화면 단계 카드 수). 좁으면 다음 줄로 */}
          {chapterShowsBoardSelect(chapter) && <BoardSelect className="sm:ml-auto" />}
          {/* 호스트 끼움 자리 (lib-v1.1.1): 저장 상태 등. 줄 끝에 붙는다 */}
          {slots.headerEnd && (
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2" data-slot="blocklab-header-end">{slots.headerEnd}</div>
          )}
        </div>

        <div className="mt-1 flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight break-keep md:text-3xl">{chapter.title}</h1>
            {/* 부제와 차시·단계·교과를 한 줄에 (머리띠를 낮게 — 단계 지도가 한 화면에 더 들어오게) */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {chapter.subtitle && <p className="w-full text-base text-muted-foreground md:text-md xl:w-auto">{chapter.subtitle}</p>}
              <Sessions sessions={chapter.sessions} />
              <span className="flex items-center gap-1"><ListOrdered className="size-3.5" />{steps.length}단계</span>
              {minutes > 0 && <span className="flex items-center gap-1"><Clock className="size-3.5" />약 {minutes}분</span>}
              <SubjectChips chapter={chapter} />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex w-52 items-center gap-2 text-sm text-muted-foreground" data-testid="chapter-progress">
              <Progress value={(done / steps.length) * 100} className="h-2" aria-label="진행률" />
              <span className="shrink-0 tabular-nums">{done} / {steps.length} 완료</span>
            </div>
            <Button asChild className="h-11 px-5 text-base" data-testid="chapter-start">
              <HostLink to={nav.href.step(chapter.id, resume.id)}>{review ? "기록 보기" : done > 0 ? "이어서 하기" : "시작하기"} <ArrowRight className="size-4" /></HostLink>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_clamp(400px,42%,600px)]">
        {/* 작업대: 배선을 크게. 읽는 순서(DOM)는 넓은 화면 기준이고, 좁은 화면에서는 옆 칸 뒤로 보낸다 */}
        <section aria-label="배선 작업대" className={cn("relative order-2 min-h-[22rem] border-t lg:order-1 lg:min-h-0 lg:border-t-0", STAGE_BG)} data-testid="chapter-stage">
          {chapter.wiring ? (
            <div className="lg:absolute lg:inset-0" data-testid="chapter-wiring">
              {has3d && (
                <div className="absolute top-2 right-2 z-10 inline-flex rounded-lg border bg-background/95 p-[3px] shadow-xs" role="group" aria-label="배선 보는 방법">
                  {([["3d", "3D", Box], ["picture", "그림", ImageIcon]] as const).map(([id, name, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={view === id}
                      onClick={() => setView(id)}
                      className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50", view === id && "bg-foreground text-background")}
                      data-testid={`wiring-view-${id}`}
                    >
                      <Icon className="size-4" />{name}
                    </button>
                  ))}
                </div>
              )}
              {has3d && view === "3d" ? (
                scene ? (
                  <div className="absolute inset-0">
                    <Suspense fallback={null}>
                      <Wiring3DView scene={scene} pending={pending} chapterId={chapter.id} stage infoContainer={infoBox} onUnsupported={onUnsupported} />
                    </Suspense>
                  </div>
                ) : (
                  <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />3D 배선을 준비하고 있어요</p>
                )
              ) : (
                <div className={cn("p-4 lg:absolute lg:inset-0 lg:overflow-auto lg:p-8", has3d && "pt-14 lg:pt-14")}>
                  <Illustration chapterId={chapter.id} image={chapter.wiring.image} className="mx-auto max-w-3xl rounded-xl border bg-white p-3 text-neutral-900 shadow-sm" zoomable />
                </div>
              )}
            </div>
          ) : chapter.cover ? (
            <div className="flex items-center justify-center p-6 lg:absolute lg:inset-0 lg:p-10">
              <Illustration chapterId={chapter.id} image={chapter.cover} className="w-full max-w-xl rounded-xl border bg-white p-4 text-neutral-900 shadow-sm" />
            </div>
          ) : null}
        </section>

        {/* 옆 칸: 단계(처음에 보인다) · 소개 · 배선 · 원리 */}
        <aside className="order-1 flex min-h-0 min-w-0 flex-col lg:order-2 lg:border-l" data-testid="chapter-panel">
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-3 pt-1 lg:px-4" role="tablist" aria-label="챕터 정보">
            {([
              ["steps", "단계", ListOrdered, true],
              ["intro", "소개", Target, true],
              ["wiring", "배선", Cable, Boolean(chapter.wiring)],
              ["principle", "원리", Lightbulb, Boolean(chapter.principle || chapter.why?.length)],
            ] as const).filter((t) => t[3]).map(([id, name, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`chapter-tab-${id}`}
                aria-selected={panel === id}
                aria-controls={`chapter-panel-${id}`}
                onClick={() => setPanel(id)}
                className={cn(
                  "-mb-px flex h-11 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  panel === id && "border-foreground text-foreground",
                )}
              >
                <Icon className="size-4" />{name}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 lg:overflow-y-auto">
            <section
              id="chapter-panel-steps"
              role="tabpanel"
              aria-labelledby="chapter-tab-steps"
              hidden={panel !== "steps"}
              className="@container min-w-0 px-4 py-4 lg:px-5"
              data-testid="chapter-steps"
            >
              <StepMap chapter={chapter} states={states} resumeId={resume.id} />
              {/* 제출: 필수 단계를 모두 끝냈고 호스트가 onSubmit 을 줬을 때만 (SubmitCard 가 스스로 숨는다) */}
              <div className="mt-6 max-w-2xl empty:hidden">
                <SubmitCard chapter={chapter} states={states} progress={progress} />
              </div>
            </section>
            <div id="chapter-panel-intro" role="tabpanel" aria-labelledby="chapter-tab-intro" hidden={panel !== "intro"} className="@container min-w-0 px-4 py-4 lg:px-5" data-testid="chapter-intro">
              <ChapterIntro chapter={chapter} progressChapters={progress.chapters} teacherMode={teacherMode} />
            </div>
            {chapter.wiring && (
              <div id="chapter-panel-wiring" role="tabpanel" aria-labelledby="chapter-tab-wiring" hidden={panel !== "wiring"} className="min-w-0 space-y-3 px-4 py-4 lg:px-5" data-testid="chapter-wiring-info">
                {/* 3D 를 보고 있으면 연결 · 부품 목록이 여기로 온다 (줄을 누르면 작업대의 그 선만 또렷해진다) */}
                {/* 조립 안전 안내(과열 · 고장 · 다칠 수 있는 챕터만): 연결 표보다 먼저 */}
                <SafetyNotice chapterId={chapter.id} />
                {/* 확장 보드 점퍼 5V 안내: 3D 를 보고 있어도 보인다 */}
                {shownJumperNotice(chapter.id, shown) && <JumperNotice text={shownJumperNotice(chapter.id, shown)!} />}
                <div ref={setInfoBox} />
                {!(has3d && view === "3d" && scene) && <p className="text-base leading-relaxed break-keep">{figureCaption(chapter.wiring, board)}</p>}
              </div>
            )}
            {(chapter.principle || chapter.why?.length) && (
              <div id="chapter-panel-principle" role="tabpanel" aria-labelledby="chapter-tab-principle" hidden={panel !== "principle"} className="@container min-w-0 space-y-5 px-4 py-4 lg:px-5">
                <ChapterPrinciple chapter={chapter} />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** 단계 지도: 부마다 단계 카드 격자. 칸 폭에 따라 1 → 2 → 3열 (@container 28rem · 52rem, 넓은 화면의 옆 칸에서는 22rem 부터 2열) */
function StepMap({ chapter, states, resumeId }: { chapter: LoadedChapter; states: Record<string, StepState>; resumeId: string }) {
  let index = 0;
  return (
    <div className="space-y-4">
      {chapter.parts.map((part) => (
        <section key={part.id} aria-label={part.title}>
          <h3 className="mb-1.5 text-base font-semibold text-muted-foreground">{part.title}</h3>
          <ol className="grid gap-2 @md:grid-cols-2 lg:@[22rem]:grid-cols-2 @[52rem]:grid-cols-3">
            {part.steps.map((step) => {
              index += 1;
              return <StepCard key={step.id} chapterId={chapter.id} step={step} n={index} state={states[step.id]} resume={step.id === resumeId} />;
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function StepCard({ chapterId, step, n, state, resume }: { chapterId: string; step: Step; n: number; state: StepState; resume: boolean }) {
  const { nav } = useHost();
  const Icon = STATE_ICON[state];
  const inner = (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
          state === "done" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base leading-snug font-medium break-keep md:text-md md:leading-snug">{step.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><StepTypeIcon type={step.type} className="size-3.5" />{STEP_TYPE_LABEL[step.type]}</span>
          {step.minutes && <span className="flex items-center gap-1"><Clock className="size-3.5" />{step.minutes}분</span>}
          {step.optional && <Badge variant="outline" className="font-normal">선택</Badge>}
        </span>
      </span>
      {state === "awaiting" ? (
        // 설명 관문: 판정은 통과, 교사 확인만 남음 — 아이콘에 짧은 글을 붙인다
        <span className={cn("mt-1 flex shrink-0 items-center gap-1 text-sm whitespace-nowrap", STATE_COLOR[state])}>
          <Icon className="size-5" aria-hidden />{STATE_LABEL[state]}
        </span>
      ) : (
        <Icon className={cn("mt-1 size-5 shrink-0", STATE_COLOR[state])} aria-label={STATE_LABEL[state]} />
      )}
    </>
  );
  // 터치 대상 44px 이상: min-h-14(56px)
  const box = "flex h-full min-h-14 items-start gap-3 rounded-xl border bg-card px-3 py-2";
  return (
    <li data-testid={`step-row-${step.id}`} data-state={state}>
      {state === "locked" ? (
        <div className={cn(box, "opacity-60")}>{inner}</div>
      ) : (
        <HostLink
          to={nav.href.step(chapterId, step.id)}
          className={cn(
            box,
            "transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
            resume && state !== "done" && "border-primary/70 ring-1 ring-primary/30",
          )}
        >
          {inner}
        </HostLink>
      )}
    </li>
  );
}

/**
 * 소개 탭: [표지 · 이렇게 되면 성공] [소개 글 · 목표 · 준비물 · 먼저 할 챕터] → 교사 메모. (배선은 작업대와 배선 탭, 원리는 원리 탭)
 * 칸이 넓으면(@2xl — 태블릿 세로에서 쌓였을 때) 앞 두 묶음을 두 열로 나란히.
 */
function ChapterIntro({ chapter, progressChapters, teacherMode }: { chapter: LoadedChapter; progressChapters: ProgressChapters; teacherMode: boolean }) {
  const board = useBoardChoice();
  return (
    <div className="space-y-5">
      <div className="grid gap-5 @2xl:grid-cols-2 @2xl:items-start">
        <div className="space-y-4">
          {chapter.cover && (
            <div data-testid="chapter-cover">
              <Illustration chapterId={chapter.id} image={chapter.cover} className="rounded-xl border bg-muted/30 p-3" />
            </div>
          )}
          {chapter.successCriteria && (
            <section aria-labelledby="success-title" className="rounded-xl border bg-card p-4">
              <h2 id="success-title" className="flex items-center gap-2 text-md font-semibold"><Target className="size-4 text-primary" />이렇게 되면 성공</h2>
              <ul className="mt-2 space-y-1.5 text-base leading-relaxed break-keep">
                {chapter.successCriteria.map((c) => (
                  <li key={c} className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />{c}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {chapter.summary && <GuideBody text={chapter.summary} />}
          {chapter.goals && (
            <dl className="grid gap-2 text-base break-keep @md:grid-cols-2 @2xl:grid-cols-1">
              <div className="rounded-lg bg-muted/50 p-3">
                <dt className="font-semibold">내용 목표</dt>
                <dd className="mt-0.5 leading-relaxed text-muted-foreground">{chapter.goals.content}</dd>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <dt className="font-semibold">생각 목표</dt>
                <dd className="mt-0.5 leading-relaxed text-muted-foreground">{chapter.goals.thinking}</dd>
              </div>
            </dl>
          )}
          {materialsForBoard(chapter.materials, board).length > 0 && (
            <section aria-labelledby="materials-title">
              <h2 id="materials-title" className="mb-2 flex items-center gap-2 text-md font-semibold"><Package className="size-4 text-primary" />준비물</h2>
              <MaterialChips chapterId={chapter.id} materials={chapter.materials!} board={board} />
            </section>
          )}
          <PrerequisiteList chapter={chapter} chapters={loadChapters()} progressChapters={progressChapters} />
        </div>
      </div>

      {/* 교사 메모: 교사 모드에서만 */}
      {teacherMode && chapter.teacherNotes && (
        <section aria-labelledby="teacher-notes-title" className="rounded-xl border border-dashed bg-muted/30 p-4" data-testid="teacher-notes">
          <h2 id="teacher-notes-title" className="flex items-center gap-2 text-md font-semibold"><NotebookPen className="size-4 text-primary" />교사 메모</h2>
          <GuideBody text={chapter.teacherNotes} className="mt-3" />
        </section>
      )}
    </div>
  );
}

/** 원리 탭: 원리 카드(그림 + 글) + 「왜 그럴까?」 */
function ChapterPrinciple({ chapter }: { chapter: LoadedChapter }) {
  return (
    <>
      {/* 원리 (Keyestudio 수업의 "원리"): 그림 + 글. 기본 펼침 — 소개 칸이 따로 스크롤되어 첫 화면(표지·성공 기준)을 밀어내지 않는다 */}
      {chapter.principle && (
        <Collapsible defaultOpen className="rounded-xl border bg-card" data-testid="chapter-principle">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="group h-12 w-full justify-start rounded-xl px-4 text-md font-semibold">
              <Lightbulb className="size-4 text-primary" />원리
              <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4">
            <div className={cn("grid gap-4", chapter.principle.image && "@2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @2xl:items-start")}>
              {chapter.principle.image && (
                <Illustration chapterId={chapter.id} image={chapter.principle.image} className="rounded-lg bg-muted/30 p-2" zoomable />
              )}
              <GuideBody text={chapter.principle.body} className="min-w-0" />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <WhyCards ids={chapter.why} />
    </>
  );
}
