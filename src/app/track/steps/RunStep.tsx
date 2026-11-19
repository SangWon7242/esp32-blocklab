import { useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Play, Square, Usb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { runSucceeded, type RunInput } from "@/track/completion";
import { TrackEditor } from "../TrackEditor";
import { CodeNotesBody, CodeNotesLabel, noteHighlight } from "./CodeNotes";
import { ReadOnlyCode } from "./ReadOnlyCode";
import type { StepProps } from "./types";
import { useStepInput } from "./useStepInput";

/**
 * 복사·실행: 지정 코드가 실린 편집기에서 보드(가짜 포함)로 한 번 오류 없이 실행하면 완료.
 * 끝없이 도는 프로그램은 「멈춤」으로 끝내는 것도 해낸 것으로 센다 (runSucceeded).
 * 편집기 위는 한 줄 띠만: 할 일 흐름(보드 연결 → 실행 → 멈춤) · 성공 표시 · 「코드 설명 N줄」 단추.
 * 단추를 누르면 띠 아래에 원본 코드(읽기 전용, 학생이 고쳐도 줄 번호가 그대로)와 줄별 설명이 펼쳐진다 (처음엔 접힘).
 */
export function RunStep({ step, chapter, input, onInput, onComplete }: StepProps<"run">) {
  const r = input as RunInput;
  const update = useStepInput<RunInput>(input, onInput);
  const ranRef = useRef(r.ran === true);
  const [noteLine, setNoteLine] = useState<number | undefined>();
  const highlights = useMemo(() => noteHighlight(noteLine), [noteLine]);

  return (
    <div className="flex flex-1 flex-col gap-3">
      <Collapsible className="space-y-2" data-testid={step.codeNotes ? "code-notes-panel" : undefined}>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground" data-testid="run-strip">
          {r.ran && (
            <span className="mr-1.5 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary" role="status">
              <CheckCircle2 className="size-4" />실행에 성공했어요
            </span>
          )}
          <span className="inline-flex items-center gap-1"><Usb className="size-4" /><strong className="text-foreground">보드 연결</strong></span>
          <ChevronRight className="size-3.5 opacity-60" aria-hidden />
          <span className="inline-flex items-center gap-1"><Play className="size-4" /><strong className="text-foreground">실행</strong>하고 콘솔 보기</span>
          <ChevronRight className="size-3.5 opacity-60" aria-hidden />
          <span className="inline-flex items-center gap-1">끝없이 돌면<Square className="size-4" /><strong className="text-foreground">멈춤</strong></span>
          {step.codeNotes && (
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="group ml-auto">
                <CodeNotesLabel count={step.codeNotes.length} />
                <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
        {step.codeNotes && (
          <CollapsibleContent className="space-y-2 rounded-lg border p-3">
            <CodeNotesBody notes={step.codeNotes} selected={noteLine} onSelect={setNoteLine}>
              <ReadOnlyCode code={chapter.files[step.code] ?? ""} name={`${step.code} (원본)`} highlightLines={highlights} panelClassName="h-56" />
            </CodeNotesBody>
          </CollapsibleContent>
        )}
      </Collapsible>
      <TrackEditor
        fill
        initialCode={r.program?.code ?? chapter.files[step.code] ?? ""}
        onProgram={(code, blocksJson) => update(() => ({ program: { code, blocksJson } }))}
        onRunEnd={(result) => {
          if (!runSucceeded(result) || ranRef.current) return;
          ranRef.current = true;
          onComplete({ ran: true });
        }}
      />
    </div>
  );
}
