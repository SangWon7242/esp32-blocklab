import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import { APP_DESIGN_BOXES, appCheckLabels, appCheckOptions } from "../../src/track/appCheck.ts";
import type { Step } from "../../src/track/schema.ts";
import type { LoadedSlideChapter, SlideChapter } from "./chapter.ts";
import { blockLines, itemBlock, markdownBlocks, plainBlock, splitBlock, textWidthPt, type Block } from "./text.ts";

/*
 * 챕터 → 슬라이드(pptx). 장 순서:
 *   표지 → 목표·성공 기준 → 준비물 → 배선 → 원리 → 단계마다 1~3장(+ 유형별 장) → 교사용.
 * 학생 화면에서 숨기는 것(예시 답·정답 코드·읽기 체크 답·설계 빈칸 답)은 넣지 않는다.
 * 그림(SVG)은 rasterize 가 PNG 로 바꿔 준다(없거나 실패하면 그림 없이).
 */

/** PNG 그림: data 는 pptxgenjs 형식("image/png;base64,...") */
export type Png = { data: string; width: number; height: number };
/** SVG 원문 → PNG. ref 는 "images/x.svg" (로그용) */
export type Rasterize = (svg: string, ref: string) => Promise<Png | undefined>;

export type DeckOptions = {
  rasterize?: Rasterize;
  /** 본문 글꼴 (기본: macOS 는 Apple SD Gothic Neo, 그 밖은 Malgun Gothic) */
  font?: string;
  /** 코드 글꼴 (기본: macOS 는 Menlo, 그 밖은 Consolas) */
  codeFont?: string;
};

export function defaultFont(platform: string = process.platform): string {
  return platform === "darwin" ? "Apple SD Gothic Neo" : "Malgun Gothic";
}
export function defaultCodeFont(platform: string = process.platform): string {
  return platform === "darwin" ? "Menlo" : "Consolas";
}

/** 단계 유형 이름 (src/app/track/stepMeta.ts 의 STEP_TYPE_LABEL 과 같게) */
export const STEP_TYPE_LABEL: Record<string, string> = {
  problem: "문제 만나기",
  analysis: "조건 분석",
  predict: "예측하기",
  run: "복사·실행",
  readcheck: "읽기 체크",
  mission: "미션",
  debug: "디버깅",
  design: "설계",
  reflect: "성찰",
  app: "앱 만들기",
};

const TYPE_COLOR: Record<string, string> = {
  problem: "D97706",
  analysis: "0D9488",
  predict: "7C3AED",
  run: "2563EB",
  readcheck: "0891B2",
  mission: "16A34A",
  debug: "DC2626",
  design: "4F46E5",
  reflect: "475569",
  app: "DB2777",
};

// 색
const INK = "0F172A";
const SUB = "475569";
const MUTED = "94A3B8";
const BAR = "1E293B";
const ACCENT = "2563EB";
const INLINE_CODE = "BE185D";
const CARD = "F1F5F9";
const CARD_LINE = "CBD5E1";
const CODE_BG = "0F172A";
const CODE_TEXT = "E2E8F0";
const CODE_NUM = "64748B";
const NOTE_BG = "FEF3C7";
const NOTE_INK = "92400E";

// 판 (LAYOUT_WIDE: 13.333 x 7.5 in)
const SLIDE_W = 13.333;
const X0 = 0.55;
const FULL_W = SLIDE_W - 2 * X0;
const BODY_Y = 1.35;
const BODY_BOTTOM = 7.0;
const BODY_H = BODY_BOTTOM - BODY_Y;

/** 본문 글 크기와 한 장의 본문 줄 수 한도 */
const BODY_PT = 22;
const MAX_LINES = 8;
/** 코드 한 장의 최대 줄 수 */
const CODE_LINES = 22;
/** 그림 옆 글 칸 폭 */
const SIDE_TEXT_W = 6.75;
const SIDE_IMG_X = 7.65;
const SIDE_IMG_W = SLIDE_W - X0 - SIDE_IMG_X;

type Section = { heading?: string; blocks: Block[] };
type Badge = { text: string; color: string };
type Figure = { image?: string; caption?: string };

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

/** 한 장에 들어갈 글 (섹션 조각들) */
type Page = Section[];

/**
 * 섹션들을 장으로 나눈다: 한 장의 본문은 maxLines 줄 이하 (제목 줄은 따로).
 * widthFor(i) = i 번째 장의 글 칸 폭(in). 한 문단이 남은 줄보다 길면 낱말 단위로 잘라 다음 장으로 넘긴다.
 */
export function paginate(sections: Section[], widthFor: (page: number) => number, pt = BODY_PT, maxLines = MAX_LINES): Page[] {
  const pages: Page[] = [];
  let page: Page = [];
  let used = 0;
  let current: Section = { blocks: [] };
  /** 다음 장으로. 지금 섹션에 아직 문단이 없으면 제목째로 옮긴다 (제목만 덩그러니 남지 않게) */
  const nextPage = () => {
    const orphan = current.blocks.length === 0;
    const heading = orphan ? current.heading : undefined;
    if (orphan) page.pop();
    if (page.length) pages.push(page);
    page = [];
    used = 0;
    current = { heading, blocks: [] };
    page.push(current);
  };
  for (const section of sections) {
    if (!section.blocks.length) continue;
    // 다음 장 하나에 통째로 들어가는 섹션은 쪼개지 않고 다음 장으로 넘긴다 (지금 할 일 목록 등)
    if (used > 0) {
      const total = section.blocks.reduce((n, b) => n + blockLines(b, pt, widthFor(pages.length + 1)), 0);
      const here = section.blocks.reduce((n, b) => n + blockLines(b, pt, widthFor(pages.length)), 0);
      if (used + here > maxLines && total <= maxLines) {
        pages.push(page);
        page = [];
        used = 0;
      }
    }
    current = { heading: section.heading, blocks: [] };
    page.push(current);
    const queue = [...section.blocks];
    while (queue.length) {
      const block = queue.shift()!;
      const width = widthFor(pages.length);
      const lines = blockLines(block, pt, width);
      if (used + lines <= maxLines) {
        current.blocks.push(block);
        used += lines;
        continue;
      }
      const room = used === 0 ? maxLines : maxLines - used;
      // 남은 자리가 2줄 이상이거나 빈 장에도 안 들어가는 문단이면 낱말 단위로 잘라 채운다
      if (room >= 2) {
        const [head, tail] = splitBlock(block, room, pt, width);
        if (tail) {
          current.blocks.push(head);
          queue.unshift(tail);
          nextPage();
          continue;
        }
      }
      if (used === 0) {
        // 자를 수 없는 긴 문단은 그대로 둔다 (글상자가 줄여 맞춘다)
        current.blocks.push(block);
        used += lines;
        continue;
      }
      queue.unshift(block);
      nextPage();
    }
  }
  if (page.some((s) => s.blocks.length)) pages.push(page);
  return pages;
}

/** 그림 크기를 칸 안에 비율대로 (가운데) */
function contain(png: Png, box: { x: number; y: number; w: number; h: number }, valign: "top" | "middle" = "middle") {
  const scale = Math.min(box.w / png.width, box.h / png.height);
  const w = png.width * scale;
  const h = png.height * scale;
  return { x: box.x + (box.w - w) / 2, y: valign === "top" ? box.y : box.y + (box.h - h) / 2, w, h };
}

/** 챕터에서 그림을 가리키는 곳들 (중복 없이) */
export function chapterImageRefs(chapter: SlideChapter): string[] {
  const refs = new Set<string>();
  const add = (r: string | undefined) => r && refs.add(r);
  add(chapter.cover);
  chapter.materials?.forEach((m) => add(m.image));
  add(chapter.wiring?.image);
  add(chapter.principle?.image);
  for (const p of chapter.parts) for (const s of p.steps) add(s.scene?.image);
  return [...refs];
}

class DeckBuilder {
  readonly pres = new PptxGenJS();
  count = 0;
  private label: string;
  private readonly loaded: LoadedSlideChapter;
  private readonly images: Map<string, Png>;
  private readonly font: string;
  private readonly codeFont: string;

  constructor(loaded: LoadedSlideChapter, images: Map<string, Png>, font: string, codeFont: string) {
    this.loaded = loaded;
    this.images = images;
    this.font = font;
    this.codeFont = codeFont;
    const c = loaded.chapter;
    this.pres.layout = "LAYOUT_WIDE";
    this.pres.title = c.title;
    this.pres.subject = c.summary ?? "";
    this.pres.company = "ESP32 블록랩";
    this.pres.theme = { headFontFace: font, bodyFontFace: font };
    this.label = `${this.chapterNo()} · ${c.title}`;
  }

  private get chapter(): SlideChapter {
    return this.loaded.chapter;
  }

  private chapterNo(): string {
    const c = this.chapter;
    return c.code ?? c.label ?? `챕터 ${c.order}`;
  }

  setPart(title: string | undefined) {
    this.label = `${this.chapterNo()} · ${this.chapter.title}${title ? `  |  ${title}` : ""}`;
  }

  // ── 기본 틀 ────────────────────────────────────────────

  private newSlide(): PptxGenJS.Slide {
    const s = this.pres.addSlide();
    s.background = { color: "FFFFFF" };
    s.slideNumber = { x: SLIDE_W - X0 - 0.6, y: 7.08, w: 0.6, h: 0.3, fontFace: this.font, fontSize: 10, color: MUTED, align: "right" };
    this.count++;
    return s;
  }

  /** 제목 띠(챕터 이름 + 장 제목 + 유형 배지)가 있는 장 */
  framed(title: string, badge?: Badge): PptxGenJS.Slide {
    const s = this.newSlide();
    s.addShape(this.pres.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 1.08, fill: { color: BAR }, line: { color: BAR, width: 0 } });
    s.addText(this.label, { x: X0, y: 0.1, w: FULL_W, h: 0.32, fontFace: this.font, fontSize: 12, color: MUTED, margin: 0, valign: "middle", fit: "shrink" });
    let titleW = FULL_W;
    if (badge) {
      const bw = Math.max(1.2, textWidthPt(badge.text, 14) / 72 + 0.45);
      titleW = FULL_W - bw - 0.3;
      s.addText(badge.text, {
        shape: this.pres.ShapeType.roundRect, rectRadius: 0.12,
        x: SLIDE_W - X0 - bw, y: 0.48, w: bw, h: 0.44,
        fill: { color: badge.color }, line: { color: badge.color, width: 0 },
        fontFace: this.font, fontSize: 14, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0,
      });
    }
    s.addText(title, { x: X0, y: 0.42, w: titleW, h: 0.58, fontFace: this.font, fontSize: 26, bold: true, color: "FFFFFF", margin: 0, valign: "middle", fit: "shrink" });
    return s;
  }

  /** 섹션 글 → pptxgenjs 글 토막 */
  private rich(page: Page, pt: number): PptxGenJS.TextProps[] {
    const out: PptxGenJS.TextProps[] = [];
    page.forEach((section, si) => {
      if (section.heading) {
        out.push({
          text: section.heading,
          options: { bold: true, color: ACCENT, fontSize: pt - 5, breakLine: true, paraSpaceBefore: si === 0 ? 0 : 14, paraSpaceAfter: 4 },
        });
      }
      section.blocks.forEach((block, bi) => {
        const para: PptxGenJS.TextPropsOptions = {
          fontSize: pt,
          color: INK,
          bullet: block.kind === "bullet" ? { indent: 22 } : block.kind === "number" ? { type: "number", numberStartAt: block.n ?? 1, indent: 28 } : false,
          paraSpaceBefore: block.gap ? 10 : bi === 0 && !section.heading && si > 0 ? 14 : 3,
          lineSpacingMultiple: 1.1,
        };
        const runs = block.runs.filter((r) => r.text.length);
        if (!runs.length) runs.push({ text: " " });
        // 글머리·번호는 첫 토막의 꾸밈(굵게·코드 색)을 따라가므로, 꾸민 토막으로 시작하면 보이지 않는 보통 토막을 앞에 둔다
        if (block.kind !== "p" && (runs[0].bold || runs[0].code)) runs.unshift({ text: "\u200B" });
        // 글머리·번호는 문단 첫 토막에만 (pptxgenjs 는 bullet 이 붙은 토막마다 새 문단을 연다)
        runs.forEach((r, ri) => {
          out.push({
            text: r.text,
            options: {
              ...para,
              bullet: ri === 0 ? para.bullet : undefined,
              bold: r.bold,
              ...(r.code ? { fontFace: this.codeFont, color: INLINE_CODE } : {}),
              breakLine: ri === runs.length - 1,
            },
          });
        });
      });
    });
    // 마지막 줄바꿈은 빈 문단을 만들지 않게 뺀다
    const last = out[out.length - 1];
    if (last?.options) last.options.breakLine = false;
    return out;
  }

  private addRich(s: PptxGenJS.Slide, page: Page, box: { x: number; y: number; w: number; h: number }, pt = BODY_PT) {
    s.addText(this.rich(page, pt), { ...box, fontFace: this.font, valign: "top", margin: [2, 4, 2, 2], fit: "shrink" });
  }

  /** 그림 + 아래 설명을 칸에 */
  private addFigure(s: PptxGenJS.Slide, fig: Figure, box: { x: number; y: number; w: number; h: number }, captionPt = 15): boolean {
    const png = fig.image ? this.images.get(fig.image) : undefined;
    if (!png) return false;
    const capLines = fig.caption ? Math.min(4, blockLines(plainBlock(fig.caption), captionPt, box.w)) : 0;
    const capH = capLines ? (capLines * captionPt * 1.25) / 72 + 0.15 : 0;
    const img = contain(png, { ...box, h: box.h - capH }, "middle");
    s.addShape(this.pres.ShapeType.rect, { ...img, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 1 } });
    s.addImage({ data: png.data, ...img });
    if (fig.caption) {
      s.addText(fig.caption, {
        x: box.x, y: img.y + img.h + 0.08, w: box.w, h: capH,
        fontFace: this.font, fontSize: captionPt, color: SUB, margin: 0, valign: "top", fit: "shrink",
      });
    }
    return true;
  }

  /** 글 장들 (첫 장 오른쪽에 그림). 글이 없고 그림만 있으면 그림을 크게 한 장 */
  textSlides(title: string, sections: Section[], opts: { badge?: Badge; figure?: Figure; pt?: number; notes?: string; footer?: string; maxLines?: number } = {}) {
    const pt = opts.pt ?? BODY_PT;
    const hasFig = !!(opts.figure?.image && this.images.get(opts.figure.image));
    const footerH = opts.footer ? 0.75 : 0;
    const maxLines = (opts.maxLines ?? MAX_LINES) - (opts.footer ? 1 : 0);
    const pages = paginate(sections, (i) => (i === 0 && hasFig ? SIDE_TEXT_W : FULL_W), pt, maxLines);
    if (!pages.length) {
      if (!hasFig && !opts.footer) return;
      pages.push([]);
    }
    pages.forEach((page, i) => {
      const s = this.framed(i === 0 ? title : `${title} (계속)`, opts.badge);
      if (opts.notes) s.addNotes(opts.notes);
      const textH = BODY_H - footerH;
      if (i === 0 && hasFig) {
        if (page.length) {
          this.addRich(s, page, { x: X0, y: BODY_Y, w: SIDE_TEXT_W, h: textH }, pt);
          this.addFigure(s, opts.figure!, { x: SIDE_IMG_X, y: BODY_Y + 0.05, w: SIDE_IMG_W, h: textH - 0.05 });
        } else {
          this.addFigure(s, opts.figure!, { x: X0, y: BODY_Y, w: FULL_W, h: textH }, 18);
        }
      } else if (page.length) {
        this.addRich(s, page, { x: X0, y: BODY_Y, w: FULL_W, h: textH }, pt);
      }
      if (opts.footer) this.noteBox(s, opts.footer);
    });
  }

  private noteBox(s: PptxGenJS.Slide, text: string) {
    s.addText(text, {
      shape: this.pres.ShapeType.roundRect, rectRadius: 0.1,
      x: X0, y: BODY_BOTTOM - 0.6, w: FULL_W, h: 0.6,
      fill: { color: NOTE_BG }, line: { color: "FCD34D", width: 1 },
      fontFace: this.font, fontSize: 16, bold: true, color: NOTE_INK, align: "center", valign: "middle", margin: 4,
    });
  }

  // ── 코드 카드 ──────────────────────────────────────────

  private codeCard(s: PptxGenJS.Slide, lines: string[], firstNo: number, totalLines: number, label: string, box: { x: number; y: number; w: number; h: number }) {
    const digits = String(totalLines).length;
    const innerW = box.w - 0.45;
    const maxEm = Math.max(10, ...lines.map((l, i) => textWidthPt(`${String(firstNo + i).padStart(digits)}  ${l}`, 1, true)));
    const byWidth = (innerW * 72) / (maxEm * 1.03);
    const byHeight = ((box.h - 0.75) * 72) / (lines.length * 1.2);
    const size = Math.max(10, Math.min(18, Math.floor(Math.min(byWidth, byHeight) * 2) / 2));
    const lineH = size * 1.2;
    const h = Math.min(box.h, 0.62 + (lines.length * lineH) / 72 + 0.25);
    s.addShape(this.pres.ShapeType.roundRect, { x: box.x, y: box.y, w: box.w, h, rectRadius: 0.12, fill: { color: CODE_BG }, line: { color: CODE_BG, width: 0 } });
    s.addText(label, { x: box.x + 0.25, y: box.y + 0.1, w: box.w - 0.5, h: 0.36, fontFace: this.codeFont, fontSize: 12, color: MUTED, margin: 0, valign: "middle" });
    const runs: PptxGenJS.TextProps[] = [];
    lines.forEach((line, i) => {
      runs.push({ text: `${String(firstNo + i).padStart(digits)}  `, options: { color: CODE_NUM } });
      runs.push({ text: line.length ? line : " ", options: { color: CODE_TEXT, breakLine: i < lines.length - 1 } });
    });
    s.addText(runs, {
      x: box.x + 0.22, y: box.y + 0.52, w: box.w - 0.4, h: h - 0.62,
      fontFace: this.codeFont, fontSize: size, lineSpacing: lineH, valign: "top", margin: 0, fit: "shrink",
    });
  }

  /**
   * 코드 카드 장. 22줄이 넘으면 여러 장으로 고르게 나눈다.
   * panel(오른쪽 글)이 있고 코드가 한 장이며 글이 옆 칸에 들어가면 한 장에 나란히, 아니면 코드 장 다음에 글 장.
   */
  codeSlides(title: string, label: string, code: string, opts: { badge?: Badge; panel?: Section[]; notes?: string } = {}) {
    const lines = code.replace(/\t/g, "    ").replace(/\s+$/, "").split("\n").map((l) => l.replace(/\s+$/, ""));
    const pageCount = Math.max(1, Math.ceil(lines.length / CODE_LINES));
    const per = Math.ceil(lines.length / pageCount);
    const panel = (opts.panel ?? []).filter((p) => p.blocks.length);
    const PANEL_PT = 20;
    const panelW = 4.85;
    const codeW = FULL_W - panelW - 0.35;
    const panelPages = panel.length ? paginate(panel, () => panelW, PANEL_PT) : [];
    const sideBySide = pageCount === 1 && panelPages.length === 1;
    for (let p = 0; p < pageCount; p++) {
      const chunk = lines.slice(p * per, (p + 1) * per);
      const s = this.framed(pageCount > 1 ? `${title} (${p + 1}/${pageCount})` : title, opts.badge);
      if (opts.notes) s.addNotes(opts.notes);
      const tag = pageCount > 1 ? `${label}  ·  ${p * per + 1}~${p * per + chunk.length}줄` : label;
      if (sideBySide) {
        this.codeCard(s, chunk, p * per + 1, lines.length, tag, { x: X0, y: BODY_Y, w: codeW, h: BODY_H });
        this.addRich(s, panelPages[0], { x: X0 + codeW + 0.35, y: BODY_Y, w: panelW, h: BODY_H }, PANEL_PT);
      } else {
        this.codeCard(s, chunk, p * per + 1, lines.length, tag, { x: X0, y: BODY_Y, w: FULL_W, h: BODY_H });
      }
    }
    if (!sideBySide && panel.length) this.textSlides(title, panel, { badge: opts.badge, notes: opts.notes });
  }

  // ── 카드 ──────────────────────────────────────────────

  private card(s: PptxGenJS.Slide, box: { x: number; y: number; w: number; h: number }, heading: string, sub: string | undefined, color: string) {
    s.addShape(this.pres.ShapeType.roundRect, { ...box, rectRadius: 0.12, fill: { color: CARD }, line: { color: CARD_LINE, width: 1 } });
    s.addShape(this.pres.ShapeType.rect, { x: box.x, y: box.y + 0.15, w: 0.08, h: 0.55, fill: { color }, line: { color, width: 0 } });
    s.addText(heading, { x: box.x + 0.25, y: box.y + 0.12, w: box.w - 0.4, h: 0.6, fontFace: this.font, fontSize: 22, bold: true, color: INK, margin: 0, valign: "middle", fit: "shrink" });
    if (sub) {
      s.addText(sub, { x: box.x + 0.25, y: box.y + 0.75, w: box.w - 0.4, h: Math.min(1.2, box.h - 0.9), fontFace: this.font, fontSize: 15, color: SUB, margin: 0, valign: "top", fit: "shrink" });
    }
  }

  // ── 챕터 장 ───────────────────────────────────────────

  cover() {
    const c = this.chapter;
    const s = this.newSlide();
    const png = c.cover ? this.images.get(c.cover) : undefined;
    const textW = png ? 6.1 : FULL_W;
    s.addShape(this.pres.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: 7.5, fill: { color: ACCENT }, line: { color: ACCENT, width: 0 } });
    const no = this.chapterNo();
    s.addText(no, {
      shape: this.pres.ShapeType.roundRect, rectRadius: 0.12,
      x: 0.75, y: 0.75, w: Math.max(1.3, textWidthPt(no, 16) / 72 + 0.5), h: 0.48,
      fill: { color: ACCENT }, line: { color: ACCENT, width: 0 }, fontFace: this.font, fontSize: 16, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0,
    });
    s.addText(c.title, { x: 0.75, y: 1.45, w: textW, h: 1.5, fontFace: this.font, fontSize: 40, bold: true, color: INK, margin: 0, valign: "bottom", fit: "shrink" });
    let y = 3.05;
    if (c.subtitle) {
      s.addText(c.subtitle, { x: 0.75, y, w: textW, h: 0.6, fontFace: this.font, fontSize: 20, color: SUB, margin: 0, valign: "top", fit: "shrink" });
      y += 0.7;
    }
    const summary = markdownBlocks(c.summary);
    if (summary.length) {
      s.addText(this.rich([{ blocks: summary }], 18), { x: 0.75, y: y + 0.1, w: textW, h: 6.6 - y - 0.1, fontFace: this.font, valign: "top", margin: 0, fit: "shrink" });
    }
    if (png) {
      const img = contain(png, { x: 7.2, y: 0.75, w: 5.6, h: 5.85 });
      s.addImage({ data: png.data, ...img });
    }
    s.addText("ESP32 블록랩", { x: 0.75, y: 6.85, w: 6, h: 0.35, fontFace: this.font, fontSize: 12, color: MUTED, margin: 0 });
  }

  goals() {
    const c = this.chapter;
    const sections: Section[] = [];
    if (c.goals) {
      sections.push({ heading: "내용 목표", blocks: markdownBlocks(c.goals.content) });
      sections.push({ heading: "사고 목표", blocks: markdownBlocks(c.goals.thinking) });
    }
    if (c.successCriteria?.length) sections.push({ heading: "성공 기준", blocks: c.successCriteria.map((t) => itemBlock(t)) });
    this.textSlides("목표와 성공 기준", sections);
  }

  materials() {
    const items = this.chapter.materials ?? [];
    if (!items.length) return;
    const perSlide = 8;
    const pages = Math.ceil(items.length / perSlide);
    const colW = (FULL_W - 0.3) / 2;
    const cardH = 1.22;
    for (let p = 0; p < pages; p++) {
      const s = this.framed(pages > 1 ? `준비물 (${p + 1}/${pages})` : "준비물");
      items.slice(p * perSlide, (p + 1) * perSlide).forEach((m, i) => {
        const x = X0 + (i % 2) * (colW + 0.3);
        const y = BODY_Y + Math.floor(i / 2) * (cardH + 0.18);
        s.addShape(this.pres.ShapeType.roundRect, { x, y, w: colW, h: cardH, rectRadius: 0.12, fill: { color: CARD }, line: { color: CARD_LINE, width: 1 } });
        const png = m.image ? this.images.get(m.image) : undefined;
        let tx = x + 0.3;
        if (png) {
          const img = contain(png, { x: x + 0.15, y: y + 0.11, w: 1.0, h: cardH - 0.22 });
          s.addImage({ data: png.data, ...img });
          tx = x + 1.3;
        }
        const runs: PptxGenJS.TextProps[] = [{ text: m.name, options: { fontSize: 20, bold: true, color: INK, breakLine: !!m.note } }];
        if (m.note) runs.push({ text: m.note, options: { fontSize: 15, color: SUB, paraSpaceBefore: 2 } });
        s.addText(runs, { x: tx, y: y + 0.08, w: x + colW - tx - 0.2, h: cardH - 0.16, fontFace: this.font, valign: "middle", margin: 0, fit: "shrink" });
      });
    }
  }

  wiring() {
    const w = this.chapter.wiring;
    if (!w) return;
    const png = this.images.get(w.image);
    if (!png) {
      if (w.caption) this.textSlides("배선", [{ blocks: [plainBlock(w.caption)] }]);
      return;
    }
    const s = this.framed("배선");
    this.addFigure(s, w, { x: X0, y: BODY_Y - 0.05, w: FULL_W, h: BODY_H + 0.05 }, 18);
  }

  principle() {
    const p = this.chapter.principle;
    if (!p) return;
    this.textSlides("원리", [{ blocks: markdownBlocks(p.body) }], { figure: { image: p.image } });
  }

  // ── 단계 ──────────────────────────────────────────────

  step(step: Step) {
    const typeLabel = STEP_TYPE_LABEL[step.type] ?? step.type;
    const badge: Badge = { text: step.minutes ? `${typeLabel} · ${step.minutes}분` : typeLabel, color: TYPE_COLOR[step.type] ?? "334155" };
    const notes = `단계 ${step.id} · ${typeLabel}${step.minutes ? ` · ${step.minutes}분` : ""}${step.optional ? " · 선택 단계" : ""}`;
    const files = this.loaded.files;

    // 1) 제목 · 장면 그림 · 상황 글 · 지금 할 일
    const intro: Section[] = [{ blocks: markdownBlocks(step.body) }];
    if (step.todo?.length) intro.push({ heading: "지금 할 일", blocks: step.todo.map((t, i) => itemBlock(t, "number", i + 1)) });
    this.textSlides(step.title, intro, { badge, figure: step.scene, notes });

    // 2) 유형별 장
    switch (step.type) {
      case "problem":
        this.textSlides("생각해 볼 질문", [{ blocks: step.questions.map((q, i) => itemBlock(q, "number", i + 1)) }], { badge, notes, pt: 24 });
        break;
      case "analysis":
        this.analysisBoard(badge, notes);
        break;
      case "predict":
        this.codeSlides("예측하기", step.code, files[step.code] ?? "", {
          badge, notes,
          panel: [{ heading: "실행하기 전에 예측해요", blocks: step.blanks.map((b, i) => itemBlock(`${b.q}${b.unit ? ` (단위: ${b.unit})` : ""}`, "number", i + 1)) }],
        });
        break;
      case "run": {
        const panel: Section[] = [];
        if (step.expected) panel.push({ heading: "실행 결과", blocks: markdownBlocks(step.expected) });
        if (step.codeNotes?.length) {
          panel.push({
            heading: "코드 설명",
            blocks: step.codeNotes.map((n) => ({ kind: "bullet" as const, runs: [{ text: `${n.line}번 줄  `, bold: true }, ...itemBlock(n.note).runs] })),
          });
        }
        this.codeSlides("코드", step.code, files[step.code] ?? "", { badge, notes });
        if (panel.length) this.textSlides("실행 결과 · 코드 설명", panel, { badge, notes });
        break;
      }
      case "readcheck": {
        this.codeSlides("읽을 코드", step.code, files[step.code] ?? "", { badge, notes });
        const blocks: Block[] = [];
        step.questions.forEach((q, i) => {
          const suffix = q.kind === "line" ? " (줄 번호로 답하기)" : "";
          blocks.push(itemBlock(`${q.q}${suffix}`, "number", i + 1));
          if (q.kind === "choice") {
            q.options.forEach((o, k) => blocks.push({ kind: "p", runs: [{ text: `      ${CIRCLED[k] ?? `${k + 1})`} ` }, { text: o, code: /[()=_.]/.test(o) }] }));
          }
        });
        this.textSlides("읽기 체크 문항", [{ blocks }], { badge, notes });
        break;
      }
      case "mission": {
        const sections: Section[] = [{ heading: "미션", blocks: markdownBlocks(step.instructions) }];
        if (step.hint) sections.push({ heading: "힌트", blocks: markdownBlocks(step.hint) });
        if (step.code) sections.push({ blocks: [{ kind: "p", runs: [{ text: "시작 코드: " }, { text: step.code, code: true }], gap: true }] });
        this.textSlides(step.title, sections, { badge, notes });
        break;
      }
      case "debug":
        step.symptoms.forEach((sym, i) => {
          this.codeSlides(`증상 ${i + 1} · ${sym.title}`, "고장 난 코드", sym.code, {
            badge, notes,
            panel: [{ heading: "되묻기", blocks: markdownBlocks(sym.question) }],
          });
        });
        break;
      case "design":
        this.designBoard(step, badge, notes);
        break;
      case "reflect":
        this.reflectBoard(step, badge, notes);
        break;
      case "app":
        this.appBoard(step, badge, notes);
        break;
      default:
        break;
    }
  }

  private analysisBoard(badge: Badge, notes: string) {
    const s = this.framed("세 칸 보드", badge);
    s.addNotes(notes);
    const boxes: [string, string, string][] = [
      ["알아야 할 것", "보드가 시작 전에 알고 있어야 할 사실", "0D9488"],
      ["정해야 할 것", "사람이 골라 줘야 하는 선택이나 숫자", "D97706"],
      ["해야 할 것", "보드가 실제로 바꾸는 일", "2563EB"],
    ];
    const gap = 0.3;
    const w = (FULL_W - 2 * gap) / 3;
    boxes.forEach(([h, sub, color], i) => this.card(s, { x: X0 + i * (w + gap), y: BODY_Y + 0.1, w, h: BODY_H - 0.2 }, h, sub, color));
  }

  private designBoard(step: Extract<Step, { type: "design" }>, badge: Badge, notes: string) {
    const s = this.framed("우리말 설계도 · 번역표", badge);
    s.addNotes(notes);
    const leftW = 6.0;
    const rightX = X0 + leftW + 0.4;
    const rightW = FULL_W - leftW - 0.4;
    const pt = step.pseudocode.length > 8 ? 17 : 20;
    s.addText("우리말 설계도", { x: X0, y: BODY_Y, w: leftW, h: 0.4, fontFace: this.font, fontSize: 17, bold: true, color: ACCENT, margin: 0 });
    const blocks = step.pseudocode.map((p, i) => itemBlock(p.text.replace(/__/g, "＿＿＿＿"), "number", i + 1));
    this.addRich(s, [{ blocks }], { x: X0, y: BODY_Y + 0.5, w: leftW, h: BODY_H - 0.5 }, pt);
    s.addText("번역표", { x: rightX, y: BODY_Y, w: rightW, h: 0.4, fontFace: this.font, fontSize: 17, bold: true, color: ACCENT, margin: 0 });
    const head = (text: string): PptxGenJS.TableCell => ({ text, options: { bold: true, color: "FFFFFF", fill: { color: BAR }, fontFace: this.font } });
    const rows: PptxGenJS.TableRow[] = [
      [head("우리말"), head("코드")],
      ...step.translation.map(([ko, code]): PptxGenJS.TableRow => [
        { text: ko, options: { fontFace: this.font, color: INK } },
        { text: code, options: { fontFace: this.codeFont, color: INLINE_CODE } },
      ]),
    ];
    const rowH = Math.min(0.62, (BODY_H - 0.6) / rows.length);
    s.addTable(rows, {
      x: rightX, y: BODY_Y + 0.5, w: rightW, colW: [rightW * 0.38, rightW * 0.62], rowH,
      fontSize: rows.length > 8 ? 14 : 17, valign: "middle", margin: [2, 6, 2, 6],
      border: { type: "solid", pt: 1, color: CARD_LINE }, fill: { color: "FFFFFF" },
    });
  }

  /** 앱 만들기: 화면 설계 세 칸(빈 칸) → 약속표 → 프롬프트 템플릿 → 검사 항목 → 읽기 체크 문항(답 없이) */
  private appBoard(step: Extract<Step, { type: "app" }>, badge: Badge, notes: string) {
    const s = this.framed("화면 설계", badge);
    s.addNotes(notes);
    const colors = ["0D9488", "D97706", "2563EB"];
    const gap = 0.3;
    const w = (FULL_W - 2 * gap) / 3;
    APP_DESIGN_BOXES.forEach((b, i) => this.card(s, { x: X0 + i * (w + gap), y: BODY_Y + 0.1, w, h: BODY_H - 0.2 }, b.label, b.help, colors[i]));

    const t = this.framed("약속표", badge);
    t.addNotes(notes);
    const head = (text: string): PptxGenJS.TableCell => ({ text, options: { bold: true, color: "FFFFFF", fill: { color: BAR }, fontFace: this.font } });
    const rows: PptxGenJS.TableRow[] = [
      [head("주소"), head("종류"), head("값"), head("설명")],
      ...step.api.map((a): PptxGenJS.TableRow => [
        { text: a.path, options: { fontFace: this.codeFont, color: INLINE_CODE } },
        { text: a.method, options: { fontFace: this.font, color: INK } },
        { text: a.fields?.join(", ") ?? "", options: { fontFace: this.codeFont, color: INK } },
        { text: a.note ?? "", options: { fontFace: this.font, color: INK } },
      ]),
    ];
    t.addTable(rows, {
      x: X0, y: BODY_Y + 0.1, w: FULL_W, colW: [FULL_W * 0.28, FULL_W * 0.12, FULL_W * 0.22, FULL_W * 0.38],
      rowH: Math.min(0.62, (BODY_H - 0.2) / rows.length), fontSize: rows.length > 8 ? 14 : 18, valign: "middle", margin: [2, 6, 2, 6],
      border: { type: "solid", pt: 1, color: CARD_LINE }, fill: { color: "FFFFFF" },
    });

    const names: Record<string, string> = {
      ip: "보드 주소(상대 주소)", data: "읽기 주소", commands: "명령 주소", show: "보여 줄 값", buttons: "누를 버튼", changes: "바뀌는 모습",
    };
    const template = step.promptTemplate.replace(/\{\{\s*([^}]*?)\s*\}\}/g, (all, k: string) => (names[k] ? `＿＿(${names[k]})` : all));
    this.textSlides("프롬프트 템플릿", [{ blocks: template.replace(/\n+$/, "").split("\n").filter((l) => l.trim()).map((l) => plainBlock(l)) }], {
      badge, notes, pt: 20, footer: "빈칸은 화면 설계와 약속표로 채워요",
    });

    const opts = appCheckOptions(step);
    this.textSlides("붙여넣기 검사", [{ heading: "AI 가 만든 HTML 이 지켜야 할 것", blocks: appCheckLabels(opts).map((l) => itemBlock(l)) }], { badge, notes, pt: 20, maxLines: 10 });

    const blocks: Block[] = [];
    step.readcheck.forEach((q, i) => {
      blocks.push(itemBlock(q.q, "number", i + 1));
      if (q.kind === "choice") q.options.forEach((o, k) => blocks.push({ kind: "p", runs: [{ text: `      ${CIRCLED[k] ?? `${k + 1})`} ` }, { text: o, code: /[()=_.<]/.test(o) }] }));
    });
    this.textSlides("읽기 체크 문항", [{ blocks }], { badge, notes });
  }

  private reflectBoard(step: Extract<Step, { type: "reflect" }>, badge: Badge, notes: string) {
    const s = this.framed("성찰 네 칸", badge);
    s.addNotes(notes);
    s.addText(
      [
        { text: "먼저 ", options: {} },
        { text: step.lineExplain, options: { fontFace: this.codeFont, color: INLINE_CODE } },
        { text: " 의 줄마다 \"이 줄은 ___\" 을 내 말로 쓰고, 네 칸을 채워요", options: {} },
      ],
      { x: X0, y: BODY_Y, w: FULL_W, h: 0.5, fontFace: this.font, fontSize: 18, color: SUB, margin: 0, valign: "middle", fit: "shrink" },
    );
    const gap = 0.3;
    const w = (FULL_W - gap) / 2;
    const top = BODY_Y + 0.65;
    const h = (BODY_BOTTOM - top - gap) / 2;
    const colors = ["DC2626", "D97706", "2563EB", "16A34A"];
    step.prompts.forEach((p, i) => this.card(s, { x: X0 + (i % 2) * (w + gap), y: top + Math.floor(i / 2) * (h + gap), w, h }, `${i + 1}. ${p}`, undefined, colors[i % 4]));
  }

  // ── 교사용 ────────────────────────────────────────────
  // 교사용 장은 띄워 보여 주는 장이 아니라 선생님이 읽는 장이라 글을 작게(18pt), 줄 수 한도를 넉넉히(12줄) 둔다.

  teacher() {
    const c = this.chapter;
    const sections: Section[] = [];
    if (typeof c.teacherNotes === "string" && c.teacherNotes.trim()) sections.push({ heading: "교사 메모", blocks: markdownBlocks(c.teacherNotes) });
    const flow: Block[] = [];
    let n = 0;
    for (const part of c.parts) {
      if (c.parts.length > 1) flow.push({ kind: "p", runs: [{ text: part.title, bold: true }], gap: flow.length > 0 });
      for (const s of part.steps) {
        n++;
        const meta = [STEP_TYPE_LABEL[s.type] ?? s.type, s.minutes ? `${s.minutes}분` : "", s.optional ? "선택" : ""].filter(Boolean).join(" · ");
        flow.push({ kind: "number", n, runs: [{ text: s.title }, { text: `  (${meta})` }] });
      }
    }
    sections.push({ heading: "수업 흐름", blocks: flow });
    this.textSlides("교사용", sections, { pt: 18, maxLines: 13, footer: "정답·힌트는 사이트 교사 모드에서 확인하세요" });
  }
}

/** 챕터에 쓰인 그림을 모두 PNG 로 (순서대로, 실패한 그림은 빠짐) */
async function rasterizeAll(loaded: LoadedSlideChapter, rasterize: Rasterize | undefined): Promise<Map<string, Png>> {
  const out = new Map<string, Png>();
  if (!rasterize) return out;
  for (const ref of chapterImageRefs(loaded.chapter)) {
    const svg = loaded.images[ref];
    if (!svg) {
      console.warn(`[slides] 경고: ${loaded.chapter.id}: 그림 파일이 없습니다 (${ref})`);
      continue;
    }
    const png = await rasterize(svg, ref);
    if (png) out.set(ref, png);
  }
  return out;
}

/** 챕터 하나로 발표 자료를 만든다. slideCount 는 만든 장 수 */
export async function buildDeck(loaded: LoadedSlideChapter, opts: DeckOptions = {}): Promise<{ pres: PptxGenJS; slideCount: number }> {
  const images = await rasterizeAll(loaded, opts.rasterize);
  const d = new DeckBuilder(loaded, images, opts.font ?? defaultFont(), opts.codeFont ?? defaultCodeFont());
  d.cover();
  d.goals();
  d.materials();
  d.wiring();
  d.principle();
  for (const part of loaded.chapter.parts) {
    d.setPart(loaded.chapter.parts.length > 1 ? part.title : undefined);
    for (const step of part.steps) d.step(step);
  }
  d.setPart(undefined);
  d.teacher();
  return { pres: d.pres, slideCount: d.count };
}

/**
 * pptxgenjs 가 만든 슬라이드 XML 다듬기.
 * - 한 문단(<a:p>)에 토막이 여럿이면 pptxgenjs 는 토막마다 <a:pPr> 를 다시 써서(글머리 없음) 문단 모양이 깨진다
 *   → 문단 맨 앞의 pPr 하나만 남긴다.
 * - 동아시아 글꼴 charset 을 중국어(-122 = GB2312)로 적어 일부 프로그램이 한글을 못 그린다 → 한글(-127 = HANGUL).
 * - 글 언어를 ko-KR 로 (맞춤법 검사·글꼴 고르기).
 */
export function fixSlideXml(xml: string): string {
  const PPR = /<a:pPr\b[^>]*\/>|<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/g;
  return xml
    .replace(/<a:p>([\s\S]*?)<\/a:p>/g, (_m, body: string) => {
      let first = true;
      const fixed = body.replace(PPR, (ppr, offset: number) => {
        const keep = first && offset === 0;
        first = false;
        return keep ? ppr : "";
      });
      return `<a:p>${fixed}</a:p>`;
    })
    .replace(/(<a:ea typeface="[^"]*"(?: pitchFamily="\d+")?) charset="-122"/g, '$1 charset="-127"')
    .replace(/<a:(rPr|endParaRPr|defRPr) lang="en-US"(?! altLang)/g, '<a:$1 lang="ko-KR" altLang="en-US"');
}

/** pptx 파일 내용 (슬라이드 XML 을 fixSlideXml 로 다듬은 것) */
export async function deckBuffer(pres: PptxGenJS): Promise<Buffer> {
  const raw = (await pres.write({ outputType: "nodebuffer", compression: true })) as Uint8Array;
  const zip = await JSZip.loadAsync(raw);
  for (const name of Object.keys(zip.files)) {
    if (!/^ppt\/(slides|notesSlides|slideLayouts|slideMasters)\/[^/]+\.xml$/.test(name)) continue;
    zip.file(name, fixSlideXml(await zip.file(name)!.async("string")));
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
