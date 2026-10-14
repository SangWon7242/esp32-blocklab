import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PredictInput } from "@/track/completion";
import { CODE_SPLIT, CODE_SPLIT_CODE, CODE_SPLIT_PANEL, ReadOnlyCode } from "./ReadOnlyCode";
import type { StepProps } from "./types";

/** 예측하기: 코드(읽기 전용)와 예상 빈칸을 나란히 */
export function Predict({ step, chapter, input, onInput }: StepProps<"predict">) {
  const answers = (input as PredictInput).answers ?? [];
  const set = (i: number, text: string) => {
    const next = [...answers];
    next[i] = text;
    onInput({ ...input, answers: next });
  };
  return (
    <div className={CODE_SPLIT}>
      <ReadOnlyCode code={chapter.files[step.code] ?? ""} name={step.code} className={CODE_SPLIT_CODE} panelClassName={CODE_SPLIT_PANEL} />
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">실행하기 전에 예상해서 적어 보세요. 틀려도 괜찮아요.</p>
        <ol className="space-y-3">
          {step.blanks.map((b, i) => (
            <li key={i} className="space-y-2 rounded-xl border bg-card p-4">
              <Label htmlFor={`blank-${i}`} className="leading-snug">{i + 1}. {b.q}</Label>
              <div className="flex items-center gap-2">
                <Input id={`blank-${i}`} value={answers[i] ?? ""} onChange={(e) => set(i, e.target.value)} placeholder="내 예상" />
                {b.unit && <span className="shrink-0 text-sm text-muted-foreground">{b.unit}</span>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
