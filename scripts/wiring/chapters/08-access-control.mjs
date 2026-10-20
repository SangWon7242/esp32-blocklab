// 융합 F1 "스마트 출입 통제 시스템" — RFID(I2C: SCL 22 · SDA 21), 서보(4), (미션) LED(26) + 220Ω 저항.
// ESP32 Plus: RFID 는 I2C 묶음 첫 줄, 서보 플러그는 ANALOG io4 줄에 바로. LED 만 보드 위 브레드보드(01 장과 같은 꼴).
// 기본 보드: 보드 위 브레드보드 + − 줄(VIN · GND)을 서보와 LED 가 나눠 쓰고, RFID 는 아래 줄 3V3 · GND · D21 · D22 에 바로.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, led, resistor, rfid, servo, servoWithPlug } from "../parts.mjs";

/** 01 장과 같은 LED 회로 (보드 위 브레드보드, + − 줄이 아래): 신호 (k, j) → 저항 (k, h)~(k-5, h) → LED 긴 다리 (k-5, f), 짧은 다리 (k-6, f) → (k-6, j) → − 줄 */
function ledCircuit(bb, k) {
  [k, k - 5, k - 6].forEach((c) => bb.tint(c, "bottom"));
  const svg = [resistor(bb.hole(k, "h"), bb.hole(k - 5, "h"), { label: "220Ω" }).svg, led(bb.hole(k - 5, "f"), bb.hole(k - 6, "f"), "#e03131").svg];
  const jumper = mmWire(bb.hole(k - 6, "j"), bb.rail("bottom", "-", k - 6), C.black);
  return { svg, jumper, signalHole: bb.hole(k, "j"), cols: { sig: k, anode: k - 5, cathode: k - 6 } };
}

/* ───── ESP32 Plus ───── */
function plus() {
  const bb = breadboard({ x: 78, y: 8, cols: 26, rails: { top: false, bottom: true } });
  const b = makePlus({ x: 78, y: bb.y + bb.h + 24 });
  const parts = [], wires = [], used = [];
  // (미션) LED: io26 → 22번 줄
  const circ = ledCircuit(bb, 22);
  parts.push(bb.svg, ...circ.svg);
  const io26 = b.gpio(26), gTop = b.power("GND");
  wires.push(mfWire(io26, circ.signalHole, C.orange), mfWire(gTop, bb.rail("bottom", "-", bb.nearestCol(gTop.x, true)), C.black), circ.jumper);
  used.push(io26, gTop);
  // RFID: 보드 오른쪽 → I2C 묶음 첫 줄
  const r = rfid(508, b.lane.bottom + 18, { titleAt: { x: 573, y: b.lane.bottom + 146 } });
  parts.push(r.svg);
  const bus = b.i2c(0);
  const lane = { GND: b.lane.top + 3, VCC: b.lane.top + 8, SDA: b.lane.top + 13, SCL: b.lane.top + 18 };
  const via = (k) => [{ x: r.pins[k].x, y: lane[k] }, { x: bus[k].x, y: lane[k] }];
  wires.push(ffWire(r.pins.GND, bus.GND, C.black, via("GND"), "orth"), ffWire(r.pins.VCC, bus.VCC, C.red, via("VCC"), "orth"), ffWire(r.pins.SDA, bus.SDA, C.blue, via("SDA"), "orth"), ffWire(r.pins.SCL, bus.SCL, C.purple, via("SCL"), "orth"));
  used.push(bus.GND, bus.VCC, bus.SDA, bus.SCL);
  // 서보: 플러그를 ANALOG io4 줄에 그대로
  const sv = b.triple(4);
  parts.push(servo(8, sv.S.y - 22, [sv.G, sv.V, sv.S], { titleAt: { x: 40, y: sv.S.y + 42 } }).svg);
  used.push(sv.G, sv.V, sv.S);
  const rows = [
    { colors: [C.black, C.red], part: "RFID GND · VCC", to: "I2C GND · 5V" },
    { colors: [C.blue, C.purple], part: "RFID SDA · SCL", to: "I2C SDA · SCL" },
    { colors: [C.brown, C.red, C.orange], part: "서보 플러그", to: "io4 줄 G · V · S" },
    { color: C.orange, part: "(미션) io26", to: `${circ.cols.sig}번 줄 → 220Ω 저항 → ${circ.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${circ.cols.cathode}번 줄`, to: "− 줄 → GND" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 34, "이렇게 꽂아요 — RFID · 서보는 보드에 바로, LED 만 브레드보드에", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드 ───── */
function devkit() {
  const bb = breadboard({ x: 96, y: 8, cols: 21, rails: { top: false, bottom: true } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 30 });
  const parts = [], wires = [], used = [];
  const r = (sign, c) => bb.rail("bottom", sign, c);
  // 보드 VIN · GND → + − 줄, (미션) LED: D26 → 11번 줄
  const vin = b.power("5V"), gTop = b.power("GND", 0), d26 = b.gpio(26);
  const circ = ledCircuit(bb, 11);
  parts.push(bb.svg, ...circ.svg);
  wires.push(mfWire(vin, r("+", bb.nearestCol(vin.x, true)), C.red), mfWire(gTop, r("-", bb.nearestCol(gTop.x, true)), C.black));
  wires.push(mfWire(d26, circ.signalHole, C.orange), circ.jumper);
  used.push(vin, gTop, d26);
  // 서보: 브레드보드 오른쪽, 플러그(왼쪽)의 빨강 · 갈색은 + − 줄, 주황은 보드 오른쪽 바깥 길로 D4
  const pR = r("+", 21), pG = r("-", 21);
  const s = servoWithPlug(536, pG.y - 12, { plugSide: "left", titleAt: { x: 570, y: pG.y + 54 } });
  parts.push(s.svg);
  wires.push(mmWire(s.pins.V, pR, C.red, [], "line"), mmWire(s.pins.G, pG, C.black, [], "line"));
  const d4 = b.gpio(4);
  const outY = b.bounds.y + b.bounds.h + 14;
  wires.push(mfWire(d4, s.pins.S, C.yellow, [{ x: d4.x, y: outY }, { x: 622, y: outY }, { x: 622, y: s.pins.S.y }], "orth"));
  used.push(d4);
  // RFID: 보드 아래, 3V3 · 아래 GND · D21 · D22 에 바로
  const rf = rfid(150, outY + 76, { titleAt: { x: 138, y: outY + 130, anchor: "end" } });
  parts.push(rf.svg);
  const v33 = b.power("3V3"), gBot = b.power("GND", 1), sda = b.gpio(21), scl = b.gpio(22);
  const ty = (k) => outY + { GND: 10, VCC: 20, SDA: 30, SCL: 40 }[k];
  wires.push(ffWire(rf.pins.VCC, v33, C.red, [{ x: rf.pins.VCC.x, y: ty("VCC") }, { x: v33.x, y: ty("VCC") }], "orth"));
  wires.push(ffWire(rf.pins.GND, gBot, C.black, [{ x: rf.pins.GND.x, y: ty("GND") }, { x: gBot.x, y: ty("GND") }], "orth"));
  wires.push(ffWire(rf.pins.SDA, sda, C.blue, [{ x: rf.pins.SDA.x, y: ty("SDA") }, { x: sda.x, y: ty("SDA") }], "orth"));
  wires.push(ffWire(rf.pins.SCL, scl, C.purple, [{ x: rf.pins.SCL.x, y: ty("SCL") }, { x: scl.x, y: ty("SCL") }], "orth"));
  used.push(v33, gBot, sda, scl);
  const rows = [
    { color: C.red, part: "VIN · 서보 빨강", to: "+ 줄" },
    { color: C.black, part: "GND · 서보 갈색 · LED 짧은 다리", to: "− 줄" },
    { color: C.yellow, part: "서보 주황(신호)", to: d4.label },
    { colors: [C.red, C.black], part: "RFID VCC · GND", to: "3V3 · GND" },
    { colors: [C.blue, C.purple], part: "RFID SDA · SCL", to: "D21 · D22" },
    { color: C.orange, part: "(미션) D26", to: `${circ.cols.sig}번 줄 → 220Ω 저항 → ${circ.cols.anode}번 줄 LED 긴 다리(+), 짧은 다리 ${circ.cols.cathode}번 줄` },
  ];
  const table = connectionTable(rf.pins.GND.y + 150, "이렇게 꽂아요 — 5V 는 브레드보드 + 줄로 나눠 써요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "출입 통제 배선도(ESP32 Plus 확장 보드): RFID 모듈 GND · VCC · SDA · SCL 은 F-F 듀폰선으로 보드 I2C 묶음 첫 줄의 GND · 5V · SDA(21) · SCL(22) 에 바로. 서보 모터 플러그는 ANALOG 묶음 io4 줄에 갈색 G, 빨강 V, 주황 S 가 맞도록 그대로. 미션 LED 는 보드 위 브레드보드에: io26 → 22번 줄 → 220Ω 저항 → 17번 줄 LED 긴 다리(+), 짧은 다리(−) 16번 줄 → 점퍼선 → − 줄 → 보드 GND",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 출입 통제 배선도: 보드 VIN(5V) · GND 를 보드 위 브레드보드 + − 줄에 잇고, 서보 빨강은 + 줄, 갈색은 − 줄, 주황(신호)은 D4. RFID VCC 는 3V3, GND 는 GND, SDA 는 D21, SCL 은 D22 에 F-F 듀폰선으로 바로. 미션 LED: D26 → 11번 줄 → 220Ω 저항 → 6번 줄 LED 긴 다리(+), 짧은 다리(−) 5번 줄 → 점퍼선 → − 줄",
};

export default {
  "wiring-rfid-servo.svg": {
    plus: () => { const r = plus(); return svgDoc("ar", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("ark", T.devkit, r.body, r.height); },
  },
};
