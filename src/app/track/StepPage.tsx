import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Cable, Check, CheckCircle2, ChevronDown, CircleCheck, Clock, Hourglass, ListChecks, PanelLeftClose, PanelLeftOpen, SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { HostLink, useHost } from "@/host/HostContext";
import { cn } from "@/lib/utils";
import { figureCaption, materialsForBoard } from "@/track/board";
import { awaitingExplain, canComplete, isEditorStep } from "@/track/completion";
import { getChapter, type LoadedChapter } from "@/track/content";
import { allSteps, stepStates } from "@/track/gating";
import type { ProgressStore, StepRecord } from "@/track/progress";
import type { Step } from "@/track/schema";
import { BoardSelect, chapterShowsBoardSelect } from "../board/BoardSelect";
import { useBoardChoice } from "../board/boardChoice";
import { useSettings } from "../settings/settings";
import { ReviewBadge } from "./ReviewBadge";
import { ProjectSaveTargetContext, projectSaveTarget } from "./TrackSaveButton";
import { GuideBody } from "./GuideBody";
import { useGuideCollapsed } from "./guidePanel";
import { Illustration } from "./Illustration";
import { MaterialChips } from "./Materials";
import { saveStepRecord, useChapterRecords } from "./progressState";
import { STEP_TYPE_GUIDE, STEP_TYPE_LABEL } from "./stepMeta";
import { StepTypeIcon } from "./StepTypeIcon";
import { AppStep } from "./steps/AppStep";
import { ANALYSIS_IMAGE, Analysis } from "./steps/Analysis";
import { DebugStep } from "./steps/DebugStep";
import { DesignStep } from "./steps/DesignStep";
import { MissionStep } from "./steps/MissionStep";
import { Predict } from "./steps/Predict";
import { Problem } from "./steps/Problem";
import { ReadCheck } from "./steps/ReadCheck";
import { Reflect } from "./steps/Reflect";
import { RunStep } from "./steps/RunStep";
import type { StepProps } from "./steps/types";

export const LOCKED_MESSAGE = "앞 단계를 먼저 끝내 주세요";

/**
 * 단계 화면 — 안내 칸 + 활동 칸, 진행 줄, 이전·완료·다음 줄.
 * 배치 (lib-v1.0.6): lg(≥1024, 태블릿 가로·노트북) 두 칸 — 안내 칸 폭 clamp(320px, 34%, 520px), 나머지는 활동 칸, 칸마다 따로 스크롤.
 * md(768~1023, 태블릿 세로) 이하는 안내 → 활동으로 쌓고 화면 전체가 스크롤된다. 안내 칸 접기는 md 이상에서 쓸 수 있다
 * (태블릿 세로에서 접으면 편집기가 바로 위에 온다).
 * 열람(review) 모드는 호스트가 넘긴 학생 기록을 저장 없이 보여 준다: 모든 단계 열림, 입력·판정·저장·AI·완료 숨김.
 */
export function StepPage({ chapterId, stepId }: { chapterId: string; stepId: string }) {
  const { nav, mode, store } = useHost();
  const chapter = getChapter(chapterId);
  const records = useChapterRecords(chapterId);
  const { teacherMode, explainGate } = useSettings();
  const review = mode === "review";

  const steps = chapter ? allSteps(chapter) : [];
  const index = steps.findIndex((s) => s.id === stepId);
  const states = chapter ? stepStates(chapter, records ?? {}, teacherMode || review, { explainGate }) : {};
  const state = states[stepId];

  // 없는 챕터·단계, 잠긴 단계는 챕터(또는 목록)로 돌려보낸다. replace 로 바꿔 넣어 뒤로 가기가 다시 여기로 오지 않게
  useEffect(() => {
    if (!chapter) nav.go(nav.href.track(), { replace: true });
    else if (index < 0) nav.go(nav.href.chapter(chapter.id), { replace: true });
    else if (records && state === "locked") {
      toast.warning(LOCKED_MESSAGE, { id: "step-locked" });
      nav.go(nav.href.chapter(chapter.id), { replace: true });
    }
  }, [chapter, index, records, state, nav]);

  if (!chapter || index < 0 || !records || state === "locked") return null;
  const step = steps[index];
  // 단계가 바뀌면 입력 상태를 새로 만든다
  return (
    <StepBody
      key={`${chapter.id}/${step.id}`}
      chapter={chapter}
      step={step}
      index={index}
      steps={steps}
      record={records[step.id]}
      states={states}
      teacherMode={teacherMode}
      explainGate={explainGate}
      readOnly={review}
      store={store}
    />
  );
}

type BodyProps = {
  chapter: LoadedChapter;
  step: Step;
  index: number;
  steps: Step[];
  record: StepRecord | undefined;
  states: Record<string, string>;
  teacherMode: boolean;
  /** 설정: 미션·디버깅은 교사 "설명 확인" 뒤 완료 */
  explainGate: boolean;
  /** 열람 모드: 저장하지 않고 입력·판정·완료를 숨긴다 */
  readOnly: boolean;
  store: ProgressStore;
};

function StepBody({ chapter, step, index, steps, record, states, teacherMode, explainGate, readOnly, store }: BodyProps) {
  const { nav } = useHost();
  const [input, setInput] = useState<Record<string, unknown>>(record?.input ?? {});
  const [attempts, setAttempts] = useState(record?.attempts ?? 0);
  const done = states[step.id] === "done";
  const editor = isEditorStep(step);
  const prev = steps[index - 1];
  const next = steps[index + 1];
  const nextOpen = next && states[next.id] !== "locked";
  const doneCount = steps.filter((s) => states[s.id] === "done").length;
  const boardSelect = chapterShowsBoardSelect(chapter);
  const [guideCollapsed, setGuideCollapsed] = useGuideCollapsed();

  const save = (nextInput: Record<string, unknown>, nextAttempts: number, status: "open" | "done") => {
    if (readOnly) return; // 열람 모드는 학생 기록을 바꾸지 않는다
    void saveStepRecord(store, chapter.id, step.id, { status, input: nextInput, attempts: nextAttempts, updatedAt: new Date().toISOString() });
  };

  const onInput: StepProps<never>["onInput"] = (nextInput, opts) => {
    if (readOnly) return;
    const nextAttempts = attempts + (opts?.attempt ? 1 : 0);
    setInput(nextInput);
    setAttempts(nextAttempts);
    save(nextInput, nextAttempts, done ? "done" : "open");
  };

  const complete = (extra?: Record<string, unknown>) => {
    if (readOnly) return;
    const finalInput = extra ? { ...input, ...extra } : input;
    setInput(finalInput);
    save(finalInput, attempts, "done");
    toast.success(extra?.skipped ? "건너뛰었어요. 다음 단계가 열렸어요" : "완료했어요. 다음 단계가 열렸어요", { id: "step-done" });
  };

  const saveTarget = useMemo(() => projectSaveTarget(chapter, step), [chapter, step]);
  const props = { chapter, input, onInput, teacherMode, attempts, onComplete: complete, readOnly };
  let activity: ReactNode;
  switch (step.type) {
    case "problem": activity = <Problem step={step} {...props} />; break;
    case "analysis": activity = <Analysis step={step} {...props} />; break;
    case "predict": activity = <Predict step={step} {...props} />; break;
    case "readcheck": activity = <ReadCheck step={step} {...props} />; break;
    case "reflect": activity = <Reflect step={step} {...props} />; break;
    case "run": activity = <RunStep step={step} {...props} />; break;
    case "mission": activity = <MissionStep step={step} {...props} />; break;
    case "debug": activity = <DebugStep step={step} {...props} />; break;
    case "design": activity = <DesignStep step={step} {...props} />; break;
    case "app": activity = <AppStep step={step} {...props} />; break;
  }
  // 편집기 단계의 「작품으로 저장」이 이 챕터·단계를 알도록 (TrackEditor 가 읽는다)
  activity = <ProjectSaveTargetContext.Provider value={saveTarget}>{activity}</ProjectSaveTargetContext.Provider>;

  const ready = canComplete(step, input, { explainGate });
  /** 판정은 통과했는데 교사 "설명 확인"만 남았다 */
  const awaiting = !done && awaitingExplain(step, input, { explainGate });
  const part = chapter.parts.find((p) => p.steps.some((s) => s.id === step.id));

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="flex h-14 shrink-0 items-center gap-2 overflow-hidden border-b px-2 whitespace-nowrap sm:gap-3 sm:px-3">
        <Button variant="ghost" asChild className="h-11 px-3 text-sm">
          <HostLink to={nav.href.chapter(chapter.id)}><ArrowLeft className="size-4" /><span className="hidden sm:inline">{chapter.title}</span><span className="sm:hidden">단계 목록</span></HostLink>
        </Button>
        {readOnly && <ReviewBadge />}
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-11 md:inline-flex"
          onClick={() => setGuideCollapsed(!guideCollapsed)}
          aria-controls="step-guide"
          aria-expanded={!guideCollapsed}
          aria-label={guideCollapsed ? "안내 칸 펼치기" : "안내 칸 접기"}
          title={guideCollapsed ? "안내 칸 펼치기" : "안내 칸 접기"}
          data-testid="guide-toggle"
        >
          {guideCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
        {/* 안내 칸을 접으면 제목을 위 줄에 남긴다 */}
        {guideCollapsed && <span className="hidden min-w-0 truncate text-base font-medium md:block">{step.title}</span>}
        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          {/* 수업 보드 (배선이 있는 챕터만, 작은 모양): 챕터 화면의 고르는 칸과 같은 값 */}
          {boardSelect && <BoardSelect compact />}
          <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", boardSelect ? "w-28 sm:w-48 lg:w-64" : "w-40 sm:w-64")}>
            <Progress value={(doneCount / steps.length) * 100} className="h-2" aria-label="챕터 진행률" />
            <span className="shrink-0" data-testid="step-position">{index + 1} / {steps.length}</span>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto lg:grid lg:overflow-hidden",
          guideCollapsed ? "lg:grid-cols-1" : "lg:grid-cols-[clamp(320px,34%,520px)_minmax(0,1fr)]",
        )}
      >
        <aside
          id="step-guide"
          aria-label="안내"
          data-testid="step-guide"
          className={cn("border-b p-4 sm:p-6 lg:overflow-y-auto lg:border-r lg:border-b-0", guideCollapsed && "md:hidden")}
        >
          <StepGuide chapter={chapter} step={step} partTitle={part?.title} done={done} awaiting={awaiting} />
        </aside>
        {/* 활동 칸 (기본 글자 16 → md 17px, lib-v1.0.6): 세로로 꽉 차게 (편집기·입력 칸이 남는 높이를 채운다). 칸 폭에 따라 안쪽 배치가 바뀐다(@container) */}
        <section className="@container flex min-h-0 flex-col p-4 text-base sm:p-6 md:text-md lg:overflow-y-auto" aria-label="활동" data-testid="step-activity">
          {readOnly ? (
            // 열람 모드: 안의 입력·버튼을 모두 끈다 (display:contents 로 배치는 그대로)
            <fieldset disabled className="min-w-0 border-0 p-0 [display:contents]" data-testid="review-activity">
              {activity}
            </fieldset>
          ) : (
            activity
          )}
        </section>
      </div>

      {/* 이전·완료·다음: 터치 대상 44px (h-11) */}
      <div className="flex shrink-0 items-center gap-2 border-t px-3 py-2 [&_[data-slot=button]]:h-11 [&_[data-slot=button]]:px-4 [&_[data-slot=button]]:text-base">
        {prev ? (
          <Button variant="outline" asChild><HostLink to={nav.href.step(chapter.id, prev.id)}><ArrowLeft className="size-4" />이전</HostLink></Button>
        ) : (
          <Button variant="outline" disabled><ArrowLeft className="size-4" />이전</Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {done ? (
            <span className="hidden items-center gap-1 text-base text-primary sm:flex"><CheckCircle2 className="size-4" />완료한 단계예요</span>
          ) : readOnly ? (
            <span className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex" data-testid="step-not-done">아직 끝내지 않은 단계예요</span>
          ) : (
            <>
              {awaiting && (
                <span className="hidden items-center gap-1 text-sm text-amber-700 sm:flex dark:text-amber-400" data-testid="step-awaiting">
                  <Hourglass className="size-4" />확인 대기
                </span>
              )}
              {/* 건너뛰기는 선택 단계만 (§8.3). 필수 편집기 단계는 실행·판정을 통과해야 끝난다 */}
              {editor && step.optional && <Button variant="secondary" onClick={() => complete({ skipped: true })}><SkipForward className="size-4" />건너뛰기</Button>}
              <Button
                onClick={() => complete()}
                disabled={!ready}
                title={ready ? undefined : awaiting ? "선생님 확인을 받으면 누를 수 있어요" : "활동을 마치면 누를 수 있어요"}
              >
                <Check className="size-4" />완료
              </Button>
            </>
          )}
          {next ? (
            nextOpen ? (
              <Button variant={done ? "default" : "outline"} asChild><HostLink to={nav.href.step(chapter.id, next.id)}>다음<ArrowRight className="size-4" /></HostLink></Button>
            ) : (
              <Button variant="outline" disabled>다음<ArrowRight className="size-4" /></Button>
            )
          ) : (
            <Button variant={done ? "default" : "outline"} asChild><HostLink to={nav.href.chapter(chapter.id)}>단계 목록<ArrowRight className="size-4" /></HostLink></Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** 안내 칸: 배지·제목 → 장면 그림 → 글 → 지금 할 일 → 이렇게 되면 성공(run 의 expected) → (접힘) 부품과 배선 → 시간·완료 */
function StepGuide({
  chapter, step, partTitle, done, awaiting,
}: { chapter: LoadedChapter; step: Step; partTitle?: string; done: boolean; awaiting: boolean }) {
  const board = useBoardChoice();
  const hasKit = Boolean(materialsForBoard(chapter.materials, board).length || chapter.wiring);
  return (
    <>
      {partTitle && <p className="text-sm text-muted-foreground">{partTitle}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Badge variant="secondary"><StepTypeIcon type={step.type} />{STEP_TYPE_LABEL[step.type]}</Badge>
        {step.optional && <Badge variant="outline">선택</Badge>}
        {/* 설명 관문: 판정은 통과, 교사 확인만 남음 (좁은 화면에서도 보이는 자리) */}
        {awaiting && <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400"><Hourglass />확인 대기</Badge>}
      </div>
      <h1 className="mt-3 text-xl leading-snug font-bold tracking-tight break-keep sm:text-2xl xl:text-3xl xl:leading-tight">{step.title}</h1>

      {/* 조건 분석의 세 칸 그림은 활동 칸에서 입력 칸 바로 위에 보인다 (두 번 그리지 않게) */}
      {step.scene && !(step.type === "analysis" && step.scene.image === ANALYSIS_IMAGE) && (
        <Illustration
          chapterId={chapter.id}
          image={step.scene.image}
          caption={figureCaption(step.scene, board)}
          className="mt-4 max-w-xl rounded-lg border bg-muted/30 p-3"
          zoomable
        />
      )}

      <GuideBody text={step.body ?? STEP_TYPE_GUIDE[step.type]} className="mt-4" />

      {step.todo && (
        <Card size="sm" className="mt-4" data-testid="step-todo">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-md font-semibold group-data-[size=sm]/card:text-md"><ListChecks className="size-4 text-primary" />지금 할 일</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {step.todo.map((t) => (
                <li key={t} className="flex items-start gap-2">
                  {/* 체크 표시는 장식: 완료 조건은 유형별 규칙 그대로 */}
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1 flex size-4 shrink-0 items-center justify-center rounded border",
                      done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                    )}
                  >
                    {done && <Check className="size-3" />}
                  </span>
                  <GuideBody text={t} className="space-y-0" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 실행 결과 (Keyestudio 수업의 "실행 결과"): 코드를 올리면 무엇이 보이는지 */}
      {step.type === "run" && step.expected && (
        <Card size="sm" className="mt-4" data-testid="step-expected">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-md font-semibold group-data-[size=sm]/card:text-md"><CircleCheck className="size-4 text-primary" />이렇게 되면 성공</CardTitle>
          </CardHeader>
          <CardContent>
            <GuideBody text={step.expected} />
          </CardContent>
        </Card>
      )}

      {hasKit && (
        <Collapsible className="mt-4 rounded-lg border" data-testid="step-kit">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="group h-11 w-full justify-start rounded-lg text-base">
              <Cable className="size-4" />부품과 배선
              <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 px-3 pt-1 pb-3">
            {chapter.materials && <MaterialChips chapterId={chapter.id} materials={chapter.materials} board={board} />}
            {chapter.wiring && (
              <Illustration chapterId={chapter.id} image={chapter.wiring.image} caption={figureCaption(chapter.wiring, board)} className="rounded-md bg-muted/30 p-2" zoomable />
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {(step.minutes || done) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {step.minutes && <span className="flex items-center gap-1"><Clock className="size-3" />{step.minutes}분</span>}
          {done && <span className="flex items-center gap-1 text-primary"><CheckCircle2 className="size-3" />완료함</span>}
        </div>
      )}
    </>
  );
}
