import type { Pt } from "@/track/wiring3d";

/*
 * ESP32 Plus(Keyestudio KS5020) 3D 배치 — 실물 도면(ESP32_D1_R32_SensorShield_Board.svg, 800×500)을 그대로 따른다.
 *   왼쪽: RESET · USB-C · CH340 · 4R7 코일 · 전원 칩 · DC 잭
 *   가운데: 위 DIGITAL(S·V·G) 두 묶음, 그 아래 BUS I2C, 그 아래 ANALOG(G·V·S)
 *   오른쪽: ESP-WROOM-32 모듈(안테나는 오른쪽 끝) · TX RX G V 세로 4핀
 *   위 · 아래 가장자리: 노란 암핀 줄 (SCL…io12 · io14…RX / POWER · ANALOG IN)
 * 배선도 그림(scripts/wiring/boards/plus.mjs)이 이 배치로 핀을 놓는다 — 그림 자리 428×300 안에 보드 428×250.
 * 3D 는 같은 배율로 보드 부품 · 실크를 그린다.
 */

/** 도면 px → 보드 px 배율 (도면 기판 740 × 433 → 428 × 250) */
export const K = 428 / 740;
/** 도면 기판 왼쪽 위 */
const OX = 35, OY = 12;
/** 3D 보드 판 높이 (배선도 300 안에서 위아래 25 씩 여백) */
export const PLUS_H = Math.round(433 * K);

/** 도면 좌표 → 보드 안 좌표 (보드 왼쪽 위가 0, 0) */
export const svgToBoard = (sx: number, sy: number): Pt => ({ x: (sx - OX) * K, y: (sy - OY) * K });

/*
 * 기본 보드: ESP32-DevKitC 38핀 (ESP32-WROOM-32). 눕혀서 USB-C 가 왼쪽, 모듈(안테나)이 오른쪽.
 * 세워 놓은 사진(USB 위)의 왼쪽 줄이 아래 줄, 오른쪽 줄이 위 줄이 된다 (왼 → 오 = 사진의 위 → 아래).
 * 배선도 그림(scripts/wiring/boards/devkit.mjs)이 이 배치로 핀을 놓는다.
 */
export const DK38_TOP = ["5V", "CMD", "D3", "D2", "13", "GND", "12", "14", "27", "26", "25", "33", "32", "35", "34", "VN", "VP", "EN", "3V3"];
export const DK38_BOT = ["CLK", "D0", "D1", "15", "2", "0", "4", "16", "17", "5", "18", "19", "GND", "21", "RX", "TX", "22", "23", "GND"];
/** 38핀 첫 핀 자리 · 간격 (보드 왼쪽 끝에서) */
export const DK38_X0 = 14, DK38_P = 22;
