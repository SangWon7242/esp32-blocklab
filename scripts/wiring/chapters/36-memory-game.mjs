// 융합 F9 "기억력 게임기" — OLED(I2C 21 · 22), 시작 버튼(14, 풀업), 호일 터치 패드 a · b · c (32 · 33 · 27).
// 버튼은 작은 브레드보드에 가운데 홈을 건너 꽂는다: 신호 = 오른쪽 아래 다리 줄(j 칸에서 위로),
//   접지 = 대각선 왼쪽 위 다리 줄 — 접지 선은 열과 열 사이 빈 길로 올라가 c 칸에 꽂는다 (구멍 위를 지나지 않게).
// 터치 패드는 선 끝(핀 쪽)을 악어 클립으로 호일에. Plus: OLED 는 I2C 묶음에 바로, a · b 는 아래 줄 io32 · io33, c 는 위 줄 io27.
// DevKit: OLED 는 3V3 · GND · D21 · D22 에 바로, 패드 셋은 위 줄 D27 · D33 · D32 에서 보드 위로.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, note, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, button, oled } from "../parts.mjs";
import { alley } from "./35-random-hammer.mjs";

/**
 * 호일 터치 패드 + 악어 클립. 클립 입(선 끝)이 (x, y). 호일은 클립 위(side "up") 또는 아래("down").
 * 호일 가운데에 패드 이름(a · b · c)을 크게.
 */
export function foilPad(x, y, label, { side = "up" } = {}) {
  const w = 84, h = 52;
  const fy = side === "up" ? y - 22 - h : y + 22;
  const fx = x - w / 2;
  const clipPath = side === "up"
    ? `M${x - 7} ${y - 2} l-4 -22 h22 l-4 22 z`
    : `M${x - 7} ${y + 2} l-4 22 h22 l-4 -22 z`;
  const svg = [
    `<path d="M${fx} ${fy + 6} l20 -6 l22 5 l24 -4 l18 5 l-2 ${h - 8} l-20 4 l-22 -5 l-22 4 l-18 -3 z" fill="#ced4da" stroke="#868e96" stroke-width="2"/>`,
    `<path d="M${fx + 10} ${fy + 14} l16 4 M${fx + 52} ${fy + h - 12} l20 -3" stroke="#f8f9fa" stroke-width="2"/>`,
    `<text x="${x}" y="${fy + h / 2 + 1}" text-anchor="middle" dominant-baseline="central" font-size="24" font-weight="700" fill="#343a40" stroke="none">${label}</text>`,
    `<path d="${clipPath}" fill="#e03131" stroke="#a61e1e" stroke-width="1.5"/>`,
  ];
  return { svg, clip: { x, y } };
}

/**
 * 풀업 버튼(대각선): 다리 (c,e)(c+2,e)(c,f)(c+2,f). 신호 = (c+2, j) 아래에서, 접지 = (c, e) 줄 — 접지 선은
 * c-1 · c 열 사이 빈 길로 올라가 (c, "c") 에 꽂힌다. 반환 { svg, sigHole, gndHole, gndAlley, cols }
 */
export function buttonCross(bb, c) {
  const b = button(bb, c);
  bb.tint(c, "top");
  bb.tint(c + 2, "bottom");
  return { svg: b.svg, sigHole: bb.hole(c + 2, "j"), gndHole: bb.hole(c, "c"), gndAlley: alley(bb, c - 1), cols: { gnd: c, sig: c + 2 } };
}

/** 아래에서 빈 길(alleyX)로 올라와 구멍 hole 에 옆으로 꽂는 길 (from 은 보드 핀): 세로 → trackY 에서 가로 → 빈 길로 세로 → 옆으로 */
export const viaAlley = (from, hole, alleyX, trackY) => [{ x: from.x, y: trackY }, { x: alleyX, y: trackY }, { x: alleyX, y: hole.y }];

/* ───── ESP32 Plus ───── */
function plus() {
  const PADS_H = 104;
  const bb = breadboard({ x: 248, y: 8, cols: 6, rails: { top: false, bottom: false } });
  const b = makePlus({ x: 96, y: bb.y + bb.h + 30 });
  const parts = [], wires = [], used = [];
  const mid = bb.y + bb.h + 14;

  // 버튼: 다리 4 · 6번 줄. io14 → (6, j), 위 GND → 빈 길로 (4, c)
  const btn = buttonCross(bb, 4);
  const p14 = b.gpio(14), gnd = b.power("GND");
  wires.push(mfWire(p14, btn.sigHole, C.green));
  wires.push(mfWire(gnd, btn.gndHole, C.black, viaAlley(gnd, btn.gndHole, btn.gndAlley, mid), "orth"));
  used.push(p14, gnd);

  // OLED: 보드 오른쪽 → 빈 띠 → I2C 묶음 첫 줄 (10장 자동문과 같은 길)
  const o = oled(528, b.lane.bottom + 18, { titleAt: { x: 582, y: b.lane.bottom + 148 } });
  const bus = b.i2c(0);
  const lane = { GND: b.lane.top + 3, VCC: b.lane.top + 8, SDA: b.lane.top + 13, SCL: b.lane.top + 18 };
  const via = (k) => [{ x: o.pins[k].x, y: lane[k] }, { x: bus[k].x, y: lane[k] }];
  wires.push(ffWire(o.pins.GND, bus.GND, C.black, via("GND"), "orth"), ffWire(o.pins.VCC, bus.VCC, C.red, via("VCC"), "orth"), ffWire(o.pins.SDA, bus.SDA, C.blue, via("SDA"), "orth"), ffWire(o.pins.SCL, bus.SCL, C.purple, via("SCL"), "orth"));
  used.push(bus.GND, bus.VCC, bus.SDA, bus.SCL);

  // 패드 c: 위 줄 io27 → 브레드보드 오른쪽으로 돌아 위로
  const p27 = b.gpio(27);
  const padC = foilPad(470, 120, "c");
  wires.push(mfWire(p27, padC.clip, C.orange, [{ x: p27.x, y: mid }, { x: padC.clip.x, y: mid }], "orth"));
  // 패드 a · b: 아래 줄 io32 · io33 → 보드 아래
  const p32 = b.gpio(32, { at: "bottom" }), p33 = b.gpio(33, { at: "bottom" });
  const padY = b.bounds.y + b.bounds.h + 30;
  const padA = foilPad(310, padY, "a", { side: "down" }), padB = foilPad(470, padY, "b", { side: "down" });
  wires.push(mfWire(p32, padA.clip, C.yellow), mfWire(p33, padB.clip, C.teal));
  used.push(p27, p32, p33);

  parts.push(bb.svg, btn.svg, o.svg, ...padC.svg, ...padA.svg, ...padB.svg);
  const rows = [
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C 묶음 GND · 5V" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C 묶음 SDA · SCL" },
    { color: C.green, part: "io14", to: "6번 줄 (버튼 한쪽 다리)" },
    { color: C.black, part: "GND (위 한 줄)", to: "4번 줄 (버튼 대각선 다리)" },
    { color: C.yellow, part: "io32 (아래 줄)", to: "악어 클립 → 호일 패드 a" },
    { color: C.teal, part: "io33 (아래 줄)", to: "악어 클립 → 호일 패드 b" },
    { color: C.orange, part: "io27 (위 한 줄)", to: "악어 클립 → 호일 패드 c" },
  ];
  const table = connectionTable(padY + 22 + PADS_H - 30, "이렇게 꽂아요 — OLED 는 보드에 바로, 버튼은 브레드보드, 패드는 악어 클립", rows, "plus", { columns: 1 });
  return { body: compose(b.draw(used), parts, wires, [table.svg, note(bb.x - 10, bb.y + 40, "버튼", "end", 14)]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  // 패드 셋은 맨 위, 그 아래 브레드보드(왼쪽), 그 아래 보드
  const padTop = 100;
  const bb = breadboard({ x: 156, y: padTop + 12, cols: 5, rails: { top: false, bottom: false } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 34 });
  const parts = [], wires = [], used = [];
  const mid = bb.y + bb.h + 17;

  // 버튼: 다리 2 · 4번 줄. D14 → (4, j), GND(위 줄) → 1 · 2번 열 사이 빈 길로 (2, c)
  const btn = buttonCross(bb, 2);
  const d14 = b.gpio(14), gnd = b.power("GND", 0);
  wires.push(mfWire(d14, btn.sigHole, C.green));
  wires.push(mfWire(gnd, btn.gndHole, C.black, viaAlley(gnd, btn.gndHole, btn.gndAlley, mid), "orth"));
  used.push(d14, gnd);

  // 패드 c · b · a ← D27 · D33 · D32 (보드 위, 서로 엇갈리지 않게)
  const d27 = b.gpio(27), d33 = b.gpio(33), d32 = b.gpio(32);
  const padC = foilPad(306, padTop, "c"), padB = foilPad(420, padTop, "b"), padA = foilPad(540, padTop, "a");
  wires.push(mfWire(d27, padC.clip, C.orange, [{ x: d27.x, y: mid - 6 }, { x: padC.clip.x, y: mid - 6 }], "orth"));
  wires.push(mfWire(d33, padB.clip, C.teal, [{ x: d33.x, y: padTop + 40 }, { x: padB.clip.x, y: padTop + 40 }], "orth"));
  wires.push(mfWire(d32, padA.clip, C.yellow, [{ x: d32.x, y: padTop + 60 }, { x: padA.clip.x, y: padTop + 60 }], "orth"));
  used.push(d27, d33, d32);

  // OLED: 보드 아래. VCC → 3V3, GND → GND(아래 줄), SDA → D21, SCL → D22
  const underB = b.bounds.y + b.bounds.h + 12, oY = underB + 64;
  const o = oled(20, oY, { titleAt: { x: 74, y: oY + 128 } });
  const v33 = b.power("3V3"), gBot = b.power("GND", 1), sda = b.gpio(21), scl = b.gpio(22);
  const lv = (k) => underB + 8 + k * 8;
  wires.push(ffWire(o.pins.VCC, v33, C.red, [{ x: o.pins.VCC.x, y: lv(1) }, { x: v33.x, y: lv(1) }], "orth"));
  wires.push(ffWire(o.pins.GND, gBot, C.black, [{ x: o.pins.GND.x, y: lv(0) }, { x: gBot.x, y: lv(0) }], "orth"));
  wires.push(ffWire(o.pins.SDA, sda, C.blue, [{ x: o.pins.SDA.x, y: lv(3) }, { x: sda.x, y: lv(3) }], "orth"));
  wires.push(ffWire(o.pins.SCL, scl, C.purple, [{ x: o.pins.SCL.x, y: lv(4) }, { x: scl.x, y: lv(4) }], "orth"));
  used.push(v33, gBot, sda, scl);

  parts.push(bb.svg, btn.svg, o.svg, ...padC.svg, ...padB.svg, ...padA.svg);
  const rows = [
    { colors: [C.red, C.black], part: "OLED VCC · GND", to: "3V3 · GND" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "D21 · D22" },
    { color: C.green, part: "D14", to: "4번 줄 (버튼 한쪽 다리)" },
    { color: C.black, part: "GND (위 줄)", to: "2번 줄 (버튼 대각선 다리)" },
    { color: C.yellow, part: "D32", to: "악어 클립 → 호일 패드 a" },
    { color: C.teal, part: "D33", to: "악어 클립 → 호일 패드 b" },
    { color: C.orange, part: "D27", to: "악어 클립 → 호일 패드 c" },
  ];
  const table = connectionTable(oY + 150, "이렇게 꽂아요 — OLED 는 보드에 바로, 버튼은 브레드보드, 패드는 악어 클립", rows, "devkit", { columns: 1 });
  return { body: compose(b.draw(used), parts, wires, [table.svg, note(bb.x - 10, bb.y + 40, "버튼", "end", 14)]), height: table.bottom };
}

const T = {
  plus: "기억력 게임기 배선도(ESP32 Plus 확장 보드): OLED 화면 GND · VCC · SDA · SCL 은 I2C 묶음 GND · 5V · SDA · SCL 에 F-F 듀폰선으로 바로. 버튼은 브레드보드 가운데 홈에 걸쳐 4 · 6번 줄에 꽂고, 보드 위쪽 io14 → 6번 줄(버튼 한쪽 다리), 위쪽 GND → 4번 줄(대각선 다리). 호일 패드 a 는 아래 줄 io32, b 는 아래 줄 io33, c 는 위쪽 io27 에 꽂은 M-F 듀폰선 끝을 악어 클립으로",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 기억력 게임기 배선도: OLED 화면 VCC → 3V3, GND → GND, SDA → D21, SCL → D22 에 F-F 듀폰선으로 바로. 버튼은 브레드보드 가운데 홈에 걸쳐 2 · 4번 줄에 꽂고, D14 → 4번 줄(버튼 한쪽 다리), GND → 2번 줄(대각선 다리). 호일 패드 a 는 D32, b 는 D33, c 는 D27 에 꽂은 M-F 듀폰선 끝을 악어 클립으로",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wmg", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wmgk", T.devkit, r.body, r.height); },
  },
};
