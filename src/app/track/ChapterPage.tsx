import { useEffect } from "react";
import {
  ArrowLeft, ArrowRight, Cable, CheckCircle2, ChevronDown, Circle, Clock, Hourglass, Lightbulb, ListOrdered, Lock, NotebookPen, Package, Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { HostLink, useHost, withQuery } from "@/host/HostContext";
import { cn } from "@/lib/utils";
import { getChapter, loadChapters, type LoadedChapter } from "@/track/content";
import { allSteps, stepStates, type StepState } from "@/track/gating";
import type { Step } from "@/track/schema";
import { TRACK_NAME } from "@/track/tracks";
import { useSettings } from "../settings/settings";
import { GuideBody } from "./GuideBody";
import { Illustration } from "./Illustration";
import { PAGE_GUTTER } from "./layout";
import { MaterialChips } from "./Materials";
import { useChapterRecords, useProgress } from "./progressState";
import { ReviewBadge } from "./ReviewBadge";
import { STEP_TYPE_LABEL } from "./stepMeta";
import { StepTypeIcon } from "./StepTypeIcon";
import { SubmitCard } from "./SubmitCard";
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

/**
 * 챕터 화면 (lib-v1.0.6 풀페이지 두 칸).
 * - 머리띠(전체 폭): 챕터 목록으로 · 트랙·번호 배지 · 제목 · 차시·교과 · 진행률 · 시작/이어서 하기
 * - 넓은 화면(lg ≥1024): 소개 칸(폭 clamp 340~560px, 약 2/5) | 단계 지도 칸(나머지). 칸마다 따로 스크롤
 * - 좁은 화면(<1024, 폰·태블릿 세로): 한 줄로 쌓고 머리띠 → 단계 지도 → 소개 순서 (시작 버튼과 단계가 먼저 보이게).
 *   태블릿 세로(768~1023)는 소개 칸 안을 두 열로 나눠 그림과 글이 나란히 놓인다 (@container)
 * 먼저 할 챕터는 안내만 하고 잠그지 않는다. 초안(draft)도 주소로는 그대로 열린다.
 * 열람(review) 모드는 호스트가 넘긴 학생 기록으로 모든 단계를 열어 보여 준다.
 */
export function ChapterPage({ chapterId }: { chapterId: string }) {
  const { nav, mode } = useHost();
  const chapter = getChapter(chapterId);
  const progress = useProgress();
  const records = useChapterRecords(chapterId);
  const { teacherMode, explainGate } = useSettings();
  const review = mode === "review";

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
          <Button variant="ghost" asChild className="-ml-3 h-11 px-3 text-sm">
            <HostLink to={withQuery(nav.href.track(), { track: chapter.track })}><ArrowLeft className="size-4" />챕터 목록</HostLink>
          </Button>
          <div className="flex flex-wrap items-center gap-1.5" data-testid="chapter-track">
            <Badge variant="secondary">{TRACK_NAME[chapter.track]}</Badge>
            <Badge className="font-semibold">{chapter.label}</Badge>
            {chapter.status === "draft" && <DraftBadge />}
            {review && <ReviewBadge />}
            {teacherMode && !review && <Badge variant="outline">교사 모드 — 모든 단계가 열려 있어요</Badge>}
          </div>
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

      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[clamp(340px,38%,560px)_minmax(0,1fr)]">
        {/* 단계 지도: 읽는 순서(DOM)는 좁은 화면에 맞춰 먼저, 넓은 화면에서는 둘째 칸(col 2)에 놓는다 */}
        <section
          aria-labelledby="step-map-title"
          className={cn("@container min-w-0 py-5 lg:col-start-2 lg:row-start-1 lg:overflow-y-auto lg:py-6", PAGE_GUTTER)}
          data-testid="chapter-steps"
        >
          {/* 부 제목이 눈에 보이는 머리 역할을 하므로 구역 제목은 읽기 프로그램에만 */}
          <h2 id="step-map-title" className="sr-only">단계 지도</h2>
          <StepMap chapter={chapter} states={states} resumeId={resume.id} />

          {/* 제출: 필수 단계를 모두 끝냈고 호스트가 onSubmit 을 줬을 때만 (SubmitCard 가 스스로 숨는다) */}
          <div className="mt-6 max-w-2xl empty:hidden">
            <SubmitCard chapter={chapter} states={states} progress={progress} />
          </div>
        </section>

        <aside
          aria-label="챕터 소개"
          className={cn("@container min-w-0 border-t py-5 lg:col-start-1 lg:row-start-1 lg:overflow-y-auto lg:border-t-0 lg:border-r lg:py-6", PAGE_GUTTER)}
          data-testid="chapter-intro"
        >
          <ChapterIntro chapter={chapter} progressChapters={progress.chapters} teacherMode={teacherMode} />
        </aside>
      </div>
    </div>
  );
}

/** 단계 지도: 부마다 단계 카드 격자. 칸 폭에 따라 1 → 2 → 3열 (@container 28rem · 52rem) */
function StepMap({ chapter, states, resumeId }: { chapter: LoadedChapter; states: Record<string, StepState>; resumeId: string }) {
  let index = 0;
  return (
    <div className="space-y-4">
      {chapter.parts.map((part) => (
        <section key={part.id} aria-label={part.title}>
          <h3 className="mb-1.5 text-base font-semibold text-muted-foreground">{part.title}</h3>
          <ol className="grid gap-2 @md:grid-cols-2 @[52rem]:grid-cols-3">
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
 * 소개 칸: [표지 · 이렇게 되면 성공] [소개 글 · 목표 · 준비물 · 먼저 할 챕터] → 배선(접힘) · 원리(펼침) · 교사 메모.
 * 칸이 넓으면(@2xl — 태블릿 세로에서 쌓였을 때) 앞 두 묶음을 두 열로 나란히.
 */
function ChapterIntro({ chapter, progressChapters, teacherMode }: { chapter: LoadedChapter; progressChapters: ProgressChapters; teacherMode: boolean }) {
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
          {chapter.materials && (
            <section aria-labelledby="materials-title">
              <h2 id="materials-title" className="mb-2 flex items-center gap-2 text-md font-semibold"><Package className="size-4 text-primary" />준비물</h2>
              <MaterialChips chapterId={chapter.id} materials={chapter.materials} />
            </section>
          )}
          <PrerequisiteList chapter={chapter} chapters={loadChapters()} progressChapters={progressChapters} />
        </div>
      </div>

      {chapter.wiring && (
        <Collapsible className="rounded-xl border" data-testid="chapter-wiring">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="group h-12 w-full justify-start rounded-xl px-4 text-md font-semibold">
              <Cable className="size-4 text-primary" />배선 보기
              <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pt-1 pb-4">
            <Illustration
              chapterId={chapter.id}
              image={chapter.wiring.image}
              caption={chapter.wiring.caption}
              className="rounded-md bg-muted/30 p-2"
              zoomable
            />
          </CollapsibleContent>
        </Collapsible>
      )}

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
