import { stripComment } from "@/parser/normalize";

/** 줄 비교용 글: 주석과 모든 공백을 떼고 작은따옴표를 큰따옴표로 (생성기는 큰따옴표를 쓴다) */
const key = (line: string): string => stripComment(line).replace(/\s+/g, "").replace(/'/g, '"');

/**
 * 재생성 코드 줄 → 학생이 친 원문 줄 (둘 다 1부터). 주석·공백을 뗀 글이 같은 줄을 앞에서부터 짝짓는다:
 * 직전에 짝지은 원문 줄 뒤에서 먼저 찾고, 없으면(준비 줄 순서가 바뀐 경우 등) 아직 짝 없는 원문 줄 중 첫 것.
 * 그래도 없거나 빈 줄이면 넣지 않는다. 원문에만 있는 주석·빈 줄은 건너뛴다.
 */
export function alignLines(generated: string, source: string): Map<number, number> {
  const src = source.replace(/\t/g, "    ").split("\n").map(key);
  const used = new Set<number>();
  const out = new Map<number, number>();
  let cursor = 0;
  generated.split("\n").forEach((line, i) => {
    const k = key(line);
    if (!k) return;
    let found = -1;
    for (let j = cursor; j < src.length; j++) if (!used.has(j) && src[j] === k) { found = j; break; }
    if (found < 0) for (let j = 0; j < cursor; j++) if (!used.has(j) && src[j] === k) { found = j; break; }
    if (found < 0) return;
    used.add(found);
    if (found >= cursor) cursor = found + 1;
    out.set(i + 1, found + 1);
  });
  return out;
}
