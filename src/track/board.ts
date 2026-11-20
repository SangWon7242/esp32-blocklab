import type { Chapter, Figure } from "./schema";

/*
 * 수업 보드 고르기 (순수 — React·DOM 없음). 보드는 세 가지:
 *   plus      — Keyestudio "ESP32 Plus" 확장 보드 (기본값, 콘텐츠의 기본 그림·설명)
 *   devkit    — 확장 보드 없는 "ESP32 DevKit 38핀" 기본 보드
 *   expansion — 보라색 ESP32 38핀 확장 보드(Goouuu V4)에 DevKit 38핀을 꽂은 것. GPIO 마다 S/V/G 3핀, V 줄 전압은 JUMP 점퍼
 * 보드 그림은 같은 이름에 .<보드>.svg (images/wiring-door.svg → images/wiring-door.devkit.svg · images/wiring-door.expansion.svg).
 * 그 보드 그림이 없으면 물러난다: devkit → 기본 그림, expansion → .devkit.svg → 기본 그림
 *   (확장 보드 위의 DevKit 은 기본 보드와 같은 GPIO 번호라, 아직 확장 보드 그림이 없는 챕터는 기본 보드 그림이 가장 가깝다).
 * 그림 설명도 같은 차례: devkit 은 captionDevkit → caption, expansion 은 captionExpansion → captionDevkit → caption.
 * 준비물: board 가 없는 것 + 그 보드 것. expansion 은 board: expansion 준비물이 하나도 없는 챕터면 devkit 준비물을 쓴다.
 * 화면(src/app/board/boardChoice.ts)과 슬라이드 내보내기(scripts/export-slides.ts --board)가 함께 쓴다.
 */

export const BOARD_IDS = ["plus", "devkit", "expansion"] as const;
export type BoardId = (typeof BOARD_IDS)[number];
export const DEFAULT_BOARD: BoardId = "plus";

/** 보드 이름 (고르는 칸·안내에 그대로 쓴다) */
export const BOARD_LABELS: Record<BoardId, string> = {
  plus: "ESP32 Plus 확장 보드",
  devkit: "기본 보드 (DevKit 38핀)",
  expansion: "확장 보드 (DevKit 38핀)",
};

export function isBoardId(value: unknown): value is BoardId {
  return typeof value === "string" && (BOARD_IDS as readonly string[]).includes(value);
}

/** 그 보드에서 그림 이름이 물러나는 차례 (기본 그림은 맨 끝에 늘 있다) */
const IMAGE_CHAIN: Record<BoardId, readonly Exclude<BoardId, "plus">[]> = { plus: [], devkit: ["devkit"], expansion: ["expansion", "devkit"] };
const VARIANT = /\.(devkit|expansion)\.svg$/;

/** "images/x.svg" → "images/x.<board>.svg" (이미 보드 그림이면 그대로). plus 는 그대로 */
export function boardVariantRef(ref: string, board: BoardId): string {
  if (board === "plus" || VARIANT.test(ref)) return ref;
  return ref.replace(/\.svg$/, `.${board}.svg`);
}

/** "images/x.svg" → "images/x.devkit.svg" (이미 .devkit.svg 면 그대로) */
export function devkitImageRef(ref: string): string {
  return ref.endsWith(".devkit.svg") ? ref : ref.replace(/\.svg$/, ".devkit.svg");
}

/** 기본 보드 그림인지 (이름이 .devkit.svg 로 끝난다) */
export function isDevkitImageRef(ref: string): boolean {
  return ref.endsWith(".devkit.svg");
}

/** 보드 그림이면 그 보드 (.devkit.svg · .expansion.svg), 아니면 undefined */
export function imageBoard(ref: string | undefined): Exclude<BoardId, "plus"> | undefined {
  const m = ref ? VARIANT.exec(ref) : null;
  return m ? (m[1] as Exclude<BoardId, "plus">) : undefined;
}

/** 그 보드에서 그릴 그림 이름: 차례대로 있는(exists) 보드 그림, 없으면 원래 그림 */
export function boardImageRef(ref: string, board: BoardId, exists: (ref: string) => boolean): string;
export function boardImageRef(ref: string | undefined, board: BoardId, exists: (ref: string) => boolean): string | undefined;
export function boardImageRef(ref: string | undefined, board: BoardId, exists: (ref: string) => boolean): string | undefined {
  if (!ref || !/\.svg$/.test(ref) || VARIANT.test(ref)) return ref;
  for (const b of IMAGE_CHAIN[board]) {
    const variant = boardVariantRef(ref, b);
    if (exists(variant)) return variant;
  }
  return ref;
}

/** 그림 설명: devkit 은 captionDevkit → caption, expansion 은 captionExpansion → captionDevkit → caption */
export function figureCaption(figure: Pick<Figure, "caption" | "captionDevkit" | "captionExpansion"> | undefined, board: BoardId): string | undefined {
  if (!figure) return undefined;
  if (board === "expansion") return figure.captionExpansion ?? figure.captionDevkit ?? figure.caption;
  return board === "devkit" ? (figure.captionDevkit ?? figure.caption) : figure.caption;
}

/**
 * 그 보드의 준비물: board 가 없거나(모든 보드) 그 보드인 것만.
 * expansion 은 board: expansion 준비물이 하나도 없으면 devkit 준비물로 물러난다 (그림이 기본 보드 그림으로 물러나는 것과 같게).
 */
export function materialsForBoard<M extends { board?: BoardId }>(materials: readonly M[] | undefined, board: BoardId): M[] {
  const list = materials ?? [];
  const pick: BoardId = board === "expansion" && !list.some((m) => m.board === "expansion") ? "devkit" : board;
  return list.filter((m) => !m.board || m.board === pick);
}

/**
 * 보드 고르는 칸을 보일 챕터인가: 배선도가 있거나, 보드 그림(.devkit.svg · .expansion.svg)·captionDevkit·captionExpansion·보드별 준비물이 하나라도 있다.
 * imageRefs 는 챕터 폴더의 그림 이름들 ("images/x.svg").
 */
export function chapterHasBoardChoice(chapter: Pick<Chapter, "wiring" | "materials" | "parts">, imageRefs: readonly string[]): boolean {
  if (chapter.wiring) return true;
  if (imageRefs.some((r) => imageBoard(r))) return true;
  if (chapter.materials?.some((m) => m.board)) return true;
  return chapter.parts.some((p) => p.steps.some((s) => s.scene?.captionDevkit || s.scene?.captionExpansion));
}

/* ───────── 확장 보드 JUMP 점퍼 ───────── */

export type Jumper = "3V3" | "5V";

/** 확장 보드 그림에서 V 줄 점퍼 자리를 읽는다 (scripts/wiring/boards/expansion.mjs 가 기판에 data-expansion-jumper 로 남긴다) */
export function svgJumper(svg: string | undefined): Jumper | undefined {
  const m = svg ? /data-expansion-jumper="(3V3|5V)"/.exec(svg) : null;
  return m ? (m[1] as Jumper) : undefined;
}

/** 확장 보드 그림이 점퍼 5V 일 때 그림 곁에 보이는 한 줄 */
export const JUMPER_5V_NOTICE = "이번 수업은 점퍼를 5V 쪽으로 옮겨요 (끝나면 3.3V 로)";

/** 그 그림(보드판까지 정해진 이름)을 볼 때 띄울 점퍼 안내. 확장 보드 그림이고 점퍼 5V 일 때만 */
export function jumperNotice(shownRef: string | undefined, svgOf: (ref: string) => string | undefined): string | undefined {
  if (!shownRef || imageBoard(shownRef) !== "expansion") return undefined;
  return svgJumper(svgOf(shownRef)) === "5V" ? JUMPER_5V_NOTICE : undefined;
}

type ForBoardOptions = { svgOf?: (ref: string) => string | undefined };

function figureFor<F extends Figure>(figure: F, board: BoardId, exists: (ref: string) => boolean, opts: ForBoardOptions): F {
  const { captionDevkit: _devkit, captionExpansion: _expansion, ...rest } = figure;
  const image = boardImageRef(figure.image, board, exists);
  const notice = opts.svgOf ? jumperNotice(image, opts.svgOf) : undefined;
  const base = figureCaption(figure, board);
  const caption = notice ? (base ? `${base} (${notice})` : notice) : base;
  return { ...rest, image, ...(caption !== undefined ? { caption } : {}) } as F;
}

/**
 * 챕터를 그 보드에 맞춰 바꾼 사본 (슬라이드 내보내기용): 그림 이름은 그 보드 그림으로(있으면), 설명은 그 보드 설명,
 * 준비물은 보드에 맞는 것만. captionDevkit·captionExpansion·board 키는 결과에서 빠진다. plus 면 그림은 그대로이고 다른 보드 전용 준비물만 빠진다.
 * opts.svgOf 를 주면 확장 보드 그림이 점퍼 5V 일 때 설명 끝에 점퍼 안내를 붙인다.
 */
export function chapterForBoard<C extends Chapter>(chapter: C, board: BoardId, exists: (ref: string) => boolean, opts: ForBoardOptions = {}): C {
  const img = (ref: string | undefined) => boardImageRef(ref, board, exists);
  const materials = chapter.materials
    ? materialsForBoard(chapter.materials, board).map(({ board: _b, ...m }) => (m.image ? { ...m, image: img(m.image) } : m))
    : undefined;
  return {
    ...chapter,
    ...(chapter.cover ? { cover: img(chapter.cover) } : {}),
    ...(materials ? { materials: materials.length ? materials : undefined } : {}),
    ...(chapter.wiring ? { wiring: figureFor(chapter.wiring, board, exists, opts) } : {}),
    ...(chapter.principle ? { principle: { ...chapter.principle, ...(chapter.principle.image ? { image: img(chapter.principle.image) } : {}) } } : {}),
    parts: chapter.parts.map((p) => ({
      ...p,
      steps: p.steps.map((s) => (s.scene ? { ...s, scene: figureFor(s.scene, board, exists, opts) } : s)),
    })),
  };
}
