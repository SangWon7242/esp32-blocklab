import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Png, Rasterize } from "./deck.ts";

/*
 * SVG → PNG: Playwright chromium 으로 흰 바탕에 폭 1600px 로 그린다. 결과는 slides/.cache/ 에 SVG 내용의 해시로 저장해
 * 다음 실행에서는 브라우저 없이 바로 쓴다. 브라우저를 못 띄우면 경고 한 번만 내고 그림 없이 진행한다.
 */

/** 그림 폭 (px) */
export const RASTER_WIDTH = 1600;
/** 그리는 방식이 바뀌면 올린다 (캐시 무효화) */
const RENDER_VERSION = "1";

/** 화면(src/index.css :root, 밝은 모드)과 같은 색 변수. 선은 currentColor = 글자색 */
const PAGE_CSS = `
:root {
  --background: #ffffff; --foreground: #0a0a0a; --card: #ffffff; --card-foreground: #0a0a0a;
  --primary: #171717; --primary-foreground: #fafafa; --secondary: #f5f5f5; --muted: #f5f5f5;
  --muted-foreground: #737373; --accent: #f5f5f5; --border: #e5e5e5; --destructive: #e7000b;
}
html, body { margin: 0; padding: 0; background: #ffffff; }
body { color: #0a0a0a; font-family: "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; }
#box { width: ${RASTER_WIDTH}px; background: #ffffff; }
#box > svg { display: block; width: ${RASTER_WIDTH}px; height: auto; }
`;

/** PNG 머리(IHDR)에서 폭·높이 */
export function pngSize(buf: Uint8Array): { width: number; height: number } {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function toPng(buf: Uint8Array): Png {
  return { data: `image/png;base64,${Buffer.from(buf).toString("base64")}`, ...pngSize(buf) };
}

/** 인라인에 넣기 전 XML 선언·DOCTYPE 을 뺀다 */
function cleanSvg(svg: string): string {
  return svg.replace(/<\?xml[\s\S]*?\?>/gi, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "").trim();
}

type Browser = { newPage(opts: object): Promise<Page>; close(): Promise<void> };
type Page = {
  setContent(html: string, opts?: object): Promise<void>;
  locator(sel: string): { screenshot(opts?: object): Promise<Buffer> };
  close(): Promise<void>;
};

/** Playwright 로 그리는 래스터라이저. close() 로 브라우저를 닫는다 */
export function createPlaywrightRasterizer(cacheDir: string): { rasterize: Rasterize; close(): Promise<void> } {
  let browser: Promise<Browser | undefined> | undefined;
  let warned = false;

  const launch = async (): Promise<Browser | undefined> => {
    try {
      const { chromium } = await import("@playwright/test");
      return (await chromium.launch()) as unknown as Browser;
    } catch (e) {
      if (!warned) {
        warned = true;
        const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
        console.warn(`[slides] 경고: Playwright chromium 을 띄우지 못해 그림 없이 만듭니다 (npx playwright install chromium). ${msg}`);
      }
      return undefined;
    }
  };

  const rasterize: Rasterize = async (svg) => {
    const hash = createHash("sha1").update(RENDER_VERSION).update(svg).digest("hex").slice(0, 16);
    const file = path.join(cacheDir, `${hash}.png`);
    if (existsSync(file)) return toPng(readFileSync(file));
    browser ??= launch();
    const b = await browser;
    if (!b) return undefined;
    let page: Page | undefined;
    try {
      page = await b.newPage({ viewport: { width: RASTER_WIDTH, height: 900 }, deviceScaleFactor: 1 });
      await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${PAGE_CSS}</style></head><body><div id="box">${cleanSvg(svg)}</div></body></html>`);
      const buf = await page.locator("#box").screenshot({ type: "png", omitBackground: false });
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(file, buf);
      return toPng(buf);
    } catch (e) {
      console.warn(`[slides] 경고: 그림을 그리지 못했습니다 (${e instanceof Error ? e.message.split("\n")[0] : e})`);
      return undefined;
    } finally {
      await page?.close().catch(() => {});
    }
  };

  return {
    rasterize,
    async close() {
      const b = await browser;
      await b?.close().catch(() => {});
    },
  };
}
