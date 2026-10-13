/** 블록에 단 검사 표시: 경고 말풍선 글과 테두리 수준 */
export type LintMark = { text: string; level: "error" | "warning" };
/** 표시를 단 블록. id 가 아니라 블록 자체로 들고 있어야 같은 id 로 지웠다 다시 만든 블록을 구별한다 */
export type MarkedBlock<B> = LintMark & { block: B };

export type LintMarkDiff<B> = {
  /** 표시를 뗄 (아직 살아 있는) 블록 */
  clear: B[];
  /** 표시를 달 블록. setText 면 경고 글도 다시 단다 (아니면 테두리 수준만) */
  apply: (MarkedBlock<B> & { setText: boolean })[];
};

/**
 * 지난 표시(prev)와 이번 표시(next)를 견준다 (Blockly 에 기대지 않는 순수 함수, BlocklyWorkspace.setIssues 가 쓴다).
 * 같은 블록(참조)이고 글·수준이 같으면 건드리지 않는다. 같은 id 라도 블록이 바뀌었으면(지웠다 되살림) 새로 단다.
 */
export function diffLintMarks<B>(prev: Map<string, MarkedBlock<B>>, next: Map<string, MarkedBlock<B>>, isDead: (block: B) => boolean): LintMarkDiff<B> {
  const clear: B[] = [];
  const apply: LintMarkDiff<B>["apply"] = [];
  for (const [id, old] of prev) {
    if (next.get(id)?.block === old.block) continue;
    if (!isDead(old.block)) clear.push(old.block);
  }
  for (const [id, mark] of next) {
    const old = prev.get(id);
    const same = old?.block === mark.block;
    if (same && old.text === mark.text && old.level === mark.level) continue;
    apply.push({ ...mark, setText: !same || old.text !== mark.text });
  }
  return { clear, apply };
}
