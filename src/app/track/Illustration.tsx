import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Box, Image as ImageIcon, Loader2, Maximize2, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { boardImageRef, jumperNotice, type BoardId } from "@/track/board";
import { chapterImage, sanitizeSvg } from "@/track/images";
import { canShow3D, hasScene3D, loadScene3D, type Scene3D } from "@/track/wiring3d";
import { useBoardChoice } from "../board/boardChoice";

// three.js 는 크게 보기 창에서 3D 를 처음 열 때만 불러온다
const Wiring3DView = lazy(() => import("./wiring3d/Wiring3DView").then((m) => ({ default: m.Wiring3DView })));

type Props = {
  /** 챕터 id (그림 폴더) */
  chapterId: string;
  /** "images/x.svg" — 없거나 모르는 그림이면 아무것도 그리지 않는다 */
  image: string | undefined;
  /** 그림 아래 설명 */
  caption?: string;
  /** 바깥 figure 의 크기·여백 (그림은 그 폭을 꽉 채우고 높이는 viewBox 비율) */
  className?: string;
  /** 설명 글 꾸밈 */
  captionClassName?: string;
  /** 눌러서 크게 보기 (좁은 칸에서는 그림 속 글자가 작아진다) */
  zoomable?: boolean;
  /** 그림을 figure 높이에 맞춘다 (className 에 높이를 준다, 예: h-40). 비율은 그대로, 가운데 정렬 — lib-v1.0.6 목록 카드 표지 */
  fit?: boolean;
  /**
   * 학생이 고른 보드를 따를지 (기본 true): 기본 보드(devkit)를 골랐고 같은 이름의 .devkit.svg 가 있으면 그 그림을 그린다.
   * false 면 늘 image 그대로. 설명(caption)은 부르는 쪽이 figureCaption 으로 고른다
   */
  boardVariant?: boolean;
  /** 고른 보드 대신 이 보드로 (미리 보기·시험용). 없으면 학생이 고른 보드 */
  board?: BoardId;
  /** 확장 보드 그림이 점퍼 5V 면 그림 위에 안내 한 줄 (기본 true. 부르는 쪽이 따로 보이면 false) */
  showJumper?: boolean;
};

const SVG_BOX = "[&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-full";
const BIG_SVG = cn(SVG_BOX, "text-foreground [&>svg]:mx-auto [&>svg]:max-h-[calc(100dvh-9rem)]");
const SVG_FIT = "h-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full";

/** SVG 의 <title> 글 (크게 보기 창의 제목) */
function svgTitle(svg: string): string | undefined {
  return /<title[^>]*>([^<]*)<\/title>/i.exec(svg)?.[1]?.trim() || undefined;
}

/** 그 보드에서 그릴 그림 이름 (기본 보드 그림이 없으면 image 그대로) */
export function resolveBoardImage(chapterId: string, image: string | undefined, board: BoardId): string | undefined {
  return boardImageRef(image, board, (ref) => chapterImage(chapterId, ref) !== undefined);
}

/** 그 그림(보드판까지 정해진 이름)을 볼 때의 점퍼 안내 (확장 보드 그림이 점퍼 5V 일 때만) */
export function shownJumperNotice(chapterId: string, shown: string | undefined): string | undefined {
  return jumperNotice(shown, (ref) => chapterImage(chapterId, ref));
}

/** 확장 보드 JUMP 점퍼 안내 한 줄: "이번 수업은 점퍼를 5V 쪽으로 옮겨요 (끝나면 3.3V 로)" */
export function JumperNotice({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn("flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-50 px-2.5 py-1.5 text-sm font-medium text-amber-900 break-keep dark:bg-amber-950/40 dark:text-amber-200", className)} data-testid="jumper-notice">
      <Zap className="mt-0.5 size-4 shrink-0" aria-hidden />{text}
    </p>
  );
}

/**
 * 콘텐츠 그림(SVG)을 인라인으로 그린다. 선은 currentColor 라 글자색(text-foreground)을 따르고,
 * 면 색은 그림 안의 CSS 변수(var(--primary) 등)를 따라 다크 모드에서도 맞는다.
 * 우리 파일만 쓰지만 script·on* 처리기는 한 번 더 거른 뒤 넣는다.
 * zoomable 이면 그림을 누를 때 큰 창(Dialog)에 같은 그림을 크게 보여 준다.
 * 다른 보드를 고르면 같은 이름의 보드 그림(.devkit.svg · .expansion.svg)이 있을 때 그것을 그린다 (크게 보기 창도 같은 그림).
 * 확장 보드 그림이 점퍼 5V 면 그림 위(와 크게 보기 창)에 점퍼 안내 한 줄.
 * 그 그림에 3D 장면(.3d.json)이 있으면 크게 보기 창은 「3D 시뮬레이션 | 그림」 으로 나뉘고 3D 가 먼저 열린다.
 */
export function Illustration({ chapterId, image, caption, className, captionClassName, zoomable, fit, boardVariant = true, board: boardProp, showJumper = true }: Props) {
  const chosen = useBoardChoice();
  const board = boardProp ?? chosen;
  const shown = boardVariant ? resolveBoardImage(chapterId, image, board) : image;
  const svg = useMemo(() => {
    const raw = chapterImage(chapterId, shown);
    return raw ? sanitizeSvg(raw) : undefined;
  }, [chapterId, shown]);
  // 배선 그림처럼 3D 장면이 있는 그림: 크게 보기 창에서 3D 시뮬레이션을 먼저 (기기가 3D 를 못 쓰면 창 안에서 그림으로)
  const has3d = Boolean(zoomable) && hasScene3D(chapterId, shown);
  const jumper = showJumper && boardVariant ? shownJumperNotice(chapterId, shown) : undefined;
  if (!svg) return null;
  const picture = <div className={fit ? SVG_FIT : SVG_BOX} dangerouslySetInnerHTML={{ __html: svg }} />;
  return (
    <figure
      className={cn("text-foreground", className)}
      data-testid="illustration"
      data-image={image}
      data-shown-image={shown !== image ? shown : undefined}
    >
      {/* 확장 보드 점퍼 5V 안내: 배선하기 전에 먼저 보이게 그림 위에 */}
      {jumper && <JumperNotice text={jumper} className="mb-2" />}
      {zoomable ? (
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="group relative block w-full cursor-zoom-in rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="그림 크게 보기"
              data-testid="illustration-zoom"
            >
              {picture}
              <span className="pointer-events-none absolute top-1 right-1 flex items-center gap-1 rounded-md border bg-background/90 px-1.5 py-0.5 text-xs text-muted-foreground shadow-xs transition-colors group-hover:text-foreground group-focus-visible:text-foreground">
                <Maximize2 className="size-3" />크게 보기
              </span>
            </button>
          </DialogTrigger>
          <DialogContent
            className={cn(
              "max-h-[calc(100dvh-2rem)] overflow-y-auto",
              has3d ? "sm:max-w-[min(80rem,calc(100vw-4rem))]" : "sm:max-w-[min(72rem,calc(100vw-4rem))]",
            )}
            data-testid="illustration-dialog"
          >
            <DialogTitle className="pr-8 leading-snug">{caption ?? svgTitle(svg) ?? "그림"}</DialogTitle>
            {jumper && <JumperNotice text={jumper} />}
            {has3d ? (
              <ZoomWith3D chapterId={chapterId} shown={shown} svg={svg} />
            ) : (
              <>
                <DialogDescription className="sr-only">그림을 크게 보여 줍니다. Esc 를 누르면 닫혀요.</DialogDescription>
                <div className={BIG_SVG} dangerouslySetInnerHTML={{ __html: svg }} />
              </>
            )}
          </DialogContent>
        </Dialog>
      ) : (
        picture
      )}
      {caption && <figcaption className={cn("mt-2 text-sm text-muted-foreground", captionClassName)}>{caption}</figcaption>}
    </figure>
  );
}

function Loading3D() {
  return (
    <div className="flex h-[min(70dvh,42rem)] w-full items-center justify-center gap-2 rounded-xl bg-muted/40 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />3D 배선을 준비하고 있어요
    </div>
  );
}

/**
 * 크게 보기 창의 본문 (창이 열릴 때만 그린다): 「3D 시뮬레이션 | 그림」. 3D 가 먼저.
 * 그래픽 가속이 없는 기기이거나 3D 를 그리다 실패하면 전환 없이 그림만 (WiringFigure 와 같은 방식).
 */
function ZoomWith3D({ chapterId, shown, svg }: { chapterId: string; shown: string | undefined; svg: string }) {
  const [unsupported, setUnsupported] = useState(() => !canShow3D());
  const [tab, setTab] = useState("3d");
  const [scene, setScene] = useState<Scene3D | null>(null);

  useEffect(() => {
    setScene(null);
    if (unsupported) return;
    let alive = true;
    void loadScene3D(chapterId, shown)?.then((s) => { if (alive) setScene(s); });
    return () => { alive = false; };
  }, [unsupported, chapterId, shown]);

  const onUnsupported = useCallback(() => { setUnsupported(true); setTab("picture"); }, []);
  const picture = <div className={BIG_SVG} dangerouslySetInnerHTML={{ __html: svg }} />;
  if (unsupported) {
    return (
      <>
        <DialogDescription className="sr-only">그림을 크게 보여 줍니다. Esc 를 누르면 닫혀요.</DialogDescription>
        {picture}
      </>
    );
  }
  return (
    <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-3" data-testid="illustration-views">
      <DialogDescription className="sr-only">배선을 3D 시뮬레이션이나 그림으로 크게 보여 줍니다. Esc 를 누르면 닫혀요.</DialogDescription>
      <TabsList>
        <TabsTrigger value="3d" data-testid="illustration-view-3d"><Box className="size-4" />3D 시뮬레이션</TabsTrigger>
        <TabsTrigger value="picture" data-testid="illustration-view-picture"><ImageIcon className="size-4" />그림</TabsTrigger>
      </TabsList>
      <TabsContent value="3d" className="min-w-0">
        {scene ? (
          <Suspense fallback={<Loading3D />}>
            <Wiring3DView scene={scene} chapterId={chapterId} large onUnsupported={onUnsupported} />
          </Suspense>
        ) : <Loading3D />}
      </TabsContent>
      <TabsContent value="picture">{picture}</TabsContent>
    </Tabs>
  );
}
