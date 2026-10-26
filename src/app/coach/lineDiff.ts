/*
 * 코치 제안 상자의 줄 차이 (lib-v1.1.0). 새 의존성 없이 줄 단위 LCS(가장 긴 공통 부분열)로 잰다.
 * 수업 코드는 수십~수백 줄이라 O(n·m) 표로 충분하다. 너무 길면(줄 수 곱이 한도를 넘으면) 앞뒤 같은 줄만 걷어 내고
 * 가운데는 통째로 "지움 + 더함" 으로 보인다 (화면이 멈추지 않게).
 */

export type DiffRow =
  /** 두 코드에 다 있는 줄 */
  | { kind: "same"; text: string; oldLine: number; newLine: number }
  /** 지금 코드에만 있는 줄 (적용하면 사라진다) */
  | { kind: "del"; text: string; oldLine: number }
  /** 제안 코드에만 있는 줄 (적용하면 생긴다) */
  | { kind: "add"; text: string; newLine: number };

/** LCS 표 칸 수 한도 (약 4백만 칸 = 2000×2000 줄) */
const MAX_CELLS = 4_000_000;

/** 줄로 나눈다. 줄 끝 \r 은 지우고, 맨 끝 빈 줄 하나(파일 끝 줄바꿈)는 줄로 세지 않는다 */
export function splitLines(code: string): string[] {
  const lines = code.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  if (lines.length === 1 && lines[0] === "") return [];
  return lines;
}

/** 지금 코드(before) → 제안 코드(after) 의 줄 차이. 같은 자리에서 바뀐 줄은 지움 다음에 더함으로 놓는다 */
export function lineDiff(before: string, after: string): DiffRow[] {
  const a = splitLines(before);
  const b = splitLines(after);
  // 앞뒤 같은 줄은 표를 만들지 않고 바로 같음으로 둔다
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;

  const rows: DiffRow[] = [];
  for (let i = 0; i < head; i++) rows.push({ kind: "same", text: a[i], oldLine: i + 1, newLine: i + 1 });

  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  rows.push(...middleDiff(midA, midB, head, head));

  for (let k = tail; k > 0; k--) {
    const i = a.length - k;
    const j = b.length - k;
    rows.push({ kind: "same", text: a[i], oldLine: i + 1, newLine: j + 1 });
  }
  return rows;
}

function middleDiff(a: string[], b: string[], offA: number, offB: number): DiffRow[] {
  const n = a.length;
  const m = b.length;
  const del = (i: number): DiffRow => ({ kind: "del", text: a[i], oldLine: offA + i + 1 });
  const add = (j: number): DiffRow => ({ kind: "add", text: b[j], newLine: offB + j + 1 });
  if (n === 0 || m === 0 || (n + 1) * (m + 1) > MAX_CELLS) {
    return [...a.map((_, i) => del(i)), ...b.map((_, j) => add(j))];
  }
  // len[i][j] = a[i..], b[j..] 의 LCS 길이 (뒤에서부터 채워 앞에서부터 걷는다)
  const w = m + 1;
  const len = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      len[i * w + j] = a[i] === b[j] ? len[(i + 1) * w + j + 1] + 1 : Math.max(len[(i + 1) * w + j], len[i * w + j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ kind: "same", text: a[i], oldLine: offA + i + 1, newLine: offB + j + 1 });
      i++;
      j++;
    } else if (len[(i + 1) * w + j] >= len[i * w + j + 1]) {
      rows.push(del(i++));
    } else {
      rows.push(add(j++));
    }
  }
  while (i < n) rows.push(del(i++));
  while (j < m) rows.push(add(j++));
  return rows;
}

/** 더한 줄·지운 줄 수 (상자 머리의 요약) */
export function diffStats(rows: DiffRow[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const r of rows) {
    if (r.kind === "add") added++;
    else if (r.kind === "del") removed++;
  }
  return { added, removed };
}

/** 접은 같은 줄 묶음 (상자에서 "같은 줄 N개" 한 줄로 보인다) */
export type FoldRow = { kind: "fold"; count: number; oldLine: number; newLine: number };

/**
 * 바뀐 곳 둘레 context 줄만 남기고 긴 같은 줄 묶음을 접는다. 접어도 한 줄밖에 안 줄면 접지 않는다.
 * 바뀐 줄이 없으면 그대로 둔다 (상자가 "바뀐 줄이 없어요" 를 보인다)
 */
export function foldRows(rows: DiffRow[], context = 3): (DiffRow | FoldRow)[] {
  if (!rows.some((r) => r.kind !== "same")) return rows;
  const keep = rows.map(() => false);
  rows.forEach((r, i) => {
    if (r.kind === "same") return;
    for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep[k] = true;
  });
  const out: (DiffRow | FoldRow)[] = [];
  let i = 0;
  while (i < rows.length) {
    if (keep[i]) {
      out.push(rows[i++]);
      continue;
    }
    let j = i;
    while (j < rows.length && !keep[j]) j++;
    const first = rows[i] as Extract<DiffRow, { kind: "same" }>;
    if (j - i <= 1) out.push(...rows.slice(i, j));
    else out.push({ kind: "fold", count: j - i, oldLine: first.oldLine, newLine: first.newLine });
    i = j;
  }
  return out;
}
