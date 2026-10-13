/** 단계 안내 글. markdown 라이브러리 없이 빈 줄로 문단을 나누고, 줄바꿈은 그대로 둔다 */
export function GuideBody({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line">{p}</p>
      ))}
    </div>
  );
}
