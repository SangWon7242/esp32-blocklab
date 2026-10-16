import { useEffect, useState } from "react";
import { ArrowRight, Clock, ListOrdered } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HostLink, useHost } from "@/host/HostContext";
import { loadChapters, type LoadedChapter } from "@/track/content";
import { allSteps } from "@/track/gating";
import type { Progress as ProgressData } from "@/track/progress";
import type { TrackId } from "@/track/schema";
import { chaptersInTrack, isTrackId, TRACKS } from "@/track/tracks";
import { useSettings } from "../settings/settings";
import { GuideBody } from "./GuideBody";
import { Illustration } from "./Illustration";
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

/**
 * 트랙 목록 — 두 탭(센서 트랙 / 교과 융합 트랙), 탭마다 챕터 카드 목록.
 * 초안(draft) 챕터는 교사 모드에서만 "초안" 배지와 함께 보인다.
 */
export function TrackPage({ track: fromHost, onTrackChange }: Props = {}) {
  const progress = useProgress();
  const { teacherMode } = useSettings();
  const chapters = loadChapters();
  const [local, setLocal] = useState<TrackId>(readStoredTrack);
  const track: TrackId = isTrackId(fromHost) ? fromHost : local;

  useEffect(() => storeTrack(track), [track]);

  const select = (value: string) => {
    if (!isTrackId(value)) return;
    setLocal(value);
    onTrackChange?.(value);
  };

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto max-w-5xl p-4 sm:p-8">
        <h1 className="text-2xl font-bold">트랙</h1>
        <p className="mt-2 text-muted-foreground">챕터를 골라 단계를 차례대로 풀어 갑니다. 챕터 안에서는 앞 단계를 끝내야 다음 단계가 열려요.</p>
        <Tabs value={track} onValueChange={select} className="mt-6">
          <TabsList className="h-9">
            {TRACKS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="px-4" data-testid={`track-tab-${t.id}`}>{t.name}</TabsTrigger>
            ))}
          </TabsList>
          {TRACKS.map((t) => {
            const list = chaptersInTrack(chapters, t.id, teacherMode);
            return (
              <TabsContent key={t.id} value={t.id} className="mt-2" data-testid={`track-panel-${t.id}`}>
                <p className="text-sm text-muted-foreground">{t.description}</p>
                {list.length === 0 ? (
                  <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-muted-foreground">아직 준비 중인 트랙이에요.</p>
                ) : (
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    {list.map((ch) => <ChapterCard key={ch.id} chapter={ch} chapters={chapters} progress={progress} />)}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}

function ChapterCard({ chapter: ch, chapters, progress }: { chapter: LoadedChapter; chapters: LoadedChapter[]; progress: ProgressData | null }) {
  const { nav } = useHost();
  const steps = allSteps(ch);
  const records = progress?.chapters[ch.id] ?? {};
  const done = steps.filter((s) => records[s.id]?.status === "done").length;
  const minutes = steps.reduce((n, s) => n + (s.minutes ?? 0), 0);
  return (
    <Card className={ch.cover ? "pt-0" : undefined} data-testid={`chapter-card-${ch.id}`} data-status={ch.status}>
      {ch.cover && (
        <div className="border-b bg-muted/30 px-4 py-3">
          <Illustration chapterId={ch.id} image={ch.cover} className="mx-auto max-w-md" />
        </div>
      )}
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className="font-semibold" data-testid="chapter-label">{ch.label}</Badge>
          {ch.status === "draft" && <DraftBadge />}
        </div>
        <CardTitle className="text-lg font-semibold">{ch.title}</CardTitle>
        {ch.subtitle && <CardDescription>{ch.subtitle}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {ch.summary && <GuideBody text={ch.summary} className="text-muted-foreground" />}
        <SubjectChips chapter={ch} />
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Sessions sessions={ch.sessions} />
          <span className="flex items-center gap-1"><ListOrdered className="size-3.5" />{steps.length}단계</span>
          {minutes > 0 && <span className="flex items-center gap-1"><Clock className="size-3.5" />약 {minutes}분</span>}
        </div>
        <PrerequisiteList chapter={ch} chapters={chapters} progressChapters={progress?.chapters} />
        <div className="mt-auto flex items-center gap-3 pt-1 text-sm text-muted-foreground">
          <Progress value={(done / steps.length) * 100} className="h-2" aria-label="진행률" />
          <span className="shrink-0">{done} / {steps.length}</span>
        </div>
        <Button asChild className="self-start">
          <HostLink to={nav.href.chapter(ch.id)}>{done > 0 ? "이어서 하기" : "시작하기"} <ArrowRight className="size-4" /></HostLink>
        </Button>
      </CardContent>
    </Card>
  );
}
