import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages는 /esp32-blocklab/ 아래에 배포되므로 production 빌드만 base를 바꾼다.
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/esp32-blocklab/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  build: { chunkSizeWarningLimit: 3000 },
}));
