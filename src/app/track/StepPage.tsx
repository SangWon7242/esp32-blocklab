import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { canComplete, isEditorStep } from "@/track/completion";
import { getChapter, type LoadedChapter } from "@/track/content";
import { allSteps, stepStates } from "@/track/gating";
import type { StepRecord } from "@/track/progress";
import type { Step } from "@/track/schema";
import { useSettings } from "../settings/settings";
import { GuideBody } from "./GuideBody";
import { saveStepRecord, useProgress } from "./progressState";
import { STEP_TYPE_GUIDE, STEP_TYPE_LABEL } from "./stepMeta";
import { Analysis } from "./steps/Analysis";
import { EditorStepPlaceholder } from "./steps/EditorStepPlaceholder";
import { Predict } from "./steps/Predict";
import { Problem } from "./steps/Problem";
import { ReadCheck } from "./steps/ReadCheck";
import { Reflect } from "./steps/Reflect";
import type { StepProps } from "./steps/types";

export const LOCKED_MESSAGE = "앞 단계를 먼저 끝내 주세요";

/** #/track/:chapter/:step — 왼쪽 안내, 오른쪽 활동, 위 진행, 아래 이전·완료·다음 */
export function StepPage() {
  const { chapter: chapterId = "", step: stepId = "" } = useParams();
  const navigate = useNavigate();
  const chapter = getChapter(chapterId);
  const progress = useProgress();
  const { teacherMode } = useSettings();

  const steps = chapter ? allSteps(chapter) : [];
  const index = steps.findIndex((s) => s.id === stepId);
  const records = (chapter && progress?.chapters[chapter.id]) || {};
  const states = chapter ? stepStates(chapter, records, teacherMode) : {};
  const state = states[stepId];

  // 없는 챕터·단계, 잠긴 단계는 챕터(또는 목록)로 돌려보낸다
  useEffect(() => {
    if (!chapter) navigate("/track", { replace: true });
    else if (index < 0) navigate(`/track/${chapter.id}`, { replace: true });
    else if (progress && state === "locked") {
      toast.warning(LOCKED_MESSAGE, { id: "step-locked" });
      navigate(`/track/${chapter.id}`, { replace: true });
    }
  }, [chapter, index, progress, state, navigate]);

  if (!chapter || index < 0 || !progress || state === "locked") return null;
  const step = steps[index];
  // 단계가 바뀌면 입력 상태를 새로 만든다
  return (
    <StepView
      key={`${chapter.id}/${step.id}`}
      chapter={chapter}
      step={step}
      index={index}
      steps={steps}
      record={records[step.id]}
      states={states}
      teacherMode={teacherMode}
    />
  );
}

type ViewProps = {
  chapter: LoadedChapter;
  step: Step;
  index: number;
  steps: Step[];
  record: StepRecord | undefined;
  states: Record<string, string>;
  teacherMode: boolean;
};

function StepView({ chapter, step, index, steps, record, states, teacherMode }: ViewProps) {
  const [input, setInput] = useState<Record<string, unknown>>(record?.input ?? {});
  const [attempts, setAttempts] = useState(record?.attempts ?? 0);
  const done = states[step.id] === "done";
  const editor = isEditorStep(step);
  const prev = steps[index - 1];
  const next = steps[index + 1];
  const nextOpen = next && states[next.id] !== "locked";
  const doneCount = steps.filter((s) => states[s.id] === "done").length;

  const save = (nextInput: Record<string, unknown>, nextAttempts: number, status: "open" | "done") =>
    void saveStepRecord(chapter.id, step.id, { status, input: nextInput, attempts: nextAttempts, updatedAt: new Date().toISOString() });

  const onInput: StepProps<never>["onInput"] = (nextInput, opts) => {
    const nextAttempts = attempts + (opts?.attempt ? 1 : 0);
    setInput(nextInput);
    setAttempts(nextAttempts);
    save(nextInput, nextAttempts, done ? "done" : "open");
  };

  const complete = (extra?: Record<string, unknown>) => {
    const finalInput = extra ? { ...input, ...extra } : input;
    setInput(finalInput);
    save(finalInput, attempts, "done");
    toast.success(extra?.skipped ? "건너뛰었어요. 다음 단계가 열렸어요" : "완료했어요. 다음 단계가 열렸어요", { id: "step-done" });
  };

  const props = { chapter, input, onInput, teacherMode, attempts };
  let activity: ReactNode;
  switch (step.type) {
    case "problem": activity = <Problem step={step} {...props} />; break;
    case "analysis": activity = <Analysis step={step} {...props} />; break;
    case "predict": activity = <Predict step={step} {...props} />; break;
    case "readcheck": activity = <ReadCheck step={step} {...props} />; break;
    case "reflect": activity = <Reflect step={step} {...props} />; break;
    default: activity = <EditorStepPlaceholder step={step} chapter={chapter} teacherMode={teacherMode} />;
  }

  const ready = canComplete(step, input);
  const part = chapter.parts.find((p) => p.steps.some((s) => s.id === step.id));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 overflow-hidden border-b px-3 whitespace-nowrap">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/track/${chapter.id}`}><ArrowLeft className="size-4" /><span className="hidden sm:inline">{chapter.title}</span><span className="sm:hidden">단계 목록</span></Link>
        </Button>
        <div className="ml-auto flex w-40 items-center gap-2 text-sm text-muted-foreground sm:w-64">
          <Progress value={(doneCount / steps.length) * 100} className="h-2" aria-label="챕터 진행률" />
          <span className="shrink-0" data-testid="step-position">{index + 1} / {steps.length}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:overflow-hidden">
        <aside className="border-b p-4 sm:p-6 lg:overflow-y-auto lg:border-r lg:border-b-0">
          {part && <p className="text-xs text-muted-foreground">{part.title}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{STEP_TYPE_LABEL[step.type]}</Badge>
            {step.optional && <Badge variant="outline">선택</Badge>}
            {step.minutes && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />{step.minutes}분</span>}
            {done && <span className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="size-3" />완료함</span>}
          </div>
          <h1 className="mt-3 text-xl font-bold">{step.title}</h1>
          <div className="mt-4">
            <GuideBody text={step.body ?? STEP_TYPE_GUIDE[step.type]} />
          </div>
        </aside>
        <section className="p-4 sm:p-6 lg:overflow-y-auto" aria-label="활동">{activity}</section>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t px-3 py-2">
        {prev ? (
          <Button variant="outline" asChild><Link to={`/track/${chapter.id}/${prev.id}`}><ArrowLeft className="size-4" />이전</Link></Button>
        ) : (
          <Button variant="outline" disabled><ArrowLeft className="size-4" />이전</Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {done ? (
            <span className="hidden items-center gap-1 text-sm text-primary sm:flex"><CheckCircle2 className="size-4" />완료한 단계예요</span>
          ) : editor ? (
            <Button variant="secondary" onClick={() => complete({ skipped: true })}><SkipForward className="size-4" />건너뛰기</Button>
          ) : (
            <Button onClick={() => complete()} disabled={!ready} title={ready ? undefined : "활동을 마치면 누를 수 있어요"}>
              <Check className="size-4" />완료
            </Button>
          )}
          {next ? (
            nextOpen ? (
              <Button variant={done ? "default" : "outline"} asChild><Link to={`/track/${chapter.id}/${next.id}`}>다음<ArrowRight className="size-4" /></Link></Button>
            ) : (
              <Button variant="outline" disabled>다음<ArrowRight className="size-4" /></Button>
            )
          ) : (
            <Button variant={done ? "default" : "outline"} asChild><Link to={`/track/${chapter.id}`}>단계 목록<ArrowRight className="size-4" /></Link></Button>
          )}
        </div>
      </div>
    </div>
  );
}
