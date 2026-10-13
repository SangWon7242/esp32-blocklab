import { Link, Navigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getChapter } from "@/track/content";
import { allSteps, stepStates, type StepState } from "@/track/gating";
import { useSettings } from "../settings/settings";
import { useProgress } from "./progressState";
import { STEP_TYPE_LABEL } from "./stepMeta";

const STATE_ICON: Record<StepState, typeof Lock> = { locked: Lock, open: Circle, done: CheckCircle2 };
const STATE_LABEL: Record<StepState, string> = { locked: "잠김", open: "열림", done: "완료" };

/** #/track/:chapter — 단계 목록(진행표) */
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
  let index = 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl p-4 sm:p-8">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/track"><ArrowLeft className="size-4" />챕터 목록</Link>
        </Button>
        <p className="mt-2 text-sm text-muted-foreground">챕터 {chapter.order}</p>
        <h1 className="text-2xl font-bold">{chapter.title}</h1>
        {chapter.subtitle && <p className="mt-1 text-muted-foreground">{chapter.subtitle}</p>}
        {chapter.goals && (
          <dl className="mt-4 grid gap-1 text-sm">
            <div><dt className="inline font-medium">내용 목표 </dt><dd className="inline text-muted-foreground">{chapter.goals.content}</dd></div>
            <div><dt className="inline font-medium">생각 목표 </dt><dd className="inline text-muted-foreground">{chapter.goals.thinking}</dd></div>
          </dl>
        )}
        <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
          <Progress value={(done / steps.length) * 100} className="h-2" aria-label="진행률" />
          <span className="shrink-0">{done} / {steps.length} 완료</span>
          <Button asChild size="sm" className="shrink-0">
            <Link to={`/track/${chapter.id}/${resume.id}`}>이어서 하기 <ArrowRight className="size-4" /></Link>
          </Button>
        </div>
        {teacherMode && <Badge variant="secondary" className="mt-3">교사 모드 — 모든 단계가 열려 있어요</Badge>}

        {chapter.parts.map((part) => (
          <section key={part.id} className="mt-8">
            <h2 className="mb-2 font-semibold">{part.title}</h2>
            <ol className="divide-y rounded-lg border">
              {part.steps.map((step) => {
                index += 1;
                const state = states[step.id];
                const Icon = STATE_ICON[state];
                const inner = (
                  <>
                    <Icon className={cn("size-5 shrink-0", state === "done" ? "text-primary" : "text-muted-foreground")} aria-label={STATE_LABEL[state]} />
                    <span className="w-6 shrink-0 text-sm text-muted-foreground">{index}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{step.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {STEP_TYPE_LABEL[step.type]}{step.minutes ? ` · ${step.minutes}분` : ""}
                      </span>
                    </span>
                    {step.optional && <Badge variant="outline">선택</Badge>}
                  </>
                );
                return (
                  <li key={step.id} data-testid={`step-row-${step.id}`} data-state={state}>
                    {state === "locked" ? (
                      <div className="flex items-center gap-3 px-4 py-3 opacity-60">{inner}</div>
                    ) : (
                      <Link to={`/track/${chapter.id}/${step.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">{inner}</Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}

        {chapter.successCriteria && (
          <section className="mt-8">
            <h2 className="mb-2 font-semibold">이렇게 되면 성공</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {chapter.successCriteria.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
