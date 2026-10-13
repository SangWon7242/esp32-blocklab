import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { askClaude, type SavedAiReview } from "@/ai/claude";
import { useSettings } from "../../settings/settings";

type Props = {
  /** 버튼 글 ("내 설명 점검 받기", "질문 3개만 받기") */
  label: string;
  /** 누를 때 보낼 사용자 메시지 */
  buildMessage(): string;
  /** 저장해 둔 지난 결과 */
  review: SavedAiReview | null | undefined;
  /** 받은 결과를 단계 기록에 저장한다 */
  onReview(review: SavedAiReview): void;
  /** 질문만 보여 준다 (디버깅) */
  questionsOnly?: boolean;
  disabled?: boolean;
  disabledTitle?: string;
};

/** AI 점검 버튼 + 결과 카드. 설정에 API 키가 없으면 버튼을 숨긴다. 실패는 알림만 띄우고 진행을 막지 않는다 */
export function AiCheck({ label, buildMessage, review, onReview, questionsOnly, disabled, disabledTitle }: Props) {
  const { claudeApiKey, claudeModel } = useSettings();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const result = await askClaude({ apiKey: claudeApiKey, model: claudeModel, message: buildMessage() });
      onReview({ ...result, at: new Date().toISOString() });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI 점검에 실패했어요", { id: "ai-check" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {claudeApiKey && (
        <Button variant="outline" onClick={() => void run()} disabled={busy || disabled} title={disabled ? disabledTitle : undefined}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? "AI 가 읽는 중…" : label}
        </Button>
      )}
      {review && <AiReviewCard review={review} questionsOnly={questionsOnly} />}
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}

export function AiReviewCard({ review, questionsOnly }: { review: SavedAiReview; questionsOnly?: boolean }) {
  return (
    <Card data-testid="ai-review" className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4" />AI 점검</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        {!questionsOnly && <List title="맞게 설명한 부분" items={review.correct} />}
        {!questionsOnly && <List title="더 생각해 볼 부분" items={review.missing} />}
        <div>
          <p className="text-sm font-medium">스스로 답해 볼 질문</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
            {review.questions.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        </div>
        <p className="text-xs text-muted-foreground">AI 는 틀릴 수 있어요. 답은 직접 코드와 보드로 확인해 보세요.</p>
      </CardContent>
    </Card>
  );
}
