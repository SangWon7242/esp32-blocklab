import { CodePanel, type LineHighlight } from "@/components/editor/CodePanel";
import { CodeFontSizeButton } from "@/components/editor/CodeFontSize";
import { cn } from "@/lib/utils";

const noop = () => {};

/** 고칠 수 없는 코드 보기 (예측·읽기 체크). 줄 번호를 누르면 onLineClick. panelClassName 으로 높이를 바꾼다 */
export function ReadOnlyCode({ code, name, highlightLines, onLineClick, className, panelClassName }: {
  code: string;
  name: string;
  highlightLines?: LineHighlight[];
  onLineClick?: (line: number) => void;
  className?: string;
  panelClassName?: string;
}) {
  return (
    <figure className={className}>
      <figcaption className="mb-1 flex min-w-0 items-center gap-2 font-mono text-xs text-muted-foreground">
        <span className="min-w-0 truncate">{name}</span>
        <CodeFontSizeButton className="ml-auto" />
      </figcaption>
      <div className={cn("h-72 overflow-hidden rounded-md border", panelClassName)}>
        <CodePanel value={code} readOnly onChange={noop} highlightLines={highlightLines} onLineClick={onLineClick} />
      </div>
    </figure>
  );
}

/**
 * 코드(왼쪽, 붙어 따라옴)와 문항(오른쪽)을 나란히 두는 틀. 활동 칸이 좁으면 위아래로 쌓는다.
 * 부모 section 이 @container 라 안내 칸을 접으면 저절로 넓은 배치가 된다.
 */
export const CODE_SPLIT = "grid flex-1 grid-cols-1 gap-6 @2xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @2xl:items-start";
export const CODE_SPLIT_CODE = "@2xl:sticky @2xl:top-0";
export const CODE_SPLIT_PANEL = "@2xl:h-[min(40rem,calc(100dvh-13rem))] @2xl:min-h-72";
