import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** 열람(review) 모드 배지: 학생 기록을 읽기만 한다 (저장·입력 없음). 챕터·단계 화면 위에 붙는다 */
export function ReviewBadge() {
  return (
    <Badge variant="outline" className="border-sky-500/50 text-sky-700 dark:text-sky-400" data-testid="review-badge">
      <Eye />열람 모드
    </Badge>
  );
}
