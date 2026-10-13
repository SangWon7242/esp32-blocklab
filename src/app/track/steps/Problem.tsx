import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProblemInput } from "@/track/completion";
import type { StepProps } from "./types";

export function Problem({ step, input, onInput }: StepProps<"problem">) {
  const answers = (input as ProblemInput).answers ?? [];
  const set = (i: number, text: string) => {
    const next = [...answers];
    next[i] = text;
    onInput({ ...input, answers: next });
  };
  return (
    <div className="space-y-5">
      {step.questions.map((q, i) => (
        <div key={i} className="space-y-2">
          <Label htmlFor={`q-${i}`} className="leading-snug">{i + 1}. {q}</Label>
          <Textarea id={`q-${i}`} value={answers[i] ?? ""} onChange={(e) => set(i, e.target.value)} placeholder="내 생각을 적어 보세요" rows={3} />
        </div>
      ))}
    </div>
  );
}
