// 사용: node scripts/wiring/build.mjs <챕터 id> [출력 폴더]
// scripts/wiring/chapters/<id>.mjs 의 그림 명세를 content/chapters/<id>/images/ (또는 출력 폴더)에 쓴다.
// 명세: export default { "wiring-x.svg": { plus: () => svg, devkit: () => svg } }
//   plus → wiring-x.svg (ESP32 Plus 확장 보드, 기본), devkit → wiring-x.devkit.svg (기본 보드 DevKit V1 30핀)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [, , id, outDir] = process.argv;
if (!id) throw new Error("챕터 id 를 주세요 (예: 10-auto-door)");
const spec = (await import(`./chapters/${id}.mjs`)).default;
const dir = outDir ?? join(import.meta.dirname, "../../content/chapters", id, "images");
mkdirSync(dir, { recursive: true });
for (const [name, make] of Object.entries(spec)) {
  const variants = typeof make === "function" ? { plus: make } : make;
  for (const [board, fn] of Object.entries(variants)) {
    const file = board === "plus" ? name : name.replace(/\.svg$/, `.${board}.svg`);
    writeFileSync(join(dir, file), fn());
    console.log("wrote", join(dir, file));
  }
}
