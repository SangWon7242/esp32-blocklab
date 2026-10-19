import { cn } from "@/lib/utils";
import { parseGuide, parseInline, type Inline } from "./guideMarkdown";

function Inlines({ inlines }: { inlines: Inline[] }) {
  return inlines.map((x, i) =>
    x.kind === "bold" ? <strong key={i} className="font-semibold">{x.text}</strong>
    : x.kind === "code" ? <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{x.text}</code>
    : x.text,
  );
}

/** 한 줄짜리 글(**굵게**·`코드`만): 버튼·배지 옆처럼 문단을 넣을 수 없는 자리 */
export function GuideInline({ text, className }: { text: string; className?: string }) {
  return <span className={className}><Inlines inlines={parseInline(text)} /></span>;
}

/**
 * 단계 안내 글: 가벼운 markdown(문단·**굵게**·- 목록·1. 번호·`코드`). 문법은 guideMarkdown.ts
 * 글자 (lib-v1.0.6): 폰 16px · 태블릿 이상 17px, 줄 높이 1.625, 한 줄 최대 폭 max-w-measure(44rem)
 */
export function GuideBody({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("max-w-measure space-y-3 text-base leading-relaxed break-keep md:text-md md:leading-relaxed", className)}>
      {parseGuide(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i} className="whitespace-pre-line"><Inlines inlines={b.inlines} /></p>
        ) : b.kind === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((it, j) => <li key={j}><Inlines inlines={it} /></li>)}</ul>
        ) : (
          <ol key={i} start={b.start} className="list-decimal space-y-1 pl-5">{b.items.map((it, j) => <li key={j}><Inlines inlines={it} /></li>)}</ol>
        ),
      )}
    </div>
  );
}
