import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Issue, Level } from "@/lint";
import { cn } from "@/lib/utils";

const ICONS: Record<Level, { icon: typeof Info; className: string; label: string }> = {
  error: { icon: CircleAlert, className: "text-red-500", label: "오류" },
  warning: { icon: TriangleAlert, className: "text-amber-500", label: "주의" },
  info: { icon: Info, className: "text-muted-foreground", label: "정보" },
};

type Props = {
  issues: Issue[];
  /** 항목을 누르면 (블록 선택 + 코드 줄 강조) */
  onSelect(issue: Issue): void;
};

/** 하단 "문제" 탭: 학생용 한글 문구. 누르면 그 블록과 코드 줄로 간다 */
export function ProblemsPanel({ issues, onSelect }: Props) {
  if (issues.length === 0) return <p className="px-3 py-2 text-sm text-muted-foreground">문제가 없어요</p>;
  return (
    <ul className="py-1" data-testid="problems-list">
      {issues.map((issue, i) => {
        const { icon: Icon, className, label } = ICONS[issue.level];
        return (
          <li key={`${issue.id}-${issue.blockId ?? ""}-${i}`}>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              onClick={() => onSelect(issue)}
              data-testid="problem-item"
            >
              <Icon className={cn("size-4 shrink-0", className)} aria-label={label} />
              <span className="min-w-0 flex-1 truncate">{issue.ko}</span>
              {issue.line !== undefined && <Badge variant="outline" className="shrink-0 font-normal">{issue.line}줄</Badge>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
