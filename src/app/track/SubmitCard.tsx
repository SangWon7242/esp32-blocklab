import { useState } from "react";
import { CheckCircle2, LoaderCircle, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHost } from "@/host/HostContext";
import type { LoadedChapter } from "@/track/content";
import { allSteps, type StepState } from "@/track/gating";
import type { Progress } from "@/track/progress";
import type { Chapter } from "@/track/schema";
import { chapterSnapshot } from "@/track/snapshot";

/*
 * 제출 카드 (계획 13): 챕터의 필수 단계를 모두 끝냈을 때 챕터 화면 끝에 보인다.
 * 호스트가 onSubmit 을 주지 않으면(체험판) 없고, 열람 모드에서도 없다. 제출은 스냅숏(chapterSnapshot)을 호스트에 넘기는 것까지.
 */

export type SubmitStatus = "idle" | "submitting" | "done" | "failed";

export const SUBMIT_TEXT = {
  title: "선생님께 제출",
  ready: "모든 단계를 마쳤어요. 지금까지 쓴 답과 코드를 선생님께 보낼 수 있어요.",
  submit: "제출",
  resubmit: "다시 제출",
  submitting: "제출 중",
  done: "제출했어요. 답이나 코드를 고치면 다시 제출할 수 있어요.",
  failed: "제출하지 못했어요. 잠시 뒤 다시 해 보세요.",
} as const;

/** 필수 단계(optional 이 아닌 단계)가 모두 done 인가 — 설명 관문(awaiting)은 done 이 아니므로 제출할 수 없다 */
export function canSubmitChapter(chapter: Chapter, states: Readonly<Record<string, StepState | undefined>>): boolean {
  return allSteps(chapter).filter((s) => !s.optional).every((s) => states[s.id] === "done");
}

type ViewProps = {
  status: SubmitStatus;
  /** 마지막으로 제출한 때 (ISO) */
  submittedAt?: string | null;
  onSubmit(): void;
};

function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("ko-KR", { hour12: false });
}

/** 제출 카드 모양 (상태는 밖에서 받는다 — 테스트와 호스트가 그대로 그릴 수 있게) */
export function SubmitCardView({ status, submittedAt, onSubmit }: ViewProps) {
  const submitting = status === "submitting";
  const again = status === "done" || status === "failed";
  return (
    <Card className="border-primary/40" data-testid="submit-card" data-status={status}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Send className="size-4 text-primary" />{SUBMIT_TEXT.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "done" ? (
          <p className="flex items-start gap-2 text-sm text-primary" role="status">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>
              {SUBMIT_TEXT.done}
              {submittedAt && <span className="ml-2 text-xs text-muted-foreground">{clock(submittedAt)}</span>}
            </span>
          </p>
        ) : status === "failed" ? (
          <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
            <XCircle className="mt-0.5 size-4 shrink-0" />{SUBMIT_TEXT.failed}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{SUBMIT_TEXT.ready}</p>
        )}
        <Button onClick={onSubmit} disabled={submitting} aria-busy={submitting || undefined}>
          {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
          {submitting ? SUBMIT_TEXT.submitting : again ? SUBMIT_TEXT.resubmit : SUBMIT_TEXT.submit}
        </Button>
      </CardContent>
    </Card>
  );
}

type Props = {
  chapter: LoadedChapter;
  /** ChapterPage 가 계산한 단계 상태 (stepStates — 설명 관문 포함) */
  states: Readonly<Record<string, StepState | undefined>>;
  /** 스냅숏을 뜰 진행 기록 */
  progress: Progress;
};

/** 제출 카드. 호스트 onSubmit 이 있고, 열람 모드가 아니고, 필수 단계를 모두 끝냈을 때만 보인다 */
export function SubmitCard({ chapter, states, progress }: Props) {
  const { onSubmit, mode } = useHost();
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  if (!onSubmit || mode === "review" || !canSubmitChapter(chapter, states)) return null;

  const submit = async () => {
    if (status === "submitting") return;
    setStatus("submitting");
    try {
      const snapshot = chapterSnapshot(progress, chapter.id);
      await onSubmit(chapter.id, snapshot);
      setSubmittedAt(snapshot.takenAt);
      setStatus("done");
    } catch {
      setStatus("failed");
    }
  };

  return <SubmitCardView status={status} submittedAt={submittedAt} onSubmit={() => void submit()} />;
}
