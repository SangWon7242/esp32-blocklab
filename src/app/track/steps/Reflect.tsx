import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reflectMessage } from "@/ai/claude";
import { explainableLines, type ReflectInput } from "@/track/completion";
import { AiCheck } from "./AiCheck";
import type { StepProps } from "./types";
import { useStepInput } from "./useStepInput";

export function Reflect({ step, chapter, input, onInput }: StepProps<"reflect">) {
  const r = input as ReflectInput;
  const update = useStepInput<ReflectInput>(input, onInput);
  const lines = r.lines ?? {};
  const prompts = r.prompts ?? [];
  const code = chapter.files[step.lineExplain] ?? "";
  const source = code.split("\n");
  const setPrompt = (i: number, text: string) => {
    const next = [...prompts];
    next[i] = text;
    onInput({ ...r, prompts: next });
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <section>
        <h3 className="font-semibold">한 줄씩 내 말로</h3>
        <p className="mt-1 text-sm text-muted-foreground">{step.lineExplain} 의 줄마다 "이 줄은 ___" 을 채워 보세요. 할 수 있는 만큼 써도 괜찮아요.</p>
        <ol className="mt-3 space-y-2">
          {explainableLines(code).map((n) => (
            <li key={n} className="grid gap-1 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @xl:items-center @xl:gap-3">
              <code className="block truncate rounded bg-muted px-2 py-1 text-xs whitespace-pre" title={source[n - 1]}>
                <span className="mr-2 text-muted-foreground">{n}</span>{source[n - 1]}
              </code>
              <Input
                aria-label={`${n}번 줄 설명`}
                value={lines[n] ?? ""}
                onChange={(e) => onInput({ ...r, lines: { ...lines, [n]: e.target.value } })}
                placeholder="이 줄은 …"
                className="h-8"
              />
            </li>
          ))}
        </ol>
      </section>
      <section className="flex flex-1 flex-col gap-3">
        <div>
          <h3 className="font-semibold">오늘 한 생각</h3>
          <p className="mt-1 text-sm text-muted-foreground">모든 칸을 써야 완료할 수 있어요.</p>
        </div>
        {/* 넓은 활동 칸에서는 2×2 격자. 칸이 남는 높이를 나눠 채운다 */}
        <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-4 @lg:grid-cols-2">
          {step.prompts.map((p, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <Label htmlFor={`prompt-${i}`} className="leading-snug">{i + 1}. {p}</Label>
              <Textarea
                id={`prompt-${i}`}
                value={prompts[i] ?? ""}
                onChange={(e) => setPrompt(i, e.target.value)}
                className="min-h-24 flex-1 resize-none"
              />
            </div>
          ))}
        </div>
      </section>
      <AiCheck
        label="내 설명 점검 받기"
        buildMessage={() => reflectMessage({ code, lines, reflections: step.prompts.map((prompt, i) => ({ prompt, answer: prompts[i] ?? "" })) })}
        review={r.ai}
        onReview={(ai) => update(() => ({ ai }))}
      />
    </div>
  );
}
