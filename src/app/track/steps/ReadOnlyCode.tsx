import { CodePanel, type LineHighlight } from "@/components/editor/CodePanel";

const noop = () => {};

/** 고칠 수 없는 코드 보기 (예측·읽기 체크). 줄 번호를 누르면 onLineClick */
export function ReadOnlyCode({ code, name, highlightLines, onLineClick, className }: {
  code: string;
  name: string;
  highlightLines?: LineHighlight[];
  onLineClick?: (line: number) => void;
  className?: string;
}) {
  return (
    <figure className={className}>
      <figcaption className="mb-1 font-mono text-xs text-muted-foreground">{name}</figcaption>
      <div className="h-72 overflow-hidden rounded-md border">
        <CodePanel value={code} readOnly onChange={noop} highlightLines={highlightLines} onLineClick={onLineClick} />
      </div>
    </figure>
  );
}
