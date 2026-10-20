/*
 * 챕터 → 슬라이드(pptx) 내보내기.
 *   npm run slides -- 01-led              챕터 하나
 *   npm run slides -- 01-led 10-auto-door 여러 개
 *   npm run slides -- all                 모든 챕터
 * 옵션: --out <폴더>(기본 slides), --no-images(그림 빼기), --font <글꼴>, --code-font <글꼴>,
 *       --board <plus|devkit>(기본 plus. devkit 이면 기본 보드 그림 .devkit.svg·captionDevkit·기본 보드 준비물)
 * 결과: slides/<id>.pptx (--board devkit 이면 slides/<id>.devkit.pptx). 그림(SVG)은 Playwright chromium 으로 PNG 로 그려 slides/.cache/ 에 둔다.
 */
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_BOARD, isBoardId, type BoardId } from "../src/track/board.ts";
import { chapterForSlideBoard, listChapterIds, loadChapter } from "./slides/chapter.ts";
import { buildDeck, deckBuffer } from "./slides/deck.ts";
import { createPlaywrightRasterizer } from "./slides/raster.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage(): never {
  console.error("사용법: npm run slides -- <챕터 id ...|all> [--out 폴더] [--no-images] [--font 글꼴] [--code-font 글꼴] [--board plus|devkit]");
  console.error(`챕터: ${listChapterIds(ROOT).join(", ")}`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const ids: string[] = [];
  let outDir = path.join(ROOT, "slides");
  let images = true;
  let font: string | undefined;
  let codeFont: string | undefined;
  let board: BoardId = DEFAULT_BOARD;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--out") outDir = path.resolve(args[++i] ?? usage());
    else if (a === "--no-images") images = false;
    else if (a === "--font") font = args[++i] ?? usage();
    else if (a === "--code-font") codeFont = args[++i] ?? usage();
    else if (a === "--board") {
      const b = args[++i];
      if (!isBoardId(b)) usage();
      board = b;
    }
    else if (a === "-h" || a === "--help") usage();
    else if (a.startsWith("--")) usage();
    else ids.push(a);
  }
  if (!ids.length) usage();
  const all = listChapterIds(ROOT);
  const targets = ids.includes("all") ? all : ids;
  const unknown = targets.filter((id) => !all.includes(id));
  if (unknown.length) {
    console.error(`없는 챕터: ${unknown.join(", ")}`);
    usage();
  }

  mkdirSync(outDir, { recursive: true });
  const raster = images ? createPlaywrightRasterizer(path.join(ROOT, "slides", ".cache")) : undefined;
  let failed = 0;
  try {
    for (const id of targets) {
      try {
        const loaded = chapterForSlideBoard(loadChapter(ROOT, id), board);
        const { pres, slideCount } = await buildDeck(loaded, { rasterize: raster?.rasterize, font, codeFont });
        const file = path.join(outDir, board === DEFAULT_BOARD ? `${id}.pptx` : `${id}.${board}.pptx`);
        writeFileSync(file, await deckBuffer(pres));
        const kb = Math.round(statSync(file).size / 1024);
        console.log(`${path.relative(process.cwd(), file)}  ${slideCount}장  ${kb} KB`);
      } catch (e) {
        failed++;
        console.error(`[slides] ${id}: ${e instanceof Error ? e.message : e}`);
      }
    }
  } finally {
    await raster?.close();
  }
  if (failed) process.exit(1);
}

await main();
