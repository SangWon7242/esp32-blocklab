// 센서 S19 "RFID 카드 읽기" — RFID RC522(I2C: SCL 22 · SDA 21), 설계 단계 LED(2번) + 220Ω 저항.
// ESP32 Plus: RFID 는 I2C 묶음 첫 줄에 F-F 로 바로, LED 는 보드 아래 브레드보드(io2 는 ANALOG 묶음 S).
// 기본 보드: 보드 아래 브레드보드 + − 줄을 3V3 · GND 에 잇고 RFID V · G 와 LED 가 나눠 쓴다. RFID SDA · SCL 은 D21 · D22 에 바로.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, note, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
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

/* ───── 확장 보드(38핀 확장 보드 + DevKit): RFID 는 보드에 바로, LED 는 보드 아래 브레드보드. 점퍼 3.3V ─────
 * RFID 는 3.3V 모듈이라 VCC 는 전원 헤더 3V(점퍼와 상관없이 늘 3.3V)에서: 3V 핀과 5V 핀 사이 틈 → 콘덴서 둘 사이 →
 * I2C 헤더 VCC · D21 핀 사이 틈으로 곧게 내려와 RFID VCC 로. GND · SDA · SCL 은 I2C 헤더(GND · D21 · D22)에 F-F 로,
 * 선은 바깥 줄(UART) 핀 사이 틈으로 올라가 옆에서 꽂는다 (GND 는 왼쪽 틈, D21 · D22 는 오른쪽 틈 — 가운데 틈은 3V 선 자리).
 * LED 의 P2 · GND 는 아래 줄 칸이라 브레드보드를 보드 아래에, P2 칸 바로 아래 열에 회로.
 * 점퍼 메모는 보드 그림의 한 줄 메모 대신 오른쪽 끝에 두 줄로 (한 줄 메모 자리를 GND 선 · RFID 선이 지나가서).
 */
function expansion() {
  const b = makeExpansion({ x: 22, y: 44, jumper: "3V3" });
  const { x, y, w } = b.bounds, bot = y + 314; // 보드 아래 끝 (메모 줄 위)
  const parts = [], wires = [], used = [];
  // RFID: 보드 왼쪽 아래, 핀이 위로 (LED 브레드보드를 Plus · DevKit 과 같은 6 · 10 · 11번 줄로 두려고 왼쪽으로 붙였다).
  // 네 선 모두 오른쪽으로 꺾여 올라간다 — 왼쪽 핀일수록 높은 가로 길이라 서로 엇갈리지 않는다
  const bus = b.i2c(0);
  const r = rfid(50, bot + 56, { titleAt: { x: 115, y: bot + 56 + 128 } });
  parts.push(r.svg);
  const lanes = { GND: bot + 8, VCC: bot + 16, SDA: bot + 24, SCL: bot + 32 };
  const color = { GND: C.black, SDA: C.blue, SCL: C.purple };
  for (const [k, dx] of [["GND", -9.9], ["SDA", 9.9], ["SCL", 9.9]]) {
    const p = bus[k], from = r.pins[k], seam = Math.round((p.x + dx) * 10) / 10;
    wires.push(ffWire(from, p, color[k], [{ x: from.x, y: lanes[k] }, { x: seam, y: lanes[k] }, { x: seam, y: p.y }], "orth"));
    used.push(p);
  }
  // RFID VCC ← 전원 헤더 3V (오른쪽 3V 핀). 3V 핀 → 오른쪽 틈 → 아래로 곧게 → RFID VCC 위에서 꺾어 꽂기
  const v3 = b.power("3V3", 1), vc = r.pins.VCC, mid = Math.round((v3.x + 10) * 10) / 10;
  wires.push(ffWire(v3, vc, C.red, [{ x: mid, y: v3.y }, { x: mid, y: lanes.VCC }, { x: vc.x, y: lanes.VCC }], "orth"));
  used.push(v3);
  // (설계) LED: 아래 줄 P2 칸 S 핀 → 브레드보드 2번 줄, 아래 줄 GND 칸 S 핀 → − 줄
  const p2 = b.gpio(2), gnd = b.power("GND", 1);
  const k = 6;
  const bb = breadboard({ x: Math.round((p2.x - 28 - (k - 1) * 16) * 10) / 10, y: bot + 48, cols: 22, rails: { top: true, bottom: false } });
  const circ = ledBelow(bb, k);
  parts.push(bb.svg, ...circ.svg);
  wires.push(mfWire(p2, circ.signalHole, C.orange), mfWire(gnd, bb.rail("top", "-", bb.nearestCol(gnd.x, true)), C.black), circ.jumper);
  used.push(p2, gnd);
  const memo = [note(x + w, bot + 14, "JUMP 점퍼는 3.3V 쪽", "end", 12), note(x + w, bot + 30, "(V 줄 = 3.3V)", "end", 12)];
  const rows = [
    { color: C.red, part: "RFID VCC", to: "전원 헤더 3V (늘 3.3V, 보드 안 틈으로 내려와요)" },
    { color: C.black, part: "RFID GND", to: "I2C 헤더 GND" },
    { colors: [C.blue, C.purple], part: "RFID SDA · SCL", to: "I2C 헤더 D21 · D22" },
    { color: C.orange, part: "(설계) P2 칸 S 핀 (아래 줄)", to: `${circ.cols.sig}번 줄 → 220Ω 저항 → ${circ.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${circ.cols.cathode}번 줄`, to: "− 줄 → 아래 줄 GND 칸 S 핀" },
  ];
  const table = connectionTable(Math.max(bb.y + bb.h, r.pins.GND.y + 12 + 110 + 30) + 14, "이렇게 꽂아요 — RFID 는 보드에 바로, LED 만 브레드보드에", rows, b.legend);
  return { body: compose(b.draw(used, { note: false }), parts, wires, [...memo, table.svg]), height: table.bottom, led: circ.cols };
}

const T = {
  plus: "RFID 배선도(ESP32 Plus 확장 보드): RFID 모듈 GND · VCC · SDA · SCL 은 F-F 듀폰선으로 보드 I2C 묶음 첫 줄의 GND · 5V · SDA(21) · SCL(22) 에 바로. 설계 단계 LED: ANALOG 묶음 io2 의 S 핀 → 브레드보드 6번 줄 → 220Ω 저항 → 10번 줄 LED 긴 다리(+), 짧은 다리(−) 11번 줄 → 점퍼선 → − 줄 → 보드 아래 줄 GND",
  devkit: "기본 보드(ESP32 DevKit 38핀) RFID 배선도: 보드 3V3 · GND 를 브레드보드 + − 줄에 잇고, RFID VCC 는 + 줄, GND 는 − 줄. RFID SDA 는 D21, SCL 은 D22 에 F-F 듀폰선으로 바로. 설계 단계 LED: D2 → 브레드보드 6번 줄 → 220Ω 저항 → 10번 줄 LED 긴 다리(+), 짧은 다리(−) 11번 줄 → 점퍼선 → − 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("rfw", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("rfwk", T.devkit, r.body, r.height); },
    expansion: () => {
      const r = expansion(), c = r.led;
      const title = `확장 보드(ESP32 38핀 확장 보드 + DevKit) RFID 배선도: RFID 모듈 GND · SDA · SCL 은 F-F 듀폰선으로 I2C 헤더(안쪽 줄)의 GND · D21 · D22 에 바로, VCC 는 전원 헤더 3V(점퍼와 상관없이 3.3V)에 F-F 듀폰선으로 — 3V 핀과 5V 핀 사이, 콘덴서 둘 사이, I2C 헤더 VCC 와 D21 핀 사이 틈으로 내려와요. JUMP 점퍼는 3.3V 쪽. 설계 단계 LED: 아래 줄 P2 칸 S 핀 → 보드 아래 브레드보드 ${c.sig}번 줄 → 220Ω 저항 → ${c.anode}번 줄 LED 긴 다리(+), 짧은 다리(−) ${c.cathode}번 줄 → 점퍼선 → − 줄 → 아래 줄 GND 칸 S 핀`;
      return svgDoc("rfwx", title, r.body, r.height);
    },
  },
};
