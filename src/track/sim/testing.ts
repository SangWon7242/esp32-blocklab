import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Scene3D } from "../wiring3d";
import { behaviorFor } from "./behaviors";
import { readDevices } from "./circuit";
import { defaultInputs, Simulator } from "./engine";

/*
 * 시험용: 챕터의 실제 배선 장면(.3d.json)으로 시뮬레이터를 만든다 (Node 에서만 — 화면 코드에서 쓰지 않는다).
 *   const sim = simFor("17-ultrasonic");
 *   sim.inputs.distance[part] = 10; run(sim, 3); expect(sim.outputs.pins[26]).toBe(1);
 */

const ROOT = join(import.meta.dirname, "../../../content/chapters");

/** 그 챕터 배선도 가운데 3D 장면이 있는 첫 그림 (board: plus | devkit) */
export function sceneFor(chapterId: string, board: "plus" | "devkit" = "plus"): Scene3D | undefined {
  const dir = join(ROOT, chapterId, "images");
  if (!existsSync(dir)) return undefined;
  const yaml = readFileSync(join(ROOT, chapterId, "chapter.yaml"), "utf8");
  const image = /^wiring:\s*\n\s+image:\s*images\/([\w.-]+)\.svg/m.exec(yaml)?.[1];
  const names = image ? [image] : [];
  for (const n of names) {
    const f = join(dir, `${n}${board === "devkit" ? ".devkit" : ""}.3d.json`);
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8")) as Scene3D;
  }
  return undefined;
}

export function simFor(chapterId: string, board: "plus" | "devkit" = "plus"): Simulator {
  const scene = sceneFor(chapterId, board) ?? sceneFor(chapterId, board === "plus" ? "devkit" : "plus");
  if (!scene) throw new Error(`${chapterId}: 3D 장면이 없어요`);
  return new Simulator(readDevices(scene), behaviorFor(chapterId), defaultInputs());
}

/** sec 초 동안 60분의 1초씩 돌린다 */
export function run(sim: Simulator, sec: number, step = 1 / 60) {
  for (let t = 0; t < sec; t += step) sim.step(step);
}

/** 그 종류의 장치 (첫째) */
export function device<K extends ReturnType<typeof readDevices>[number]["kind"]>(sim: Simulator, kind: K) {
  const d = sim.devices.find((x) => x.kind === kind);
  if (!d) throw new Error(`장치가 없어요: ${kind}`);
  return d as Extract<ReturnType<typeof readDevices>[number], { kind: K }>;
}
