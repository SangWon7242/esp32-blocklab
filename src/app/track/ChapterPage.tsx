import { Link, Navigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Cable, CheckCircle2, ChevronDown, Circle, Clock, Lightbulb, Lock, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getChapter } from "@/track/content";
import { allSteps, stepStates, type StepState } from "@/track/gating";
import { useSettings } from "../settings/settings";
import { GuideBody } from "./GuideBody";
import { Illustration } from "./Illustration";
import { MaterialChips } from "./Materials";
import { useProgress } from "./progressState";
import { STEP_TYPE_LABEL } from "./stepMeta";

const STATE_ICON: Record<StepState, typeof Lock> = { locked: Lock, open: Circle, done: CheckCircle2 };
const STATE_LABEL: Record<StepState, string> = { locked: "잠김", open: "열림", done: "완료" };

/** #/track/:chapter — 표지·목표(hero) → 준비물·배선 → 원리 → 단계 카드 격자(진행표) */
export function ChapterPage() {
  const { chapter: chapterId = "" } = useParams();
  const chapter = getChapter(chapterId);
  const progress = useProgress();
  const { teacherMode } = useSettings();
  if (!chapter) return <Navigate to="/track" replace />;
  if (!progress) return null;

  const steps = allSteps(chapter);
  const states = stepStates(chapter, progress.chapters[chapter.id] ?? {}, teacherMode);
  const done = steps.filter((s) => states[s.id] === "done").length;
  // 이어서 하기: 아직 끝내지 않은 열린 단계 중 첫 번째 (다 끝냈으면 마지막 단계)
  const resume = steps.find((s) => states[s.id] === "open") ?? steps[steps.length - 1];
  const minutes = steps.reduce((n, s) => n + (s.minutes ?? 0), 0);
  let index = 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-4 sm:p-8">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/track"><ArrowLeft className="size-4" />챕터 목록</Link>
        </Button>

        <div className="mt-2">
          <p className="text-sm text-muted-foreground">챕터 {chapter.order}</p>
          <h1 className="text-2xl font-bold">{chapter.title}</h1>
          {chapter.subtitle && <p className="mt-1 text-muted-foreground">{chapter.subtitle}</p>}
        </div>

        {/* hero: 표지 그림·진행·성공 기준(왼쪽) + 소개·목표·준비물·배선(오른쪽). 좁은 화면은 위아래 */}
        <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
          <div className="space-y-4">
            {chapter.cover && (
              <div data-testid="chapter-cover">
                <Illustration chapterId={chapter.id} image={chapter.cover} className="rounded-xl border bg-muted/30 p-3" />
              </div>
            )}
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Progress value={(done / steps.length) * 100} className="h-2" aria-label="진행률" />
                <span className="shrink-0">{done} / {steps.length} 완료</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Button asChild className="shrink-0">
                  <Link to={`/track/${chapter.id}/${resume.id}`}>{done > 0 ? "이어서 하기" : "시작하기"} <ArrowRight className="size-4" /></Link>
                </Button>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {steps.length}단계
                  {minutes > 0 && <><Clock className="ml-1 size-3" />약 {minutes}분</>}
                </span>
              </div>
              {teacherMode && <Badge variant="secondary">교사 모드 — 모든 단계가 열려 있어요</Badge>}
              {/* 끝 지점: 진행률 바로 아래에 "이렇게 되면 성공" */}
              {chapter.successCriteria && (
                <section aria-labelledby="success-title" className="border-t pt-3">
                  <h2 id="success-title" className="flex items-center gap-1.5 text-sm font-medium"><Target className="size-4" />이렇게 되면 성공</h2>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {chapter.successCriteria.map((c) => (
                      <li key={c} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />{c}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            {chapter.summary && <GuideBody text={chapter.summary} />}
            {chapter.goals && (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-muted/50 p-3">
                  <dt className="font-medium">내용 목표</dt>
                  <dd className="mt-0.5 text-muted-foreground">{chapter.goals.content}</dd>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <dt className="font-medium">생각 목표</dt>
                  <dd className="mt-0.5 text-muted-foreground">{chapter.goals.thinking}</dd>
                </div>
              </dl>
            )}
            {chapter.materials && (
              <section aria-label="준비물">
                <h2 className="mb-2 text-sm font-medium">준비물</h2>
                <MaterialChips chapterId={chapter.id} materials={chapter.materials} />
              </section>
            )}
            {chapter.wiring && (
              <Collapsible className="rounded-lg border" data-testid="chapter-wiring">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="group w-full justify-start rounded-lg">
                    <Cable className="size-4" />배선 보기
                    <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pt-1 pb-3">
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
          </div>
        </div>

        {/* 원리 (Keyestudio 수업의 "원리"): 그림 왼쪽 + 글. 기본 펼침 */}
        {chapter.principle && (
          <Collapsible defaultOpen className="mt-6 rounded-xl border bg-card" data-testid="chapter-principle">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="group h-auto w-full justify-start rounded-xl px-4 py-3 text-base font-semibold">
                <Lightbulb className="size-4 text-primary" />원리
                <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              <div className={cn("grid gap-4", chapter.principle.image && "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start")}>
                {chapter.principle.image && (
                  <Illustration chapterId={chapter.id} image={chapter.principle.image} className="rounded-lg bg-muted/30 p-2" zoomable />
                )}
                <GuideBody text={chapter.principle.body} className="min-w-0" />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {chapter.parts.map((part) => (
          <section key={part.id} className="mt-8">
            <h2 className="mb-3 font-semibold">{part.title}</h2>
            <ol className="grid gap-3 sm:grid-cols-2">
              {part.steps.map((step) => {
                index += 1;
                const state = states[step.id];
                const Icon = STATE_ICON[state];
                const inner = (
                  <>
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        state === "done" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                      aria-hidden
                    >
                      {index}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="font-normal">{STEP_TYPE_LABEL[step.type]}</Badge>
                        {step.optional && <Badge variant="outline" className="font-normal">선택</Badge>}
                        {step.minutes && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />{step.minutes}분</span>}
                      </span>
                      <span className="mt-1 block truncate font-medium">{step.title}</span>
                    </span>
                    <Icon className={cn("size-5 shrink-0", state === "done" ? "text-primary" : "text-muted-foreground")} aria-label={STATE_LABEL[state]} />
                  </>
                );
                const box = "flex h-full items-center gap-3 rounded-xl border bg-card p-3";
                return (
                  <li key={step.id} data-testid={`step-row-${step.id}`} data-state={state}>
                    {state === "locked" ? (
                      <div className={cn(box, "opacity-60")}>{inner}</div>
                    ) : (
                      <Link
                        to={`/track/${chapter.id}/${step.id}`}
                        className={cn(box, "transition-colors hover:bg-muted", step.id === resume.id && state === "open" && "border-primary/60")}
                      >
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
