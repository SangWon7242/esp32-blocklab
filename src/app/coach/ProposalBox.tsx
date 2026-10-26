import { useMemo } from "react";
import { Check, GitCompareArrows, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CODE_FONT_FAMILY, CODE_FONT_SIZE_DEFAULT, CODE_FONT_SIZE_VAR, CODE_LINE_HEIGHT } from "@/host/codeFontSize";
import { cn } from "@/lib/utils";
import { diffStats, foldRows, lineDiff } from "./lineDiff";

type Props = {
  /** 지금 편집기 코드 */
  current: string;
  /** 제안 코드 (편집기 전체를 바꿀 코드) */
  proposed: string;
  note?: string;
  /** 보기만 하는 화면이면 「적용」 을 막는다 */
  readOnly?: boolean;
  onApply(): void;
  onClose(): void;
};

/** 줄 차이 글자 칸: 학생이 고른 코드 글자 크기를 따른다 (Provider 의 CSS 변수) */
const codeStyle = {
  fontFamily: CODE_FONT_FAMILY,
  fontSize: `var(${CODE_FONT_SIZE_VAR}, ${CODE_FONT_SIZE_DEFAULT}px)`,
  lineHeight: String(CODE_LINE_HEIGHT),
  fontVariantLigatures: "none",
} as const;

/**
 * 코치 제안 상자 (lib-v1.1.0): 지금 코드와 제안 코드의 줄 차이. 더한 줄은 초록 띠와 +, 지운 줄은 빨간 띠와 − 로
 * 색이 없어도 기호로 구분된다. 줄 번호는 지금 코드 번호 · 제안 코드 번호 두 칸. 긴 같은 줄은 접는다.
 */
export function ProposalBox({ current, proposed, note, readOnly, onApply, onClose }: Props) {
  const rows = useMemo(() => lineDiff(current, proposed), [current, proposed]);
  const folded = useMemo(() => foldRows(rows), [rows]);
  const { added, removed } = diffStats(rows);
  const unchanged = added === 0 && removed === 0;

  return (
    <section
      className="mx-2 my-2 flex max-h-[45%] min-h-0 min-w-0 shrink-0 flex-col overflow-hidden rounded-lg border border-violet-300 bg-violet-50/60 shadow-sm dark:border-violet-800 dark:bg-violet-950/30"
      aria-label="제안된 변경"
      data-testid="coach-proposal"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-violet-200 px-3 py-2 dark:border-violet-900">
        <GitCompareArrows className="size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
        <span className="font-medium">제안된 변경</span>
        <span className="text-sm text-muted-foreground" data-testid="coach-proposal-stats">
          {unchanged ? "바뀐 줄이 없어요" : `더한 줄 ${added}개 · 지운 줄 ${removed}개`}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={onApply} disabled={readOnly} data-testid="coach-proposal-apply">
            <Check className="size-4" />적용
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} data-testid="coach-proposal-close">
            <X className="size-4" />닫기
          </Button>
        </div>
        {note && <p className="w-full truncate text-sm" title={note} data-testid="coach-proposal-note">{note}</p>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-background" role="table" aria-label="줄 차이" style={codeStyle}>
        <div className="min-w-max">
          {folded.map((r, i) =>
            r.kind === "fold" ? (
              <div key={i} role="row" className="flex text-muted-foreground" data-kind="fold">
                <span aria-hidden className="w-[7.5em] shrink-0" />
                <span role="cell" className="py-0.5 font-sans text-xs">같은 줄 {r.count}개</span>
              </div>
            ) : (
              <div
                key={i}
                role="row"
                data-kind={r.kind}
                aria-label={r.kind === "add" ? `더한 줄 ${r.newLine}` : r.kind === "del" ? `지운 줄 ${r.oldLine}` : undefined}
                className={cn(
                  "flex whitespace-pre",
                  r.kind === "add" && "bg-green-500/15 text-green-950 dark:text-green-100",
                  r.kind === "del" && "bg-red-500/15 text-red-950 dark:text-red-100",
                )}
              >
                <span role="cell" className="w-[3em] shrink-0 select-none pr-1 text-right text-muted-foreground tabular-nums">
                  {r.kind !== "add" ? r.oldLine : ""}
                </span>
                <span role="cell" className="w-[3em] shrink-0 select-none pr-1 text-right text-muted-foreground tabular-nums">
                  {r.kind !== "del" ? r.newLine : ""}
                </span>
                <span role="cell" aria-hidden className={cn("w-[1.5em] shrink-0 select-none text-center font-bold", r.kind === "add" && "text-green-700 dark:text-green-400", r.kind === "del" && "text-red-700 dark:text-red-400")}>
                  {r.kind === "add" ? "+" : r.kind === "del" ? "−" : " "}
                </span>
                <span role="cell" className="pr-3">{r.text || " "}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
