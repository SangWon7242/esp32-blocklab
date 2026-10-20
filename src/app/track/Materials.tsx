import { materialsForBoard, type BoardId } from "@/track/board";
import type { Chapter } from "@/track/schema";
import { useBoardChoice } from "../board/boardChoice";
import { Illustration } from "./Illustration";

type Materials = NonNullable<Chapter["materials"]>;

/**
 * 챕터 부품 칩: 작은 그림(있으면) + 이름 + 작은 글 note.
 * 학생이 고른 보드(board 를 주면 그 보드)에 맞는 부품만 보인다 — board: plus | devkit 가 적힌 부품은 그 보드에서만. 남는 것이 없으면 그리지 않는다
 */
export function MaterialChips({ chapterId, materials, board }: { chapterId: string; materials: Materials; board?: BoardId }) {
  const chosen = useBoardChoice();
  const items = materialsForBoard(materials, board ?? chosen);
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="부품" data-testid="material-chips">
      {items.map((m) => (
        <li key={`${m.name}|${m.board ?? ""}`} className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1.5 text-sm" title={m.note}>
          {m.image ? (
            <Illustration chapterId={chapterId} image={m.image} className="size-6 shrink-0" />
          ) : (
            <span className="ml-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          )}
          {/* 부품 이름은 한 덩어리로 (좁은 폰에서 「브레드보 / 드」처럼 끊기지 않게). 줄바꿈은 칩 목록이 한다 */}
          <span className="whitespace-nowrap">{m.name}</span>
          {m.note && <span className="text-sm text-muted-foreground">{m.note}</span>}
        </li>
      ))}
    </ul>
  );
}
