import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages는 /esp32-blocklab/ 아래에 배포되므로 production 빌드만 base를 바꾼다.
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/esp32-blocklab/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  build: {
    chunkSizeWarningLimit: 3000,
    // Blockly(약 1MB, 거의 안 바뀜)는 따로: 블록 설명 글을 고쳐도 Blockly 캐시는 그대로 쓴다.
    // Vite 8(rolldown)은 manualChunks 객체 꼴을 받지 않아 codeSplitting.groups 로 같은 일을 한다
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: "blockly", test: /node_modules[\\/]blockly[\\/]/ }] } },
    },
  },
}));
