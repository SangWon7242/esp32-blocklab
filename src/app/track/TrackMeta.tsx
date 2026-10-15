import { Link } from "react-router";
import { BookOpen, CalendarClock, CheckCircle2, Circle, Globe2, Hourglass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Chapter } from "@/track/schema";
import { prerequisiteViews } from "@/track/tracks";

/*
 * 챕터 메타(번호·교과·SDG·차시·먼저 할 챕터) 조각. 트랙 목록 카드와 챕터 화면 hero 가 함께 쓴다.
 */

/** 교과·SDG 칩 (없으면 아무것도 그리지 않는다) */
export function SubjectChips({ chapter, className }: { chapter: Chapter; className?: string }) {
  if (!chapter.subjects?.length && !chapter.sdg?.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="연결 교과·SDG" data-testid="chapter-subjects">
      {chapter.subjects?.map((s) => (
        <li key={s}>
          <Badge variant="outline" className="font-normal"><BookOpen />{s}</Badge>
        </li>
      ))}
      {chapter.sdg?.map((n) => (
        <li key={`sdg-${n}`}>
          <Badge variant="outline" className="font-normal" title={`유엔 지속가능발전목표 ${n}번`}><Globe2 />SDG {n}</Badge>
        </li>
      ))}
    </ul>
  );
}

/** 초안(draft) 표시 — 교사 모드에서만 목록에 보이는 챕터 */
export function DraftBadge() {
  return <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-400">초안</Badge>;
}

/** "2차시" */
export function Sessions({ sessions, className }: { sessions?: number; className?: string }) {
  if (!sessions) return null;
  return <span className={cn("flex items-center gap-1", className)}><CalendarClock className="size-3.5" />{sessions}차시</span>;
}

/**
 * 먼저 할 챕터: 링크 + 완료 여부. 아직 없는 챕터는 링크 없이 "준비 중".
 * 안내일 뿐 잠그지 않는다 (관문은 챕터 안에서만).
 */
export function PrerequisiteList({
  chapter,
  chapters,
  progressChapters,
  className,
}: {
  chapter: Chapter;
  chapters: readonly Chapter[];
  progressChapters: Parameters<typeof prerequisiteViews>[2];
  className?: string;
}) {
  const views = prerequisiteViews(chapter, chapters, progressChapters);
  if (!views.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm", className)} data-testid="chapter-prerequisites">
      <span className="text-muted-foreground">먼저 할 챕터</span>
      <ul className="flex flex-wrap gap-1.5">
        {views.map((p) => {
          const name = (
            <>
              {p.label && <span className="font-semibold">{p.label}</span>}
              <span className="break-keep">{p.title}</span>
            </>
          );
          return (
            <li key={p.id} data-testid={`prerequisite-${p.id}`} data-state={p.state}>
              {p.state === "planned" ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2 py-0.5 text-muted-foreground">
                  <Hourglass className="size-3.5" aria-hidden />
                  {name}
                  <Badge variant="secondary" className="font-normal">준비 중</Badge>
                </span>
              ) : (
                <Link
                  to={`/track/${p.id}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 transition-colors hover:bg-muted",
                    p.state === "done" && "border-primary/40",
                  )}
                >
                  {p.state === "done" ? (
                    <CheckCircle2 className="size-3.5 text-primary" aria-label="완료" />
                  ) : (
                    <Circle className="size-3.5 text-muted-foreground" aria-label="아직" />
                  )}
                  {name}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
