#!/usr/bin/env node
/*
 * 라이브러리 빌드 (npm run build:lib). 결과는 dist-lib/ 하나로, 허브가 vendor/blocklab/ 으로 복사한다.
 *   1. vite build -c vite.lib.config.ts   → index.js, chunks/*.js, style.css
 *   2. tsc -p tsconfig.lib.json           → types/**.d.ts (@/ 별칭을 상대 경로로 고쳐 쓴다) + index.d.ts
 *   3. public/lib/*.py                    → lib/ (보드에 올리는 라이브러리. 호스트가 /lib/<이름> 으로 서빙해야 한다 — src/device/libs.ts)
 *   4. package.json                       → 이름·version·exports
 *   5. scripts/lib-smoke.mjs              → window 없는 Node 에서 import 해 순수 API 를 부른다
 */
import { execFileSync } from "node:child_process";
import { cpSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist-lib");
const bin = (name) => path.join(root, "node_modules/.bin", name);
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: "inherit" });
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

// 1. JS + CSS
run(bin("vite"), ["build", "-c", "vite.lib.config.ts"]);

// 2. 선언 파일
const typesDir = path.join(out, "types");
rmSync(typesDir, { recursive: true, force: true });
run(bin("tsc"), ["-p", "tsconfig.lib.json"]);
for (const file of walk(typesDir)) {
  if (!file.endsWith(".d.ts")) continue;
  const text = readFileSync(file, "utf8");
  const fixed = text
    // "@/x/y" → 이 파일에서 types/x/y 로 가는 상대 경로
    .replace(/(["'])@\/([^"']+)\1/g, (_m, q, spec) => {
      let rel = path.relative(path.dirname(file), path.join(typesDir, spec)).split(path.sep).join("/");
      if (!rel.startsWith(".")) rel = `./${rel}`;
      return `${q}${rel}${q}`;
    })
    // CSS 부수 효과 import 는 선언에 필요 없다 (허브에는 vite/client 타입이 없다)
    .replace(/^import\s+["'][^"']+\.css["'];\s*$/gm, "");
  if (fixed !== text) writeFileSync(file, fixed);
}
writeFileSync(path.join(out, "index.d.ts"), 'export * from "./types/lib/index";\n');

// 3. 보드 라이브러리
cpSync(path.join(root, "public/lib"), path.join(out, "lib"), { recursive: true, filter: (src) => !src.endsWith("README.md") });

// 4. package.json
const libPkg = {
  name: "@dlab/esp32-blocklab",
  version: pkg.version,
  description: "ESP32 블록랩 — 허브에 심는 라이브러리 (BlocklabProvider·화면·순수 판정 API)",
  type: "module",
  main: "./index.js",
  module: "./index.js",
  types: "./index.d.ts",
  exports: {
    ".": { types: "./index.d.ts", default: "./index.js" },
    "./style.css": "./style.css",
    "./package.json": "./package.json",
  },
  sideEffects: ["*.css"],
  peerDependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
};
writeFileSync(path.join(out, "package.json"), `${JSON.stringify(libPkg, null, 2)}\n`);

// 5. 연기 검사
run(process.execPath, [path.join(root, "scripts/lib-smoke.mjs")]);

// 6. 크기
const sizes = walk(out)
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => [path.relative(out, f), statSync(f).size])
  .sort((a, b) => b[1] - a[1]);
console.log("\ndist-lib/ 크기:");
for (const [name, size] of sizes) console.log(`  ${name.padEnd(44)} ${(size / 1024).toFixed(1).padStart(8)} kB`);
console.log(`  ${"합계".padEnd(44)} ${(sizes.reduce((a, [, s]) => a + s, 0) / 1024).toFixed(1).padStart(8)} kB`);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}
