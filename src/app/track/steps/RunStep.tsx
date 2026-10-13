import { useRef } from "react";
import { CheckCircle2, Play, Usb } from "lucide-react";
import type { RunInput } from "@/track/completion";
import { TrackEditor } from "../TrackEditor";
import type { StepProps } from "./types";
import { useStepInput } from "./useStepInput";

/** 복사·실행: 지정 코드가 실린 편집기에서 보드(가짜 포함)로 한 번 끝까지 실행하면 완료 */
export function RunStep({ step, chapter, input, onInput, onComplete }: StepProps<"run">) {
  const r = input as RunInput;
  const update = useStepInput<RunInput>(input, onInput);
  const ranRef = useRef(r.ran === true);

  return (
    <div className="space-y-4">
      <ol className="space-y-1 text-sm text-muted-foreground">
        <li className="flex items-center gap-2"><Usb className="size-4" />1. 위쪽 <strong className="text-foreground">보드 연결</strong>을 누르세요</li>
        <li className="flex items-center gap-2"><Play className="size-4" />2. <strong className="text-foreground">실행</strong>을 누르고 아래 콘솔에서 결과를 보세요</li>
      </ol>
      {r.ran && (
        <p className="flex items-center gap-1 text-sm text-primary" role="status"><CheckCircle2 className="size-4" />실행에 성공했어요</p>
      )}
      <TrackEditor
        initialCode={r.program?.code ?? chapter.files[step.code] ?? ""}
        onProgram={(code, blocksJson) => update(() => ({ program: { code, blocksJson } }))}
        onRunEnd={(result) => {
          if (!result.ok || ranRef.current) return;
          ranRef.current = true;
          onComplete({ ran: true });
        }}
      />
    </div>
  );
}
