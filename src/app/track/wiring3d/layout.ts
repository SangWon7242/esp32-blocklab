import * as THREE from "three";
import type { Part3D, Pt, Scene3D } from "@/track/wiring3d";

/*
 * 배선 장면(배선도 SVG 와 같은 px 좌표) → 3D 자리. 1px = 1 단위, 그림의 x → X, y → Z, 높이는 Y.
 * 실제 비율: 배선도 그림의 DevKit 은 핀 두 줄이 가까워 길쭉하지만 실물은 가로 51mm · 세로 28mm 라서,
 * 3D 에서는 보드의 세로만 DEVKIT_F 배로 늘리고 보드보다 아래에 있는 것은 늘어난 만큼 내려 보낸다.
 * 보드 옆에 놓인 모듈 · 서보는 한 덩어리로 움직인다(owners).
 */

export const BB_H = 15; // 브레드보드 두께
export const PCB_H = 6; // 보드 판 두께
export const HEADER_H = 11; // Plus 핀 소켓 높이
export const PIN_LEN = 21; // DevKit 금색 핀 길이
export const PIN_SEAT = 8; // DevKit: 선 머리가 핀에 씌워져 내려앉는 높이
export const DEVKIT_F = 1.7;
/** DevKit 38핀: 아래로 난 핀 위에 올라서 있는 높이 · 선 머리가 윗면 패드에 앉는 높이 */
export const DEVKIT_LIFT = 12;
export const DEVKIT_TOP = DEVKIT_LIFT + PCB_H + 2;

/*
 * 38핀 확장 보드: 바닥 크기는 실물 비율(77.8 × 53.3mm). 배선도 그림은 DevKit 에 맞춰 암 헤더 두 줄 사이가 납작하므로
 * 3D 에서는 그 사이(위 암 헤더 바깥 줄 ~ 아래 암 헤더)만 실물 25.5mm 가 되게 늘리고, 그 바깥(S/V/G · 전원부)은 그림 그대로다
 * (그림의 핀 간격 19.8px 가 곧 2.54mm). 높이는 다른 3D 부품(브레드보드 · 모듈)과 어울리게 실물의 약 절반(1mm ≈ 4)으로 줄였다.
 */
/** 노란 암 헤더 높이 (실물 8.5mm) */
export const EX_FEMALE = 34;
/** S/V/G 수 헤더: 색 받침 높이 (2.5mm) · 핀 끝 높이 (기판 위 11.5mm) */
export const EX_BASE = 10;
export const EX_PIN = 46;
/** 선 머리(F, 높이 14)가 수 핀 끝을 덮고 앉는 높이 */
export const EX_SEAT = PCB_H + EX_PIN - 13;
/** 실물 암 헤더 두 줄 사이 (mm) */
const EX_ROWS_MM = 25.5;

type Rect = { x: number; y: number; w: number; h: number };
export const inRect = (p: Pt, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

type Module = Extract<Part3D, { type: "module" }>;

/** 초음파 센서 앞 물체가 움직이는 길: 센서 눈 가운데에서 바라보는 쪽(face: ±1 = Z 방향) */
export type SonarTrack = { part: number; origin: THREE.Vector3; face: 1 | -1; perCm: number };

export type Layout = {
  X: (x: number) => number;
  Z: (y: number) => number;
  /** 모듈 · 서보에 딸린 점은 그 부품과 함께 움직인다 */
  Zp: (p: Pt) => number;
  v: (p: Pt, y: number) => THREE.Vector3;
  /** 그 점의 꽂는 높이: 브레드보드 윗면 · 보드 핀 위 · 모듈 핀 끝 */
  topAt: (p: Pt) => number;
  /** 3D z → 그림 y (브레드보드 구멍 찾기) */
  unZ: (z: number) => number;
  /** DevKit 보드 안에서 세로 길이 배수 */
  F: number;
  /** 모듈 · 서보 한 덩어리의 Z: 그 덩어리 안의 y → 3D z */
  zIn: (part: { y: number; h: number }) => (y: number) => number;
  /** 장면 크기 (카메라 맞춤) · 카메라가 처음 볼 곳 */
  size: { w: number; d: number };
  focus: THREE.Vector3;
  sonars: SonarTrack[];
  /** 현장 모형 자리 (융합 챕터): 바닥 가운데 · 가로 · 세로. 회로 오른쪽에 둔다 */
  diorama: { at: THREE.Vector3; w: number; d: number } | null;
  /** 장면에서 가장 높은 것의 높이 (카메라 맞춤, 기본 60) */
  height?: number;
  /**
   * 확장 보드가 있으면: 늘린 띠(위 암 헤더 바깥 줄 y0 ~ 아래 암 헤더 y1, 그림 px)와 그 배수 F.
   * 확장 보드에 꽂힌 DevKit 은 이 F 로 세로를 늘려 핀이 암 헤더에 맞는다.
   */
  seat?: { y0: number; y1: number; F: number } | null;
};

/** 현장 보기: 현장 모형만 가운데에 (회로는 그리지 않는다) */
export function siteLayout(room: { w: number; d: number }): Layout {
  const id = (v: number) => v;
  return {
    X: id, Z: id, Zp: (p) => p.y, v: (p, y) => new THREE.Vector3(p.x, y, p.y), topAt: () => 0, unZ: id, F: 1,
    zIn: () => id, sonars: [],
    size: { w: room.w, d: room.d }, height: 170,
    focus: new THREE.Vector3(0, 40, 0),
    diorama: { at: new THREE.Vector3(0, 0, 0), w: room.w, d: room.d },
  };
}

/** 현장 모형과 회로 사이 틈 (그림 px) */
const DIORAMA_GAP = 90;

/** 초음파 센서 앞에 둘 자리 (그림 px). 센서가 서 있는 방향으로 이만큼 비워 둔다 */
const SONAR_ROOM = 230;

export function makeLayout(scene: Scene3D, diorama?: { w: number; d: number }): Layout {
  // 현장 모형은 이제 현장 보기에 따로 그린다 (diorama 를 주면 예전처럼 회로 옆에 자리를 비운다)
  // 세로로 늘리는 띠: 맨 DevKit 은 보드 전체를 DEVKIT_F 배, 확장 보드는 암 헤더 두 줄 사이를 실물 25.5mm 로 (그 위에 꽂힌 DevKit 은 따로)
  const ex = scene.boards.find((b) => b.kind === "expansion");
  const dk = ex ? undefined : scene.boards.find((b) => b.kind === "devkit");
  const seat = ex ? (() => {
    const ys = ex.female.filter((f) => f.row !== "top-inner").map((f) => f.y);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    return { y0, y1, F: (EX_ROWS_MM * ex.mm) / (y1 - y0) };
  })() : null;
  const band = dk ? { y0: dk.y, h: dk.h, F: DEVKIT_F } : seat ? { y0: seat.y0, h: seat.y1 - seat.y0, F: seat.F } : null;
  const F = dk ? DEVKIT_F : 1;
  const stretch = (y: number) => (!band || y <= band.y0 ? y : y >= band.y0 + band.h ? y + (band.F - 1) * band.h : band.y0 + (y - band.y0) * band.F);
  const unstretch = (y: number) => (!band || y <= band.y0 ? y : y >= band.y0 + band.h * band.F ? y - (band.F - 1) * band.h : band.y0 + (y - band.y0) / band.F);
  const owners = scene.parts.flatMap((p) => {
    if (p.type === "module") return [{ x: p.x - 2, y: p.y - 18, w: p.w + 4, h: p.h + 36, dz: stretch(p.y + p.h / 2) - (p.y + p.h / 2) }];
    if (p.type === "servo") {
      const dz = stretch(p.y + 22) - (p.y + 22);
      return [{ x: p.x - 8, y: p.y - 4, w: 84, h: 52, dz }, ...(p.plugBox ? [{ x: p.plugBox.x - 2, y: p.plugBox.y - 2, w: p.plugBox.w + 4, h: p.plugBox.h + 4, dz }] : [])];
    }
    return [];
  });

  // 초음파 센서는 세워 둔다: 눈이 핀 반대쪽을 본다. 그 앞으로 물체가 다닐 자리를 장면에 넣는다
  const sonarRects: Rect[] = [];
  const sonarFace = (m: Module): 1 | -1 => (m.side === "bottom" ? -1 : 1);
  scene.parts.forEach((p) => {
    if (p.type !== "module" || p.kind !== "ultrasonic") return;
    const f = sonarFace(p);
    sonarRects.push(f < 0 ? { x: p.x, y: p.y - SONAR_ROOM, w: p.w, h: SONAR_ROOM } : { x: p.x, y: p.y + p.h, w: p.w, h: SONAR_ROOM });
  });

  const rects: Rect[] = [
    ...scene.boards,
    ...scene.breadboards,
    ...scene.parts.flatMap((p) => (p.type === "module" ? [{ x: p.x, y: p.y - 14, w: p.w, h: p.h + 28 }] : p.type === "servo" ? [{ x: p.x - 46, y: p.y, w: 158, h: 54 }] : p.type === "touch" ? [p.pad] : p.type === "prop" ? [p] : [])),
  ];
  const minX = Math.min(...rects.map((r) => r.x)), maxX = Math.max(...rects.map((r) => r.x + r.w));
  const minY = Math.min(...rects.map((r) => stretch(r.y))), maxY = Math.max(...rects.map((r) => stretch(r.y + r.h)));
  const cx = (minX + maxX) / 2, cz = (minY + maxY) / 2;
  const X = (x: number) => x - cx;
  const Z = (y: number) => stretch(y) - cz;
  const Zp = (p: Pt) => {
    const o = owners.find((r) => inRect(p, r));
    return o ? p.y + o.dz - cz : Z(p.y);
  };
  const zIn = (part: { y: number; h: number }) => {
    const dz = stretch(part.y + part.h / 2) - (part.y + part.h / 2);
    return (y: number) => y + dz - cz;
  };

  // 꽂는 높이: 모듈 핀 끝 · 서보 플러그 구멍
  const pads: { x: number; y: number; top: number }[] = [];
  for (const p of scene.parts) {
    if (p.type === "module") for (const q of p.pins) pads.push({ x: q.x, y: q.y, top: 0 });
    if (p.type === "servo" && !p.onBoard && p.plugBox) for (const q of p.plug) pads.push({ x: q.x, y: q.y, top: 8 });
  }
  const topAt = (p: Pt) => {
    const pad = pads.find((q) => Math.abs(q.x - p.x) < 1.5 && Math.abs(q.y - p.y) < 1.5);
    if (pad) return pad.top;
    if (scene.breadboards.some((b) => inRect(p, b))) return BB_H;
    const board = scene.boards.find((b) => inRect(p, b));
    return board ? (board.kind === "devkit" ? DEVKIT_TOP : board.kind === "expansion" ? EX_SEAT : PCB_H + HEADER_H) : 0;
  };

  const sonars: SonarTrack[] = [];
  scene.parts.forEach((p, part) => {
    if (p.type !== "module" || p.kind !== "ultrasonic") return;
    const zz = zIn(p);
    const face = sonarFace(p);
    // 세운 판의 눈 높이 · 판 앞면 (핀 쪽 가장자리를 축으로 세운다)
    const edge = face < 0 ? p.y + p.h : p.y;
    // 눈 가운데: 세운 판에서 핀 쪽 가장자리로부터 눈까지의 거리가 높이가 된다. 눈은 판 앞으로 24 나와 있다
    const eyeUp = face < 0 ? p.h - 34 : 34;
    sonars.push({ part, origin: new THREE.Vector3(X(p.x + p.w / 2), 4 + eyeUp, zz(edge) + face * 26), face, perCm: 6 });
  });

  // 손으로 다루는 소품 자리: PIR 앞 사람 · RFID 카드 · 리모컨 · 라이터
  const propRects: Rect[] = scene.parts.flatMap((p) => {
    if (p.type !== "module") return [];
    if (p.kind === "pir") return [{ x: p.x + 38 - 190, y: p.y + 32 - 180, w: 190 + 300, h: 360 }];
    if (p.kind === "rfid") return [p.side === "top" ? { x: p.x - 20, y: p.y, w: p.w + 40, h: p.h + 130 } : { x: p.x - 20, y: p.y - 130, w: p.w + 40, h: p.h + 130 }];
    if (p.kind === "ir") return [{ x: p.x, y: p.y - 30, w: p.w + 150, h: p.h + 60 }];
    if (p.kind === "flame") return [{ x: p.x, y: p.y, w: p.w + 90, h: p.h }];
    return [];
  });
  // 장면 크기: 초음파 앞 자리 · 소품 자리까지
  const all = [...rects, ...sonarRects, ...propRects];
  // 현장 모형: 회로 · 소품 자리 오른쪽, 세로 가운데. (stretch 를 거치지 않게 이미 늘인 좌표로 둔다)
  let dRect: Rect | null = null;
  if (diorama) {
    const x1 = Math.max(...all.map((r) => r.x + r.w));
    const zc = (Math.min(...all.map((r) => stretch(r.y))) + Math.max(...all.map((r) => stretch(r.y + r.h)))) / 2;
    dRect = { x: x1 + DIORAMA_GAP, y: zc - diorama.d / 2, w: diorama.w, h: diorama.d };
  }
  const ax0 = Math.min(...all.map((r) => r.x)), ax1 = Math.max(...all.map((r) => r.x + r.w), dRect ? dRect.x + dRect.w : -Infinity);
  const az0 = Math.min(...all.map((r) => stretch(r.y)), dRect ? dRect.y : Infinity), az1 = Math.max(...all.map((r) => stretch(r.y + r.h)), dRect ? dRect.y + dRect.h : -Infinity);

  return {
    X, Z, Zp, zIn, topAt, F, sonars, seat,
    ...(ex ? { height: 80 } : {}),
    v: (p, y) => new THREE.Vector3(X(p.x), y, Zp(p)),
    unZ: (z) => unstretch(z + cz),
    size: { w: Math.max(maxX - minX, ax1 - ax0), d: Math.max(maxY - minY, az1 - az0) },
    focus: new THREE.Vector3(X((ax0 + ax1) / 2), 12, (az0 + az1) / 2 - cz),
    diorama: dRect ? { at: new THREE.Vector3(X(dRect.x + dRect.w / 2), 0, dRect.y + dRect.h / 2 - cz), w: dRect.w, d: dRect.h } : null,
  };
}
