/*
 * 확장 보드: 보라색 "ESP32S 38P/V4/Goouuu Expansion board" (77.8×53.3mm) 에 기본 보드 DevKit 38핀을 꽂은 모습.
 * 위에서 본 그림, 사진 3.png 방향 — 전원부(USB-C · 마이크로 USB · DC 잭)가 왼쪽, DevKit 의 USB 도 왼쪽.
 *
 *   - 가운데 노란 암 헤더 두 줄(19핀씩)에 DevKit 이 꽂힌다. 위쪽(5V … 3V3) 은 두 줄짜리(25.5mm · 24mm 폭 DevKit 겸용),
 *     DevKit 은 바깥 줄(25.5mm)에 꽂힌 것으로 그린다. 암 헤더는 DevKit 아래에 가려 가장자리만 보인다.
 *   - 그 바깥에 GPIO 마다 S(노랑) · V(빨강) · G(검정) 3핀 수 헤더. 위쪽은 바깥부터 S V G, 아래쪽은 안쪽부터 G V S.
 *     기둥은 암 헤더의 앞 18칸(위 5V … EN, 아래 CLK … P23)에만 있고, 19번째 칸(3V3 · GND)에는 S/V/G 글자 상자가 있다.
 *     S = 그 칸의 핀(GPIO · 5V · GND), V = V 줄(JUMP 점퍼로 5V 또는 3.3V), G = GND.
 *   - 위 줄(왼→오): 5V CMD SD3 SD2 P13 GND P12 P14 P27 P26 P25 P33 P32 P35 P34 SVN SVP EN 3V3
 *     아래 줄(왼→오): CLK SD0 SD1 P15 P2 P0 P4 P16 P17 P5 P18 P19 GND P21 RX TX P22 P23 GND
 *     (devkit.mjs 의 TOP · BOT 와 같은 순서 — DevKit 핀이 그대로 맞는다. 사진 3 의 판은 두 번째 칸을 GND 로 찍었지만
 *      사진 4 · 5 · 7 의 판과 DevKit 실물은 CMD 라 CMD 로 둔다.)
 *   - 왼쪽 전원부: RPW-LED · USB-C(USB5V) · 전원 헤더 2×4(GND 넷 / 3V 둘 · 5V 둘) · JUMP(5V · V · 3.3V) ·
 *     다이오드 · 레귤레이터(AMS1117) · 47µF 35V 콘덴서 둘 · 마이크로 USB · DC 잭(DC6.5-16V) ·
 *     I2C/UART 헤더 2×4 (안쪽 줄 GND VCC D21 D22, 바깥 줄 GND VCC RX TX)
 *
 * DevKit 은 새로 그리지 않는다: boards/devkit.mjs 의 makeDevkit 그림을 그대로 가져와 transform="translate scale(0.9)" 로
 * 얹는다 (DK_SCALE). DevKit 의 핀 간격 22 × 0.9 = 19.8 이 이 보드의 핀 간격(2.54mm)이고, DevKit 핀 두 줄(118 × 0.9)이
 * 암 헤더 두 줄 자리다. 그래서 세로는 실물보다 납작하다(DevKit 그림 자체가 납작). 가로는 실물 비율에 가깝다(전원부만 조금 좁힘).
 * 3D 기록: 이 보드 { kind: "expansion" } 다음에 DevKit 기록 { kind: "devkit", seatedOn: "expansion", scale: 0.9 } 이 따른다.
 *
 * makeExpansion({ x, y, jumper }) 는 보드 왼쪽 위 모서리를 받는다. 보드 612×314 + 아래 메모 한 줄(bounds.h = 338).
 * DC 잭 · USB-C 는 왼쪽으로 조금 (최대 18) 나온다. x 는 18~22 가 알맞다 (폭 640 안).
 * jumper: "3V3"(기본, V 줄 = 3.3V — 수업 보드의 평소 자리) 또는 "5V"(서보 · 초음파 같은 5V 부품을 쓰는 수업).
 *   점퍼 위치는 수업마다 정한다. 한 챕터의 확장 보드 그림은 모두 같은 점퍼로 그린다 (src/track/README.md "수업 보드").
 *   기판 바깥선(polygon)에 data-expansion-jumper="3V3|5V" 를 남겨, 화면이 그림만 보고 "점퍼를 5V 로" 안내를 띄운다.
 *   I2C 헤더 VCC 는 V 줄을 따라간다 (선생님 실측: 점퍼 3.3V → 3.24V, 5V → 약 4.6V).
 */
import { PIN_FILL as FILL, vtext, vtextDown } from "../common.mjs";
import { makeDevkit } from "./devkit.mjs";
import { mark, moveLastBoard, pt, rec } from "../record.mjs";

const TOP = ["5V", "CMD", "SD3", "SD2", "P13", "GND", "P12", "P14", "P27", "P26", "P25", "P33", "P32", "P35", "P34", "SVN", "SVP", "EN", "3V3"];
const BOT = ["CLK", "SD0", "SD1", "P15", "P2", "P0", "P4", "P16", "P17", "P5", "P18", "P19", "GND", "P21", "RX", "TX", "P22", "P23", "GND"];
/** S/V/G 기둥이 있는 칸 수 (19번째 칸은 암 헤더뿐) */
const MALE = 18;
const ALIAS = { 36: "SVP", 39: "SVN", 3: "RX", 1: "TX" };
const FLASH = new Set(["CLK", "CMD", "SD0", "SD1", "SD2", "SD3"]);
const ROWS = ["S", "V", "G"];

/** DevKit 그림을 얹는 배율 — 핀 간격 22 → 19.8 (= 2.54mm) */
export const DK_SCALE = 0.9;
const P = 22 * DK_SCALE;
/** 그림 px ↔ mm (핀 간격 2.54mm) */
const MM = P / 2.54;

// 보드 왼쪽 위에서 잰 자리
const W = 612, H = 314;
const LP = 200; // 왼쪽 끝 ~ 첫 칸(전원부 폭)
const Y = { topS: 40, topV: 40 + P, topG: 40 + 2 * P, topF: 103.6, botF: 103.6 + 118 * DK_SCALE };
Y.topF2 = Y.topF + P; // 안쪽 암 헤더 줄 (24mm 폭 DevKit 용, DevKit 아래에 가려짐)
Y.botG = Y.botF + 24;
Y.botV = Y.botG + P;
Y.botS = Y.botG + 2 * P;
const HDR = [-88, -68, -48, -28].map((d) => LP + d); // 전원 헤더 · I2C 헤더 열 (첫 칸 왼쪽)
const PWR_Y = [44, 44 + P];
const JUMP = { x: 86, ys: [104, 104 + P, 104 + 2 * P] };

export function makeExpansion({ x = 22, y = 200, jumper = "3V3" } = {}) {
  if (jumper !== "3V3" && jumper !== "5V") throw new Error(`점퍼는 "3V3" 또는 "5V": ${jumper}`);
  const BOARD = { x, y, w: W, h: H + 24 };
  const X0 = x + LP;
  const colX = (i) => Math.round((X0 + i * P) * 10) / 10;
  const r1 = (v) => Math.round(v * 10) / 10;
  const DX = r1(X0 - 14 * DK_SCALE), DY = r1(y + Y.topF - 16 * DK_SCALE);

  /** 핀 이름 → 좌표: "top:P13:S" "bot:P4:G" · "pwr:GND:0..3" "pwr:3V:0..1" "pwr:5V:0..1" · "i2c:GND|VCC|SDA|SCL" · "uart:GND|VCC|RX|TX" · "jump:5V|V|3V3" */
  function pin(name) {
    const [a, b, c] = name.split(":");
    const at = (px, py) => ({ x: r1(px), y: r1(py), name });
    if (a === "top" || a === "bot") {
      const list = a === "top" ? TOP : BOT;
      const i = list.indexOf(b);
      const k = ROWS.indexOf(c);
      if (i >= 0 && i < MALE && k >= 0) {
        const ry = a === "top" ? [Y.topS, Y.topV, Y.topG][k] : [Y.botS, Y.botV, Y.botG][k];
        return at(colX(i), y + ry);
      }
    }
    if (a === "pwr") {
      const k = Number(c ?? 0);
      if (b === "GND" && k >= 0 && k < 4) return at(x + HDR[k], y + PWR_Y[0]);
      if (b === "3V" && k >= 0 && k < 2) return at(x + HDR[k], y + PWR_Y[1]);
      if (b === "5V" && k >= 0 && k < 2) return at(x + HDR[2 + k], y + PWR_Y[1]);
    }
    if (a === "i2c") {
      const k = ["GND", "VCC", "SDA", "SCL"].indexOf(b);
      if (k >= 0) return at(x + HDR[k], y + Y.botV);
    }
    if (a === "uart") {
      const k = ["GND", "VCC", "RX", "TX"].indexOf(b);
      if (k >= 0) return at(x + HDR[k], y + Y.botS);
    }
    if (a === "jump") {
      const k = ["5V", "V", "3V3"].indexOf(b);
      if (k >= 0) return at(x + JUMP.x, y + JUMP.ys[k]);
    }
    throw new Error(`확장 보드에 없는 핀: ${name}`);
  }

  /** GPIO 번호 → [쪽, 칸 이름] */
  function column(n) {
    const label = ALIAS[n] ?? `P${n}`;
    const i = TOP.indexOf(label);
    if (i >= 0 && i < MALE) return ["top", label];
    const j = BOT.indexOf(label);
    if (j >= 0 && j < MALE) return ["bot", label];
    return null;
  }
  const nice = (n) => (ALIAS[n] ? `${ALIAS[n]}(${n})` : `P${n}`);
  /**
   * GPIO n 의 신호 핀 = 그 칸의 S 핀. opts.at: "i2c"(21 · 22 → I2C 헤더 D21 · D22) · "uart"(3 · 1 → UART 헤더 RX · TX)
   */
  function gpio(n, { at } = {}) {
    if (at === "i2c" && (n === 21 || n === 22)) return { ...pin(`i2c:${n === 21 ? "SDA" : "SCL"}`), label: `I2C D${n}` };
    if (at === "uart" && (n === 3 || n === 1)) return { ...pin(`uart:${n === 3 ? "RX" : "TX"}`), label: `UART ${n === 3 ? "RX" : "TX"}` };
    const c = column(n);
    if (!c) throw new Error(`확장 보드(38핀)에서 GPIO${n} 은 쓸 수 없어요 (플래시 핀이거나 없는 핀)`);
    return { ...pin(`${c[0]}:${c[1]}:S`), label: nice(n) };
  }
  /** GPIO n 칸의 S · V · G 세 핀 (3핀 모듈 · 서보 플러그를 그대로 꽂는다). 세로 한 기둥 */
  function triple(n) {
    const c = column(n);
    if (!c) return null;
    const at = (r) => ({ ...pin(`${c[0]}:${c[1]}:${r}`), label: `${nice(n)} ${r}` });
    return { S: at("S"), V: at("V"), G: at("G"), kind: "column", side: c[0] };
  }
  /**
   * 전원: "5V" k=0 위 줄 5V 칸의 S 핀, 1 · 2 전원 헤더 5V / "3V3" k=0 · 1 전원 헤더 3V /
   * "GND" k=0 위 줄 GND 칸 S 핀, 1 아래 줄 GND 칸 S 핀, 2~5 전원 헤더 GND. (G 줄 핀도 모두 GND)
   */
  function power(kind, k = 0) {
    if (kind === "5V") return { ...pin(k === 0 ? "top:5V:S" : `pwr:5V:${k - 1}`), label: k === 0 ? "5V" : "전원 헤더 5V" };
    if (kind === "3V3") return { ...pin(`pwr:3V:${k}`), label: "전원 헤더 3V" };
    if (kind === "GND") return { ...pin(k === 0 ? "top:GND:S" : k === 1 ? "bot:GND:S" : `pwr:GND:${k - 2}`), label: k < 2 ? "GND" : "전원 헤더 GND" };
    throw new Error(`모르는 전원: ${kind}`);
  }
  /**
   * I2C: row 0 = I2C 헤더 안쪽 줄 { GND, VCC, SDA(D21), SCL(D22) }.
   * row 1 = 아래 줄 기둥으로: SDA = P21 S, SCL = P22 S, VCC = P21 V, GND = P21 G (모듈이 둘일 때)
   */
  function i2c(row = 0) {
    if (row === 0) {
      const at = (c, label) => ({ ...pin(`i2c:${c}`), label });
      return { GND: at("GND", "I2C GND"), VCC: at("VCC", "I2C VCC"), SDA: at("SDA", "I2C D21(SDA)"), SCL: at("SCL", "I2C D22(SCL)") };
    }
    const t = triple(21);
    return { GND: t.G, VCC: t.V, SDA: { ...t.S, label: "P21(SDA)" }, SCL: { ...pin("bot:P22:S"), label: "P22(SCL)" } };
  }
  /** UART 헤더 바깥 줄 { GND, VCC, RX, TX } */
  function uart() {
    const at = (c) => ({ ...pin(`uart:${c}`), label: `UART ${c}` });
    return { GND: at("GND"), VCC: at("VCC"), RX: at("RX"), TX: at("TX") };
  }

  /* ───── 그림 ───── */
  const BOX = 18;
  /** 수 핀 칸: 색 받침 + 금색 핀 */
  const male = (px, py, fill, dim) =>
    `<g opacity="${dim ? 0.38 : 1}"><rect x="${r1(px - BOX / 2)}" y="${r1(py - BOX / 2)}" width="${BOX}" height="${BOX}" rx="2" fill="${fill}" stroke="#1d1d1f" stroke-width="0.8"/><rect x="${r1(px - 2.6)}" y="${r1(py - 2.6)}" width="5.2" height="5.2" rx="0.8" fill="#e8b93c" stroke="#7c5e10" stroke-width="0.6"/></g>`;
  /** 흰 실크 글자 (가로) */
  const silk = (px, py, t, { size = 12, anchor = "middle", dim = false, weight = 700 } = {}) =>
    `<text x="${r1(px)}" y="${r1(py)}" text-anchor="${anchor}" dominant-baseline="central" font-size="${size}" font-weight="${weight}" fill="#ffffff" stroke="#1d1d1f" stroke-width="3" paint-order="stroke" opacity="${dim ? 0.55 : 1}">${t}</text>`;
  const rect = (rx, ry, w, h, attrs) => `<rect x="${r1(x + rx)}" y="${r1(y + ry)}" width="${r1(w)}" height="${r1(h)}" ${attrs}/>`;
  const circ = (cx, cy, r, attrs) => `<circle cx="${r1(x + cx)}" cy="${r1(y + cy)}" r="${r}" ${attrs}/>`;

  // 부품 자리 (보드 왼쪽 위 기준) — 3D 기록에도 그대로
  const PARTS = {
    usbC: { x: -6, y: 64, w: 46, h: 62 },
    microUsb: { x: -6, y: 176, w: 40, h: 36 },
    dcJack: { x: -18, y: 230, w: 98, h: 68 },
    diode: { x: 6, y: 136, w: 18, h: 32 },
    smd: { x: 64, y: 156, w: 44, h: 15 },
    regulator: { x: 38, y: 180, w: 58, h: 30 },
    caps: [{ x: 122, y: 196, r: 18 }, { x: 162, y: 196, r: 18 }],
    led: { x: 66, y: 11, w: 11, h: 6 },
    holes: [{ x: 94, y: 26, r: 7.5 }, { x: 94, y: 300, r: 7 }, { x: LP + 386, y: 112, r: 7.5 }, { x: LP + 386, y: 200, r: 7.5 }],
  };

  /** note: 아래 메모 자리 "right"(기본, 오른쪽 끝 맞춤) · "left" · false(빼기) */
  function draw(used = [], { note = "right" } = {}) {
    const names = used.map((u) => (typeof u === "string" ? u : u.name));
    const usedSet = new Set(names);
    const any = names.length > 0;
    const dimPin = (n, col) => FLASH.has(col) || (any && !usedSet.has(n));
    const base = [];
    const labels = [];

    // 기판 (보라) — 오른쪽 두 모서리를 비스듬히 깎은 꼴 · 고정 구멍
    const outline = [[0, 4], [4, 0], [W - 14, 0], [W, 14], [W, H - 14], [W - 14, H], [4, H], [0, H - 4]].map(([a, b]) => `${r1(x + a)},${r1(y + b)}`).join(" ");
    base.push(`<polygon points="${outline}" fill="#5f1fa3" stroke="#2e0b52" stroke-width="1.5" data-expansion-jumper="${jumper}"/>`);
    for (const h of PARTS.holes) base.push(circ(h.x, h.y, h.r, 'fill="#ffffff" stroke="#d9c7f0" stroke-width="2"'));

    // ── 전원부 ──
    // RPW-LED (전원 LED)
    base.push(rect(PARTS.led.x, PARTS.led.y, PARTS.led.w, PARTS.led.h, 'rx="1" fill="#f8f9fa" stroke="#868e96" stroke-width="0.8"'), rect(PARTS.led.x + 3, PARTS.led.y + 1, 5, 4, 'fill="#ff8787" stroke="none"'));
    labels.push(silk(x + 8, y + 14, "RPW-LED", { anchor: "start", size: 11 }));
    // USB-C (USB5V, 전원만): 은색 통, 구멍이 왼쪽
    { const u = PARTS.usbC; base.push(rect(u.x, u.y, u.w, u.h, 'rx="6" fill="#ced4da" stroke="#868e96"'), rect(u.x + 4, u.y + 14, 9, u.h - 28, 'rx="4" fill="#343a40" stroke="none"'), rect(u.x + 22, u.y + 8, 16, 7, 'rx="2" fill="#adb5bd" stroke="none"'), rect(u.x + 22, u.y + u.h - 15, 16, 7, 'rx="2" fill="#adb5bd" stroke="none"')); }
    labels.push(silk(x + 4, y + 52, "USB5V", { anchor: "start" }));
    // 전원 헤더 2×4: 위 줄 GND 넷, 아래 줄 3V 둘 · 5V 둘 (실크 테두리)
    base.push(rect(HDR[0] - 13, PWR_Y[0] - 13, HDR[3] - HDR[0] + 26, PWR_Y[1] - PWR_Y[0] + 26, 'rx="3" fill="none" stroke="#ffffff" stroke-width="1"'));
    base.push(`<path d="M${r1(x + (HDR[1] + HDR[2]) / 2)} ${r1(y + PWR_Y[1] + 13)} v10" stroke="#ffffff" stroke-width="1"/>`);
    labels.push(silk(x + (HDR[0] + HDR[3]) / 2, y + PWR_Y[0] - 22, "GND", { dim: any && ![0, 1, 2, 3].some((k) => usedSet.has(`pwr:GND:${k}`)) }));
    labels.push(silk(x + (HDR[0] + HDR[1]) / 2, y + PWR_Y[1] + 21, "3V", { dim: any && !["pwr:3V:0", "pwr:3V:1"].some((n) => usedSet.has(n)) }));
    labels.push(silk(x + (HDR[2] + HDR[3]) / 2, y + PWR_Y[1] + 21, "5V", { dim: any && !["pwr:5V:0", "pwr:5V:1"].some((n) => usedSet.has(n)) }));
    for (let k = 0; k < 4; k++) base.push(male(x + HDR[k], y + PWR_Y[0], FILL.G, dimPin(`pwr:GND:${k}`)));
    for (let k = 0; k < 2; k++) base.push(male(x + HDR[k], y + PWR_Y[1], "#f08c00", dimPin(`pwr:3V:${k}`)));
    for (let k = 0; k < 2; k++) base.push(male(x + HDR[2 + k], y + PWR_Y[1], FILL.V, dimPin(`pwr:5V:${k}`)));
    // JUMP: V 줄 전압 고르기 (5V · V · 3.3V), 점퍼 캡
    labels.push(silk(x + JUMP.x, y + JUMP.ys[0] - 16, "JUMP"));
    ["5V", "V", "3.3V"].forEach((t, k) => labels.push(silk(x + JUMP.x + 13, y + JUMP.ys[k], t, { anchor: "start" })));
    JUMP.ys.forEach((jy) => base.push(male(x + JUMP.x, y + jy, "#212529", false)));
    {
      const [a, b] = jumper === "3V3" ? [JUMP.ys[1], JUMP.ys[2]] : [JUMP.ys[0], JUMP.ys[1]];
      base.push(rect(JUMP.x - 9.5, a - 10, 19, b - a + 20, 'rx="2.5" fill="#fab005" stroke="#a16207" stroke-width="1"'), rect(JUMP.x - 3, a - 1, 6, b - a + 2, 'rx="1.5" fill="#e67700" stroke="none"'));
    }
    // 다이오드 (SMA, 흰 띠) · SMD 다이오드
    { const d = PARTS.diode; base.push(rect(d.x, d.y, d.w, d.h, 'rx="1.5" fill="#212529" stroke="#adb5bd" stroke-width="0.8"'), rect(d.x + 2, d.y + 4, d.w - 4, 4, 'fill="#dee2e6" stroke="none"')); }
    { const d = PARTS.smd; base.push(rect(d.x - 5, d.y + 2, 6, d.h - 4, 'fill="#ced4da" stroke="none"'), rect(d.x + d.w - 1, d.y + 2, 6, d.h - 4, 'fill="#ced4da" stroke="none"'), rect(d.x, d.y, d.w, d.h, 'rx="1.5" fill="#212529" stroke="none"')); }
    // 레귤레이터 AMS1117 (SOT-223): 다리 셋 왼쪽, 넓은 탭 오른쪽
    { const g = PARTS.regulator; for (let k = 0; k < 3; k++) base.push(rect(g.x, g.y + 3 + k * 10, 12, 5, 'fill="#ced4da" stroke="none"')); base.push(rect(g.x + 44, g.y + 2, 14, g.h - 4, 'fill="#ced4da" stroke="none"'), rect(g.x + 12, g.y, 32, g.h, 'rx="1.5" fill="#212529" stroke="none"')); }
    // 전해 콘덴서 47µF 35V 둘 (은색 통, 검은 반달)
    for (const c of PARTS.caps) {
      base.push(rect(c.x - c.r - 1, c.y - c.r - 1, 2 * c.r + 2, 2 * c.r + 2, 'rx="3" fill="#343a40" stroke="none"'));
      base.push(circ(c.x, c.y, c.r - 1, 'fill="#dee2e6" stroke="#868e96" stroke-width="1"'));
      base.push(`<path d="M${r1(x + c.x + 6)} ${r1(y + c.y - c.r + 2.5)} A${c.r - 1} ${c.r - 1} 0 0 1 ${r1(x + c.x + 6)} ${r1(y + c.y + c.r - 2.5)} Z" fill="#212529" stroke="none"/>`);
      base.push(`<text x="${r1(x + c.x - 4)}" y="${r1(y + c.y)}" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="700" fill="#212529" stroke="none">47</text>`);
    }
    // 마이크로 USB (구멍 왼쪽)
    { const u = PARTS.microUsb; base.push(rect(u.x, u.y, u.w, u.h, 'rx="3" fill="#ced4da" stroke="#868e96"'), rect(u.x + 3, u.y + 9, 8, u.h - 18, 'rx="2" fill="#343a40" stroke="none"')); }
    // DC 잭 (검은 통, 구멍 왼쪽)
    { const d = PARTS.dcJack; base.push(rect(d.x, d.y, d.w, d.h, 'rx="3" fill="#1b1b1f" stroke="#000000"'), rect(d.x, d.y + 10, 30, d.h - 20, 'rx="2" fill="#2b2b31" stroke="none"'), rect(d.x + d.w - 8, d.y + 18, 12, d.h - 36, 'fill="#adb5bd" stroke="none"')); }
    labels.push(silk(x + 4, y + PARTS.dcJack.y - 9, "DC6.5-16V", { anchor: "start" }));
    // I2C / UART 헤더 2×4
    base.push(rect(HDR[0] - 13, Y.botV - 13, HDR[3] - HDR[0] + 26, Y.botS - Y.botV + 26, 'rx="3" fill="none" stroke="#ffffff" stroke-width="1"'));
    const I2C = [["GND", "GND", FILL.G], ["VCC", "VCC", FILL.V], ["SDA", "D21", FILL.S], ["SCL", "D22", FILL.SCL]];
    const UART = [["GND", "GND", FILL.G], ["VCC", "VCC", FILL.V], ["RX", "RX", "#74c0fc"], ["TX", "TX", "#74c0fc"]];
    I2C.forEach(([k, t, f], i) => {
      base.push(male(x + HDR[i], y + Y.botV, f, dimPin(`i2c:${k}`)));
      labels.push(vtext(r1(x + HDR[i]), r1(y + Y.botV - 13), t, any && !usedSet.has(`i2c:${k}`), 12));
    });
    UART.forEach(([k, t, f], i) => {
      base.push(male(x + HDR[i], y + Y.botS, f, dimPin(`uart:${k}`)));
      labels.push(vtextDown(r1(x + HDR[i]), r1(y + Y.botS + 13), t, any && !usedSet.has(`uart:${k}`), 12));
    });

    // ── 암 헤더 (DevKit 아래, 가장자리만 보인다) ──
    const fx0 = colX(0) - 13, fx1 = colX(TOP.length - 1) + 13;
    base.push(`<rect x="${r1(fx0)}" y="${r1(y + Y.topF - 15)}" width="${r1(fx1 - fx0)}" height="${r1(Y.topF2 - Y.topF + 25)}" rx="1.5" fill="#f5c518" stroke="#a16207" stroke-width="1"/>`);
    base.push(`<rect x="${r1(fx0)}" y="${r1(y + Y.botF - 10)}" width="${r1(fx1 - fx0)}" height="25" rx="1.5" fill="#f5c518" stroke="#a16207" stroke-width="1"/>`);

    // ── S/V/G 수 헤더 + 칸 이름 ──
    const sides = [["top", TOP, [Y.topS, Y.topV, Y.topG]], ["bot", BOT, [Y.botS, Y.botV, Y.botG]]];
    for (const [side, list, ys] of sides) {
      list.slice(0, MALE).forEach((n, i) => {
        const px = colX(i);
        const col = ROWS.map((r) => `${side}:${n}:${r}`);
        ROWS.forEach((r, k) => base.push(male(px, y + ys[k], FILL[r], dimPin(col[k], n))));
        const dim = FLASH.has(n) || (any && !col.some((c) => usedSet.has(c)));
        labels.push(side === "top" ? vtext(px, r1(y + Y.topS - 13), n, dim, 12) : vtextDown(px, r1(y + Y.botS + 13), n, dim, 12));
      });
      // 19번째 칸: S/V/G 글자 상자
      const lx = colX(MALE);
      base.push(`<rect x="${r1(lx - 9)}" y="${r1(y + Math.min(...ys) - 10)}" width="18" height="${r1(2 * P + 20)}" rx="2" fill="none" stroke="#ffffff" stroke-width="1"/>`);
      ROWS.forEach((r, k) => labels.push(silk(lx, y + ys[k], r, { size: 13, weight: 800 })));
    }

    // 3D 장면: 확장 보드 (핀 · 암 헤더 · 전원부 부품 mm 자리)
    {
      const pins = [];
      const add = (nm, label, fill, row) => { const p = pin(nm); pins.push({ x: p.x, y: p.y, label, fill, row, used: usedSet.has(nm) }); };
      for (const [side, list] of sides) list.slice(0, MALE).forEach((n) => ROWS.forEach((r) => add(`${side}:${n}:${r}`, `${n} ${r}`, FILL[r], r)));
      for (let k = 0; k < 4; k++) add(`pwr:GND:${k}`, "GND", FILL.G, "pwr");
      for (let k = 0; k < 2; k++) add(`pwr:3V:${k}`, "3V3", "#f08c00", "pwr");
      for (let k = 0; k < 2; k++) add(`pwr:5V:${k}`, "5V", FILL.V, "pwr");
      I2C.forEach(([k, t, f]) => add(`i2c:${k}`, t, f, "i2c"));
      UART.forEach(([k, t, f]) => add(`uart:${k}`, t, f, "uart"));
      ["5V", "V", "3V3"].forEach((k) => add(`jump:${k}`, k, "#212529", "jump"));
      const female = [
        ...TOP.map((n, i) => ({ x: colX(i), y: r1(y + Y.topF), label: n, row: "top" })),
        ...TOP.map((n, i) => ({ x: colX(i), y: r1(y + Y.topF2), label: n, row: "top-inner" })),
        ...BOT.map((n, i) => ({ x: colX(i), y: r1(y + Y.botF), label: n, row: "bot" })),
      ];
      const abs = (o) => (Array.isArray(o) ? o.map(abs) : { ...o, x: r1(x + o.x), y: r1(y + o.y) });
      rec("boards", {
        kind: "expansion", name: "ESP32 38핀 확장 보드 (Goouuu V4)", x, y, w: W, h: H, color: "#5f1fa3",
        pitch: P, mm: r1(MM * 1000) / 1000, jumper, pins, female,
        parts: Object.fromEntries(Object.entries(PARTS).map(([k, v]) => [k, abs(v)])),
        devkit: { x: DX, y: DY, scale: DK_SCALE },
      });
    }
    // ── DevKit 38핀 (devkit.mjs 그림 그대로, 줄여서 얹음) ──
    base.push(`<rect x="${r1(DX + 2 * DK_SCALE + 3)}" y="${r1(DY + 4 * DK_SCALE + 5)}" width="${r1(418 * DK_SCALE)}" height="${r1(142 * DK_SCALE)}" rx="8" fill="#000000" fill-opacity="0.3" stroke="none"/>`);
    {
      const dk = makeDevkit({ x: 0, y: 0, usbLabel: false }).draw([]);
      base.push(`<g transform="translate(${DX} ${DY}) scale(${DK_SCALE})">\n  ${dk.base}\n  ${dk.labels}\n  </g>`);
      // 3D 기록: devkit.draw 가 남긴 DevKit 기록(확장 보드 기록 다음)을 그림과 같은 자리로 옮긴다
      moveLastBoard(DX, DY, DK_SCALE, { seatedOn: "expansion", scale: DK_SCALE });
      // DevKit 의 USB-C 글자: 보라 기판 위라 흰 실크 글자로 (devkit.mjs 와 같은 자리)
      labels.push(silk(DX - 18 * DK_SCALE, DY + 75 * DK_SCALE, "USB-C", { anchor: "end" }));
    }

    if (note) {
      const nx = note === "left" ? x : x + W;
      labels.push(`<text x="${nx}" y="${y + H + 14}" text-anchor="${note === "left" ? "start" : "end"}" dominant-baseline="central" font-size="12" fill="currentColor" stroke="none">${jumper === "3V3" ? "JUMP 점퍼는 3.3V 쪽 (V 줄 = 3.3V)" : "JUMP 점퍼를 5V 쪽으로 (V 줄 = 5V, 끝나면 3.3V 로)"}</text>`);
    }

    const marks = names.map((n) => {
      const p = pin(n);
      return `<rect x="${r1(p.x - 10)}" y="${r1(p.y - 10)}" width="20" height="20" rx="3" fill="none" stroke="#ffd43b" stroke-width="2.6"/>`;
    });
    return { base: base.join("\n  "), labels: labels.join("\n  "), marks: marks.join("\n  ") };
  }

  return {
    id: "expansion",
    title: "확장 보드 (ESP32 38핀 확장 보드 + DevKit)",
    bounds: BOARD,
    /** 위 S 줄 높이 · 아래 S 줄 높이 (모듈 선이 바깥에서 들어온다) */
    topY: r1(y + Y.topS),
    bottomY: r1(y + Y.botS),
    /** 보드 위 · 아래 바깥 가로 길 (선이 지나갈 띠) */
    lane: { top: y - 22, bottom: y - 4, below: y + H + 28 },
    pin, gpio, triple, power, i2c, uart, draw,
    legend: "plus",
  };
}

/**
 * 확장 보드 S/V/G 기둥에 꽂는 서보: 플러그가 세 핀을 덮고 선 셋이 보드 가장자리 쪽(S 끝)으로 곧게 나가 서보 몸통으로.
 * t = b.triple(n). 몸통은 기둥 바로 바깥(아래쪽 기둥이면 아래, 위쪽이면 위) gap 만큼 떨어져 놓인다.
 */
export function columnServo(t, { gap = 46, title = "서보 모터", titleSide = "left" } = {}) {
  const down = t.side === "bot";
  const cx = t.S.x;
  const top = Math.min(t.G.y, t.S.y), bot = Math.max(t.G.y, t.S.y);
  const cols = { G: "#8b5a2b", V: "#e03131", S: "#f76707" };
  const edge = down ? bot + 12 : top - 12;
  const by = down ? bot + gap : top - gap - 44;
  const bx = cx - 33;
  const out = [];
  ["G", "V", "S"].forEach((k, i) => {
    const lx = cx - 7 + i * 7;
    out.push(`<path d="M${lx} ${edge} V${down ? by : by + 44}" stroke="${cols[k]}" stroke-width="4"/>`);
  });
  out.push(`<rect x="${bx - 6}" y="${by + 16}" width="78" height="12" rx="4" fill="#1971c2" stroke="currentColor"/>`);
  out.push(`<rect x="${bx}" y="${by}" width="66" height="44" rx="7" fill="#1971c2" stroke="currentColor"/>`);
  out.push(`<circle cx="${bx + 44}" cy="${by + 22}" r="12" fill="#f8f9fa" stroke="#495057"/><path d="M${bx + 44} ${by + 5} V${by + 39}" stroke="#f8f9fa" stroke-width="7"/><circle cx="${bx + 44}" cy="${by + 22}" r="3" fill="#495057" stroke="none"/>`);
  out.push(`<rect x="${cx - 11}" y="${top - 12}" width="22" height="${bot - top + 24}" rx="3" fill="#212529" stroke="#ffd43b" stroke-width="3"/>`);
  for (const k of ["G", "V", "S"]) out.push(`<rect x="${t[k].x - 4}" y="${t[k].y - 4}" width="8" height="8" rx="1" fill="${cols[k]}" stroke="none"/>`);
  if (title) {
    const tx = titleSide === "left" ? bx - 14 : bx + 86;
    out.push(`<text x="${tx}" y="${by + 22}" text-anchor="${titleSide === "left" ? "end" : "start"}" dominant-baseline="central" font-size="15" font-weight="700" fill="currentColor" stroke="none">${title}</text>`);
  }
  rec("parts", { type: "servo", x: bx, y: by, plug: [pt(t.G), pt(t.V), pt(t.S)], onBoard: true, cable: down ? "down" : "up" });
  return { svg: mark(out.join("\n  ")) };
}

