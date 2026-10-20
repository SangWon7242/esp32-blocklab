import { useId } from "react";
import { Cpu } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { chapterHasBoardChoice } from "@/track/board";
import { chapterImageRefs } from "@/track/images";
import type { Chapter } from "@/track/schema";
import { BOARD_IDS, BOARD_LABELS, isBoardId, setBoardChoice, useBoardChoice, type BoardId } from "./boardChoice";

/** 좁은 화면에서 보이는 짧은 이름 (읽기 프로그램은 늘 BOARD_LABELS 의 긴 이름을 읽는다) */
const SHORT_LABELS: Record<BoardId, string> = { plus: "ESP32 Plus", devkit: "기본 보드" };
/** 단계 화면 윗줄(compact)의 아주 짧은 이름 */
const TINY_LABELS: Record<BoardId, string> = { plus: "Plus", devkit: "기본" };

export const BOARD_SELECT_TEXT = {
  label: "수업 보드",
  help: "고른 보드에 맞춰 배선 그림·설명·준비물이 바뀌어요. 이 기기에 기억돼 모든 챕터에 적용돼요.",
} as const;

/** 보드 고르는 칸을 보일 챕터인가: 배선도가 있거나 기본 보드 그림(.devkit.svg)·captionDevkit·보드별 준비물이 있다 */
export function chapterShowsBoardSelect(chapter: Pick<Chapter, "id" | "wiring" | "materials" | "parts">): boolean {
  return chapterHasBoardChoice(chapter, chapterImageRefs(chapter.id));
}

type Props = {
  /** 단계 화면 윗줄용 작은 모양: 글 라벨 없이 아이콘 + 아주 짧은 이름 (긴 이름은 aria-label·title) */
  compact?: boolean;
  className?: string;
};

/**
 * 수업 보드 고르기: ESP32 Plus 확장 보드(기본) | 기본 보드 (DevKit 30핀). 두 칸짜리 segmented control.
 * radiogroup 의미(방향키로 옮기면 바로 고른다, Tab 은 고른 칸 하나에만 멈춘다)는 Radix RadioGroup 이 맡는다.
 * 고른 값은 이 기기 localStorage 에 남고 모든 챕터에 적용된다 (boardChoice.ts). 라우터·window 를 import 때 쓰지 않는다 (허브에서도 그대로).
 */
export function BoardSelect({ compact = false, className }: Props) {
  const board = useBoardChoice();
  const labelId = useId();
  return (
    <div
      className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5", compact && "flex-nowrap gap-x-1", className)}
      data-testid="board-select"
      data-board={board}
    >
      {compact ? (
        <Cpu className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <span id={labelId} className="flex items-center gap-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground" title={BOARD_SELECT_TEXT.help}>
          <Cpu className="size-4 shrink-0" aria-hidden />
          {BOARD_SELECT_TEXT.label}
        </span>
      )}
      <RadioGroupPrimitive.Root
        value={board}
        onValueChange={(v) => {
          if (isBoardId(v)) setBoardChoice(v);
        }}
        orientation="horizontal"
        loop
        aria-labelledby={compact ? undefined : labelId}
        aria-label={compact ? BOARD_SELECT_TEXT.label : undefined}
        className="inline-flex shrink-0 items-center rounded-lg border bg-muted p-0.5"
      >
        {BOARD_IDS.map((id) => (
          <RadioGroupPrimitive.Item
            key={id}
            value={id}
            aria-label={BOARD_LABELS[id]}
            title={BOARD_LABELS[id]}
            data-testid={`board-option-${id}`}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none",
              "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              "aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-xs dark:aria-checked:bg-input/50",
              compact ? "h-9 px-2" : "h-10 px-3",
            )}
          >
            {compact ? (
              <>
                <span className="lg:hidden">{TINY_LABELS[id]}</span>
                <span className="hidden lg:inline">{SHORT_LABELS[id]}</span>
              </>
            ) : (
              <>
                <span className="sm:hidden">{SHORT_LABELS[id]}</span>
                <span className="hidden sm:inline">{BOARD_LABELS[id]}</span>
              </>
            )}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </div>
  );
}
