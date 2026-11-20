// 융합 F15 "달리는 디콘" — 풀업 버튼(14번, 인터럽트) + OLED(I2C: SCL 22 · SDA 21).
// 추가 미션(선택): 수동 부저 + → 25번(ESP32 Plus 에 io15 가 없어 15번에서 옮김), 가변저항 가운데 → 39번(양 끝 3V3 · GND).
// ESP32 Plus: OLED 는 21장처럼 I2C 묶음 첫 줄에 F-F 로 바로. 3V3 · GND · io39 가 모두 아래 줄이라 브레드보드는 보드 아래.
//   위 줄의 io14 · io25 두 선만 보드 왼쪽 바깥 길로 돌아 내려온다. 신호선은 + − 줄에 구멍이 없는 열(6 · 12 · 24)로 내려 꽂는다.
// DevKit: 브레드보드는 보드 위(D14 · D25 · VN 이 위 줄). OLED 는 보드 아래 — GND · SDA · SCL 은 보드에 바로,
//   VCC 는 3V3 을 나눠 써야 해서 + 줄로(보드 바깥 길). 3V3 은 + 줄에 아래에서 꽂는다.
// 확장 보드: P14 · P25 · SVN(39) · GND 칸이 모두 위 줄이라 브레드보드는 보드 위. 신호는 + − 줄에 구멍이 없는 6 · 12 · 18번 열로.
//   + 줄(3.3V)은 왼쪽 위 전원 헤더 3V 핀에서 (GND 핀 사이 틈으로 올라간다). OLED 는 I2C 헤더(41장과 같은 꼴).
//   맨 부품과 OLED 뿐이라 점퍼는 평소 자리(3.3V).
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, svgDoc, wire } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { breadboard, buzzer, oled, potentiometer } from "../parts.mjs";
import { buttonPullup, railCol, railLink } from "./11-button-touch.mjs";
import { button } from "../parts.mjs";

/** 브레드보드 위 부품 이름 (구멍 위에서도 읽히게 옅은 테두리, 어두운 화면에서도 같은 색) */
const tag = (x, y, s) =>
  `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="#343a40" stroke="#f1f3f5" stroke-width="4" paint-order="stroke">${s}</text>`;

/** 풀업 버튼(신호가 위에서 오는 꼴): 신호 (col, a) ← 핀, 대각선 다리 (col+2, j) → 아래 − 줄 */
function buttonFromTop(bb, col) {
  const b = button(bb, col);
  bb.tint(col, "top");
  bb.tint(col + 2, "bottom");
  const jumper = mmWire(bb.hole(col + 2, "j"), bb.rail("bottom", "-", railCol(col + 2)), C.black);
  return { svg: [b.svg], jumper, signalHole: bb.hole(col, "a"), cols: { sig: col, gnd: col + 2 } };
}

/* ───── ESP32 Plus ───── */
function plus() {
  const b = makePlus({ x: 96, y: 40 });
  const bot = b.bounds.y + b.bounds.h;
  const bb = breadboard({ x: 96, y: bot + 34, cols: 26, rails: { top: true, bottom: true } });
  const parts = [], wires = [], used = [];
  const rail = (s, c) => bb.rail("top", s, c);

  // OLED: 21장과 같은 자리 — 보드 오른쪽, I2C 묶음 첫 줄(빈 띠로 네 선)
  const o = oled(528, b.bounds.y + 162);
  const bus = b.i2c(0);
  const lane = { GND: b.lane.top + 3, VCC: b.lane.top + 8, SDA: b.lane.top + 13, SCL: b.lane.top + 18 };
  const via = (k) => [{ x: o.pins[k].x, y: lane[k] }, { x: bus[k].x, y: lane[k] }];
  wires.push(ffWire(o.pins.GND, bus.GND, C.black, via("GND"), "orth"), ffWire(o.pins.VCC, bus.VCC, C.red, via("VCC"), "orth"));
  wires.push(ffWire(o.pins.SDA, bus.SDA, C.blue, via("SDA"), "orth"), ffWire(o.pins.SCL, bus.SCL, C.purple, via("SCL"), "orth"));
  used.push(bus.GND, bus.VCC, bus.SDA, bus.SCL);

  // 3V3 → 위 + 줄(바로 아래), GND → 위 − 줄 (열 사이로 내려와 + 줄 구멍을 피한다)
  const v33 = b.power("3V3"), gnd = b.power("GND", 1);
  const pIn = rail("+", bb.nearestCol(v33.x, true)), mIn = rail("-", 16);
  wires.push(mfWire(v33, pIn, C.red));
  wires.push(mfWire(gnd, mIn, C.black, [{ x: gnd.x, y: mIn.y - 8 }, { x: mIn.x, y: mIn.y - 8 }], "orth"));
  used.push(v33, gnd);

  // 버튼: 12 · 14번 줄, io14 → 12번 줄 a, 대각선 14번 줄 j → 아래 − 줄 (위 − ↔ 아래 − 점퍼)
  const btn = buttonFromTop(bb, 12);
  // 수동 부저(선택): + 6번 줄, − 8번 줄 → 위 − 줄
  [6, 8].forEach((c) => bb.tint(c, "top"));
  const bz = buzzer(bb.hole(6, "e"), bb.hole(8, "e"), { up: false });
  wires.push(mmWire(bb.hole(8, "a"), rail("-", 8), C.black));
  // 가변저항(선택): 23 · 24 · 25번 줄, 가운데 24 ← io39, 23 → − 줄, 25 → + 줄
  [23, 24, 25].forEach((c) => bb.tint(c, "top"));
  const pot = potentiometer(bb.hole(23, "e"), bb.hole(24, "e"), bb.hole(25, "e"), { up: false, lift: 32 });
  const k39 = b.gpio(39);
  wires.push(mfWire(k39, bb.hole(24, "a"), C.green));
  wires.push(mmWire(bb.hole(23, "b"), rail("-", 23), C.black));
  wires.push(mmWire(bb.hole(25, "b"), rail("+", 26), C.red, [], "line"));
  used.push(k39);

  // io14 · io25: 위로 나가 보드 왼쪽 바깥 길로 돌아 버튼 · 부저 줄 a 칸에 (io25 가 바깥쪽)
  const s14 = b.gpio(14), s25 = b.gpio(25);
  const t14 = btn.signalHole, t25 = bb.hole(6, "a");
  wires.push(mfWire(s14, t14, C.yellow, [{ x: s14.x, y: 26 }, { x: 52, y: 26 }, { x: 52, y: bot + 12 }, { x: t14.x, y: bot + 12 }], "orth"));
  wires.push(mfWire(s25, t25, C.orange, [{ x: s25.x, y: 14 }, { x: 40, y: 14 }, { x: 40, y: bot + 22 }, { x: t25.x, y: bot + 22 }], "orth"));
  used.push(s14, s25);
  wires.push(btn.jumper, railLink(bb));

  parts.push(bb.svg, ...btn.svg, bz.svg, pot.svg, o.svg);
  const yName = bb.hole(1, "i").y;
  parts.push(tag(bb.hole(6, "a").x, yName, "수동 부저(선택)"));
  parts.push(tag(bb.hole(12, "a").x, yName, "버튼"));
  parts.push(tag(bb.hole(24, "a").x, yName, "가변저항(선택)"));

  const rows = [
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C GND · 5V" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C SDA · SCL" },
    { colors: [C.red, C.black], part: "3V3 · GND (아래 줄)", to: "위 + 줄 · 위 − 줄" },
    { color: C.yellow, part: "io14 (위 줄)", to: "12번 줄 버튼 한쪽 다리" },
    { color: C.black, part: "버튼 대각선 다리 14번 줄", to: "아래 − 줄 (위 − 줄 ↔ 아래 − 줄 점퍼)" },
    { color: C.orange, part: "(선택) io25 (위 줄)", to: "6번 줄 부저 + 다리, − 다리 8번 줄 → − 줄" },
    { color: C.green, part: "(선택) io39 (아래 줄)", to: "24번 줄 가변저항 가운데 다리" },
    { colors: [C.red, C.black], part: "(선택) 가변저항 25 · 23번 줄", to: "+ 줄 · − 줄" },
  ];
  const table = connectionTable(bb.y + bb.h + 16, "이렇게 꽂아요 — OLED 는 보드에 바로, 버튼 · 부저 · 가변저항은 브레드보드에", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit 38핀) ───── */
function devkit() {
  const bb = breadboard({ x: 96, y: 8, cols: 26, rails: { top: true, bottom: true } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 30 });
  const top = b.bounds.y, bot = b.bounds.y + b.bounds.h;
  const parts = [], wires = [], used = [];
  const rail = (s, c) => bb.rail("bottom", s, c);

  // 버튼: 8 · 10번 줄 (11장과 같은 꼴) — D14 → 8번 줄 j, 대각선 10번 줄 a → 위 − 줄
  const btn = buttonPullup(bb, 8);
  const d14 = b.gpio(14);
  wires.push(mfWire(d14, btn.signalHole, C.yellow), btn.jumper, railLink(bb));
  // 수동 부저(선택): + 12번 줄 ← D25, − 14번 줄 → 아래 − 줄
  [12, 14].forEach((c) => bb.tint(c, "bottom"));
  const bz = buzzer(bb.hole(12, "f"), bb.hole(14, "f"));
  const d25 = b.gpio(25);
  wires.push(mfWire(d25, bb.hole(12, "j"), C.orange), mmWire(bb.hole(14, "j"), rail("-", 14), C.black));
  // 가변저항(선택): 18 · 19 · 20번 줄, 가운데 19 ← VN(39), 18 → + 줄, 20 → − 줄 (13장과 같은 꼴)
  [18, 19, 20].forEach((c) => bb.tint(c, "bottom"));
  const pot = potentiometer(bb.hole(18, "f"), bb.hole(19, "f"), bb.hole(20, "f"));
  const vn = b.gpio(39);
  wires.push(mfWire(vn, bb.hole(19, "j"), C.green));
  wires.push(mmWire(bb.hole(18, "j"), rail("+", 17), C.red, [], "line"), mmWire(bb.hole(20, "j"), rail("-", 21), C.black, [], "line"));
  used.push(d14, d25, vn);

  // GND(위 줄) → 아래 − 줄: 3 · 4번 열 사이로 올라가 + 줄 구멍을 피한다
  const gTop = b.power("GND", 0), mIn = rail("-", 4);
  wires.push(mfWire(gTop, mIn, C.black, [{ x: gTop.x, y: mIn.y + 8 }, { x: mIn.x, y: mIn.y + 8 }], "orth"));
  // 3V3(위 줄 끝) → 보드 왼쪽 바깥 길 → 보드와 브레드보드 사이 → + 줄 2번 칸에 아래에서
  const v33 = b.power("3V3"), pIn = rail("+", 2), gapY = top - 12;
  wires.push(mfWire(v33, pIn, C.red, [{ x: v33.x, y: bot + 10 }, { x: 44, y: bot + 10 }, { x: 44, y: gapY }, { x: pIn.x, y: gapY }], "orth"));
  used.push(gTop, v33);

  // OLED: 보드 아래, 핀이 위로. GND → 아래 줄 GND 바로, SDA → D21, SCL → D22, VCC → 보드 바깥 길로 + 줄 1번 칸
  const gBot = b.power("GND", 1), sda = b.gpio(21), scl = b.gpio(22);
  const o = oled(gBot.x - 24, bot + 62, { titleAt: { x: gBot.x - 36, y: bot + 118, anchor: "end" } });
  wires.push(ffWire(o.pins.GND, gBot, C.black));
  wires.push(ffWire(o.pins.SDA, sda, C.blue, [{ x: o.pins.SDA.x, y: bot + 30 }, { x: sda.x, y: bot + 30 }], "orth"));
  wires.push(ffWire(o.pins.SCL, scl, C.purple, [{ x: o.pins.SCL.x, y: bot + 38 }, { x: scl.x, y: bot + 38 }], "orth"));
  const pOled = rail("+", 1);
  wires.push(wire(o.pins.VCC, pOled, C.red, { via: [{ x: o.pins.VCC.x, y: bot + 22 }, { x: 28, y: bot + 22 }, { x: 28, y: pOled.y }], style: "orth", ends: ["f", "m"] }));
  used.push(gBot, sda, scl);

  parts.push(bb.svg, ...btn.svg, bz.svg, pot.svg, o.svg);
  parts.push(tag(bb.hole(6, "a").x + 8, bb.hole(1, "b").y, "버튼"));
  parts.push(tag(bb.hole(13, "a").x, bb.hole(1, "c").y, "수동 부저(선택)"));
  parts.push(tag(bb.hole(20, "a").x + 4, bb.hole(1, "b").y, "가변저항(선택)"));

  const rows = [
    { colors: [C.red, C.black], part: "3V3 (위 줄 끝) · GND (위 줄)", to: "+ 줄 · − 줄 (위 − 줄 ↔ 아래 − 줄 점퍼)" },
    { color: C.yellow, part: "D14", to: "8번 줄 버튼 한쪽 다리, 대각선 10번 줄 → 위 − 줄" },
    { colors: [C.black, C.blue, C.purple], part: "OLED GND · SDA · SCL", to: "GND · D21 · D22 (아래 줄, 바로)" },
    { color: C.red, part: "OLED VCC", to: "+ 줄 (보드 바깥으로 돌아서)" },
    { color: C.orange, part: "(선택) D25", to: "12번 줄 부저 + 다리, − 다리 14번 줄 → − 줄" },
    { color: C.green, part: "(선택) VN(39)", to: "19번 줄 가변저항 가운데 다리" },
    { colors: [C.red, C.black], part: "(선택) 가변저항 18 · 20번 줄", to: "+ 줄 · − 줄" },
  ];
  const table = connectionTable(o.pins.GND.y + 112 + 30, "이렇게 꽂아요 — 3V3 · GND 는 + − 줄로 나눠 써요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 확장 보드(38핀 확장 보드 + DevKit), 점퍼 3.3V ───── */
function expansion() {
  const bb = breadboard({ x: 100, y: 8, cols: 26, rails: { top: true, bottom: true } });
  const b = makeExpansion({ x: 22, y: bb.y + bb.h + 64, jumper: "3V3" });
  const top = b.bounds.y, bot = top + b.bounds.h;
  const parts = [], wires = [], used = [];
  const rail = (s, c) => bb.rail("bottom", s, c);

  // 버튼: 6 · 8번 줄 — P14 → 6번 줄 j, 대각선 8번 줄 a → 위 − 줄 (11장과 같은 꼴)
  const btn = buttonPullup(bb, 6);
  wires.push(btn.jumper, railLink(bb));
  // 수동 부저(선택): + 12번 줄 ← P25, − 14번 줄 → 아래 − 줄
  [12, 14].forEach((c) => bb.tint(c, "bottom"));
  const bz = buzzer(bb.hole(12, "f"), bb.hole(14, "f"));
  wires.push(mmWire(bb.hole(14, "j"), rail("-", 14), C.black));
  // 가변저항(선택): 17 · 18 · 19번 줄, 가운데 18 ← SVN(39), 17 → + 줄, 19 → − 줄
  [17, 18, 19].forEach((c) => bb.tint(c, "bottom"));
  const pot = potentiometer(bb.hole(17, "f"), bb.hole(18, "f"), bb.hole(19, "f"));
  wires.push(mmWire(bb.hole(17, "j"), rail("+", 16), C.red, [], "line"), mmWire(bb.hole(19, "j"), rail("-", 20), C.black, [], "line"));

  // 위 줄 칸 → 보드 위 가로 길 → 브레드보드 (왼쪽 선일수록 보드에 가깝게, 서로 건너지 않는다)
  const lane = (k) => top - 12 - k * 9;
  const go = (pin, hole, color, k) => mfWire(pin, hole, color, [{ x: pin.x, y: lane(k) }, { x: hole.x, y: lane(k) }], "orth");
  const p = { btn: b.gpio(14), buz: b.gpio(25), pot: b.gpio(39), gnd: b.power("GND") };
  // GND → 아래 − 줄 4번 칸: 3 · 4번 열 사이로 올라가 + 줄 구멍을 피한다
  const gIn = rail("-", 4), gapX = (bb.hole(3, "a").x + gIn.x) / 2;
  wires.push(mfWire(p.gnd, gIn, C.black, [{ x: p.gnd.x, y: lane(0) }, { x: gapX, y: lane(0) }, { x: gapX, y: gIn.y + 8 }, { x: gIn.x, y: gIn.y + 8 }], "orth"));
  wires.push(go(p.btn, btn.signalHole, C.yellow, 1), go(p.buz, bb.hole(12, "j"), C.orange, 2), go(p.pot, bb.hole(18, "j"), C.green, 3));
  used.push(p.gnd, p.btn, p.buz, p.pot);
  // 3.3V: 전원 헤더 3V 핀 → 옆 틈(GND 핀 사이)으로 곧게 올라가 아래 + 줄 2번 칸
  const v33 = b.power("3V3"), pIn = rail("+", 2), seam = v33.x + 10;
  wires.push(mfWire(v33, pIn, C.red, [{ x: seam, y: v33.y }, { x: seam, y: pIn.y + 10 }, { x: pIn.x, y: pIn.y + 10 }], "orth"));
  used.push(v33);

  // OLED: 보드 왼쪽 아래, 핀이 위로. I2C 헤더 안쪽 줄로 — 선은 바깥 줄(UART) 핀 사이 틈으로 (41장과 같은 꼴)
  const bus = b.i2c(0);
  const o = oled(110, bot + 30, { titleAt: { x: 98, y: bot + 86, anchor: "end" } });
  const lanes = { GND: bot + 4, VCC: bot - 4, SDA: bot - 20, SCL: bot - 12 };
  const color = { GND: C.black, VCC: C.red, SDA: C.blue, SCL: C.purple };
  for (const k of ["GND", "VCC", "SDA", "SCL"]) {
    const q = bus[k], from = o.pins[k], sx = q.x - 9.9;
    wires.push(ffWire(from, q, color[k], [{ x: from.x, y: lanes[k] }, { x: sx, y: lanes[k] }, { x: sx, y: q.y }], "orth"));
    used.push(q);
  }

  parts.push(bb.svg, ...btn.svg, bz.svg, pot.svg, o.svg);
  parts.push(tag(bb.hole(6, "a").x + 8, bb.hole(1, "b").y, "버튼"));
  parts.push(tag(bb.hole(13, "a").x, bb.hole(1, "c").y, "수동 부저(선택)"));
  parts.push(tag(bb.hole(19, "a").x + 12, bb.hole(1, "b").y, "가변저항(선택)"));

  const rows = [
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C 헤더 GND · VCC (보드에 바로)" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C 헤더 D21 · D22 (보드에 바로)" },
    { colors: [C.red, C.black], part: "전원 헤더 3V · 위 줄 GND 칸 S", to: "아래 + 줄 · 아래 − 줄 (위 − 줄 ↔ 아래 − 줄 점퍼)" },
    { color: C.yellow, part: "P14 칸 S", to: "6번 줄 버튼 한쪽 다리, 대각선 8번 줄 → 위 − 줄" },
    { color: C.orange, part: "(선택) P25 칸 S", to: "12번 줄 부저 + 다리, − 다리 14번 줄 → − 줄" },
    { color: C.green, part: "(선택) SVN(39) 칸 S", to: "18번 줄 가변저항 가운데 다리" },
    { colors: [C.red, C.black], part: "(선택) 가변저항 17 · 19번 줄", to: "+ 줄 · − 줄" },
  ];
  const table = connectionTable(o.pins.GND.y + 112 + 24, "이렇게 꽂아요 — OLED 는 보드에 바로, 버튼 · 부저 · 가변저항은 브레드보드에", rows, b.legend);
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "달리는 디콘 배선도(ESP32 Plus 확장 보드): OLED 의 GND · VCC · SDA · SCL 은 F-F 듀폰선으로 보드 I2C 묶음 첫 줄 GND · 5V · SDA · SCL 에 바로. 브레드보드는 보드 아래: 아래 줄 3V3 → 위 + 줄, GND → 위 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요. 버튼은 가운데 홈에 걸쳐 12 · 14번 줄: 위 줄 io14 → 보드 바깥으로 돌아 12번 줄, 대각선 14번 줄 → 아래 − 줄. 추가 미션(선택): 수동 부저 + 다리 6번 줄 ← 위 줄 io25(보드 바깥으로 돌아서), − 다리 8번 줄 → − 줄. 가변저항 23 · 24 · 25번 줄: 가운데 24번 ← 아래 줄 io39, 23번 → − 줄, 25번 → + 줄",
  devkit: "기본 보드(ESP32 DevKit 38핀) 달리는 디콘 배선도: 브레드보드는 보드 위. 3V3 → 보드 바깥으로 돌아 + 줄, 위 줄 GND → 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요. 버튼은 가운데 홈에 걸쳐 8 · 10번 줄: D14 → 8번 줄, 대각선 10번 줄 → 위 − 줄. OLED 는 보드 아래: GND → GND, SDA → D21, SCL → D22 에 F-F 듀폰선으로 바로, VCC → 보드 바깥으로 돌아 + 줄. 추가 미션(선택): 수동 부저 + 다리 12번 줄 ← D25, − 다리 14번 줄 → − 줄. 가변저항 18 · 19 · 20번 줄: 가운데 19번 ← VN(39), 18번 → + 줄, 20번 → − 줄",
  expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) 달리는 디콘 배선도: JUMP 점퍼는 평소 자리(3.3V 쪽). OLED 의 GND · VCC · SDA · SCL 은 F-F 듀폰선으로 보드 왼쪽 아래 I2C 헤더 GND · VCC · D21 · D22 에 바로. 브레드보드는 보드 위: 왼쪽 위 전원 헤더 3V 핀 → 아래 + 줄, 위 줄 GND 칸 S 핀 → 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요. 버튼은 가운데 홈에 걸쳐 6 · 8번 줄: P14 칸 S 핀 → 6번 줄, 대각선 8번 줄 → 위 − 줄. 추가 미션(선택): 수동 부저 + 다리 12번 줄 ← P25 칸 S 핀, − 다리 14번 줄 → − 줄. 가변저항 17 · 18 · 19번 줄: 가운데 18번 ← SVN(39) 칸 S 핀, 17번 → + 줄, 19번 → − 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wrg", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wrgk", T.devkit, r.body, r.height); },
    expansion: () => { const r = expansion(); return svgDoc("wrgx", T.expansion, r.body, r.height); },
  },
};
