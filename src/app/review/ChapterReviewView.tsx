import type { ReactNode } from "react";
import { BadgeCheck, Check, CheckCircle2, Circle, CircleDashed, SkipForward, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AiReviewCard } from "@/app/track/steps/AiCheck";
import { ReviewBadge } from "@/app/track/ReviewBadge";
import { STEP_TYPE_LABEL } from "@/app/track/stepMeta";
import { StepTypeIcon } from "@/app/track/StepTypeIcon";
import { appCheckOptions, checkAppHtml, designItems, gradeAppReadCheck, stripCodeFence, type AppInput } from "@/track/appCheck";
import {
  explainableLines, type AnalysisInput, type DebugInput, type DesignInput, type MissionInput, type PredictInput, type ProblemInput, type ReadCheckInput,
  type ReflectInput, type RunInput, type SavedProgram,
} from "@/track/completion";
import { getChapter, type LoadedChapter } from "@/track/content";
import { gradeBlanks } from "@/track/design";
import { allSteps } from "@/track/gating";
import type { StepRecord } from "@/track/progress";
import type { ReadQuestion, Step, StepOf } from "@/track/schema";
import { ANALYSIS_BOX_LABEL, isSkipped } from "@/track/snapshot";
import { TRACK_NAME } from "@/track/tracks";
import { CodeView, ProjectPreview } from "./ProjectPreview";

/*
 * 챕터 열람 화면 (계획 13 계약 ChapterReviewView): 한 챕터의 단계를 차례로, 학생이 쓴 답·코드·판정 결과만 깔끔히 보여 준다.
 * 입력 칸·버튼이 없는 읽기 전용 화면이라 교사 열람·제출 보기에 쓴다. 호스트 컨텍스트가 없어도 그려진다.
 */

export const NO_RECORD_TEXT = "기록이 없어요";
export const EMPTY_TEXT = "(비어 있음)";

type Props = { chapterId: string; records: Record<string, StepRecord> };

export function ChapterReviewView({ chapterId, records }: Props) {
  const chapter = getChapter(chapterId);
  if (!chapter) return <p className="p-4 text-sm text-muted-foreground" data-testid="chapter-review-missing">없는 챕터예요: {chapterId}</p>;
  const steps = allSteps(chapter);
  const done = steps.filter((s) => records[s.id]?.status === "done").length;
  const latest = Object.values(records).map((r) => r.updatedAt).sort().at(-1);
  let index = 0;
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6" data-testid="chapter-review">
      <header>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{TRACK_NAME[chapter.track]}</Badge>
          <Badge className="font-semibold">{chapter.label}</Badge>
          <ReviewBadge />
        </div>
        <h1 className="mt-2 text-2xl font-bold">{chapter.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {done} / {steps.length} 단계 완료
          {latest && <span className="ml-2">마지막 기록 {when(latest)}</span>}
        </p>
      </header>
      {chapter.parts.map((part) => (
        <section key={part.id} className="space-y-3">
          <h2 className="font-semibold">{part.title}</h2>
          {part.steps.map((step) => {
            index += 1;
            return <StepReview key={step.id} chapter={chapter} step={step} index={index} record={records[step.id]} />;
          })}
        </section>
      ))}
    </div>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ko-KR", { hour12: false });
}

/* ---------- 단계 카드 ---------- */

function StepReview({ chapter, step, index, record }: { chapter: LoadedChapter; step: Step; index: number; record: StepRecord | undefined }) {
  const input = record?.input ?? {};
  const skipped = record !== undefined && isSkipped(input);
  return (
    <Card size="sm" data-testid={`review-step-${step.id}`} data-status={record?.status ?? "none"}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold" aria-hidden>{index}</span>
          <Badge variant="secondary" className="font-normal"><StepTypeIcon type={step.type} />{STEP_TYPE_LABEL[step.type]}</Badge>
          {step.optional && <Badge variant="outline" className="font-normal">선택</Badge>}
          <span className="font-medium">{step.title}</span>
          <span className="ml-auto flex items-center gap-2 text-xs font-normal text-muted-foreground">
            {record && record.attempts > 0 && <span>시도 {record.attempts}회</span>}
            {record && <span>{when(record.updatedAt)}</span>}
            <StatusBadge record={record} skipped={skipped} />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!record ? <p className="text-sm text-muted-foreground">{NO_RECORD_TEXT}</p> : <StepBody chapter={chapter} step={step} input={input} />}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ record, skipped }: { record: StepRecord | undefined; skipped: boolean }) {
  if (!record) return <Badge variant="outline" className="font-normal"><CircleDashed />기록 없음</Badge>;
  if (skipped) return <Badge variant="outline" className="font-normal"><SkipForward />건너뜀</Badge>;
  if (record.status === "done") return <Badge variant="secondary" className="font-normal text-primary"><CheckCircle2 />완료</Badge>;
  return <Badge variant="outline" className="font-normal"><Circle />진행 중</Badge>;
}

function StepBody({ chapter, step, input }: { chapter: LoadedChapter; step: Step; input: Record<string, unknown> }) {
  switch (step.type) {
    case "problem": return <ProblemReview step={step} input={input as ProblemInput} />;
    case "analysis": return <AnalysisReview step={step} input={input as AnalysisInput} />;
    case "predict": return <PredictReview step={step} input={input as PredictInput} />;
    case "run": return <RunReview input={input as RunInput} />;
    case "readcheck": return <ReadCheckReview step={step} input={input as ReadCheckInput} />;
    case "mission": return <MissionReview step={step} input={input as MissionInput} />;
    case "debug": return <DebugReview step={step} input={input as DebugInput} />;
    case "design": return <DesignReview step={step} input={input as DesignInput} />;
    case "reflect": return <ReflectReview chapter={chapter} step={step} input={input as ReflectInput} />;
    case "app": return <AppReview step={step} input={input as AppInput} />;
  }
}

/* ---------- 공통 조각 ---------- */

/** 학생 글 한 덩이: 비어 있으면 흐리게 표시. 글 사이에 끼울 때는 inline (span) */
function Answer({ text, className, inline }: { text: string | undefined; className?: string; inline?: boolean }) {
  const t = (text ?? "").trim();
  const Tag = inline ? "span" : "p";
  return t
    ? <Tag className={cn("text-sm whitespace-pre-wrap break-words", className)} data-testid="review-answer">{t}</Tag>
    : <Tag className={cn("text-sm text-muted-foreground", className)}>{EMPTY_TEXT}</Tag>;
}

/** 질문 → 답 목록 */
function QA({ items }: { items: { prompt: ReactNode; answer: string | undefined }[] }) {
  return (
    <dl className="grid gap-3 @2xl:grid-cols-2">
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border p-3">
          <dt className="text-sm font-medium">{it.prompt}</dt>
          <dd className="mt-1"><Answer text={it.answer} /></dd>
        </div>
      ))}
    </dl>
  );
}

const Mark = ({ ok, label }: { ok: boolean | null | undefined; label?: string }) =>
  ok === true
    ? <span className="inline-flex items-center gap-1 text-primary"><CheckCircle2 className="size-3.5" />{label ?? "맞음"}</span>
    : ok === false
      ? <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="size-3.5" />{label ?? "틀림"}</span>
      : <span className="inline-flex items-center gap-1 text-muted-foreground"><Circle className="size-3.5" />{label ?? "미확인"}</span>;

/** 판정 결과 (버튼 없이): 통과·실패 문장·주의·교사 확인 */
export function JudgeResult({ passed, failures, notes, explained, passText = "통과했어요" }: {
  passed: boolean | undefined;
  failures?: string[] | null;
  notes?: string[] | null;
  explained?: boolean;
  passText?: string;
}) {
  return (
    <div className="space-y-2 text-sm" data-testid="review-judge" data-passed={passed === undefined ? "none" : String(passed)}>
      <div className="flex flex-wrap items-center gap-2">
        {passed === true ? (
          <span className="inline-flex items-center gap-1 font-medium text-primary"><CheckCircle2 className="size-4" />{passText}</span>
        ) : passed === false ? (
          <span className="inline-flex items-center gap-1 font-medium text-destructive"><XCircle className="size-4" />아직 통과하지 못했어요</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground"><Circle className="size-4" />판정하지 않았어요</span>
        )}
        {explained && <Badge variant="secondary"><BadgeCheck />선생님 확인 완료</Badge>}
      </div>
      {passed === false && failures && failures.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-destructive">{failures.map((f, i) => <li key={i}>{f}</li>)}</ul>
      )}
      {passed && notes && notes.length > 0 && (
        <div className="rounded-md border border-amber-500/40 p-2">
          <p className="font-medium text-amber-700 dark:text-amber-400">주의 (통과에는 영향 없음)</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function Program({ program, name }: { program: SavedProgram | null | undefined; name?: string }) {
  if (!program) return <p className="text-sm text-muted-foreground">저장한 프로그램이 없어요</p>;
  return <ProjectPreview code={program.code} blocksJson={program.blocksJson} name={name ?? "저장한 프로그램"} />;
}

/* ---------- 유형별 ---------- */

function ProblemReview({ step, input }: { step: StepOf<"problem">; input: ProblemInput }) {
  return <QA items={step.questions.map((q, i) => ({ prompt: `${i + 1}. ${q}`, answer: input.answers?.[i] }))} />;
}

function AnalysisReview({ step, input }: { step: StepOf<"analysis">; input: AnalysisInput }) {
  const boxes = (["know", "decide", "act"] as const).map((key) => ({ key, label: ANALYSIS_BOX_LABEL[key], text: input[key], example: step.answer[key] }));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 @2xl:grid-cols-3">
        {boxes.map((b) => (
          <div key={b.key} className="rounded-lg border p-3">
            <p className="text-sm font-medium">{b.label}</p>
            <Answer text={b.text} className="mt-1" />
            <p className="mt-2 text-xs text-muted-foreground">예시 답</p>
            <ul className="mt-0.5 space-y-0.5 text-xs">
              {b.example.map((e, i) => (
                <li key={i} className="flex items-center gap-1">
                  {input.matched?.[`${b.key}:${i}`] ? <Check className="size-3 text-primary" aria-label="내 답에도 있다고 표시" /> : <span className="inline-block size-3" aria-hidden />}
                  {e}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {input.revealed ? (input.compared || Object.values(input.matched ?? {}).some(Boolean) ? "예시 답을 열어 내 답과 대조했어요" : "예시 답을 열었지만 대조 표시는 없어요") : "예시 답은 아직 열지 않았어요"}
      </p>
    </div>
  );
}

function PredictReview({ step, input }: { step: StepOf<"predict">; input: PredictInput }) {
  return (
    <QA items={step.blanks.map((b, i) => ({
      prompt: `${i + 1}. ${b.q}`,
      answer: input.answers?.[i] && b.unit ? `${input.answers[i]} ${b.unit}` : input.answers?.[i],
    }))} />
  );
}

function RunReview({ input }: { input: RunInput }) {
  return (
    <div className="space-y-3">
      <p className="text-sm"><Mark ok={input.ran ? true : isSkipped(input) ? null : false} label={input.ran ? "보드에서 끝까지 실행했어요" : isSkipped(input) ? "실행하지 않고 건너뛰었어요" : "아직 실행하지 않았어요"} /></p>
      {input.program && <Program program={input.program} />}
    </div>
  );
}

/** 읽기 체크 답을 글로: 선택지는 그 글, 줄 번호는 "n번 줄" */
export function readAnswerText(q: ReadQuestion, given: string | undefined): string {
  const t = (given ?? "").trim();
  if (!t) return "";
  if (q.kind === "choice") return q.options[Number(t)] ?? t;
  if (q.kind === "line") return `${t}번 줄`;
  return t;
}

function ReadCheckReview({ step, input }: { step: StepOf<"readcheck">; input: ReadCheckInput }) {
  return (
    <ol className="space-y-2">
      {step.questions.map((q, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border p-3 text-sm">
          <span className="font-medium">{i + 1}. {q.q}</span>
          <span className="ml-auto flex items-center gap-3">
            <span>학생 답: <Answer text={readAnswerText(q, input.answers?.[i])} inline /></span>
            <span className="text-muted-foreground">정답: {readAnswerText(q, String(q.answer))}</span>
            <Mark ok={input.results?.[i]} />
          </span>
        </li>
      ))}
    </ol>
  );
}

function MissionReview({ step, input }: { step: StepOf<"mission">; input: MissionInput }) {
  return (
    <div className="space-y-3">
      <p className="text-sm"><span className="font-medium">미션</span> {step.instructions}</p>
      <JudgeResult passed={input.passed} failures={input.failures} notes={input.notes} explained={input.explained} />
      {input.explainMemo?.trim() && <p className="text-sm"><span className="font-medium">1분 설명 메모</span> {input.explainMemo}</p>}
      <Program program={input.program} />
    </div>
  );
}

function DebugReview({ step, input }: { step: StepOf<"debug">; input: DebugInput }) {
  return (
    <div className="space-y-4">
      {step.symptoms.map((s, i) => (
        <section key={i} className="space-y-3 rounded-lg border p-3" data-testid={`review-symptom-${i}`}>
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            증상 {i + 1}. {s.title}
            <Mark ok={input.passed?.[i] ? true : input.programs?.[i] ? false : undefined} label={input.passed?.[i] ? "고쳤어요" : input.programs?.[i] ? "아직" : "손대지 않음"} />
          </h3>
          <CodeView code={s.code} name="고장 난 코드" />
          <p className="text-sm text-muted-foreground">{s.question}</p>
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">왜 이런 증상일까?</p>
            <Answer text={input.explanations?.[i]} className="mt-1" />
          </div>
          {input.ai?.[i] && <AiReviewCard review={input.ai[i]!} questionsOnly />}
          {input.programs?.[i] && (
            <>
              <JudgeResult passed={input.passed?.[i]} failures={input.failures?.[i]} notes={input.notes?.[i]} passText="이 증상은 고쳤어요" />
              <Program program={input.programs[i]} name="고친 프로그램" />
            </>
          )}
        </section>
      ))}
      {(input.explained || input.explainMemo?.trim()) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {input.explained && <Badge variant="secondary"><BadgeCheck />선생님 확인 완료</Badge>}
          {input.explainMemo?.trim() && <span><span className="font-medium">1분 설명 메모</span> {input.explainMemo}</span>}
        </div>
      )}
    </div>
  );
}

function DesignReview({ step, input }: { step: StepOf<"design">; input: DesignInput }) {
  const blanks = input.blanks ?? [];
  const graded = input.blankResults ?? gradeBlanks(step, blanks);
  return (
    <div className="space-y-3">
      <ol className="space-y-1 rounded-lg border p-3 text-sm" data-testid="review-pseudocode">
        {step.pseudocode.map((line, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <span className="w-5 text-right text-xs text-muted-foreground">{i + 1}</span>
            {line.blank ? (
              <>
                <span>{line.text.replace("__", `[ ${(blanks[i] ?? "").trim() || "　"} ]`)}</span>
                <Mark ok={graded[i]} />
                <span className="text-xs text-muted-foreground">예시 답 {String(line.blank.answer)}</span>
              </>
            ) : (
              <span>{line.text}</span>
            )}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        {input.blanksDone ? "빈칸을 모두 맞혔어요" : "빈칸을 아직 다 맞히지 않았어요"} · {input.tableDone ? "번역표를 확인했어요" : "번역표는 아직이에요"}
      </p>
      <JudgeResult passed={input.passed} failures={input.failures} passText="설계도대로 조립했어요" />
      {input.program && <Program program={input.program} name="조립한 프로그램" />}
    </div>
  );
}

function ReflectReview({ chapter, step, input }: { chapter: LoadedChapter; step: StepOf<"reflect">; input: ReflectInput }) {
  const code = chapter.files[step.lineExplain] ?? "";
  const source = code.split("\n");
  const lines = input.lines ?? {};
  const written = explainableLines(code).filter((n) => (lines[n] ?? "").trim());
  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-sm font-semibold">한 줄씩 내 말로 <span className="font-normal text-muted-foreground">({written.length} / {explainableLines(code).length}줄)</span></h3>
        <ol className="mt-2 space-y-1" data-testid="review-lines">
          {explainableLines(code).map((n) => (
            <li key={n} className="grid gap-1 text-sm @xl:grid-cols-2 @xl:gap-3">
              <code className="truncate rounded bg-muted px-2 py-1 text-xs whitespace-pre" title={source[n - 1]}>
                <span className="mr-2 text-muted-foreground">{n}</span>{source[n - 1]}
              </code>
              <Answer text={lines[n]} />
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h3 className="text-sm font-semibold">오늘 한 생각</h3>
        <div className="mt-2">
          <QA items={step.prompts.map((p, i) => ({ prompt: `${i + 1}. ${p}`, answer: input.prompts?.[i] }))} />
        </div>
      </section>
      {input.ai && <AiReviewCard review={input.ai} />}
    </div>
  );
}

function AppReview({ step, input }: { step: StepOf<"app">; input: AppInput }) {
  const html = input.html?.trim() ? stripCodeFence(input.html) : "";
  const checks = html ? checkAppHtml(html, appCheckOptions(step), step.api) : null;
  const stale = !!html && input.checkedHtml !== input.html;
  const graded = gradeAppReadCheck(step.readcheck, input.answers ?? []);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 @2xl:grid-cols-3">
        {([["show", "보여 줄 값"], ["buttons", "누를 버튼"], ["changes", "바뀌는 모습"]] as const).map(([key, label]) => (
          <div key={key} className="rounded-lg border p-3">
            <p className="text-sm font-medium">{label}</p>
            {designItems(input.design?.[key]).length ? (
              <ul className="mt-1 list-disc pl-5 text-sm">{designItems(input.design?.[key]).map((t, i) => <li key={i}>{t}</li>)}</ul>
            ) : <p className="mt-1 text-sm text-muted-foreground">{EMPTY_TEXT}</p>}
          </div>
        ))}
      </div>
      {checks ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">붙여넣기 검사 {stale && <span className="text-xs font-normal text-muted-foreground">(검사한 뒤 글을 고쳤어요 — 지금 글로 다시 본 결과)</span>}</p>
          <ul className="space-y-1 text-sm">{checks.map((c) => <li key={c.id} className="flex items-center gap-2"><Mark ok={c.pass} label={c.label} />{!c.pass && c.fail && <span className="text-muted-foreground">{c.fail}</span>}</li>)}</ul>
          {input.savedHtml && <p className="text-xs text-muted-foreground">보드에 index.html 로 저장했어요</p>}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">붙여 넣은 HTML 보기 ({html.length}자)</summary>
            <CodeView code={html} className="mt-2" />
          </details>
        </div>
      ) : <p className="text-sm text-muted-foreground">AI 결과를 아직 붙여 넣지 않았어요</p>}
      <ol className="space-y-2">
        {step.readcheck.map((q, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border p-3 text-sm">
            <span className="font-medium">{i + 1}. {q.q}</span>
            <span className="ml-auto flex items-center gap-3">
              <span>학생 답: <Answer text={q.kind === "choice" ? q.options[Number(input.answers?.[i])] ?? input.answers?.[i] : input.answers?.[i]} inline /></span>
              {q.kind === "choice" && <span className="text-muted-foreground">정답: {q.options[q.answer]}</span>}
              <Mark ok={q.kind === "text" ? (input.answers?.[i]?.trim() ? true : undefined) : input.results?.[i] ?? (input.answers?.[i] ? graded[i] : undefined)} label={q.kind === "text" ? (input.answers?.[i]?.trim() ? "썼어요" : "미작성") : undefined} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
