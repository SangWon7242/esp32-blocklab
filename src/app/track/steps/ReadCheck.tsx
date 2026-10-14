import { useMemo, useState } from "react";
import { CheckCircle2, MousePointerClick, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { gradeReadCheck, type ReadCheckInput } from "@/track/completion";
import type { ReadQuestion } from "@/track/schema";
import type { LineHighlight } from "@/components/editor/CodePanel";
import { CODE_SPLIT, CODE_SPLIT_CODE, CODE_SPLIT_PANEL, ReadOnlyCode } from "./ReadOnlyCode";
import type { StepProps } from "./types";

function answerText(q: ReadQuestion): string {
  if (q.kind === "choice") return q.options[q.answer];
  if (q.kind === "line") return `${q.answer}번 줄`;
  return String(q.answer);
}

export function ReadCheck({ step, chapter, input, onInput, teacherMode, attempts }: StepProps<"readcheck">) {
  const rc = input as ReadCheckInput;
  const answers = rc.answers ?? [];
  const results = rc.results ?? [];
  const lineQuestions = step.questions.flatMap((q, i) => (q.kind === "line" ? [i] : []));
  /** 코드 줄 번호를 누르면 답이 들어갈 줄 문항 */
  const [activeLine, setActiveLine] = useState<number | undefined>(lineQuestions[0]);

  const setAnswer = (i: number, text: string) => {
    const nextAnswers = [...answers];
    nextAnswers[i] = text;
    const nextResults = [...results];
    nextResults[i] = null; // 답을 바꾸면 그 문항은 다시 확인해야 한다
    onInput({ ...rc, answers: nextAnswers, results: nextResults });
  };

  const highlights = useMemo<LineHighlight[]>(() => {
    if (activeLine === undefined) return [];
    const n = Number(answers[activeLine]);
    return Number.isInteger(n) && n > 0 ? [{ line: n, kind: "focus" }] : [];
  }, [activeLine, answers]);

  const check = () => onInput({ ...rc, answers, results: gradeReadCheck(step.questions, answers) }, { attempt: true });
  const allRight = step.questions.every((_, i) => results[i] === true);
  const allAnswered = step.questions.every((_, i) => (answers[i] ?? "").trim() !== "");

  return (
    <div className={CODE_SPLIT}>
      <ReadOnlyCode
        code={chapter.files[step.code] ?? ""}
        name={step.code}
        highlightLines={highlights}
        onLineClick={activeLine === undefined ? undefined : (line) => setAnswer(activeLine, String(line))}
        className={CODE_SPLIT_CODE}
        panelClassName={CODE_SPLIT_PANEL}
      />
      <div className="space-y-4">
        <ol className="space-y-3">
          {step.questions.map((q, i) => {
            const result = results[i];
            const id = `rq-${i}`;
            return (
              <li
                key={i}
                className={cn(
                  "space-y-2 rounded-xl border bg-card p-4",
                  result === true && "border-primary/50",
                  result === false && "border-destructive/50",
                )}
                data-testid={`readcheck-q-${i}`}
              >
                <Label htmlFor={q.kind === "number" ? id : undefined} className="leading-snug">{i + 1}. {q.q}</Label>
                {q.kind === "number" && (
                  <Input id={id} inputMode="decimal" className="max-w-40" value={answers[i] ?? ""} onChange={(e) => setAnswer(i, e.target.value)} placeholder="숫자" />
                )}
                {q.kind === "choice" && (
                  <RadioGroup value={answers[i] ?? ""} onValueChange={(v) => setAnswer(i, v)} aria-label={q.q}>
                    {q.options.map((opt, k) => (
                      <div key={k} className="flex items-center gap-2">
                        <RadioGroupItem value={String(k)} id={`${id}-${k}`} />
                        <Label htmlFor={`${id}-${k}`} className="font-mono font-normal">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
                {q.kind === "line" && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={cn("rounded-md border px-2 py-1", activeLine === i && "border-primary")} data-testid={`line-answer-${i}`}>
                      {answers[i] ? `고른 줄: ${answers[i]}번` : "아직 고르지 않았어요"}
                    </span>
                    {activeLine === i ? (
                      <span className="flex items-center gap-1 text-muted-foreground"><MousePointerClick className="size-4" />코드의 줄 번호를 눌러 고르세요</span>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setActiveLine(i)}>코드에서 줄 고르기</Button>
                    )}
                  </div>
                )}
                {result === true && (
                  <p className="flex items-center gap-1 text-sm text-primary"><CheckCircle2 className="size-4" />맞았어요</p>
                )}
                {result === false && (
                  <div className="text-sm text-destructive" role="status">
                    <p className="flex items-center gap-1"><XCircle className="size-4" />다시 생각해 보세요</p>
                    {q.hint && <p className="mt-1 text-muted-foreground">힌트: {q.hint}</p>}
                  </div>
                )}
                {teacherMode && <p className="text-xs text-muted-foreground">정답(교사 모드): {answerText(q)}</p>}
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={check} disabled={allRight || !allAnswered}>확인</Button>
          {allRight ? (
            <span className="text-sm text-primary">모두 맞았어요. 아래 완료를 누르세요.</span>
          ) : !allAnswered ? (
            <span className="text-sm text-muted-foreground">모든 문항에 답하면 확인할 수 있어요</span>
          ) : attempts > 0 ? (
            <span className="text-sm text-muted-foreground">확인 {attempts}번</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
