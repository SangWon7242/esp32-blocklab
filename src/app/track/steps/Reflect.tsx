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
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold">한 줄씩 내 말로</h3>
        <p className="mt-1 text-sm text-muted-foreground">{step.lineExplain} 의 줄마다 "이 줄은 ___" 을 채워 보세요. 할 수 있는 만큼 써도 괜찮아요.</p>
        <ol className="mt-3 space-y-2">
          {explainableLines(code).map((n) => (
            <li key={n} className="grid gap-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-3">
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
      <section className="space-y-4">
        <h3 className="font-semibold">오늘 한 생각</h3>
        {step.prompts.map((p, i) => (
          <div key={i} className="space-y-2">
            <Label htmlFor={`prompt-${i}`} className="leading-snug">{i + 1}. {p}</Label>
            <Textarea id={`prompt-${i}`} value={prompts[i] ?? ""} onChange={(e) => setPrompt(i, e.target.value)} rows={3} />
          </div>
        ))}
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
