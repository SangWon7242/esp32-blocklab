import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { BlockState } from "@/docs/catalog";
import { acquireBlockRenderer, renderBlockSvg } from "@/docs/renderBlock";

type Props = {
  /** 그릴 블록의 JSON (사전: 툴박스 항목 그대로, 팝업: 학생이 우클릭한 블록의 지금 값) */
  state: BlockState;
  /** 그림 배율 (작업판 1배 기준) */
  scale?: number;
  /** 화면 읽기 프로그램이 읽을 블록 이름. 없으면 꾸밈 그림 (곁에 같은 이름의 글 제목이 있을 때) */
  label?: string;
  className?: string;
};

/** 편집기 팔레트와 같은 렌더러·테마로 그린 블록 그림 */
export function BlockImage({ state, scale = 0.8, label, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  // 부모가 그릴 때마다 새 객체를 넘겨도 같은 블록이면 다시 그리지 않는다
  const key = JSON.stringify(state);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let cancelled = false;
    const release = acquireBlockRenderer();
    const draw = () => {
      if (cancelled) return;
      host.replaceChildren(renderBlockSvg(JSON.parse(key) as BlockState, scale));
    };
    draw();
    // 글꼴(Pretendard)을 다 읽기 전에 그렸으면 글자 폭이 달라지므로, 다 읽은 뒤 한 번 더 그린다
    if (document.fonts && document.fonts.status !== "loaded") void document.fonts.ready.then(draw);
    return () => {
      cancelled = true;
      host.replaceChildren();
      release();
    };
  }, [key, scale]);

  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return <span ref={ref} {...a11y} data-testid="block-image" className={cn("inline-block max-w-full", className)} />;
}
