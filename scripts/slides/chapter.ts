import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { chapterForBoard, type BoardId } from "../../src/track/board.ts";
import type { Chapter } from "../../src/track/schema.ts";

/*
 * 챕터 폴더(content/chapters/<id>/)를 읽는다. 형식 검사는 npm test(src/track)가 맡으므로 여기서는 YAML 만 읽고
 * 슬라이드에 필요한 최소한만 확인한다. 트랙 화면이 나중에 더하는 키(teacherNotes·code·label·track 등)도 느슨하게 받는다.
 */

/** 슬라이드가 읽는 챕터: 스키마의 챕터 + 아직 스키마에 없을 수 있는 선택 키 */
export type SlideChapter = Chapter & {
  /** 교사용 메모 (markdown). 마지막 "교사용" 장에 넣는다 */
  teacherNotes?: string;
  /** 표시 번호 (예: S8). 이름이 code 일 수도 label 일 수도 있어 둘 다 본다 */
  code?: string;
  label?: string;
  track?: string;
};

/** 읽은 챕터 + 같은 폴더의 코드 파일(이름 → 글) + 그림 원문("images/x.svg" → SVG 글) */
export type LoadedSlideChapter = {
  chapter: SlideChapter;
  files: Record<string, string>;
  images: Record<string, string>;
};

/** content/chapters 폴더 (저장소 뿌리 기준) */
export function chaptersDir(root: string): string {
  return path.join(root, "content", "chapters");
}

/** 챕터 id 목록 (chapter.yaml 이 있는 폴더, 이름순) */
export function listChapterIds(root: string): string[] {
  const dir = chaptersDir(root);
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(dir, d.name, "chapter.yaml")))
    .map((d) => d.name)
    .sort();
}

/** 챕터 하나를 읽는다. 없거나 모양이 틀리면 throw */
export function loadChapter(root: string, id: string): LoadedSlideChapter {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`챕터 id 가 올바르지 않습니다: ${id}`);
  const dir = path.join(chaptersDir(root), id);
  const yamlPath = path.join(dir, "chapter.yaml");
  if (!existsSync(yamlPath)) throw new Error(`챕터를 찾을 수 없습니다: ${path.relative(root, yamlPath)}`);
  const data: unknown = parse(readFileSync(yamlPath, "utf8"));
  const chapter = data as SlideChapter;
  if (!chapter || typeof chapter !== "object" || typeof chapter.title !== "string" || !Array.isArray(chapter.parts)) {
    throw new Error(`${path.relative(root, yamlPath)}: title·parts 가 없습니다`);
  }
  const files: Record<string, string> = {};
  for (const name of readdirSync(dir)) if (name.endsWith(".py")) files[name] = readFileSync(path.join(dir, name), "utf8");
  const images: Record<string, string> = {};
  const imgDir = path.join(dir, "images");
  if (existsSync(imgDir)) {
    for (const name of readdirSync(imgDir)) if (name.endsWith(".svg")) images[`images/${name}`] = readFileSync(path.join(imgDir, name), "utf8");
  }
  return { chapter, files, images };
}

/**
 * 그 보드에 맞춘 챕터 (--board devkit): 그림은 같은 이름의 .devkit.svg 가 있으면 그것으로, 설명은 captionDevkit,
 * 준비물은 board 가 그 보드이거나 없는 것만. plus(기본)는 그림·설명 그대로, devkit 전용 준비물만 빠진다.
 */
export function chapterForSlideBoard(loaded: LoadedSlideChapter, board: BoardId): LoadedSlideChapter {
  return { ...loaded, chapter: chapterForBoard(loaded.chapter, board, (ref) => ref in loaded.images) };
}
