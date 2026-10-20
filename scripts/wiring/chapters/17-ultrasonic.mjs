// 센서 S14 "초음파 거리" — 초음파(Trig 13 · Echo 12, 5V), 경고 LED(26) + 220Ω 저항.
// Plus: 초음파는 보드에 바로(F-F), LED 는 보드 위 브레드보드 — 짧은 다리는 io26 기둥의 G 로.
// DevKit: 초음파는 보드에 바로(F-F), LED 는 보드 위 브레드보드 — 짧은 다리는 아래 줄 GND 로.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, led, resistor, ultrasonic } from "../parts.mjs";

/** LED 회로(오른쪽으로): 신호 열 k(j 칸) → 저항 (k,h)~(k+n,h) → LED 긴 다리 (k+n,f), 짧은 다리 (k+n+1,f) */
function ledRight(bb, k, n) {
  const a = k + n, c = a + 1;
  [k, a, c].forEach((col) => bb.tint(col, "bottom"));
  const svg = [resistor(bb.hole(k, "h"), bb.hole(a, "h"), { label: "220Ω" }).svg, led(bb.hole(a, "f"), bb.hole(c, "f"), "#e03131").svg];
  return { svg, signal: bb.hole(k, "j"), cathode: bb.hole(c, "j"), cols: { sig: k, anode: a, cathode: c } };
}

function plus() {
  const bb = breadboard({ x: 300, y: 50, cols: 16, rails: { top: false, bottom: false } });
  const b = makePlus({ x: 96, y: bb.y + bb.h + 24 });
  const circ = ledRight(bb, 9, 6);
  const u = ultrasonic(110, b.bounds.y - 128);
  const t = { VCC: b.power("5V"), GND: b.power("GND"), Trig: b.gpio(13), Echo: b.gpio(12) };
  const sig = b.gpio(26), g = b.triple(26).G;
  const laneY = (b.lane.top + b.lane.bottom) / 2;
  const gap = bb.y + bb.h + 12;
  const wires = [
    ffWire(u.pins.VCC, t.VCC, C.red), ffWire(u.pins.GND, t.GND, C.black), ffWire(u.pins.Trig, t.Trig, C.yellow), ffWire(u.pins.Echo, t.Echo, C.green),
    mfWire(sig, circ.signal, C.blue),
    // 짧은 다리 줄 → 브레드보드 오른쪽 바깥 → 보드 가운데 빈 띠 → io26 기둥 G (아래에서)
    mfWire(g, circ.cathode, C.black, [{ x: g.x, y: laneY }, { x: 614, y: laneY }, { x: 614, y: gap }, { x: circ.cathode.x, y: gap }], "orth"),
  ];
  const rows = [
    { color: C.red, part: "초음파 VCC", to: "5V" }, { color: C.black, part: "초음파 GND", to: "GND" },
    { color: C.yellow, part: "초음파 Trig", to: "io13" }, { color: C.green, part: "초음파 Echo", to: "io12" },
    { color: C.blue, part: "io26", to: `${circ.cols.sig}번 줄 → 220Ω 저항 → ${circ.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${circ.cols.cathode}번 줄`, to: "io26 기둥 맨 아래 G" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — 초음파는 보드에 바로, LED 는 브레드보드에", rows, "plus");
  const used = [t.VCC, t.GND, t.Trig, t.Echo, sig, g];
  return svgDoc("wbu", T.plus, compose(b.draw(used), [bb.svg, ...circ.svg, u.svg], wires, [table.svg]), table.bottom);
}

function devkit() {
  const bb = breadboard({ x: 206, y: 8, cols: 19, rails: { top: false, bottom: false } });
  const b = makeDevkit({ x: 100, y: bb.y + bb.h + 24 });
  const circ = ledRight(bb, 3, 5);
  const u = ultrasonic(12, b.topY - 236, { titleAt: { x: 88, y: b.topY - 252, anchor: "middle" } });
  const vin = b.power("5V"), gndTop = b.power("GND", 0), gndBot = b.power("GND", 1), trig = b.gpio(13), echo = b.gpio(12), sig = b.gpio(26);
  const under = u.pins.VCC.y + 70;
  const gap = bb.y + bb.h + 12;
  const below = b.bounds.y + b.bounds.h + 18;
  const wires = [
    ffWire(u.pins.VCC, vin, C.red, [{ x: u.pins.VCC.x, y: under }, { x: vin.x, y: under }], "orth"),
    ffWire(u.pins.GND, gndTop, C.black, [{ x: u.pins.GND.x, y: under + 8 }, { x: gndTop.x, y: under + 8 }], "orth"),
    ffWire(u.pins.Trig, trig, C.yellow), ffWire(u.pins.Echo, echo, C.green),
    mfWire(sig, circ.signal, C.blue),
    // 짧은 다리 줄 → 보드 오른쪽 바깥 → 보드 아래 → 아래 줄 GND
    mfWire(gndBot, circ.cathode, C.black, [{ x: gndBot.x, y: below }, { x: 604, y: below }, { x: 604, y: gap }, { x: circ.cathode.x, y: gap }], "orth"),
  ];
  const rows = [
    { color: C.red, part: "초음파 VCC", to: vin.label }, { color: C.black, part: "초음파 GND", to: "GND (위 줄)" },
    { color: C.yellow, part: "초음파 Trig", to: trig.label }, { color: C.green, part: "초음파 Echo", to: echo.label },
    { color: C.blue, part: sig.label, to: `${circ.cols.sig}번 줄 → 220Ω 저항 → ${circ.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${circ.cols.cathode}번 줄`, to: "GND (아래 줄)" },
  ];
  const table = connectionTable(below + 18, "이렇게 꽂아요 — 초음파는 보드에 바로, LED 는 브레드보드에", rows, "devkit");
  const used = [vin, gndTop, gndBot, trig, echo, sig];
  return svgDoc("wbuk", T.devkit, compose(b.draw(used), [bb.svg, ...circ.svg, u.svg], wires, [table.svg]), table.bottom);
}

const T = {
  plus: "초음파 거리 배선도(ESP32 Plus 확장 보드): 초음파 센서 VCC 는 보드 위쪽 5V, GND 는 GND, Trig 는 io13, Echo 는 io12 에 F-F 듀폰선으로 바로. 경고 LED 는 보드 위 브레드보드에: io26 → 9번 줄 → 220Ω 저항 → 15번 줄 LED 긴 다리(+), 짧은 다리(−) 16번 줄 → io26 기둥 맨 아래 G 핀",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 초음파 거리 배선도: 초음파 센서 VCC 는 VIN(5V), GND 는 위 줄 GND, Trig 는 D13, Echo 는 D12 에 F-F 듀폰선으로 바로. 경고 LED 는 보드 위 브레드보드에: D26 → 3번 줄 → 220Ω 저항 → 8번 줄 LED 긴 다리(+), 짧은 다리(−) 9번 줄 → 아래 줄 GND",
};

export default {
  "wiring-breadboard.svg": { plus, devkit },
};
