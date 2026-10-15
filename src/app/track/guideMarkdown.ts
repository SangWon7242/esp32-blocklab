/**
 * 안내 글용 가벼운 markdown (라이브러리 없이).
 * - 빈 줄로 문단을 나누고, 문단 안 줄바꿈은 그대로 둔다
 * - `- ` / `* ` 로 시작하는 줄은 글머리 목록, `1. ` 처럼 숫자+점은 번호 목록 (들여 쓴 다음 줄은 앞 항목에 이어 붙음)
 * - 줄 안: `**굵게**`, `` `코드` `` (코드 안의 ** 는 그대로)
 */
export type Inline = { kind: "text" | "bold" | "code"; text: string };
export type GuideBlock =
  | { kind: "p"; inlines: Inline[] }
  | { kind: "ul"; items: Inline[][] }
  | { kind: "ol"; start: number; items: Inline[][] };

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBER = /^\s*(\d+)[.)]\s+(.*)$/;

/** 줄 안 꾸밈: 코드 먼저 떼고, 나머지에서 굵게 */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const push = (kind: Inline["kind"], t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.kind === kind && kind === "text") last.text += t;
    else out.push({ kind, text: t });
  };
  const parts = text.split(/(`[^`\n]+`)/);
  for (const part of parts) {
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
      push("code", part.slice(1, -1));
      continue;
    }
    const bits = part.split(/(\*\*[^*\n](?:[^\n]*?[^*\n])?\*\*)/);
    for (const bit of bits) {
      if (bit.length >= 5 && bit.startsWith("**") && bit.endsWith("**")) push("bold", bit.slice(2, -2)); // 한 글자 굵게(**0**)도 허용
      else push("text", bit);
    }
  }
  return out;
}

export function parseGuide(source: string): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let para: string[] = [];
  let list: { kind: "ul" | "ol"; start: number; items: string[] } | null = null;

  const flushPara = () => {
    const text = para.join("\n").trim();
    if (text) blocks.push({ kind: "p", inlines: parseInline(text) });
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((i) => parseInline(i.trim()));
    blocks.push(list.kind === "ul" ? { kind: "ul", items } : { kind: "ol", start: list.start, items });
    list = null;
  };

  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const bullet = BULLET.exec(line);
    const number = bullet ? null : NUMBER.exec(line);
    if (bullet || number) {
      const kind = bullet ? "ul" : "ol";
      flushPara();
      if (list && list.kind !== kind) flushList();
      if (!list) list = { kind, start: number ? Number(number[1]) : 1, items: [] };
      list.items.push(bullet ? bullet[1] : number![2]);
      continue;
    }
    // 들여 쓴 줄은 앞 목록 항목에 이어 붙인다
    if (list && /^\s+/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}
