import { useEffect, useRef } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConsoleEntry, Level } from "@/lint";
import { cn } from "@/lib/utils";

const LEVEL_CLASS: Record<Level, string> = {
  error: "text-red-600",
  warning: "text-amber-600",
  info: "text-muted-foreground",
};

/** 보드 행: 출력은 보통 글자, Traceback 은 빨강, 안내는 흐리게 */
const DEVICE_KIND_CLASS: Record<NonNullable<ConsoleEntry["kind"]>, string> = {
  stdout: "text-foreground",
  stderr: "text-red-600",
  system: "text-muted-foreground",
};

const entryClass = (entry: ConsoleEntry) =>
  entry.source === "device" && entry.kind ? DEVICE_KIND_CLASS[entry.kind] : LEVEL_CLASS[entry.level];

type Props = {
  /** 콘솔 항목: 검사·문법 오류(위) 다음에 보드 행(아래) */
  entries: ConsoleEntry[];
  /** 항목을 누르면 (그 줄 강조 + 블록 선택) */
  onSelect(entry: ConsoleEntry): void;
  /** 보드 행 지우기 (검사 항목은 코드에서 나오므로 남는다) */
  onClear?(): void;
};

/** 맨 아래에서 이만큼 안이면 "맨 아래를 보고 있다"로 친다 */
const STICK_PX = 40;

/** 세로로 스크롤되는 가장 가까운 조상 (하단 패널의 내용 칸) */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === "auto" || overflowY === "scroll") return p;
  }
  return null;
}

/** 하단 "콘솔" 탭: 파이썬 모양의 영어 메시지와 보드 출력 (고정폭 글꼴, 여러 줄 그대로) */
export function ConsolePanel({ entries, onSelect, onClear }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastDevice = entries.findLast((e) => e.source === "device");
  const hasEntries = entries.length > 0;
  /** 학생이 맨 아래를 보고 있는지 (위로 올려 옛 출력을 읽는 중이면 새 행이 와도 끌어내리지 않는다) */
  const stickRef = useRef(true);

  useEffect(() => {
    const end = endRef.current;
    const scroller = end && scrollParent(end);
    if (!scroller) return;
    const onScroll = () => {
      stickRef.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= STICK_PX;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [hasEntries]);

  // 새 보드 행이 오면 맨 아래로 (검사 항목이 바뀌는 것으로는 움직이지 않는다)
  useEffect(() => {
    if (lastDevice && stickRef.current) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lastDevice]);

  if (entries.length === 0) return <p className="px-3 py-2 text-sm text-muted-foreground">아직 메시지가 없어요</p>;
  return (
    <div className="relative">
      {lastDevice && onClear && (
        <div className="sticky top-0 z-10 flex h-0 justify-end overflow-visible pt-1 pr-2">
          <Button variant="outline" size="sm" className="h-6 bg-background px-2 text-xs" onClick={onClear} aria-label="보드 출력 지우기">
            <Eraser className="size-3.5" />지우기
          </Button>
        </div>
      )}
      <ul className="py-1 font-mono text-xs" data-testid="console-list">
        {entries.map((entry, i) => (
          <li key={entry.source === "device" && entry.id !== undefined ? `d${entry.id}` : `l${i}`}>
            <button
              type="button"
              className={cn(
                "block w-full px-3 py-1 text-left whitespace-pre-wrap hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                entryClass(entry),
                entry.source === "device" && "py-0.5",
                entry.line === undefined && !entry.blockId && "cursor-default",
              )}
              onClick={() => onSelect(entry)}
              data-testid="console-entry"
              data-kind={entry.source === "device" ? entry.kind : undefined}
            >
              {entry.text}
            </button>
          </li>
        ))}
      </ul>
      <div ref={endRef} />
    </div>
  );
}
