/*
 * 안내 글 markdown(src/track/README.md "안내 글 markdown") → 슬라이드 글 덩어리, 그리고 줄 수 어림.
 * 지원: 빈 줄 = 문단, `- `/`* ` 글머리, `1. ` 번호, 들여 쓴 다음 줄은 앞 항목에 이어 붙임, **굵게**, `코드`.
 */

/** 글 한 토막 */
export type Run = { text: string; bold?: boolean; code?: boolean };

/** 문단 하나 (슬라이드 글상자의 한 단락) */
export type Block = {
  kind: "p" | "bullet" | "number";
  /** 번호 목록의 번호 */
  n?: number;
  runs: Run[];
  /** 앞에 빈 줄이 있었는지 (문단 사이 여백) */
  gap?: boolean;
};

/** `코드`·**굵게** 를 토막으로 나눈다 (코드 안의 ** 는 그대로) */
export function inline(text: string): Run[] {
  const runs: Run[] = [];
  const parts = text.split(/(`[^`]+`)/);
  for (const part of parts) {
    if (!part) continue;
    if (part.length > 1 && part.startsWith("`") && part.endsWith("`")) {
      runs.push({ text: part.slice(1, -1), code: true });
      continue;
    }
    const pieces = part.split(/(\*\*[^*]+\*\*)/);
    for (const piece of pieces) {
      if (!piece) continue;
      if (piece.length > 4 && piece.startsWith("**") && piece.endsWith("**")) runs.push({ text: piece.slice(2, -2), bold: true });
      else runs.push({ text: piece });
    }
  }
  return runs;
}

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBER = /^\s*(\d+)\.\s+(.*)$/;

/** markdown 글 → 문단 목록 */
export function markdownBlocks(md: string | undefined): Block[] {
  if (!md) return [];
  const blocks: Block[] = [];
  let gap = false;
  let prevList = false;
  for (const raw of md.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      gap = blocks.length > 0;
      prevList = false;
      continue;
    }
    const b = BULLET.exec(line);
    const n = b ? null : NUMBER.exec(line);
    if (b) {
      blocks.push({ kind: "bullet", runs: inline(b[1]), gap });
      prevList = true;
    } else if (n) {
      blocks.push({ kind: "number", n: Number(n[1]), runs: inline(n[2]), gap });
      prevList = true;
    } else if (prevList && /^\s+/.test(line) && blocks.length) {
      // 들여 쓴 다음 줄은 앞 항목에 이어 붙인다
      blocks[blocks.length - 1].runs.push({ text: " " }, ...inline(line.trim()));
    } else {
      blocks.push({ kind: "p", runs: inline(line.trim()), gap });
      prevList = false;
    }
    gap = false;
  }
  return blocks;
}

/** 글 그대로(꾸밈 없음) 한 문단 */
export function plainBlock(text: string, kind: Block["kind"] = "p", n?: number): Block {
  return { kind, n, runs: [{ text }] };
}

/** markdown 한 줄을 목록 항목으로 */
export function itemBlock(md: string, kind: "bullet" | "number" = "bullet", n?: number): Block {
  return { kind, n, runs: inline(md.trim()) };
}

/** 글자 하나의 폭 (글자 크기 1 기준, em). 한글·한자·전각은 1, 영문·숫자는 약 0.55 */
export function charEm(ch: string, mono = false): number {
  const c = ch.codePointAt(0) ?? 0;
  const wide =
    (c >= 0x1100 && c <= 0x11ff) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0x2190 && c <= 0x2bff);
  if (mono) return wide ? 1.0 : 0.6;
  if (wide) return 0.95;
  if (ch === " ") return 0.3;
  if (/[A-Z0-9]/.test(ch)) return 0.62;
  if (/[a-z]/.test(ch)) return 0.52;
  return 0.42;
}

/** 글 폭 (pt) */
export function textWidthPt(text: string, pt: number, mono = false): number {
  let em = 0;
  for (const ch of text) em += charEm(ch, mono);
  return em * pt;
}

/** 목록 들여쓰기 (in) */
export const LIST_INDENT_IN = 0.4;

/** 문단 하나가 폭 widthIn(인치, 글상자 안쪽) 에서 몇 줄이 되는지 어림 (줄바꿈은 낱말 단위라 조금 넉넉히) */
export function blockLines(block: Block, pt: number, widthIn: number): number {
  const avail = (widthIn - (block.kind === "p" ? 0 : LIST_INDENT_IN)) * 72;
  let w = 0;
  for (const r of block.runs) w += textWidthPt(r.text, pt, r.code) * (r.bold ? 1.04 : 1);
  return Math.max(1, Math.ceil((w * 1.06) / Math.max(avail, 36)));
}

/**
 * 너무 긴 문단을 앞부분(최대 maxLines 줄)과 나머지로 나눈다. 낱말(공백) 단위로 자른다.
 * 나눌 수 없으면(낱말 하나가 너무 길면) [block, undefined].
 */
export function splitBlock(block: Block, maxLines: number, pt: number, widthIn: number): [Block, Block | undefined] {
  // 낱말 토막: [글, 꾸밈] — 공백은 앞 낱말 끝에 붙여 둔다
  const words: Run[] = [];
  for (const r of block.runs) {
    for (const piece of r.text.split(/(?<=\s)/)) if (piece) words.push({ ...r, text: piece });
  }
  if (words.length < 2) return [block, undefined];
  let head: Run[] = [];
  let i = 0;
  for (; i < words.length; i++) {
    const trial = [...head, words[i]];
    if (head.length && blockLines({ ...block, runs: trial }, pt, widthIn) > maxLines) break;
    head = trial;
  }
  if (i >= words.length) return [block, undefined];
  const merge = (rs: Run[]): Run[] =>
    rs.reduce<Run[]>((acc, r) => {
      const last = acc[acc.length - 1];
      if (last && !!last.bold === !!r.bold && !!last.code === !!r.code) last.text += r.text;
      else acc.push({ ...r });
      return acc;
    }, []);
  const headRuns = merge(head);
  headRuns[headRuns.length - 1].text = headRuns[headRuns.length - 1].text.replace(/\s+$/, "");
  return [
    { ...block, runs: headRuns },
    // 이어지는 쪽은 글머리·번호 없는 문단으로 (같은 항목이 두 번 매겨지지 않게)
    { kind: "p", runs: merge(words.slice(i)), gap: false },
  ];
}
