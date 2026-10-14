import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { textColourOn } from "@/lib/contrast";
import { getCatalog, searchDocs, type DocCategory } from "@/docs/catalog";
import { BlockDocCard } from "./BlockDocCard";

/** ?block=<type> 로 들어왔을 때 그 카드를 강조하는 시간 */
const HIGHLIGHT_MS = 2000;

/** 위에 붙은 검색 줄(sticky)에 가리지 않게, 요소의 위쪽이 검색 줄 바로 아래에 오도록 스크롤 상자를 옮긴다 */
function scrollBelowSticky(container: HTMLElement | null, sticky: HTMLElement | null, el: Element | null, behavior: ScrollBehavior) {
  if (!container || !el) return;
  const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  container.scrollTo({ top: top - (sticky?.offsetHeight ?? 0) - 12, behavior });
}

/**
 * 카테고리 목록의 한 줄(넓은 화면) 또는 칩(좁은 화면). 고른 카테고리는 편집기 타일처럼 그 색으로 채우고
 * 글자는 바탕에서 잘 읽히는 색(textColourOn)으로
 */
function CategoryButton({ category, count, selected, chip, onClick }: {
  category: DocCategory;
  count: number;
  selected: boolean;
  chip?: boolean;
  onClick(): void;
}) {
  const text = textColourOn(category.colour);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count === 0}
      aria-current={selected ? "page" : undefined}
      data-category={category.id}
      style={selected ? { backgroundColor: category.colour, color: text, borderColor: category.colour } : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 text-sm disabled:pointer-events-none disabled:opacity-40",
        !selected && "text-muted-foreground hover:bg-muted hover:text-foreground",
        selected && "font-medium",
        chip ? "rounded-full border px-3 py-1" : "w-full rounded-md px-2 py-1.5 text-left",
      )}
    >
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: selected ? text : category.colour }} />
      <span className={cn(!chip && "flex-1 truncate")}>{category.name}</span>
      <span className="text-xs tabular-nums">{count}</span>
    </button>
  );
}

function CategoryHeading({ category }: { category: DocCategory }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold">
      <span className="size-3 rounded-full" style={{ backgroundColor: category.colour }} />
      {category.name}
    </h2>
  );
}

/**
 * 블록 사전: 카테고리마다 한 페이지(?cat=<id>, 없으면 첫 카테고리). 검색어가 있으면 카테고리와 상관없이
 * 전체에서 찾아 카테고리별로 묶어 보여 준다. ?block=<type> 은 그 블록의 카테고리를 열고 카드를 강조한다
 */
export function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const target = searchParams.get("block");
  const catParam = searchParams.get("cat");
  const [query, setQuery] = useState("");
  const searching = query.trim() !== "";
  const catalog = useMemo(() => getCatalog(), []);

  // ?block 이 ?cat 보다 먼저: 그 블록이 든 카테고리. 모르는 값이면 첫 카테고리
  const activeId =
    (target && catalog.find((c) => c.blocks.some((b) => b.type === target))?.id) ||
    (catParam && catalog.find((c) => c.id === catParam)?.id) ||
    catalog[0]?.id;
  const active = catalog.find((c) => c.id === activeId);

  const results = useMemo(() => {
    const found = new Set(searchDocs(query).map((d) => d.type));
    return catalog.map((c) => ({ ...c, blocks: c.blocks.filter((b) => found.has(b.type)) }));
  }, [catalog, query]);
  // 버튼 옆 개수: 검색 중에는 맞는 블록 수, 아니면 카테고리의 블록 수
  const listed = searching ? results : catalog;
  const shown = searching ? results.filter((c) => c.blocks.length > 0) : active ? [active] : [];
  const total = shown.reduce((n, c) => n + c.blocks.length, 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLElement>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  // 카테고리를 바꾸거나 검색어를 지우면 페이지 맨 위부터 (?block 이 있으면 아래 effect 가 카드로 옮긴다)
  useEffect(() => {
    if (target) return;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeId, searching, target]);

  // 좁은 화면: 고른 칩이 칩 줄 안에 보이게 칩 줄만 가로로 옮긴다 (페이지는 움직이지 않게 scrollIntoView 대신)
  useEffect(() => {
    const row = chipsRef.current;
    const chip = row?.querySelector<HTMLElement>(`[data-category="${CSS.escape(activeId ?? "")}"]`);
    if (!row || !chip) return;
    const left = chip.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + chip.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - 16) });
    }
  }, [activeId]);

  // ?block=<type>: 그 카드로 스크롤하고 잠시 테두리로 강조한다. 포커스도 그 카드로 (화면 읽기 프로그램)
  useEffect(() => {
    if (!target) return;
    const card = scrollRef.current?.querySelector<HTMLElement>(`[data-testid="block-doc-card"][data-type="${CSS.escape(target)}"]`);
    if (!card) return;
    scrollBelowSticky(scrollRef.current, stickyRef.current, card, "instant");
    card.focus({ preventScroll: true });
    setHighlighted(target);
    const timer = window.setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [target]);

  // 카테고리 고르기: 주소에 남겨(push) 뒤로 가기로 앞 카테고리로 돌아갈 수 있게. 검색 중이면 검색어를 지운다
  const goToCategory = (id: string) => {
    setQuery("");
    if (id === activeId && !target && catParam === id) return;
    setSearchParams({ cat: id });
  };

  const buttons = (chip: boolean) =>
    listed.map((c) => (
      <CategoryButton
        key={c.id}
        category={c}
        count={c.blocks.length}
        selected={!searching && c.id === activeId}
        chip={chip}
        onClick={() => goToCategory(c.id)}
      />
    ));

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl gap-8 px-4 md:px-8">
        <aside className="hidden w-48 shrink-0 md:block">
          <nav aria-label="블록 카테고리" className="sticky top-0 flex flex-col gap-0.5 py-6">
            <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">카테고리</p>
            {buttons(false)}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 pb-12">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-6">
            <h1 className="text-2xl font-bold">블록 사전</h1>
            <p className="text-sm text-muted-foreground">블록마다 만드는 코드와 뜻, 예시 프로그램을 볼 수 있어요.</p>
          </div>
          {/* 검색·카테고리 칩은 내려도 위에 붙어 있다 */}
          <div ref={stickyRef} className="sticky top-0 z-10 flex flex-col gap-3 bg-background pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="블록 이름·코드·설명 검색"
                  aria-label="블록 검색"
                  className="pl-8"
                />
              </div>
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums" data-testid="doc-count" aria-live="polite">{total}개</span>
            </div>
            {/* 좁은 화면: 카테고리를 가로로 넘기는 칩 줄 (칩 줄만 가로로 움직인다) */}
            <nav ref={chipsRef} aria-label="블록 카테고리" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
              {buttons(true)}
            </nav>
          </div>

          {total === 0 ? (
            <p className="py-12 text-center text-muted-foreground">"{query.trim()}"에 맞는 블록이 없어요. 다른 낱말로 찾아보세요.</p>
          ) : (
            <div className="flex flex-col gap-10 pt-3">
              {shown.map((c) => (
                <section key={c.id} className="flex flex-col gap-4" data-testid="doc-category" data-category={c.id}>
                  <CategoryHeading category={c} />
                  {c.blocks.map((doc) => (
                    <BlockDocCard key={doc.type} doc={doc} highlighted={highlighted === doc.type} />
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
