import type { Chapter, Figure } from "./schema";

/*
 * 수업 보드 고르기 (순수 — React·DOM 없음). 보드는 두 가지:
 *   plus   — Keyestudio "ESP32 Plus" 확장 보드 (기본값, 콘텐츠의 기본 그림·설명)
 *   devkit — 확장 보드 없는 "ESP32 DevKit V1 30핀" 기본 보드
 * 기본 보드용 그림은 같은 이름에 .devkit.svg (images/wiring-door.svg → images/wiring-door.devkit.svg). 없으면 기본 그림을 쓴다.
 * 그림 설명은 captionDevkit 이 있으면 그것, 준비물은 board 가 그 보드이거나 없는 것만.
 * 화면(src/app/board/boardChoice.ts)과 슬라이드 내보내기(scripts/export-slides.ts --board)가 함께 쓴다.
 */

export const BOARD_IDS = ["plus", "devkit"] as const;
export type BoardId = (typeof BOARD_IDS)[number];
export const DEFAULT_BOARD: BoardId = "plus";

/** 보드 이름 (고르는 칸·안내에 그대로 쓴다) */
export const BOARD_LABELS: Record<BoardId, string> = {
  plus: "ESP32 Plus 확장 보드",
  devkit: "기본 보드 (DevKit 30핀)",
};

export function isBoardId(value: unknown): value is BoardId {
  return typeof value === "string" && (BOARD_IDS as readonly string[]).includes(value);
}

const DEVKIT_SUFFIX = ".devkit.svg";

/** "images/x.svg" → "images/x.devkit.svg" (이미 .devkit.svg 면 그대로) */
export function devkitImageRef(ref: string): string {
  return ref.endsWith(DEVKIT_SUFFIX) ? ref : ref.replace(/\.svg$/, DEVKIT_SUFFIX);
}

/** 기본 보드 그림인지 (이름이 .devkit.svg 로 끝난다) */
export function isDevkitImageRef(ref: string): boolean {
  return ref.endsWith(DEVKIT_SUFFIX);
}

/** 그 보드에서 그릴 그림 이름. devkit 이고 기본 보드 그림이 있으면(exists) 그것, 아니면 원래 그림 */
export function boardImageRef(ref: string, board: BoardId, exists: (ref: string) => boolean): string;
export function boardImageRef(ref: string | undefined, board: BoardId, exists: (ref: string) => boolean): string | undefined;
export function boardImageRef(ref: string | undefined, board: BoardId, exists: (ref: string) => boolean): string | undefined {
  if (!ref || board !== "devkit" || !/\.svg$/.test(ref)) return ref;
  const variant = devkitImageRef(ref);
  return variant !== ref && exists(variant) ? variant : ref;
}

/** 그림 설명: devkit 이면 captionDevkit(있으면), 아니면 caption */
export function figureCaption(figure: Pick<Figure, "caption" | "captionDevkit"> | undefined, board: BoardId): string | undefined {
  if (!figure) return undefined;
  return board === "devkit" ? (figure.captionDevkit ?? figure.caption) : figure.caption;
}

/** 그 보드의 준비물: board 가 없거나(두 보드 모두) 그 보드인 것만 */
export function materialsForBoard<M extends { board?: BoardId }>(materials: readonly M[] | undefined, board: BoardId): M[] {
  return (materials ?? []).filter((m) => !m.board || m.board === board);
}

/**
 * 보드 고르는 칸을 보일 챕터인가: 배선도가 있거나, 기본 보드 그림(.devkit.svg)·captionDevkit·보드별 준비물이 하나라도 있다.
 * imageRefs 는 챕터 폴더의 그림 이름들 ("images/x.svg").
 */
export function chapterHasBoardChoice(chapter: Pick<Chapter, "wiring" | "materials" | "parts">, imageRefs: readonly string[]): boolean {
  if (chapter.wiring) return true;
  if (imageRefs.some(isDevkitImageRef)) return true;
  if (chapter.materials?.some((m) => m.board)) return true;
  return chapter.parts.some((p) => p.steps.some((s) => s.scene?.captionDevkit));
}

function figureFor<F extends Figure>(figure: F, board: BoardId, exists: (ref: string) => boolean): F {
  const { captionDevkit: _devkit, ...rest } = figure;
  const caption = figureCaption(figure, board);
  return { ...rest, image: boardImageRef(figure.image, board, exists), ...(caption !== undefined ? { caption } : {}) } as F;
}

/**
 * 챕터를 그 보드에 맞춰 바꾼 사본 (슬라이드 내보내기용): 그림 이름은 기본 보드 그림으로(있으면), 설명은 captionDevkit,
 * 준비물은 보드에 맞는 것만. captionDevkit·board 키는 결과에서 빠진다. plus 면 그림은 그대로이고 devkit 전용 준비물만 빠진다.
 */
export function chapterForBoard<C extends Chapter>(chapter: C, board: BoardId, exists: (ref: string) => boolean): C {
  const img = (ref: string | undefined) => boardImageRef(ref, board, exists);
  const materials = chapter.materials
    ? materialsForBoard(chapter.materials, board).map(({ board: _b, ...m }) => (m.image ? { ...m, image: img(m.image) } : m))
    : undefined;
  return {
    ...chapter,
    ...(chapter.cover ? { cover: img(chapter.cover) } : {}),
    ...(materials ? { materials: materials.length ? materials : undefined } : {}),
    ...(chapter.wiring ? { wiring: figureFor(chapter.wiring, board, exists) } : {}),
    ...(chapter.principle ? { principle: { ...chapter.principle, ...(chapter.principle.image ? { image: img(chapter.principle.image) } : {}) } } : {}),
    parts: chapter.parts.map((p) => ({
      ...p,
      steps: p.steps.map((s) => (s.scene ? { ...s, scene: figureFor(s.scene, board, exists) } : s)),
    })),
  };
}
