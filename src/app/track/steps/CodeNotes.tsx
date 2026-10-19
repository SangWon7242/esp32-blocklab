import type { ReactNode } from "react";
import { BookOpenText, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { LineHighlight } from "@/components/editor/CodePanel";
import { cn } from "@/lib/utils";
import type { CodeNote } from "@/track/schema";
import { GuideInline } from "../GuideBody";

/** 고른 코드 설명 줄 → 읽기 전용 코드의 줄 강조 ("focus": 화면 밖이면 그 줄까지 스크롤) */
export function noteHighlight(line: number | undefined): LineHighlight[] {
  return line === undefined ? [] : [{ line, kind: "focus" }];
}

/**
 * 코드 설명 목록 (Keyestudio 수업의 "코드 설명"): 줄 번호 배지 + 설명.
 * 설명을 누르면 onSelect(줄) — 부모가 그 줄을 읽기 전용 코드에서 강조한다. 다시 누르면 onSelect(undefined).
 */
export function CodeNoteList({ notes, selected, onSelect }: {
  notes: readonly CodeNote[];
  selected: number | undefined;
  onSelect(line: number | undefined): void;
}) {
  return (
    <ol className="space-y-1" data-testid="code-notes">
      {notes.map((n, i) => {
        const on = selected === n.line;
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => onSelect(on ? undefined : n.line)}
              aria-pressed={on}
              data-testid={`code-note-${n.line}`}
              className={cn(
                "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                on && "bg-primary/10 hover:bg-primary/15",
              )}
            >
              <Badge variant={on ? "default" : "outline"} className="mt-0.5 shrink-0 font-mono tabular-nums">{n.line}번 줄</Badge>
              <GuideInline text={n.note} className="leading-relaxed" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 접히는 "코드 설명" 칸. children 이 있으면(실행 단계: 읽기 전용 원본 코드) 넓은 칸에서 코드 옆, 좁은 칸에서 위에 둔다.
 */
export function CodeNotesPanel({ notes, selected, onSelect, defaultOpen = false, children, className }: {
  notes: readonly CodeNote[];
  selected: number | undefined;
  onSelect(line: number | undefined): void;
  defaultOpen?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("rounded-lg border", className)} data-testid="code-notes-panel">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="group w-full justify-start rounded-lg">
          <BookOpenText className="size-4" />코드 설명
          <Badge variant="secondary" className="font-normal">{notes.length}줄</Badge>
          <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 px-3 pt-1 pb-3">
        <p className="text-sm text-muted-foreground">설명을 누르면 코드에서 그 줄이 표시돼요</p>
        {children ? (
          <div className="grid min-w-0 grid-cols-1 gap-3 @2xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @2xl:items-start">
            {children}
            <CodeNoteList notes={notes} selected={selected} onSelect={onSelect} />
          </div>
        ) : (
          <CodeNoteList notes={notes} selected={selected} onSelect={onSelect} />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
