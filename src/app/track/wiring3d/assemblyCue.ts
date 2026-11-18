import * as THREE from "three";
import type { Pt, Scene3D } from "@/track/wiring3d";

/*
 * 3D 조립 안내 무대(AssemblyStage)의 순수 계산 (lib-v1.6.0).
 *   - 호스트가 준 차례(cue)마다 보드 · 부품 · 선이 언제 처음 나오는지
 *   - 차례 하나의 움직임 시간표(초)와 구간 진행률
 *   - 카메라가 점 여럿을 화면에 담을 자리 · 배율
 * React · DOM 없이 돌아서 단위 시험으로 본다.
 */

/**
 * 조립 차례 하나. 호스트가 순서를 정해 넘긴다.
 *   - `{ kind: "place", board }` — scene.boards[board] 를 내려놓는다
 *   - `{ kind: "place", part }` — scene.parts[part] 를 내려놓는다
 *   - `{ kind: "wire", wire }` — scene.wires[wire] 를 잇는다 (모듈 쪽 끝을 먼저 꽂고 보드 쪽으로 그려 간다)
 *   - `{ kind: "all" }` — 다 꽂힌 모습을 멀리서 본다
 */
export type AssemblyCue =
  | { kind: "place"; part: number; board?: undefined }
  | { kind: "place"; board: number; part?: undefined }
  | { kind: "wire"; wire: number }
  | { kind: "all" };

/** 보드 · 부품 · 선마다 처음 나오는 차례 번호 (늘 보이면 -1, 끝내 안 나오면 Infinity) */
export type CueIntro = { boards: number[]; parts: number[]; wires: number[] };

export function cueIntro(scene: Scene3D, cues: AssemblyCue[]): CueIntro {
  const first = (pick: (c: AssemblyCue) => boolean) => cues.findIndex(pick);
  const allAt = first((c) => c.kind === "all");
  const late = allAt < 0 ? Infinity : allAt;
  const or = (i: number, fallback: number) => (i < 0 ? fallback : i);
  return {
    // 차례에 없는 보드는 처음부터 깔려 있다 (바탕)
    boards: scene.boards.map((_, b) => or(first((c) => c.kind === "place" && c.board === b), -1)),
    // 차례에 없는 부품 · 선은 "다 보기" 차례에 함께 나온다
    parts: scene.parts.map((_, p) => or(first((c) => c.kind === "place" && c.part === p), late)),
    wires: scene.wires.map((_, w) => or(first((c) => c.kind === "wire" && c.wire === w), late)),
  };
}

/** 지금 차례(step)에서 그 물건이 어떤 상태인지 */
export type Stage = "hidden" | "active" | "done";
export function stageOf(intro: number, step: number): Stage {
  return intro < step ? "done" : intro === step ? "active" : "hidden";
}

/* ───────────── 시간표 ───────────── */

/** [시작, 끝] 초 */
export type Seg = readonly [number, number];

/** 놓기: 위에서 내려앉고(0.8초) 둘레에 빛 고리가 한 번 퍼진다 */
export const PLACE = { drop: [0, 0.8], ring: [0.62, 1.35], cam: [0, 0.9], end: 1.35 } as const;

/**
 * 선 잇기 (약 3.8초, 차례대로):
 *   camIn 모듈 핀 가까이 → plugA 첫 끝이 날아와 꽂힘 → draw 선이 보드 쪽으로 그려짐(카메라가 따라감)
 *   → plugB 다른 끝이 보드 핀에 꽂힘 · 핀 이름 → camOut 두 끝이 다 보이게 물러남
 */
export const WIRE = { camIn: [0, 0.8], plugA: [0.55, 1.2], draw: [1.25, 2.75], plugB: [2.7, 3.15], label: [3.15, 4.9], camOut: [3.05, 3.85], end: 3.85 } as const;

/** 다 보기: 카메라가 멀리 물러나 전체를 담는다 */
export const ALL = { cam: [0, 1.2], end: 1.2 } as const;

/** 꽂히는 순간 고리가 퍼지는 시간 */
export const BURST = 0.6;

export function cueDuration(cue: AssemblyCue | undefined): number {
  if (!cue) return 0;
  return cue.kind === "place" ? PLACE.end : cue.kind === "wire" ? WIRE.end : ALL.end;
}

/** 구간 진행률 0..1 (구간 앞은 0, 뒤는 1) */
export function phase(seg: Seg, t: number): number {
  const [a, b] = seg;
  if (t >= b) return 1;
  if (t <= a) return 0;
  return (t - a) / (b - a);
}

export const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
export const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** TubeGeometry 를 앞에서부터 k 만큼만 그리는 index 개수 (관 마디 · 둘레 마디마다 삼각형 둘) */
export function tubeDrawCount(k: number, tubular: number, radial: number): number {
  const segs = Math.floor(THREE.MathUtils.clamp(k, 0, 1) * tubular + 1e-6);
  return segs * radial * 6;
}

/* ───────────── 선의 두 끝 ───────────── */

const near = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 1.5 && Math.abs(a.y - b.y) < 1.5;

/** 보드 핀 위에 있는 점이면 그 핀 */
export function boardPinAt(scene: Scene3D, p: Pt) {
  for (const b of scene.boards) {
    const q = b.pins.find((x) => near(x, p));
    if (q) return q;
  }
  return undefined;
}

/** 먼저 꽂을 끝: 보드 핀이 아닌 쪽(모듈 · 부품). 둘 다 같으면 from */
export function firstEnd(scene: Scene3D, wire: number): "from" | "to" {
  const w = scene.wires[wire];
  const fromBoard = Boolean(boardPinAt(scene, w.from)), toBoard = Boolean(boardPinAt(scene, w.to));
  return fromBoard && !toBoard ? "to" : "from";
}

/** 끝 이름: 보드 핀 이름(괄호 설명은 뗀다) · 모듈 핀 이름 */
export function endLabel(scene: Scene3D, p: Pt): string {
  const pin = boardPinAt(scene, p);
  if (pin) return pin.label.replace(/ \(.*\)$/, "");
  for (const part of scene.parts) {
    if (part.type !== "module") continue;
    const q = part.pins.find((m) => near(m, p));
    if (q) return q.name === "-" ? "−" : q.name;
  }
  return "";
}

/* ───────────── 카메라 ───────────── */

/** 등각 카메라가 바라보는 방향의 화면 오른쪽 · 위쪽 (방위각 az, 내려다보는 각 el) */
export function viewBasis(az: number, el: number): { right: THREE.Vector3; up: THREE.Vector3; back: THREE.Vector3 } {
  const back = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  const right = new THREE.Vector3(0, 1, 0).cross(back).normalize();
  const up = back.clone().cross(right).normalize();
  return { right, up, back };
}

export type Pose = { target: THREE.Vector3; zoom: number };

/**
 * 점들이 화면(w × h px)에 여백 pad 를 두고 다 들어오는 카메라 자리 · 배율.
 * 배율은 [minZoom, maxZoom] 안으로 자른다.
 */
export function framePoints(points: THREE.Vector3[], basis: { right: THREE.Vector3; up: THREE.Vector3 }, view: { w: number; h: number }, pad: number, minZoom = 0, maxZoom = Infinity): Pose {
  if (!points.length) return { target: new THREE.Vector3(), zoom: THREE.MathUtils.clamp(1, minZoom, maxZoom) };
  const xs = points.map((p) => p.dot(basis.right)), ys = points.map((p) => p.dot(basis.up));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  // 화면 가운데 = 오른쪽 · 위쪽 성분이 cx, cy 인 점. 깊이 방향은 가운데 점들의 평균 높이에 둔다
  const mean = points.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / points.length);
  const target = mean.clone()
    .addScaledVector(basis.right, cx - mean.dot(basis.right))
    .addScaledVector(basis.up, cy - mean.dot(basis.up));
  const zw = Math.max(1, view.w - 2 * pad) / Math.max(1e-3, x1 - x0);
  const zh = Math.max(1, view.h - 2 * pad) / Math.max(1e-3, y1 - y0);
  return { target, zoom: THREE.MathUtils.clamp(Math.min(zw, zh), minZoom, maxZoom) };
}

export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  // 배율은 곱셈으로 섞어야 끌려가는 느낌이 고르다
  return { target: a.target.clone().lerp(b.target, k), zoom: a.zoom * Math.pow(b.zoom / a.zoom, k) };
}
