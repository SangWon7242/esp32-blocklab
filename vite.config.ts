import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { blocklabScope } from "./scripts/postcss-blocklab-scope.ts";
import { blocklyMedia, blocklyNoAmd } from "./scripts/vite-blockly.ts";

// GitHub Pages는 /esp32-blocklab/ 아래에 배포되므로 production 빌드만 base를 바꾼다.
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/esp32-blocklab/" : "/",
  // Blockly media(효과음·sprites.svg)를 static.blockly.com 대신 <base>blocklab/media/ 에서 (src/host/blocklyMedia.ts)
  // AMD 갈래 끄기는 라이브러리와 같은 Blockly 코드를 체험판에서도 돌려 보려고 (scripts/vite-blockly.ts)
  plugins: [blocklyNoAmd(), react(), tailwindcss(), blocklyMedia({ dir: "blocklab/media" })],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  // 체험판도 라이브러리와 같이 `.blocklab` 범위 CSS 를 쓴다 (범위가 제대로 작동하는지 e2e 가 지킨다). demo.css 만 루트에 남긴다
  css: { postcss: { plugins: [blocklabScope({ exclude: (file) => !!file && /[\\/]demo\.css$/.test(file) })] } },
  build: {
    chunkSizeWarningLimit: 3000,
    // Blockly(약 1MB, 거의 안 바뀜)는 따로: 블록 설명 글을 고쳐도 Blockly 캐시는 그대로 쓴다.
    // Vite 8(rolldown)은 manualChunks 객체 꼴을 받지 않아 codeSplitting.groups 로 같은 일을 한다
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: "blockly", test: /node_modules[\\/]blockly[\\/]/ }] } },
    },
  },
}));
