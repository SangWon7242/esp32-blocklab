import type { Pt, Scene3D } from "@/track/wiring3d";

/*
 * ESP32 Plus(Keyestudio KS5020) 3D 배치 — 실물 도면(ESP32_D1_R32_SensorShield_Board.svg, 800×500)을 그대로 따른다.
 *   왼쪽: RESET · USB-C · CH340 · 4R7 코일 · 전원 칩 · DC 잭
 *   가운데: 위 DIGITAL(S·V·G) 두 묶음, 그 아래 BUS I2C, 그 아래 ANALOG(G·V·S)
 *   오른쪽: ESP-WROOM-32 모듈(안테나는 오른쪽 끝) · TX RX G V 세로 4핀
 *   위 · 아래 가장자리: 노란 암핀 줄 (SCL…io12 · io14…RX / POWER · ANALOG IN)
 * 배선도 그림(scripts/wiring, 428×300)은 그대로 두고, 3D 장면을 불러올 때 보드 핀 좌표만 이 도면 자리로 옮긴다.
 * 선 · 서보 플러그처럼 보드 핀에 꽂힌 점도 함께 옮겨서 선이 새 자리의 핀에 꽂힌다.
 */

/** 도면 px → 보드 px 배율 (도면 기판 740 × 433 → 428 × 250) */
export const K = 428 / 740;
/** 도면 기판 왼쪽 위 */
const OX = 35, OY = 12;
/** 3D 보드 판 높이 (배선도 300 안에서 위아래 25 씩 여백) */
export const PLUS_H = Math.round(433 * K);
const DY = (300 - PLUS_H) / 2;

/** 도면 좌표 → 보드 안 좌표 (보드 왼쪽 위가 0, 0) */
export const svgToBoard = (sx: number, sy: number): Pt => ({ x: (sx - OX) * K, y: (sy - OY) * K });

/** 배선도(plus.mjs)의 핀 자리 → 도면의 핀 자리 (보드 왼쪽 위에서 잰 값). 모르는 점이면 null */
function mapPin(rx: number, ry: number): Pt | null {
  const near = (a: number, b: number) => Math.abs(a - b) < 1.5;
  const idx = (v: number, v0: number) => { const i = (v - v0) / 20; return Math.abs(i - Math.round(i)) < 0.08 ? Math.round(i) : -1; };
  // 위 한 줄 (y 58): 왼쪽 열 개 x 26 + 20i, 오른쪽 여덟 개 x 260 + 20j
  if (near(ry, 58)) {
    const i = idx(rx, 26), j = idx(rx, 260);
    if (j >= 0 && j < 8) return { x: 526 + 22 * j, y: 28 };
    if (i >= 0 && i < 10) return { x: 232 + 22 * i, y: 28 };
  }
  // DIGITAL S · V · G 세 줄 (y 78 · 96 · 114)
  const row = [78, 96, 114].findIndex((y) => near(ry, y));
  if (row >= 0) {
    const j = idx(rx, 260), i = idx(rx, 26);
    if (j >= 0 && j < 6) return { x: 524 + 22 * j, y: 82 + 22 * row };
    if (i >= 4 && i < 10) return { x: 340 + 22 * (i - 4), y: 82 + 22 * row };
  }
  // ANALOG 묶음: 열 G V S (x 30 · 50 · 70), 행 io35 … io2 (y 176 + 20r)
  const ak = [30, 50, 70].findIndex((x) => near(rx, x));
  if (ak >= 0) { const r = idx(ry, 176); if (r >= 0 && r < 6) return { x: 353 + 22 * ak, y: 260 + 22 * r }; }
  // BUS I2C: 열 GND 5V SDA SCL (x 140 + 20k), 행 (y 190 + 20r)
  const ik = idx(rx, 140), ir = idx(ry, 190);
  if (ik >= 0 && ik < 4 && ir >= 0 && ir < 3) return { x: 353 + 22 * ik, y: 170 + 22 * ir };
  // 아래 한 줄 (y 282): io0 5V RST 3V3 5V GND VIN io32 io33 io34 io35 io36 io39
  if (near(ry, 282)) {
    const i = idx(rx, 160);
    const xs = [336, 358, 380, 402, 424, 446, 490, 580, 602, 624, 646, 668, 690];
    if (i >= 0 && i < xs.length) return { x: xs[i], y: 423 };
  }
  return null;
}

/*
 * 기본 보드: ESP32-DevKitC 38핀 (ESP32-WROOM-32). 눕혀서 USB-C 가 왼쪽, 모듈(안테나)이 오른쪽.
 * 세워 놓은 사진(USB 위)의 왼쪽 줄이 아래 줄, 오른쪽 줄이 위 줄이 된다 (왼 → 오 = 사진의 위 → 아래).
 * 배선도(DevKit V1 30핀)의 핀 이름을 38핀 자리로 옮긴다 — 줄 높이는 같고 가로 자리만 바뀐다.
 */
export const DK38_TOP = ["5V", "CMD", "D3", "D2", "13", "GND", "12", "14", "27", "26", "25", "33", "32", "35", "34", "VN", "VP", "EN", "3V3"];
export const DK38_BOT = ["CLK", "D0", "D1", "15", "2", "0", "4", "16", "17", "5", "18", "19", "GND", "21", "RX", "TX", "22", "23", "GND"];
/** 38핀 첫 핀 자리 · 간격 (보드 왼쪽 끝에서) */
export const DK38_X0 = 14, DK38_P = 22;
/** 배선도 30핀 이름 → [위 줄?, 38핀 칸] */
const DK30_TO_38: Record<string, [boolean, number]> = {
  VIN: [true, 0], D13: [true, 4], D12: [true, 6], D14: [true, 7], D27: [true, 8], D26: [true, 9], D25: [true, 10], D33: [true, 11],
  D32: [true, 12], D35: [true, 13], D34: [true, 14], VN: [true, 15], VP: [true, 16], EN: [true, 17], "3V3": [true, 18],
  D15: [false, 3], D2: [false, 4], D4: [false, 6], RX2: [false, 7], TX2: [false, 8], D5: [false, 9], D18: [false, 10], D19: [false, 11],
  D21: [false, 13], RX0: [false, 14], TX0: [false, 15], D22: [false, 16], D23: [false, 17],
};

/** 보드가 있는 장면의 보드 핀 · 그 핀에 꽂힌 점을 실물 배치로 옮긴 새 장면 (Plus: 실물 도면, DevKit: 38핀) */
export function withPlusLayout(scene: Scene3D): Scene3D {
  if (!scene.boards.length) return scene;
  const moves: { from: Pt; to: Pt }[] = [];
  const boards = scene.boards.map((b) => {
    if (b.kind === "devkit") {
      const rows = [...new Set(b.pins.map((p) => Math.round(p.y)))].sort((a, c) => a - c);
      const pins = b.pins.map((p) => {
        const label = p.label.replace(/ \(.*\)$/, "");
        const top = Math.round(p.y) === rows[0];
        const m = label === "GND" ? [top, top ? 5 : 12] as [boolean, number] : DK30_TO_38[label];
        if (!m) return p;
        const to = { x: b.x + DK38_X0 + DK38_P * m[1], y: m[0] === top ? p.y : top ? rows[rows.length - 1] : rows[0] };
        moves.push({ from: { x: p.x, y: p.y }, to });
        return { ...p, ...to };
      });
      // 모듈: 오른쪽 끝(안테나가 보드 끝까지), 폭은 보드 가운데 18mm 쯤
      return { ...b, pins, chip: { x: b.x + 248, y: b.y + 27, w: 224, h: 96 }, usb: { x: b.x - 10, y: b.y + b.h / 2 - 17, w: 28, h: 34 } };
    }
    if (b.kind !== "plus") return b;
    const ny = b.y + DY;
    const at = (sx: number, sy: number) => { const q = svgToBoard(sx, sy); return { x: b.x + q.x, y: ny + q.y }; };
    const pins = b.pins.map((p) => {
      const m = mapPin(p.x - b.x, p.y - b.y);
      if (!m) return p;
      const to = at(m.x, m.y);
      moves.push({ from: { x: p.x, y: p.y }, to });
      return { ...p, ...to };
    });
    const rect = (x0: number, y0: number, x1: number, y1: number) => { const a = at(x0, y0), c = at(x1, y1); return { x: a.x, y: a.y, w: c.x - a.x, h: c.y - a.y }; };
    return { ...b, y: ny, h: PLUS_H, pins, chip: rect(504, 176, 790, 336), usb: rect(18, 80, 102, 152) };
  });
  const move = (p: Pt): Pt => moves.find((m) => Math.abs(m.from.x - p.x) < 1.5 && Math.abs(m.from.y - p.y) < 1.5)?.to ?? p;
  const parts = scene.parts.map((p) => (p.type === "servo" && p.onBoard ? { ...p, plug: p.plug.map(move) } : p));
  const wires = scene.wires.map((w) => ({ ...w, from: move(w.from), to: move(w.to) }));
  return { ...scene, boards, parts, wires };
}
