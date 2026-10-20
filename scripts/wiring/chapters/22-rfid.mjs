// 센서 S19 "RFID 카드 읽기" — RFID RC522(I2C: SCL 22 · SDA 21), 설계 단계 LED(2번) + 220Ω 저항.
// ESP32 Plus: RFID 는 I2C 묶음 첫 줄에 F-F 로 바로, LED 는 보드 아래 브레드보드(io2 는 ANALOG 묶음 S).
// 기본 보드: 보드 아래 브레드보드 + − 줄을 3V3 · GND 에 잇고 RFID V · G 와 LED 가 나눠 쓴다. RFID SDA · SCL 은 D21 · D22 에 바로.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, led, resistor, rfid } from "../parts.mjs";

/**
 * 보드 아래 브레드보드(+ − 줄이 위)에 LED 회로: 신호 (k, a) → 저항 (k, c)~(k+4, c) → LED 긴 다리 (k+4, e), 짧은 다리 (k+5, e)
 * → 점퍼선 (k+5, a) → − 줄. k 는 + − 줄에 구멍이 없는 열(6·12·18…)로 골라 신호선이 다른 구멍 위를 지나지 않게 한다.
 */
function ledBelow(bb, k) {
  [k, k + 4, k + 5].forEach((c) => bb.tint(c, "top"));
  const svg = [resistor(bb.hole(k, "c"), bb.hole(k + 4, "c"), { label: "220Ω" }).svg, led(bb.hole(k + 4, "e"), bb.hole(k + 5, "e"), "#e03131", { up: false, lift: 28 }).svg];
  const jumper = mmWire(bb.hole(k + 5, "a"), bb.rail("top", "-", k + 5), C.black);
  return { svg, jumper, signalHole: bb.hole(k, "a"), cols: { sig: k, anode: k + 4, cathode: k + 5 } };
}

/* ───── ESP32 Plus ───── */
function plus() {
  const b = makePlus({ x: 76, y: 20 });
  const parts = [], wires = [], used = [];
  // RFID: 보드 오른쪽, I2C 묶음 첫 줄로 (위 G 줄과 ESP32 모듈 사이 빈 띠를 지나)
  const r = rfid(506, b.lane.bottom + 18, { titleAt: { x: 571, y: b.lane.bottom + 146 } });
  parts.push(r.svg);
  const bus = b.i2c(0);
  const lane = { GND: b.lane.top + 3, VCC: b.lane.top + 8, SDA: b.lane.top + 13, SCL: b.lane.top + 18 };
  const via = (k) => [{ x: r.pins[k].x, y: lane[k] }, { x: bus[k].x, y: lane[k] }];
  wires.push(ffWire(r.pins.GND, bus.GND, C.black, via("GND"), "orth"), ffWire(r.pins.VCC, bus.VCC, C.red, via("VCC"), "orth"), ffWire(r.pins.SDA, bus.SDA, C.blue, via("SDA"), "orth"), ffWire(r.pins.SCL, bus.SCL, C.purple, via("SCL"), "orth"));
  used.push(bus.GND, bus.VCC, bus.SDA, bus.SCL);
  // (설계) LED: io2(ANALOG S) → 브레드보드 6번 줄, 아래 줄 GND → − 줄
  const io2 = b.gpio(2), gnd = b.power("GND", 1);
  const bb = breadboard({ x: io2.x - 28 - 5 * 16, y: b.bounds.y + b.bounds.h + 26, cols: 22, rails: { top: true, bottom: false } });
  const circ = ledBelow(bb, 6);
  parts.push(bb.svg, ...circ.svg);
  wires.push(mfWire(io2, circ.signalHole, C.orange), mfWire(gnd, bb.rail("top", "-", bb.nearestCol(gnd.x, true)), C.black), circ.jumper);
  used.push(io2, gnd);
  const rows = [
    { colors: [C.black, C.red], part: "RFID GND · VCC", to: "I2C GND · 5V" },
    { colors: [C.blue, C.purple], part: "RFID SDA · SCL", to: "I2C SDA · SCL" },
    { color: C.orange, part: "(설계) io2 (ANALOG S)", to: `${circ.cols.sig}번 줄 → 220Ω 저항 → ${circ.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${circ.cols.cathode}번 줄`, to: "− 줄 → 아래 줄 GND" },
  ];
  const table = connectionTable(bb.y + bb.h + 18, "이렇게 꽂아요 — RFID 는 보드에 바로, LED 만 브레드보드에", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드: 보드 아래 브레드보드 + − 줄(3V3 · GND)을 RFID 와 LED 가 나눠 쓴다 ───── */
function devkit() {
  const b = makeDevkit({ x: 110, y: 24 });
  const parts = [], wires = [], used = [];
  const d2 = b.gpio(2), v33 = b.power("3V3"), gnd = b.power("GND", 1), sda = b.gpio(21), scl = b.gpio(22);
  const bb = breadboard({ x: d2.x - 28 - 5 * 16, y: b.bounds.y + b.bounds.h + 52, cols: 16, rails: { top: true, bottom: false } });
  const circ = ledBelow(bb, 6);
  parts.push(bb.svg, ...circ.svg);
  wires.push(mfWire(v33, bb.rail("top", "+", bb.nearestCol(v33.x, true)), C.red), mfWire(gnd, bb.rail("top", "-", bb.nearestCol(gnd.x, true)), C.black));
  wires.push(mfWire(d2, circ.signalHole, C.orange), circ.jumper);
  used.push(v33, gnd, d2);
  // RFID: 브레드보드 오른쪽. V · G 는 + − 줄 오른쪽 끝(16번 칸)에, SDA · SCL 은 D21 · D22 에 바로
  const r = rfid(468, bb.y + 62, { titleAt: { x: 533, y: bb.y + 190 } });
  parts.push(r.svg);
  const rp = bb.rail("top", "+", 16), rm = bb.rail("top", "-", 16);
  wires.push(mfWire(rp, r.pins.VCC, C.red, [{ x: r.pins.VCC.x, y: rp.y }], "orth"));
  wires.push(mfWire(rm, r.pins.GND, C.black, [{ x: r.pins.GND.x, y: rm.y }], "orth"));
  const trackY = { SCL: b.bounds.y + b.bounds.h + 18, SDA: b.bounds.y + b.bounds.h + 30 };
  wires.push(ffWire(r.pins.SDA, sda, C.blue, [{ x: r.pins.SDA.x, y: trackY.SDA }, { x: sda.x, y: trackY.SDA }], "orth"));
  wires.push(ffWire(r.pins.SCL, scl, C.purple, [{ x: r.pins.SCL.x, y: trackY.SCL }, { x: scl.x, y: trackY.SCL }], "orth"));
  used.push(sda, scl);
  const rows = [
    { color: C.red, part: "3V3 · RFID VCC", to: "+ 줄" },
    { color: C.black, part: "GND · RFID GND · LED 짧은 다리", to: "− 줄" },
    { colors: [C.blue, C.purple], part: "RFID SDA · SCL", to: "D21 · D22" },
    { color: C.orange, part: "(설계) D2", to: `${circ.cols.sig}번 줄 → 220Ω 저항 → ${circ.cols.anode}번 줄 LED 긴 다리(+), 짧은 다리 ${circ.cols.cathode}번 줄` },
  ];
  const table = connectionTable(Math.max(bb.y + bb.h, r.pins.GND.y + 122 + 30) + 16, "이렇게 꽂아요 — 3V3 · GND 는 브레드보드 + − 줄로 나눠 써요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "RFID 배선도(ESP32 Plus 확장 보드): RFID 모듈 GND · VCC · SDA · SCL 은 F-F 듀폰선으로 보드 I2C 묶음 첫 줄의 GND · 5V · SDA(21) · SCL(22) 에 바로. 설계 단계 LED: ANALOG 묶음 io2 의 S 핀 → 브레드보드 6번 줄 → 220Ω 저항 → 10번 줄 LED 긴 다리(+), 짧은 다리(−) 11번 줄 → 점퍼선 → − 줄 → 보드 아래 줄 GND",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) RFID 배선도: 보드 3V3 · GND 를 브레드보드 + − 줄에 잇고, RFID VCC 는 + 줄, GND 는 − 줄. RFID SDA 는 D21, SCL 은 D22 에 F-F 듀폰선으로 바로. 설계 단계 LED: D2 → 브레드보드 6번 줄 → 220Ω 저항 → 10번 줄 LED 긴 다리(+), 짧은 다리(−) 11번 줄 → 점퍼선 → − 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("rfw", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("rfwk", T.devkit, r.body, r.height); },
  },
};
