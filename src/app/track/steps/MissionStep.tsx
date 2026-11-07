import { useRef } from "react";
import { judgeInputOf } from "../judgeInput";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HostLink, useHost, withQuery } from "@/host/HostContext";
import { cn } from "@/lib/utils";
import { onEditedProgram, type MissionInput } from "@/track/completion";
import { judge } from "@/track/judge";
import { useSettings } from "../../settings/settings";
import { judgeNotes } from "../judgeNotes";
import { TrackEditor, type TrackEditorHandle } from "../TrackEditor";
import { JudgePanel } from "./JudgePanel";
import type { StepProps } from "./types";
import { useStepInput } from "./useStepInput";

type MissionStepDef = StepProps<"mission">["step"];

/**
 * 미션 지시문 · 힌트(판정에 한 번 실패한 뒤) · 교사용 정답 코드 링크.
 * 안내 칸의 「미션」 탭에 보이고, 안내 칸을 접으면 활동 칸 위에 보인다 (편집기 자리를 넓히려고 한 곳에만 둔다)
 */
export function MissionBrief({ step, chapterId, failedOnce, teacherMode, className }: {
  step: MissionStepDef;
  chapterId: string;
  failedOnce: boolean;
  teacherMode: boolean;
  className?: string;
}) {
  const { nav } = useHost();
  return (
    <section className={cn("rounded-lg border p-4", className)} data-testid="mission-brief">
      <h3 className="font-semibold">미션</h3>
      <p className="mt-1">{step.instructions}</p>
      {step.hint && failedOnce && (
        <p className="mt-2 flex items-start gap-1 text-sm text-muted-foreground" data-testid="mission-hint">
          <Lightbulb className="mt-0.5 size-4 shrink-0" />힌트: {step.hint}
        </p>
      )}
      {teacherMode && step.answerCode && (
        <Button asChild variant="outline" size="sm" className="mt-3">
          <HostLink to={withQuery(nav.href.lab(), { code: `${chapterId}/${step.answerCode}` })}>정답 코드 열기 ({step.answerCode})</HostLink>
        </Button>
      )}
    </section>
  );
}

/**
 * 미션: 지시문 → 편집기에서 고치기 → 판정 (실패하면 되묻기 문장, 그 뒤에 힌트). 설정 explainGate 면 교사 "설명 확인" 뒤 완료.
 * 지시문은 안내 칸의 「미션」 탭에 있다. 안내 칸을 접었을 때(briefInActivity)만 여기 위에 다시 보인다
 */
export function MissionStep({ step, chapter, input, onInput, teacherMode, briefInActivity }: StepProps<"mission"> & { briefInActivity?: boolean }) {
  const m = input as MissionInput;
  const update = useStepInput<MissionInput>(input, onInput);
  const { explainGate } = useSettings();
  const editor = useRef<TrackEditorHandle>(null);
  /** 마지막 실행의 보드 출력 (outputIncludes 판정용) */
  const output = useRef("");

  const onJudge = () => {
    const program = editor.current?.getProgram();
    if (!program) return;
    const result = judge(step.rules, judgeInputOf(program, output.current), chapter.files);
    // 주의(검사 warning·준비만 한 장치·시작 코드 그대로)는 통과했을 때만 모은다. 완료를 막지 않는다
    const notes = result.pass ? judgeNotes({ program, startCode, rules: step.rules }) : undefined;
    update((cur) => ({
      program: { code: program.code, blocksJson: program.blocksJson },
      passed: result.pass,
      failures: result.failures,
      failedOnce: cur.failedOnce || !result.pass,
      judgedCode: program.code,
      notes,
    }), { attempt: true });
  };

  const startCode = step.code ? chapter.files[step.code] : undefined;
  const initial = m.program?.code ?? startCode ?? "";
  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* 좁은 화면(md 미만)은 안내 칸이 늘 위에 쌓이므로 여기는 넓은 화면에서 접었을 때만 */}
      {briefInActivity && (
        <MissionBrief step={step} chapterId={chapter.id} failedOnce={m.failedOnce === true} teacherMode={teacherMode} className="hidden md:block" />
      )}
      <JudgePanel
        onJudge={onJudge}
        failures={m.failures}
        passed={m.passed}
        passText="통과했어요. 아래 완료를 누르세요."
        notes={m.notes}
        explainGate={explainGate ? { teacherMode, explained: m.explained === true, onConfirm: () => update(() => ({ explained: true })) } : undefined}
      />
      <TrackEditor
        fill
        ref={editor}
        initialCode={initial}
        onProgram={(code, blocksJson) => update((cur) => onEditedProgram(cur, { code, blocksJson }))}
        onRunEnd={(_, text) => { output.current = text; }}
      />
    </div>
  );
}
