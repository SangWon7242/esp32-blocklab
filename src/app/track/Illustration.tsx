import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { chapterImage, sanitizeSvg } from "@/track/images";

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
};

/**
 * 콘텐츠 그림(SVG)을 인라인으로 그린다. 선은 currentColor 라 글자색(text-foreground)을 따르고,
 * 면 색은 그림 안의 CSS 변수(var(--primary) 등)를 따라 다크 모드에서도 맞는다.
 * 우리 파일만 쓰지만 script·on* 처리기는 한 번 더 거른 뒤 넣는다.
 */
export function Illustration({ chapterId, image, caption, className, captionClassName }: Props) {
  const svg = useMemo(() => {
    const raw = chapterImage(chapterId, image);
    return raw ? sanitizeSvg(raw) : undefined;
  }, [chapterId, image]);
  if (!svg) return null;
  return (
    <figure className={cn("text-foreground", className)} data-testid="illustration" data-image={image}>
      <div className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      {caption && <figcaption className={cn("mt-2 text-xs text-muted-foreground", captionClassName)}>{caption}</figcaption>}
    </figure>
  );
}
