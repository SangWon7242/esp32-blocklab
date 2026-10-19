import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock, ListOrdered, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HostLink, useHost } from "@/host/HostContext";
import { cn } from "@/lib/utils";
import { loadChapters, type LoadedChapter } from "@/track/content";
import { allSteps } from "@/track/gating";
import type { Progress as ProgressData } from "@/track/progress";
import type { TrackId } from "@/track/schema";
import { buildChapterSearchIndex, searchChapters, type ChapterSearchHit, type SearchSnippetPart } from "@/track/search";
import { chaptersInTrack, isTrackId, TRACK_NAME, TRACKS } from "@/track/tracks";
import { useSettings } from "../settings/settings";
import { GuideBody } from "./GuideBody";
import { Illustration } from "./Illustration";
import { PAGE_GUTTER } from "./layout";
import { useProgress } from "./progressState";
import { DraftBadge, PrerequisiteList, Sessions, SubjectChips } from "./TrackMeta";

/** 마지막으로 본 트랙 탭 (이 브라우저에만) */
export const TRACK_TAB_KEY = "esp32-blocklab:track-tab";

function readStoredTrack(): TrackId {
  try {
    const v = globalThis.localStorage?.getItem(TRACK_TAB_KEY);
    return isTrackId(v) ? v : "sensor";
  } catch {
    return "sensor";
  }
}

function storeTrack(track: TrackId) {
  try {
    globalThis.localStorage?.setItem(TRACK_TAB_KEY, track);
  } catch {
    // 저장이 막힌 브라우저면 주소(?track=)로만 기억한다
  }
}

type Props = {
  /** 호스트가 주소(?track=)에서 읽은 탭. 없거나 모르는 값이면 마지막으로 본 탭(없으면 센서 트랙) */
  track?: string | null;
  /** 탭을 바꾸면 호스트가 주소에 남긴다. 없으면 화면 안에서만 바뀐다 */
  onTrackChange?(track: TrackId): void;
};

/** 카드 격자: 폰 1열 · sm 2열 · lg 3열 · 2xl 4열 (lib-v1.0.6 전체 폭) */
const CARD_GRID = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

/**
 * 트랙 목록 — 찾기 칸 + 두 탭(센서 트랙 / 교과 융합 트랙), 탭마다 챕터 카드 격자 (화면 전체 폭).
 * 찾기 칸에 글을 넣으면 탭 대신 두 트랙 전체에서 찾은 결과를 보여 준다 (src/track/search.ts — 제목·번호·장치·준비물·단계…).
 * 초안(draft) 챕터는 교사 모드에서만 "초안" 배지와 함께 보인다 (찾기도 같다).
 */
export function TrackPage({ track: fromHost, onTrackChange }: Props = {}) {
  const progress = useProgress();
  const { teacherMode } = useSettings();
  const chapters = loadChapters();
  const [local, setLocal] = useState<TrackId>(readStoredTrack);
  const track: TrackId = isTrackId(fromHost) ? fromHost : local;
  const [query, setQuery] = useState("");

  useEffect(() => storeTrack(track), [track]);

  const index = useMemo(
    () => buildChapterSearchIndex(chapters.filter((c) => teacherMode || c.status !== "draft")),
    [chapters, teacherMode],
  );
  const hits = query.trim() ? searchChapters(index, query) : null;

  const select = (value: string) => {
    if (!isTrackId(value)) return;
    setLocal(value);
    onTrackChange?.(value);
  };

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground" data-testid="track-page">
      <header className={cn("border-b py-5 lg:py-6", PAGE_GUTTER)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">트랙</h1>
            <p className="mt-1 max-w-measure text-base leading-relaxed text-muted-foreground md:text-md md:leading-relaxed">
              챕터를 골라 단계를 차례대로 풀어 갑니다. 챕터 안에서는 앞 단계를 끝내야 다음 단계가 열려요.
            </p>
          </div>
          <SearchBox value={query} onChange={setQuery} className="w-full lg:w-[26rem] lg:shrink-0" />
        </div>
      </header>

      <div className={cn("py-5 lg:py-6", PAGE_GUTTER)}>
        {hits ? (
          <SearchResults query={query} hits={hits} chapters={chapters} progress={progress} />
        ) : (
          <Tabs value={track} onValueChange={select}>
            <TabsList className="group-data-horizontal/tabs:h-11">
              {TRACKS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="px-4 text-base" data-testid={`track-tab-${t.id}`}>{t.name}</TabsTrigger>
              ))}
            </TabsList>
            {TRACKS.map((t) => {
              const list = chaptersInTrack(chapters, t.id, teacherMode);
              return (
                <TabsContent key={t.id} value={t.id} className="mt-3" data-testid={`track-panel-${t.id}`}>
                  <p className="text-base text-muted-foreground">{t.description}</p>
                  {list.length === 0 ? (
                    <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-base text-muted-foreground">아직 준비 중인 트랙이에요.</p>
                  ) : (
                    <div className={cn("mt-4", CARD_GRID)}>
                      {list.map((ch) => <ChapterCard key={ch.id} chapter={ch} chapters={chapters} progress={progress} />)}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </div>
  );
}

/** 찾기 칸: 돋보기 + 글 + 지우기. Esc 로도 지운다 */
function SearchBox({ value, onChange, className }: { value: string; onChange(v: string): void; className?: string }) {
  return (
    <div role="search" className={cn("relative", className)}>
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-5 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        placeholder="챕터 찾기 — 제목, 번호(S14), 부품(초음파·OLED)"
        aria-label="챕터 찾기"
        className="h-11 ps-10 pe-11 text-base md:text-base [&::-webkit-search-cancel-button]:hidden"
        data-testid="chapter-search"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute inset-y-0 end-0.5 my-auto size-10"
          onClick={() => onChange("")}
          aria-label="찾기 지우기"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

function SearchResults({
  query, hits, chapters, progress,
}: { query: string; hits: ChapterSearchHit<LoadedChapter>[]; chapters: LoadedChapter[]; progress: ProgressData | null }) {
  return (
    <section aria-label="찾은 챕터" data-testid="search-results">
      <p className="text-base text-muted-foreground" role="status" data-testid="search-count">
        <span className="font-semibold text-foreground">「{query.trim()}」</span> 찾은 챕터 {hits.length}개
      </p>
      {hits.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-base text-muted-foreground">
          맞는 챕터가 없어요. 낱말을 줄이거나 부품 이름(초음파, 서보, LED)으로 찾아보세요.
        </p>
      ) : (
        <div className={cn("mt-4", CARD_GRID)}>
          {hits.map((h) => <ChapterCard key={h.id} chapter={h.chapter} chapters={chapters} progress={progress} hit={h} />)}
        </div>
      )}
    </section>
  );
}

/** 맞은 부분을 <mark> 로 */
function Marked({ parts }: { parts: SearchSnippetPart[] }) {
  return parts.map((p, i) =>
    p.match ? <mark key={i} className="rounded-sm bg-primary/15 px-0.5 font-semibold text-foreground">{p.text}</mark> : <span key={i}>{p.text}</span>,
  );
}

function ChapterCard({
  chapter: ch, chapters, progress, hit,
}: { chapter: LoadedChapter; chapters: LoadedChapter[]; progress: ProgressData | null; hit?: ChapterSearchHit<LoadedChapter> }) {
  const { nav } = useHost();
  const steps = allSteps(ch);
  const records = progress?.chapters[ch.id] ?? {};
  const done = steps.filter((s) => records[s.id]?.status === "done").length;
  const minutes = steps.reduce((n, s) => n + (s.minutes ?? 0), 0);
  const titleSnippet = hit?.snippets.find((s) => s.field === "제목");
  // 제목·번호 밖에서 맞은 곳 두 군데까지 (어디서 맞았는지 보이게)
  const more = hit?.snippets.filter((s) => s.field !== "제목" && s.field !== "번호").slice(0, 2) ?? [];
  return (
    <Card className={ch.cover ? "pt-0" : undefined} data-testid={`chapter-card-${ch.id}`} data-status={ch.status}>
      {ch.cover && (
        // 표지는 높이를 정해(h-40 · 2xl h-44) 카드가 한눈에 들어오게 — 비율은 그대로
        <div className="border-b bg-muted/30 px-4 py-3">
          <Illustration chapterId={ch.id} image={ch.cover} fit className="h-40 2xl:h-44" />
        </div>
      )}
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className="font-semibold" data-testid="chapter-label">{ch.label}</Badge>
          {hit && <Badge variant="secondary">{TRACK_NAME[ch.track]}</Badge>}
          {ch.status === "draft" && <DraftBadge />}
        </div>
        <CardTitle className="text-lg leading-snug font-semibold break-keep">{titleSnippet ? <Marked parts={titleSnippet.parts} /> : ch.title}</CardTitle>
        {ch.subtitle && <CardDescription className="text-base">{ch.subtitle}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {hit && hit.matchedIn.length > 0 && (
          <div className="rounded-lg bg-muted/50 p-3" data-testid="search-match">
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              맞은 곳
              {hit.matchedIn.map((f) => <Badge key={f} variant="outline" className="font-normal">{f}</Badge>)}
            </p>
            {more.map((s) => (
              <p key={s.field} className="mt-1.5 text-sm leading-relaxed">
                <span className="me-1.5 font-semibold text-muted-foreground">{s.field}</span><Marked parts={s.parts} />
              </p>
            ))}
          </div>
        )}
        {/* 찾기 결과에서는 맞은 곳 조각이 소개를 대신한다 (카드를 짧게) */}
        {ch.summary && !hit && <GuideBody text={ch.summary} className="text-muted-foreground" />}
        <SubjectChips chapter={ch} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <Sessions sessions={ch.sessions} />
          <span className="flex items-center gap-1"><ListOrdered className="size-3.5" />{steps.length}단계</span>
          {minutes > 0 && <span className="flex items-center gap-1"><Clock className="size-3.5" />약 {minutes}분</span>}
        </div>
        <PrerequisiteList chapter={ch} chapters={chapters} progressChapters={progress?.chapters} />
        <div className="mt-auto flex items-center gap-3 pt-1 text-sm text-muted-foreground">
          <Progress value={(done / steps.length) * 100} className="h-2" aria-label="진행률" />
          <span className="shrink-0 tabular-nums">{done} / {steps.length}</span>
        </div>
        <Button asChild className="h-11 self-start px-5 text-base">
          <HostLink to={nav.href.chapter(ch.id)}>{done > 0 ? "이어서 하기" : "시작하기"} <ArrowRight className="size-4" /></HostLink>
        </Button>
      </CardContent>
    </Card>
  );
}
