import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PredictInput } from "@/track/completion";
import { ReadOnlyCode } from "./ReadOnlyCode";
import type { StepProps } from "./types";

export function Predict({ step, chapter, input, onInput }: StepProps<"predict">) {
  const answers = (input as PredictInput).answers ?? [];
  const set = (i: number, text: string) => {
    const next = [...answers];
    next[i] = text;
    onInput({ ...input, answers: next });
  };
  return (
    <div className="space-y-5">
      <ReadOnlyCode code={chapter.files[step.code] ?? ""} name={step.code} />
      <p className="text-sm text-muted-foreground">실행하기 전에 예상해서 적어 보세요.</p>
      {step.blanks.map((b, i) => (
        <div key={i} className="space-y-2">
          <Label htmlFor={`blank-${i}`} className="leading-snug">{i + 1}. {b.q}</Label>
          <div className="flex items-center gap-2">
            <Input id={`blank-${i}`} value={answers[i] ?? ""} onChange={(e) => set(i, e.target.value)} placeholder="내 예상" />
            {b.unit && <span className="text-sm text-muted-foreground">{b.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
