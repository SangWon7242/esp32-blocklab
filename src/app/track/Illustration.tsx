import { useMemo } from "react";
import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { boardImageRef, type BoardId } from "@/track/board";
import { chapterImage, sanitizeSvg } from "@/track/images";
import { useBoardChoice } from "../board/boardChoice";

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
};

const SVG_BOX = "[&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-full";
const SVG_FIT = "h-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full";

/** SVG 의 <title> 글 (크게 보기 창의 제목) */
function svgTitle(svg: string): string | undefined {
  return /<title[^>]*>([^<]*)<\/title>/i.exec(svg)?.[1]?.trim() || undefined;
}

/** 그 보드에서 그릴 그림 이름 (기본 보드 그림이 없으면 image 그대로) */
export function resolveBoardImage(chapterId: string, image: string | undefined, board: BoardId): string | undefined {
  return boardImageRef(image, board, (ref) => chapterImage(chapterId, ref) !== undefined);
}

/**
 * 콘텐츠 그림(SVG)을 인라인으로 그린다. 선은 currentColor 라 글자색(text-foreground)을 따르고,
 * 면 색은 그림 안의 CSS 변수(var(--primary) 등)를 따라 다크 모드에서도 맞는다.
 * 우리 파일만 쓰지만 script·on* 처리기는 한 번 더 거른 뒤 넣는다.
 * zoomable 이면 그림을 누를 때 큰 창(Dialog)에 같은 그림을 크게 보여 준다.
 * 기본 보드(devkit)를 고르면 같은 이름의 .devkit.svg 가 있을 때 그것을 그린다 (크게 보기 창도 같은 그림).
 */
export function Illustration({ chapterId, image, caption, className, captionClassName, zoomable, fit, boardVariant = true, board: boardProp }: Props) {
  const chosen = useBoardChoice();
  const board = boardProp ?? chosen;
  const shown = boardVariant ? resolveBoardImage(chapterId, image, board) : image;
  const svg = useMemo(() => {
    const raw = chapterImage(chapterId, shown);
    return raw ? sanitizeSvg(raw) : undefined;
  }, [chapterId, shown]);
  if (!svg) return null;
  const picture = <div className={fit ? SVG_FIT : SVG_BOX} dangerouslySetInnerHTML={{ __html: svg }} />;
  return (
    <figure
      className={cn("text-foreground", className)}
      data-testid="illustration"
      data-image={image}
      data-shown-image={shown !== image ? shown : undefined}
    >
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
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[min(72rem,calc(100vw-4rem))]"
            data-testid="illustration-dialog"
          >
            <DialogTitle className="pr-8 leading-snug">{caption ?? svgTitle(svg) ?? "그림"}</DialogTitle>
            <DialogDescription className="sr-only">그림을 크게 보여 줍니다. Esc 를 누르면 닫혀요.</DialogDescription>
            <div
              className={cn(SVG_BOX, "text-foreground [&>svg]:mx-auto [&>svg]:max-h-[calc(100dvh-9rem)]")}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </DialogContent>
        </Dialog>
      ) : (
        picture
      )}
      {caption && <figcaption className={cn("mt-2 text-sm text-muted-foreground", captionClassName)}>{caption}</figcaption>}
    </figure>
  );
}
