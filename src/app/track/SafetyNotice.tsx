import { Plug, ShieldAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { chapterSafety, type ChapterSafety } from "@/track/safety";

/*
 * 조립 안전 안내: 전압을 잘못 잇거나 합선되면 과열 · 고장 · 다칠 수 있는 챕터만(src/track/safety.ts).
 * 배선 그림 · 3D 위에 띠로, 3D 조립 순서 첫 단계에는 확인 칸과 함께(SafetyGate) 보인다.
 * 위험(배터리 · 날개 · 물)은 빨강, 5V 주의뿐이면 노랑.
 */
const TONE = {
  danger: "border-red-500/50 bg-red-50 text-red-950 dark:bg-red-950/40 dark:text-red-100",
  caution: "border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
} as const;

export function SafetyBody({ safety, compact = false }: { safety: ChapterSafety; compact?: boolean }) {
  const Icon = safety.level === "danger" ? TriangleAlert : ShieldAlert;
  return (
    <>
      <p className="flex items-center gap-1.5 font-bold">
        <Icon className="size-4 shrink-0" aria-hidden />
        {safety.level === "danger" ? "조립 전에 꼭 읽어요 — 다치거나 보드가 망가질 수 있어요" : "조립 전에 꼭 읽어요 — 보드가 망가질 수 있어요"}
      </p>
      <ul className={cn("mt-1.5 grid gap-1 leading-snug break-keep", compact ? "text-[0.8rem]" : "text-sm")}>
        {safety.basics.map((b, i) => (
          <li key={b} className="flex items-start gap-1.5">
            {i === 0 ? <Plug className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <span className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden />}
            <span className={cn(i === 0 && "font-bold")}>{b}</span>
          </li>
        ))}
        {safety.hazards.map((h) => (
          <li key={h.id} className="flex items-start gap-1.5" data-hazard={h.id}>
            <span className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden />
            <span><b>{h.title}</b> · {h.text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** 배선 그림 · 3D 위 안전 띠. 위험이 없는 챕터면 아무것도 그리지 않는다 */
export function SafetyNotice({ chapterId, className }: { chapterId: string | null | undefined; className?: string }) {
  const safety = chapterSafety(chapterId);
  if (!safety) return null;
  return (
    <div role="note" aria-label="조립 안전 안내" className={cn("rounded-md border px-3 py-2", TONE[safety.level], className)} data-testid="safety-notice" data-level={safety.level}>
      <SafetyBody safety={safety} />
    </div>
  );
}

export const SAFETY_TONE = TONE;
