import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { BlockState } from "@/docs/types";
import { topBlockStates } from "./blockStates";

/*
 * 작품·프로그램 미리 보기 (계획 13 계약 ProjectPreview): 코드 글 + 블록 그림.
 * 블록 그림은 화면에서만(useEffect) 편집기 팔레트와 같은 renderBlockSvg 로 그린다 — 모듈은 그때 불러와 서버 렌더에서는 코드만 보인다.
 */

/** 줄 번호가 있는 읽기 전용 코드 (CodeMirror 없이 글로 — 서버 렌더·열람 화면용) */
export function CodeView({ code, name, className }: { code: string; name?: string; className?: string }) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <figure className={cn("min-w-0", className)}>
      {name && <figcaption className="mb-1 font-mono text-xs text-muted-foreground">{name}</figcaption>}
      <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-5" data-testid="code-view">
        <code>
          {lines.map((line, i) => (
            <span key={i} className="block whitespace-pre">
              <span className="mr-3 inline-block w-6 text-right text-muted-foreground select-none" aria-hidden>{i + 1}</span>
              {line === "" ? " " : line}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}

export const BLOCKS_UNAVAILABLE = "블록 그림을 그릴 수 없어요";

type Props = {
  code: string;
  /** 작업판 직렬화 JSON (저장한 프로그램의 blocksJson). 없거나 비어 있으면 코드만 */
  blocksJson?: unknown;
  /** 코드 칸 제목 (파일 이름 등) */
  name?: string;
  className?: string;
};

/** 코드와 블록 그림을 나란히 (좁으면 위아래). 블록이 없는 프로그램은 코드만 */
export function ProjectPreview({ code, blocksJson, name, className }: Props) {
  const key = useMemo(() => JSON.stringify(topBlockStates(blocksJson)), [blocksJson]);
  const tops = useMemo(() => JSON.parse(key) as BlockState[], [key]);
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = ref.current;
    if (!host || tops.length === 0) return;
    let cancelled = false;
    let release: (() => void) | undefined;
    // Blockly 는 여기서만 불러온다 (서버·순수 API 쪽에 실리지 않게)
    import("@/docs/renderBlock")
      .then(({ acquireBlockRenderer, renderBlockSvg }) => {
        if (cancelled) return;
        release = acquireBlockRenderer();
        const draw = () => {
          if (cancelled) return;
          host.replaceChildren(...tops.map((t) => renderBlockSvg(t, 0.7)));
        };
        draw();
        // 글꼴을 다 읽기 전에 그렸으면 글자 폭이 달라지므로 한 번 더
        if (document.fonts && document.fonts.status !== "loaded") void document.fonts.ready.then(draw);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      host.replaceChildren();
      release?.();
    };
  }, [tops]);

  return (
    <div className={cn("grid gap-4", tops.length > 0 && "@3xl:grid-cols-2", className)} data-testid="project-preview">
      <CodeView code={code} name={name} />
      {tops.length > 0 && (
        <figure className="min-w-0">
          <figcaption className="mb-1 text-xs text-muted-foreground">블록 그림</figcaption>
          <div ref={ref} className="flex flex-col items-start gap-3 overflow-x-auto rounded-md border bg-muted/20 p-3" data-testid="project-blocks" aria-hidden />
          {failed && <p className="mt-1 text-xs text-muted-foreground">{BLOCKS_UNAVAILABLE}</p>}
        </figure>
      )}
    </div>
  );
}
