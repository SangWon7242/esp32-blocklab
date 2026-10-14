import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    // 변환 캐시는 import.meta.glob 결과(콘텐츠 .py·그림 .svg 목록)까지 굳혀 두어, 파일을 더하거나 빼도 옛 목록을 쓴다
    fsModuleCache: false,
  },
});
