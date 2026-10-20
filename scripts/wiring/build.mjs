// 사용: node scripts/wiring/build.mjs <챕터 id> [출력 폴더]
// scripts/wiring/chapters/<id>.mjs 의 그림들을 content/chapters/<id>/images/ (또는 출력 폴더)에 쓴다.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [, , id, outDir] = process.argv;
if (!id) throw new Error("챕터 id 를 주세요 (예: 10-auto-door)");
const spec = (await import(`./chapters/${id}.mjs`)).default;
const dir = outDir ?? join(import.meta.dirname, "../../content/chapters", id, "images");
mkdirSync(dir, { recursive: true });
for (const [name, make] of Object.entries(spec)) {
  writeFileSync(join(dir, name), make());
  console.log("wrote", join(dir, name));
}
