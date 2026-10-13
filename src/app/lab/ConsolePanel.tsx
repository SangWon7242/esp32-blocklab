import type { ConsoleEntry, Level } from "@/lint";
import { cn } from "@/lib/utils";

const LEVEL_CLASS: Record<Level, string> = {
  error: "text-red-600",
  warning: "text-amber-600",
  info: "text-muted-foreground",
};

type Props = {
  /** 콘솔 항목 (지금은 검사·문법 오류, 다음 단계에서 보드 출력도 같은 목록에 붙는다) */
  entries: ConsoleEntry[];
  /** 항목을 누르면 (그 줄 강조 + 블록 선택) */
  onSelect(entry: ConsoleEntry): void;
};

/** 하단 "콘솔" 탭: 파이썬 모양의 영어 메시지 (고정폭 글꼴, 여러 줄 그대로) */
export function ConsolePanel({ entries, onSelect }: Props) {
  if (entries.length === 0) return <p className="px-3 py-2 text-sm text-muted-foreground">아직 메시지가 없어요</p>;
  return (
    <ul className="py-1 font-mono text-xs" data-testid="console-list">
      {entries.map((entry, i) => (
        <li key={i}>
          <button
            type="button"
            className={cn(
              "block w-full px-3 py-1 text-left whitespace-pre-wrap hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
              LEVEL_CLASS[entry.level],
              entry.line === undefined && !entry.blockId && "cursor-default",
            )}
            onClick={() => onSelect(entry)}
            data-testid="console-entry"
          >
            {entry.text}
          </button>
        </li>
      ))}
    </ul>
  );
}
