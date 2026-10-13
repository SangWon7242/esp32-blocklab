import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getCatalog, searchDocs, type DocCategory } from "@/docs/catalog";
import { BlockDocCard } from "./BlockDocCard";

/** ?block=<type> 로 들어왔을 때 그 카드를 강조하는 시간 */
const HIGHLIGHT_MS = 2000;

const sectionId = (id: string) => `cat-${id}`;

/** 위에 붙은 검색 줄(sticky)에 가리지 않게, 요소의 위쪽이 검색 줄 바로 아래에 오도록 스크롤 상자를 옮긴다 */
function scrollBelowSticky(container: HTMLElement | null, sticky: HTMLElement | null, el: Element | null, behavior: ScrollBehavior) {
  if (!container || !el) return;
  const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  container.scrollTo({ top: top - (sticky?.offsetHeight ?? 0) - 12, behavior });
}

/** 카테고리 목록의 한 줄(넓은 화면) 또는 칩(좁은 화면) */
function CategoryButton({ category, count, chip, onClick }: { category: DocCategory; count: number; chip?: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count === 0}
      className={cn(
        "flex shrink-0 items-center gap-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        chip ? "rounded-full border px-3 py-1" : "w-full rounded-md px-2 py-1.5 text-left",
      )}
    >
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.colour }} />
      <span className={cn(!chip && "flex-1 truncate")}>{category.name}</span>
      <span className="text-xs tabular-nums">{count}</span>
    </button>
  );
}

/** 블록 사전: 툴박스의 모든 블록을 카테고리별로 훑어보고 찾는다 */
export function DocsPage() {
  const [searchParams] = useSearchParams();
  const target = searchParams.get("block");
  const [query, setQuery] = useState("");
  const catalog = useMemo(() => getCatalog(), []);
  const results = useMemo(() => {
    const found = new Set(searchDocs(query).map((d) => d.type));
    return catalog.map((c) => ({ ...c, blocks: c.blocks.filter((b) => found.has(b.type)) }));
  }, [catalog, query]);
  const total = results.reduce((n, c) => n + c.blocks.length, 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const scrollToElement = (el: Element | null, behavior: ScrollBehavior) =>
    scrollBelowSticky(scrollRef.current, stickyRef.current, el, behavior);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  // ?block=<type>: 그 카드로 스크롤하고 잠시 테두리로 강조한다
  useEffect(() => {
    if (!target) return;
    const card = scrollRef.current?.querySelector<HTMLElement>(`[data-testid="block-doc-card"][data-type="${CSS.escape(target)}"]`);
    if (!card) return;
    scrollBelowSticky(scrollRef.current, stickyRef.current, card, "instant");
    setHighlighted(target);
    const timer = window.setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [target]);

  const goToCategory = (id: string) => {
    scrollToElement(document.getElementById(sectionId(id)), "smooth");
  };

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl gap-8 px-4 md:px-8">
        <aside className="hidden w-48 shrink-0 md:block">
          <nav aria-label="블록 카테고리" className="sticky top-0 flex flex-col gap-0.5 py-6">
            <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">카테고리</p>
            {results.map((c) => (
              <CategoryButton key={c.id} category={c} count={c.blocks.length} onClick={() => goToCategory(c.id)} />
            ))}
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
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums" data-testid="doc-count">{total}개</span>
            </div>
            {/* 좁은 화면: 카테고리를 가로로 넘기는 칩 줄 */}
            <nav aria-label="블록 카테고리" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
              {results.map((c) => (
                <CategoryButton key={c.id} category={c} count={c.blocks.length} chip onClick={() => goToCategory(c.id)} />
              ))}
            </nav>
          </div>

          {total === 0 ? (
            <p className="py-12 text-center text-muted-foreground">"{query.trim()}" 이(가) 들어간 블록이 없어요.</p>
          ) : (
            <div className="flex flex-col gap-10 pt-3">
              {results.filter((c) => c.blocks.length > 0).map((c) => (
                <section key={c.id} className="flex flex-col gap-4">
                  <h2 id={sectionId(c.id)} className="flex items-center gap-2 text-lg font-semibold">
                    <span className="size-3 rounded-full" style={{ backgroundColor: c.colour }} />
                    {c.name}
                  </h2>
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
