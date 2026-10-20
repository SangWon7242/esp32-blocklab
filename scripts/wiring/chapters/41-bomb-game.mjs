// 융합 F14 "바이러스 폭탄 피하기" — OLED(I2C SCL 22 · SDA 21), 풀업 버튼 a(14) · b(27), (선택) 수동 부저 + → 25번
// (ESP32 Plus 에 io15 가 없어 부저를 15번에서 25번으로 옮김).
// 두 보드 모두 브레드보드를 보드 위에 두고 버튼 · 부저를 꽂는다(11장 · 12장과 같은 꼴, 버튼은 대각선 다리 → 위 − 줄).
// Plus: OLED 는 F-F 로 I2C 묶음 첫 줄에 바로 — 선은 위 G 줄과 ESP32 사이 빈 띠로(10장 자동문과 같은 길).
// DevKit: OLED 는 보드 아래에서 F-F 로 3V3 · GND(아래 줄) · D21 · D22 에 바로(10장 자동문과 같음).
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, button, buzzer, oled } from "../parts.mjs";
import { railCol, railLink } from "./11-button-touch.mjs";

/** 풀업 버튼(11장 buttonPullup 과 같고 이름표만 더함): 다리 (col,e)(col+2,e)(col,f)(col+2,f), 신호 (col, j), 대각선 (col+2, a) → 위 − 줄 */
function namedButton(bb, col, label) {
  const btn = button(bb, col);
  const at = bb.hole(col + 1, "i");
  const tag = `<text x="${at.x}" y="${at.y}" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="700" fill="#343a40" stroke="#f1f3f5" stroke-width="4" paint-order="stroke">${label}</text>`;
  bb.tint(col, "bottom");
  bb.tint(col + 2, "top");
  const jumper = mmWire(bb.hole(col + 2, "a"), bb.rail("top", "-", railCol(col + 2)), C.black);
  return { svg: [btn.svg, tag], jumper, signalHole: bb.hole(col, "j"), cols: { sig: col, gnd: col + 2 } };
}

/** 수동 부저: + 다리 (p, f), − 다리 (p+3, f). 신호는 (p, j), − 쪽 (p+3, j) → 아래 − 줄 (12장과 같은 꼴) */
function buzzerCircuit(bb, p) {
  [p, p + 3].forEach((c) => bb.tint(c, "bottom"));
  const svg = buzzer(bb.hole(p, "f"), bb.hole(p + 3, "f")).svg;
  const at = { x: (bb.hole(p, "c").x + bb.hole(p + 3, "c").x) / 2, y: bb.hole(p, "c").y };
  const tag = `<text x="${at.x}" y="${at.y}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="#343a40" stroke="#f1f3f5" stroke-width="4" paint-order="stroke">(선택) 수동 부저</text>`;
  const jumper = mmWire(bb.hole(p + 3, "j"), bb.rail("bottom", "-", railCol(p + 3)), C.black);
  return { svg: [svg, tag], jumper, signalHole: bb.hole(p, "j"), cols: { plus: p, minus: p + 3 } };
}

/** 브레드보드 위 회로(두 보드 같은 꼴, 열 번호만 다름) */
function circuits(bb, { a, b: bc, buz }) {
  const btnA = namedButton(bb, a, "a"), btnB = namedButton(bb, bc, "b"), bz = buzzerCircuit(bb, buz);
  return { btnA, btnB, bz, svg: [...btnA.svg, ...btnB.svg, ...bz.svg], jumpers: [btnA.jumper, btnB.jumper, bz.jumper, railLink(bb)] };
}

function rowsFor(p, c, { a, b, buz }) {
  return [
    { color: C.green, part: `${a.label} 핀`, to: `${c.btnA.cols.sig}번 줄 (버튼 a 한쪽 다리)` },
    { color: C.yellow, part: `${b.label} 핀`, to: `${c.btnB.cols.sig}번 줄 (버튼 b 한쪽 다리)` },
    { color: C.black, part: `버튼 대각선 다리 ${c.btnA.cols.gnd} · ${c.btnB.cols.gnd}번 줄`, to: "위 − 줄" },
    { color: C.orange, part: `(선택) ${buz.label} 핀`, to: `${c.bz.cols.plus}번 줄 수동 부저 + 다리 (− 다리 ${c.bz.cols.minus}번 줄 → 아래 − 줄)` },
    { color: C.black, part: `${p.gnd.label} 핀`, to: "아래 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" },
  ];
}

/* ───── ESP32 Plus ───── */
function plus() {
  const bb = breadboard({ x: 72, y: 8, cols: 26, rails: { top: true, bottom: true } });
  const b = makePlus({ x: 60, y: bb.y + bb.h + 24 });
  const c = circuits(bb, { a: 13, b: 17, buz: 22 });
  const p = { a: b.gpio(14), b: b.gpio(27), buz: b.gpio(25), gnd: b.power("GND") };
  const wires = [
    mfWire(p.a, c.btnA.signalHole, C.green), mfWire(p.b, c.btnB.signalHole, C.yellow), mfWire(p.buz, c.bz.signalHole, C.orange),
    mfWire(p.gnd, bb.rail("bottom", "-", railCol(bb.nearestCol(p.gnd.x, true))), C.black),
    ...c.jumpers,
  ];
  const used = [p.a, p.b, p.buz, p.gnd];

  // OLED: 보드 오른쪽 아래, 핀이 위로. 선은 빈 띠를 지나 I2C 묶음 첫 줄로 (10장과 같은 길)
  const o = oled(514, b.bounds.y + 162, { titleAt: { x: 568, y: b.bounds.y + 290 } });
  const bus = b.i2c(0);
  const lane = { GND: b.lane.top + 3, VCC: b.lane.top + 8, SDA: b.lane.top + 13, SCL: b.lane.top + 18 };
  const via = (k) => [{ x: o.pins[k].x, y: lane[k] }, { x: bus[k].x, y: lane[k] }];
  wires.push(ffWire(o.pins.GND, bus.GND, C.black, via("GND"), "orth"), ffWire(o.pins.VCC, bus.VCC, C.red, via("VCC"), "orth"), ffWire(o.pins.SDA, bus.SDA, C.blue, via("SDA"), "orth"), ffWire(o.pins.SCL, bus.SCL, C.purple, via("SCL"), "orth"));
  used.push(bus.GND, bus.VCC, bus.SDA, bus.SCL);

  const rows = [
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C GND · 5V (보드에 바로)" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C SDA · SCL (보드에 바로)" },
    ...rowsFor(p, c, p),
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 20, "이렇게 꽂아요 — OLED 는 보드에 바로, 버튼 · 부저는 브레드보드에", rows, "plus");
  return { body: compose(b.draw(used), [bb.svg, ...c.svg, o.svg], wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  const bb = breadboard({ x: 72, y: 8, cols: 26, rails: { top: true, bottom: true } });
  const b = makeDevkit({ x: 95, y: bb.y + bb.h + 24 });
  const c = circuits(bb, { a: 7, b: 11, buz: 16 });
  const p = { a: b.gpio(14), b: b.gpio(27), buz: b.gpio(25), gnd: b.power("GND", 0) };
  const wires = [
    mfWire(p.a, c.btnA.signalHole, C.green), mfWire(p.b, c.btnB.signalHole, C.yellow), mfWire(p.buz, c.bz.signalHole, C.orange),
    mfWire(p.gnd, bb.rail("bottom", "-", railCol(bb.nearestCol(p.gnd.x, true))), C.black),
    ...c.jumpers,
  ];
  const used = [p.a, p.b, p.buz, p.gnd];

  // OLED: 보드 아래, 핀이 위로. VCC → 3V3, GND → 아래 줄 GND, SDA → D21, SCL → D22 (10장 자동문과 같음)
  const bot = b.bounds.y + b.bounds.h;
  const o = oled(10, bot + 74, { titleAt: { x: 64, y: bot + 202 } });
  const v33 = b.power("3V3"), gndBot = b.power("GND", 1), sda = b.gpio(21), scl = b.gpio(22);
  wires.push(ffWire(o.pins.VCC, v33, C.red, [{ x: o.pins.VCC.x, y: bot + 22 }, { x: v33.x, y: bot + 22 }], "orth"));
  wires.push(ffWire(o.pins.GND, gndBot, C.black, [{ x: o.pins.GND.x, y: bot + 14 }, { x: gndBot.x, y: bot + 14 }], "orth"));
  wires.push(ffWire(o.pins.SDA, sda, C.blue, [{ x: o.pins.SDA.x, y: bot + 46 }, { x: sda.x, y: bot + 46 }], "orth"));
  wires.push(ffWire(o.pins.SCL, scl, C.purple, [{ x: o.pins.SCL.x, y: bot + 54 }, { x: scl.x, y: bot + 54 }], "orth"));
  used.push(v33, gndBot, sda, scl);

  const rows = [
    { colors: [C.red, C.black], part: "OLED VCC · GND", to: "3V3 · GND (아래 줄에 바로)" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "D21 · D22 (보드에 바로)" },
    ...rowsFor(p, c, p),
  ];
  const table = connectionTable(bot + 230, "이렇게 꽂아요 — OLED 는 보드에 바로, 버튼 · 부저는 브레드보드에", rows, "devkit");
  return { body: compose(b.draw(used), [bb.svg, ...c.svg, o.svg], wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "바이러스 폭탄 피하기 배선도(ESP32 Plus 확장 보드): OLED 화면 GND · VCC · SDA · SCL 은 보드 I2C 묶음 첫 줄의 GND · 5V · SDA · SCL 에 F-F 듀폰선으로 바로. 브레드보드는 보드 위: 버튼 a 는 가운데 홈에 걸쳐 13 · 15번 줄, 보드 위쪽 io14 → 13번 줄, 대각선 다리 15번 줄 → 위 − 줄. 버튼 b 는 17 · 19번 줄, io27 → 17번 줄, 대각선 다리 19번 줄 → 위 − 줄. (선택) 수동 부저 + 다리 22번 줄 ← io25, − 다리 25번 줄 → 아래 − 줄. 보드 GND → 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 바이러스 폭탄 피하기 배선도: OLED 화면 VCC → 3V3, GND → GND(아래 줄), SDA → D21, SCL → D22 에 F-F 듀폰선으로 바로. 브레드보드는 보드 위: 버튼 a 는 가운데 홈에 걸쳐 7 · 9번 줄, D14 → 7번 줄, 대각선 다리 9번 줄 → 위 − 줄. 버튼 b 는 11 · 13번 줄, D27 → 11번 줄, 대각선 다리 13번 줄 → 위 − 줄. (선택) 수동 부저 + 다리 16번 줄 ← D25, − 다리 19번 줄 → 아래 − 줄. 보드 GND → 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wbg", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wbgk", T.devkit, r.body, r.height); },
  },
};
