import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analysisFilled, type AnalysisInput } from "@/track/completion";
import type { StepProps } from "./types";

const BOXES = [
  { key: "know", label: "알아야 할 것", help: "무엇을 알아내야 하나요?" },
  { key: "decide", label: "정해야 할 것", help: "내가 정할 기준은 무엇인가요?" },
  { key: "act", label: "해야 할 것", help: "결국 무엇을 움직이거나 보여 주나요?" },
] as const;

export function Analysis({ step, input, onInput, teacherMode }: StepProps<"analysis">) {
  const a = input as AnalysisInput;
  const filled = analysisFilled(a);
  const showAnswer = a.revealed === true || teacherMode;
  const matched = a.matched ?? {};
  const total = BOXES.reduce((n, b) => n + step.answer[b.key].length, 0);
  const matchedCount = Object.values(matched).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {BOXES.map((b) => (
          <div key={b.key} className="space-y-2">
            <Label htmlFor={`box-${b.key}`}>{b.label}</Label>
            <Textarea
              id={`box-${b.key}`}
              value={a[b.key] ?? ""}
              onChange={(e) => onInput({ ...a, [b.key]: e.target.value })}
              placeholder={b.help}
              rows={5}
            />
          </div>
        ))}
      </div>

      {!a.revealed && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={!filled} onClick={() => onInput({ ...a, revealed: true })}>
            <Eye className="size-4" />예시 답 보기
          </Button>
          {!filled && <span className="text-sm text-muted-foreground">세 칸을 모두 쓰면 예시 답을 볼 수 있어요</span>}
        </div>
      )}

      {showAnswer && (
        <section className="rounded-lg border bg-muted/40 p-4" data-testid="analysis-answer">
          <h3 className="font-semibold">예시 답 {teacherMode && !a.revealed && <span className="text-xs font-normal text-muted-foreground">(교사 모드)</span>}</h3>
          <p className="mt-1 text-sm text-muted-foreground">내 답에도 있는 항목에 체크해 보세요. 빠진 것이 있다면 내 칸에 덧붙여도 좋아요.</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {BOXES.map((b) => (
              <div key={b.key}>
                <h4 className="mb-2 text-sm font-medium">{b.label}</h4>
                <ul className="space-y-2">
                  {step.answer[b.key].map((item, i) => {
                    const id = `${b.key}:${i}`;
                    return (
                      <li key={id} className="flex items-start gap-2">
                        <Checkbox
                          id={`match-${id}`}
                          checked={matched[id] === true}
                          onCheckedChange={(v) => onInput({ ...a, matched: { ...matched, [id]: v === true } })}
                          className="mt-0.5"
                        />
                        <Label htmlFor={`match-${id}`} className="font-normal leading-snug">{item}</Label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm">{total}개 중 {matchedCount}개가 내 답에도 있어요.</p>
        </section>
      )}
    </div>
  );
}
