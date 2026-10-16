import { useId } from "react";
import { ALargeSmall, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  CODE_FONT_SIZE_DEFAULT, CODE_FONT_SIZE_MAX, CODE_FONT_SIZE_MIN, resetCodeFontSize, setCodeFontSize, useCodeFontSize,
} from "@/host/codeFontSize";

/*
 * 코드 글자 크기 조절 (lib-v1.0.5). 코드 칸 머리줄의 작은 단추 → 팝오버 안 조절 칸, 체험판 설정 화면에도 같은 조절 칸.
 * 값은 src/host/codeFontSize.ts (localStorage, 모든 코드 칸이 같은 값).
 */

export const CODE_FONT_TEXT = {
  title: "코드 글자 크기",
  description: "코드 칸 글자를 키우거나 줄여요. 이 브라우저에만 저장돼요.",
  smaller: "글자 줄이기",
  larger: "글자 키우기",
  reset: "기본값",
  sample: "print(\"안녕\")  # 0O 1lI",
} as const;

/** 슬라이더 + 지금 값(px) + 줄이기·키우기 + 기본값 */
export function CodeFontSizeAdjuster({ className, showSample = true }: { className?: string; showSample?: boolean }) {
  const size = useCodeFontSize();
  const labelId = useId();
  return (
    <div className={cn("flex flex-col gap-3", className)} data-testid="code-font-size">
      <div className="flex items-center justify-between gap-2">
        <span id={labelId} className="text-sm font-medium">{CODE_FONT_TEXT.title}</span>
        <output className="font-mono text-sm tabular-nums" aria-live="polite" data-testid="code-font-size-value">{size}px</output>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={CODE_FONT_TEXT.smaller}
          title={CODE_FONT_TEXT.smaller}
          disabled={size <= CODE_FONT_SIZE_MIN}
          onClick={() => setCodeFontSize(size - 1)}
        >
          <Minus />
        </Button>
        <Slider
          aria-labelledby={labelId}
          min={CODE_FONT_SIZE_MIN}
          max={CODE_FONT_SIZE_MAX}
          step={1}
          value={[size]}
          onValueChange={(v) => setCodeFontSize(v[0] ?? size)}
          className="min-w-0 flex-1"
          data-testid="code-font-size-slider"
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={CODE_FONT_TEXT.larger}
          title={CODE_FONT_TEXT.larger}
          disabled={size >= CODE_FONT_SIZE_MAX}
          onClick={() => setCodeFontSize(size + 1)}
        >
          <Plus />
        </Button>
      </div>
      {showSample && (
        <p
          className="overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 font-mono whitespace-pre"
          style={{ fontSize: `${size}px`, lineHeight: 1.6 }}
          aria-hidden
        >
          {CODE_FONT_TEXT.sample}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">{CODE_FONT_SIZE_MIN}px ~ {CODE_FONT_SIZE_MAX}px</span>
        <Button type="button" variant="ghost" size="xs" onClick={resetCodeFontSize} disabled={size === CODE_FONT_SIZE_DEFAULT}>
          <RotateCcw />{CODE_FONT_TEXT.reset} ({CODE_FONT_SIZE_DEFAULT}px)
        </Button>
      </div>
    </div>
  );
}

/** 코드 칸 머리줄의 작은 "글자 크기" 단추 (팝오버) */
export function CodeFontSizeButton({ className }: { className?: string }) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={cn("shrink-0 text-muted-foreground", className)}
              aria-label={CODE_FONT_TEXT.title}
              data-testid="code-font-size-button"
            >
              <ALargeSmall className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{CODE_FONT_TEXT.title}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80">
        <CodeFontSizeAdjuster />
      </PopoverContent>
    </Popover>
  );
}
