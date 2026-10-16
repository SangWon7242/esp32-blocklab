import { Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analysisCompared, analysisFilled, type AnalysisInput } from "@/track/completion";
import { Illustration } from "../Illustration";
import type { StepProps } from "./types";

/** 조건 분석 세 칸 그림 (챕터 폴더에 있으면 입력 칸 위에 보인다) */
export const ANALYSIS_IMAGE = "images/three-boxes.svg";

const BOXES = [
  { key: "know", label: "알아야 할 것", help: "무엇을 알아내야 하나요?" },
  { key: "decide", label: "정해야 할 것", help: "내가 정할 기준은 무엇인가요?" },
  { key: "act", label: "해야 할 것", help: "결국 무엇을 움직이거나 보여 주나요?" },
] as const;

export function Analysis({ step, chapter, input, onInput, teacherMode, readOnly }: StepProps<"analysis">) {
  const a = input as AnalysisInput;
  const filled = analysisFilled(a);
  const showAnswer = a.revealed === true || teacherMode;
  const matched = a.matched ?? {};
  const total = BOXES.reduce((n, b) => n + step.answer[b.key].length, 0);
  const matchedCount = Object.values(matched).filter(Boolean).length;

  // 장면 그림이 세 칸 그림이면 그 설명을 함께 (안내 칸에서는 빼고 여기서만 그린다)
  const caption = step.scene?.image === ANALYSIS_IMAGE ? step.scene.caption : undefined;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <Illustration
        chapterId={chapter.id}
        image={ANALYSIS_IMAGE}
        caption={caption}
        className="mx-auto w-full max-w-lg rounded-lg border bg-muted/30 p-3"
        captionClassName="text-center"
        zoomable
      />
      {/* 세 칸은 남는 높이를 나눠 채운다 (예시 답이 열리면 줄어든다) */}
      <div className="grid flex-1 grid-cols-1 gap-4 @lg:grid-cols-3">
        {BOXES.map((b, i) => (
          <div key={b.key} className="flex flex-col gap-2">
            <Label htmlFor={`box-${b.key}`} className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-semibold" aria-hidden>{i + 1}</span>
              {b.label}
            </Label>
            <Textarea
              id={`box-${b.key}`}
              value={a[b.key] ?? ""}
              onChange={(e) => onInput({ ...a, [b.key]: e.target.value })}
              placeholder={b.help}
              className="min-h-32 flex-1 resize-none @lg:min-h-40"
            />
          </div>
        ))}
      </div>

      {!a.revealed && !teacherMode && !readOnly && (
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
          <div className="mt-3 grid gap-4 @lg:grid-cols-3">
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
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span>{total}개 중 {matchedCount}개가 내 답에도 있어요.</span>
            {a.revealed && analysisCompared(a) ? (
              <span className="flex items-center gap-1 text-primary"><Check className="size-4" />대조를 마쳤어요. 아래 완료를 누르세요.</span>
            ) : readOnly ? null : (
              <>
                {/* 겹치는 항목이 하나도 없을 때도 대조를 마칠 수 있게 (교사 모드에선 예시 답 보기 버튼 대신) */}
                <Button size="sm" variant="secondary" disabled={!filled} onClick={() => onInput({ ...a, revealed: true, compared: true })}>
                  <Check className="size-4" />대조했어요
                </Button>
                {!filled && <span className="text-muted-foreground">세 칸을 모두 쓴 뒤에 대조할 수 있어요</span>}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
