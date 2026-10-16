import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/*
 * Blockly 를 싣는 빌드(체험판 vite.config.ts·라이브러리 vite.lib.config.ts)가 함께 쓰는 Vite 플러그인 둘.
 */

/** Blockly 가 작업판 그림(sprites.svg·아이콘)·효과음(mp3)·커서를 읽는 폴더 */
export const BLOCKLY_MEDIA_SRC = path.resolve(import.meta.dirname, "../node_modules/blockly/media");

/**
 * Blockly UMD 감싸개의 AMD 갈래를 끈다 (lib-v1.0.1).
 *   `typeof define === 'function' && define.amd ? define([...], factory) : …`
 * 브라우저에는 AMD define 이 없어 이 갈래는 돌지 않는다. 그런데 허브의 Turbopack 은 번들 속 define([...]) 의
 * 의존 이름(./blockly_compressed.js, blockly/core …)을 정적으로 풀다 Module not found 로 멈춘다.
 * 그래서 blockly·@blockly 모듈을 변환할 때 그 조건을 false 로 바꿔 죽은 갈래로 만든다(번들러가 지운다).
 * 다른 갈래(CommonJS·전역)는 그대로 둔다.
 */
const AMD_SNIFF = /typeof\s+define\s*===?\s*(["'])function\1\s*&&\s*define\.amd|(["'])function\2\s*===?\s*typeof\s+define\s*&&\s*define\.amd/g;

export function stripAmdSniff(code: string): { code: string; count: number } {
  let count = 0;
  const out = code.replace(AMD_SNIFF, () => {
    count++;
    return "false";
  });
  return { code: out, count };
}

export function blocklyNoAmd(): Plugin {
  return {
    name: "blocklab:blockly-no-amd",
    enforce: "pre",
    transform(code, id) {
      if (!/[\\/]node_modules[\\/](blockly|@blockly[\\/][^\\/]+)[\\/].*\.(c|m)?js$/.test(id.split("?")[0])) return null;
      const { code: out, count } = stripAmdSniff(code);
      if (count === 0) return null;
      return { code: out, map: null };
    },
  };
}

/**
 * Blockly media 를 자기 주소에서 낸다 (lib-v1.0.1). 기본값(https://static.blockly.com/media/)은 허브 CSP 에 막힌다.
 *   - 빌드: node_modules/blockly/media 의 파일 전부를 `<outDir>/<dir>/` 로 낸다 (체험판 dir="blocklab/media", 라이브러리 dir="media")
 *   - 개발 서버: `<base><dir>/<파일>` 요청에 같은 파일을 준다
 * 런타임 경로는 src/host/blocklyMedia.ts 가 정한다.
 */
export function blocklyMedia({ dir }: { dir: string }): Plugin {
  const files = readdirSync(BLOCKLY_MEDIA_SRC).filter((f) => !f.startsWith("."));
  const types: Record<string, string> = {
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".gif": "image/gif",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".cur": "image/x-icon",
  };
  let base = "/";
  return {
    name: "blocklab:blockly-media",
    configResolved(config) {
      base = config.base;
    },
    configureServer(server) {
      const prefix = `${base}${dir}/`;
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        if (!url.startsWith(prefix)) return next();
        const name = decodeURIComponent(url.slice(prefix.length));
        if (!files.includes(name)) return next();
        res.setHeader("Content-Type", types[path.extname(name)] ?? "application/octet-stream");
        res.end(readFileSync(path.join(BLOCKLY_MEDIA_SRC, name)));
      });
    },
    generateBundle() {
      for (const name of files) {
        this.emitFile({ type: "asset", fileName: `${dir}/${name}`, source: readFileSync(path.join(BLOCKLY_MEDIA_SRC, name)) });
      }
    },
  };
}
