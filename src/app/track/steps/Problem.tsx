import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ProblemInput } from "@/track/completion";
import type { StepProps } from "./types";

/** 문제 만나기: 질문마다 카드 한 장 (넓은 활동 칸에서는 2열). 카드가 남는 높이를 나눠 채운다 */
export function Problem({ step, input, onInput }: StepProps<"problem">) {
  const answers = (input as ProblemInput).answers ?? [];
  const set = (i: number, text: string) => {
    const next = [...answers];
    next[i] = text;
    onInput({ ...input, answers: next });
  };
  const count = step.questions.length;
  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-sm text-muted-foreground">정답을 맞히는 단계가 아니에요. 질문마다 지금 떠오르는 생각을 내 말로 한 줄 이상 적어 보세요.</p>
      <ol className={cn("grid flex-1 auto-rows-fr grid-cols-1 gap-4", count > 1 && "@lg:grid-cols-2")}>
        {step.questions.map((q, i) => {
          const filled = (answers[i] ?? "").trim() !== "";
          return (
            <li
              key={i}
              className={cn(
                "flex min-h-48 flex-col gap-3 rounded-xl border bg-card p-4",
                // 홀수 개면 마지막 카드는 두 칸을 다 쓴다
                count > 1 && count % 2 === 1 && i === count - 1 && "@lg:col-span-2",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    filled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <Label htmlFor={`q-${i}`} className="pt-0.5 leading-snug">{q}</Label>
              </div>
              <Textarea
                id={`q-${i}`}
                value={answers[i] ?? ""}
                onChange={(e) => set(i, e.target.value)}
                placeholder="내 생각을 적어 보세요"
                className="min-h-24 flex-1 resize-none"
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
