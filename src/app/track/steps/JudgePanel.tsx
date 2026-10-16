import { BadgeCheck, CheckCircle2, Gavel, Hourglass, TriangleAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useReadOnly } from "@/host/HostContext";

/** 1분 설명 관문 (설정 explainGate): 통과 뒤 교사가 "설명 확인"을 눌러야 완료할 수 있다 */
export type ExplainGateProps = {
  teacherMode: boolean;
  /** 교사가 이미 확인했는지 */
  explained: boolean;
  /** "설명 확인" 버튼 (교사 모드에서만 보인다) */
  onConfirm(): void;
};

/** 관문이 켜져 있고 아직 확인을 받지 않았을 때의 통과 문구 */
export const EXPLAIN_GATE_TEXT = "통과했어요. 선생님께 1분 설명을 하고 확인을 받아요";

type Props = {
  onJudge(): void;
  /** 마지막 판정 실패 문장 (null 이면 아직 판정 전) */
  failures: string[] | null | undefined;
  passed: boolean | undefined;
  passText: string;
  /** 통과한 판정에 덧붙인 주의 (검사 warning·notes.ts). 통과에는 영향이 없다 */
  notes?: string[] | null;
  /** 1분 설명 관문. 없으면(설정이 꺼져 있으면) 통과 = 완료 가능 */
  explainGate?: ExplainGateProps;
};

/**
 * "판정" 버튼과 결과. 실패하면 규칙의 fail 문장만 보여 준다 (정답은 말하지 않는다). 통과하면 주의 목록을 그 뒤에.
 * 설명 관문이 있으면 통과 문구가 "선생님께 1분 설명을 하고 확인을 받아요" 로 바뀌고,
 * 교사 모드에는 "설명 확인" 버튼이, 학생에게는 "선생님 확인 대기" 배지가 보인다.
 * 열람 모드는 버튼 없이 마지막 판정 결과만 보여 준다.
 */
export function JudgePanel({ onJudge, failures, passed, passText, notes, explainGate }: Props) {
  const readOnly = useReadOnly();
  const waiting = passed === true && explainGate !== undefined && !explainGate.explained;
  const confirmed = passed === true && explainGate?.explained === true;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {!readOnly && <Button onClick={onJudge}><Gavel className="size-4" />판정</Button>}
        {passed && (
          <span className="flex items-center gap-1 text-sm text-primary" role="status">
            <CheckCircle2 className="size-4 shrink-0" />{waiting ? EXPLAIN_GATE_TEXT : passText}
          </span>
        )}
      </div>
      {waiting && (
        <div className="flex flex-wrap items-center gap-2" data-testid="explain-gate">
          {explainGate.teacherMode && !readOnly ? (
            <Button variant="outline" size="sm" onClick={explainGate.onConfirm}><BadgeCheck className="size-4" />설명 확인</Button>
          ) : (
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400"><Hourglass />선생님 확인 대기</Badge>
          )}
        </div>
      )}
      {confirmed && (
        <Badge variant="secondary" data-testid="explain-confirmed"><BadgeCheck />선생님 확인 완료</Badge>
      )}
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
