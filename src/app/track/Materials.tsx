import type { Chapter } from "@/track/schema";
import { Illustration } from "./Illustration";

/** 챕터 부품 칩: 작은 그림(있으면) + 이름 + 작은 글 note */
export function MaterialChips({ chapterId, materials }: { chapterId: string; materials: NonNullable<Chapter["materials"]> }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="부품" data-testid="material-chips">
      {materials.map((m) => (
        <li key={m.name} className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1.5 text-sm" title={m.note}>
          {m.image ? (
            <Illustration chapterId={chapterId} image={m.image} className="size-6 shrink-0" />
          ) : (
            <span className="ml-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          )}
          <span>{m.name}</span>
          {m.note && <span className="text-xs text-muted-foreground">{m.note}</span>}
        </li>
      ))}
    </ul>
  );
}
