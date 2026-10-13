import { useRef, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, Lock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { filled, type DebugInput } from "@/track/completion";
import { judge } from "@/track/judge";
import { TrackEditor, type TrackEditorHandle } from "../TrackEditor";
import { JudgePanel } from "./JudgePanel";
import type { StepProps } from "./types";
import { useStepInput } from "./useStepInput";

/** 배열의 i 번째만 바꾼 새 배열 (모자란 칸은 fill 로 채운다) */
function setAt<T>(list: readonly T[] | undefined, i: number, value: T, fill: T): T[] {
  const next = [...(list ?? [])];
  while (next.length <= i) next.push(fill);
  next[i] = value;
  return next;
}

/**
 * 디버깅: 증상마다 ① 증상 카드(고장 코드·되묻기) ② "왜 이런 증상일까?" 설명 저장 → 그 전에는 편집기 잠김
 * ③ 고장 코드가 실린 편집기에서 고치고 판정. 모든 증상을 통과하면 완료할 수 있다.
 */
export function DebugStep({ step, chapter, input, onInput, teacherMode }: StepProps<"debug">) {
  const d = input as DebugInput;
  const update = useStepInput<DebugInput>(input, onInput);
  const firstOpen = step.symptoms.findIndex((_, i) => d.passed?.[i] !== true);
  const [current, setCurrent] = useState(firstOpen < 0 ? 0 : firstOpen);
  const editor = useRef<TrackEditorHandle>(null);
  const output = useRef("");

  const symptom = step.symptoms[current];
  const explanation = d.explanations?.[current] ?? "";
  const saved = d.saved?.[current] === true;
  const passed = d.passed?.[current] === true;

  const onJudge = () => {
    const program = editor.current?.getProgram();
    if (!program) return;
    const result = judge([...symptom.rules, ...step.rules], { code: program.code, blocksJson: program.blocksJson, output: output.current }, chapter.files);
    update((cur) => ({
      programs: setAt(cur.programs, current, { code: program.code, blocksJson: program.blocksJson }, null),
      passed: setAt(cur.passed, current, result.pass, false),
      failures: setAt(cur.failures, current, result.failures, null),
    }), { attempt: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="증상">
        {step.symptoms.map((s, i) => (
          <Button
            key={i}
            role="tab"
            aria-selected={i === current}
            variant={i === current ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrent(i)}
            title={s.title}
          >
            {d.passed?.[i] && <CheckCircle2 className="size-4" />}증상 {i + 1}
          </Button>
        ))}
      </div>

      <section className="rounded-lg border p-4" data-testid="symptom-card">
        <h3 className="font-semibold">증상 {current + 1}. {symptom.title}</h3>
        <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">{symptom.code}</pre>
        <p className="mt-2 text-sm">{symptom.question}</p>
      </section>

      <section className="space-y-2">
        <Label htmlFor={`explain-${current}`}>왜 이런 증상일까?</Label>
        <Textarea
          id={`explain-${current}`}
          key={current}
          rows={3}
          value={explanation}
          onChange={(e) => update((cur) => ({ explanations: setAt(cur.explanations, current, e.target.value, "") }))}
          placeholder="고치기 전에 내 생각을 먼저 적어 보세요"
        />
        <div className="flex items-center gap-3">
          <Button
            variant={saved ? "outline" : "default"}
            disabled={!filled(explanation)}
            onClick={() => update((cur) => ({ saved: setAt(cur.saved, current, true, false) }))}
          >
            <Save className="size-4" />설명 저장
          </Button>
          {saved && <span className="text-sm text-muted-foreground">저장했어요. 이제 아래에서 고쳐 보세요</span>}
        </div>
      </section>

      {!saved ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground" data-testid="editor-locked">
          <Lock className="size-5" />
          설명을 저장하면 편집기가 열려요
        </div>
      ) : (
        <div className={cn("space-y-4")}>
          <JudgePanel
            onJudge={onJudge}
            failures={d.failures?.[current]}
            passed={passed}
            passText={step.symptoms.every((_, i) => d.passed?.[i]) ? "모든 증상을 고쳤어요. 아래 완료를 누르세요." : "이 증상은 고쳤어요. 다음 증상으로 가 보세요."}
          />
          <TrackEditor
            key={current}
            ref={editor}
            initialCode={d.programs?.[current]?.code ?? symptom.code}
            onProgram={(code, blocksJson) => update((cur) => ({ programs: setAt(cur.programs, current, { code, blocksJson }, null) }))}
            onRunEnd={(_, text) => { output.current = text; }}
          />
        </div>
      )}

      {teacherMode && step.answerCode && (
        <Button asChild variant="outline" size="sm">
          <Link to={`/lab?code=${chapter.id}/${step.answerCode}`}>정답 코드 열기 ({step.answerCode})</Link>
        </Button>
      )}
    </div>
  );
}
