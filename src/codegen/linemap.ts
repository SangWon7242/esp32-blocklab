/**
 * 코드 지도: 블록 id ↔ 코드 줄 번호 (1부터, 표식을 걷어 낸 최종 코드 기준).
 * Blockly 에 기대지 않는 순수 함수만 둔다 (검사 엔진·정렬 테스트가 그대로 쓴다).
 *
 * 생성기는 두 단계로 지도를 만든다.
 * 1. 표식 줄: 명령 블록 코드 맨 앞에 `MARK'id'MARK` 한 줄(STATEMENT_PREFIX)이 붙는다. 부모의 statementToCode 가
 *    블록 코드와 함께 들여쓰므로 표식 줄의 들여쓰기 = 그 블록 첫 줄의 들여쓰기.
 *    marksToTags 가 표식 줄을 지우며 그 아래 줄들에 주인 꼬리표(TAG)를 단다 (규칙은 marksToTags 주석).
 * 2. 꼬리표: 줄 끝에 붙은 `TAG ids TAG`. 조립(import 끌어올리기·빈 줄 다듬기)이 줄 단위로 움직여도 줄과 함께 다닌다.
 *    준비 줄·도우미 함수 줄은 생성기 장부로 직접 꼬리표를 단다. 마지막에 buildLineMap 이 꼬리표를 걷어 지도를 만든다.
 */

export type LineMap = {
  /** 블록 id → 그 블록이 낸 줄 번호들 (오름차순) */
  blockToLines: Record<string, number[]>;
  /** 줄 번호 → 그 줄을 낸 블록 id (여러 블록이 함께 낸 준비 줄은 먼저 적힌 블록) */
  lineToBlock: Record<number, string>;
  /**
   * 블록 id → 그 블록의 첫 문장 줄: 블록 줄 중 `#` 으로 시작하지 않는 첫 줄 (윗줄 주석을 건너뛴다).
   * 모두 주석 줄이면 첫 줄. 검사 문제의 줄은 이것이다 (주석 줄은 원문 줄과 짝지을 수 없다)
   */
  blockStart: Record<string, number>;
};

/** 표식 글자 (도우미 호출 표시 HELPER_MARK "" 과 다른 사용자 영역 글자) */
export const MARK = "";
/** 줄 끝 꼬리표 글자. 꼬리표 안의 id 는 TAG_SEP 로 나눈다 */
export const TAG = "";
const TAG_SEP = "";
const TAG_CHARS = /[]/;

/** Blockly STATEMENT_PREFIX 값. injectId 가 %1 을 'id' (작은따옴표로 싼 id)로 바꾼다 */
export const STATEMENT_MARK = `${MARK}%1${MARK}\n`;

/** 표식 줄: 들여쓰기 + MARK'id'MARK */
const MARK_LINE = new RegExp(`^( *)${MARK}'(.*)'${MARK}$`);
/** 코드 맨 앞의 표식 한 줄 (줄바꿈까지) */
const LEADING_MARK = new RegExp(`^${MARK}'[^\\n]*'${MARK}\\n`);

export const emptyLineMap = (): LineMap => ({ blockToLines: {}, lineToBlock: {}, blockStart: {} });

/** 코드 맨 앞의 표식 줄 길이 (없으면 0) */
export function leadingMarkLength(code: string): number {
  return LEADING_MARK.exec(code)?.[0].length ?? 0;
}

/** 표식을 지우면 아무것도 남지 않는 코드인지 (내용 없는 명령 블록: 준비 블록, 빈 시작 블록) */
export function isMarksOnly(code: string): boolean {
  if (!code.includes(MARK)) return false;
  return code.split("\n").every((line, i, all) => MARK_LINE.test(line) || (line === "" && i === all.length - 1));
}

/** 줄 끝에 주인 꼬리표를 단다. 빈 줄이나 주인이 없으면 그대로 */
export function tagLine(line: string, ids: readonly string[]): string {
  return ids.length && line.trim() ? `${line}${TAG}${ids.join(TAG_SEP)}${TAG}` : line;
}

/** 여러 줄 글의 (빈 줄이 아닌) 줄마다 같은 꼬리표 */
export function tagLines(text: string, ids: readonly string[]): string {
  return ids.length ? text.split("\n").map((l) => tagLine(l, ids)).join("\n") : text;
}

/** 꼬리표를 모두 걷어 낸 글 */
export function stripTags(text: string): string {
  return text.includes(TAG) ? text.split("\n").map((l) => (l.includes(TAG) ? l.slice(0, l.indexOf(TAG)) : l)).join("\n") : text;
}

const indentOf = (line: string) => line.length - line.trimStart().length;

/**
 * 표식 줄을 지우고, 표식이 연 구역의 줄에 그 블록 꼬리표를 단다.
 * - 표식 줄(들여쓰기 d, id)을 만나면 스택에서 들여쓰기 d 이상인 구역을 닫고 (d, id) 를 연다.
 *   형제 블록의 표식은 앞 형제를, 자식 블록의 표식은 아무것도 닫지 않는다.
 * - 내용 줄(들여쓰기 i)은 i 보다 깊은 구역을 닫은 뒤 맨 위 구역의 블록 것이다.
 *   그래서 `while True:` 는 while 블록, 몸통은 각자 표식, `else:`·`elif` 는 (자식 구역이 닫혀) if 블록,
 *   여러 줄 명령은 모두 그 블록, 문장 위 주석 줄은 (표식 뒤에 오므로) 그 문장 블록.
 * - 빈 줄은 꼬리표를 달지 않고 구역도 닫지 않는다.
 */
export function marksToTags(text: string): string {
  if (!text.includes(MARK)) return text;
  const stack: { indent: number; id: string }[] = [];
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const m = MARK_LINE.exec(line);
    if (m) {
      const indent = m[1].length;
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      stack.push({ indent, id: m[2] });
      continue;
    }
    if (!line.trim()) {
      out.push(line);
      continue;
    }
    const indent = indentOf(line);
    while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();
    const owner = stack[stack.length - 1];
    out.push(owner ? tagLine(line, [owner.id]) : line);
  }
  return out.join("\n");
}

/** 꼬리표 달린 글 → 꼬리표를 걷어 낸 코드와 지도 */
export function buildLineMap(tagged: string): { code: string; map: LineMap } {
  const map = emptyLineMap();
  const lines = tagged.split("\n").map((line, i) => {
    const at = line.indexOf(TAG);
    if (at < 0) return line;
    const ids = line.slice(at).split(TAG_CHARS).filter(Boolean);
    const n = i + 1;
    const text = line.slice(0, at);
    const statement = !text.trim().startsWith("#");
    if (ids.length) map.lineToBlock[n] = ids[0];
    for (const id of new Set(ids)) {
      (map.blockToLines[id] ??= []).push(n);
      if (statement && map.blockStart[id] === undefined) map.blockStart[id] = n;
    }
    return text;
  });
  for (const [id, ls] of Object.entries(map.blockToLines)) map.blockStart[id] ??= ls[0];
  return { code: lines.join("\n"), map };
}

/** 지도의 줄 번호를 delta 만큼 옮기고 1..lastLine 밖의 줄은 버린다 (생성기 마지막 공백 다듬기가 줄을 지울 때) */
export function shiftLineMap(map: LineMap, delta: number, lastLine: number): LineMap {
  const out = emptyLineMap();
  for (const [line, id] of Object.entries(map.lineToBlock)) {
    const n = Number(line) + delta;
    if (n >= 1 && n <= lastLine) out.lineToBlock[n] = id;
  }
  for (const [id, lines] of Object.entries(map.blockToLines)) {
    const kept = lines.map((n) => n + delta).filter((n) => n >= 1 && n <= lastLine);
    if (!kept.length) continue;
    out.blockToLines[id] = kept;
    const start = (map.blockStart[id] ?? lines[0]) + delta;
    out.blockStart[id] = kept.includes(start) ? start : kept[0];
  }
  return out;
}

/** 코드의 줄 수 (끝 줄바꿈 뒤의 빈 칸은 세지 않는다) */
export function countLines(code: string): number {
  if (!code) return 0;
  return code.split("\n").length - (code.endsWith("\n") ? 1 : 0);
}
