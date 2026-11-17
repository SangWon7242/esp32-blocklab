// 사용: node scripts/wiring/build.mjs <챕터 id> [출력 폴더]
// scripts/wiring/chapters/<id>.mjs 의 그림 명세를 content/chapters/<id>/images/ (또는 출력 폴더)에 쓴다.
// 명세: export default { "wiring-x.svg": { plus: () => svg, devkit: () => svg } }
//   plus → wiring-x.svg (ESP32 Plus 확장 보드, 기본), devkit → wiring-x.devkit.svg (기본 보드 DevKit V1 30핀)
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { endScene, startScene } from "./record.mjs";

// 3D 배선 보기(<이름>.3d.json): 그림의 모든 조각이 3D 로 그릴 줄 아는 부품일 때만 함께 낸다 (record.mjs 의 unsupported).

const [, , id, outDir] = process.argv;
if (!id) throw new Error("챕터 id 를 주세요 (예: 10-auto-door)");
const spec = (await import(`./chapters/${id}.mjs`)).default;
const dir = outDir ?? join(import.meta.dirname, "../../content/chapters", id, "images");
mkdirSync(dir, { recursive: true });
for (const [name, make] of Object.entries(spec)) {
  const variants = typeof make === "function" ? { plus: make } : make;
  for (const [board, fn] of Object.entries(variants)) {
    const file = board === "plus" ? name : name.replace(/\.svg$/, `.${board}.svg`);
    startScene();
    const svg = fn();
    const scene = endScene();
    writeFileSync(join(dir, file), svg);
    console.log("wrote", join(dir, file));
    const out3d = join(dir, file.replace(/\.svg$/, ".3d.json"));
    const { composed, unsupported, ...sceneData } = scene;
    if (!(composed && !unsupported && /^wiring-/.test(name))) rmSync(out3d, { force: true });
    else {
      const height = Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)?.[1] ?? 0);
      writeFileSync(out3d, JSON.stringify({ board, height, ...sceneData }) + "\n");
      console.log("wrote", out3d);
    }
  }
}
