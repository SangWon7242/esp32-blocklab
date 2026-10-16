import { CheckCircle2, Gavel, TriangleAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onJudge(): void;
  /** 마지막 판정 실패 문장 (null 이면 아직 판정 전) */
  failures: string[] | null | undefined;
  passed: boolean | undefined;
  passText: string;
  /** 통과한 판정에 덧붙인 주의 (검사 warning·notes.ts). 통과에는 영향이 없다 */
  notes?: string[] | null;
};

/** "판정" 버튼과 결과. 실패하면 규칙의 fail 문장만 보여 준다 (정답은 말하지 않는다). 통과하면 주의 목록을 그 뒤에 */
export function JudgePanel({ onJudge, failures, passed, passText, notes }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onJudge}><Gavel className="size-4" />판정</Button>
        {passed && <span className="flex items-center gap-1 text-sm text-primary" role="status"><CheckCircle2 className="size-4" />{passText}</span>}
      </div>
      {!passed && failures && failures.length > 0 && (
        <div className="rounded-lg border border-destructive/40 p-3 text-sm" role="status" data-testid="judge-failures">
          <p className="flex items-center gap-1 font-medium text-destructive"><XCircle className="size-4" />아직이에요. 다시 생각해 보세요</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {failures.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}
      {passed && notes && notes.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 p-3 text-sm" role="note" data-testid="judge-notes">
          <p className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400"><TriangleAlert className="size-4 shrink-0" />주의 (통과에는 영향 없음)</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
