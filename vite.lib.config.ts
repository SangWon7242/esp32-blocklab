import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { blocklabScope } from "./scripts/postcss-blocklab-scope.ts";

/*
 * 라이브러리 빌드 (npm run build:lib → dist-lib/). 허브(dlab-learning-hub)가 vendor/blocklab/ 으로 복사해 쓴다.
 *   - ESM 하나(index.js) + 화면 조각(chunks/*.js). react·react-dom 은 호스트 것을 쓴다 (external)
 *   - CSS 는 style.css 하나로 (cssCodeSplit:false), 모든 선택자가 `.blocklab` 아래 (scripts/postcss-blocklab-scope.ts)
 *   - Blockly·CodeMirror 는 따로 조각으로 (크고 거의 안 바뀜). 화면 컴포넌트는 lazy 라서 index.js 를 Node 에서 import 해도 DOM 을 건드리지 않는다
 *   - 선언 파일(index.d.ts)·package.json 은 scripts/build-lib.mjs 가 뒤에 만든다
 */
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  css: { postcss: { plugins: [blocklabScope()] } },
  // public/ (favicon, 보드 라이브러리)은 체험판 것. 보드 라이브러리는 build-lib.mjs 가 lib/ 로 따로 복사한다
  publicDir: false,
  define: { __LIB_VERSION__: JSON.stringify(pkg.version) },
  build: {
    outDir: "dist-lib",
    emptyOutDir: true,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 3000,
    lib: { entry: path.resolve(import.meta.dirname, "src/lib/index.ts"), formats: ["es"], fileName: "index", cssFileName: "style" },
    rolldownOptions: {
      external: [/^react(\/|$)/, /^react-dom(\/|$)/],
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
        codeSplitting: {
          groups: [
            // 콘텐츠(YAML·코드·그림 원문, 약 3MB)는 이름을 붙여 둔다 — 순수 API(loadChapters)가 쓰므로 index.js 가 바로 import 한다
            { name: "content", test: /[\\/]content[\\/]chapters[\\/]/ },
            { name: "blockly", test: /node_modules[\\/](blockly|@blockly)[\\/]/ },
            { name: "codemirror", test: /node_modules[\\/](codemirror|@codemirror|@lezer)[\\/]/ },
          ],
        },
      },
    },
  },
});
