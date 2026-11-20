// 센서 S14 "초음파 거리" — 초음파(Trig 13 · Echo 12, 5V), 경고 LED(26) + 220Ω 저항.
// Echo 는 5V 신호라 브레드보드의 전압 나누기(1kΩ · 2kΩ, echo-divider.mjs)를 거쳐 12번으로. VCC · Trig 는 보드에 바로.
// Plus: LED 는 보드 위 브레드보드 — 짧은 다리는 io26 기둥의 G 로.
// DevKit: 초음파는 보드에 바로(F-F), LED 는 보드 위 브레드보드 — 짧은 다리는 아래 줄 GND 로.
// 확장 보드: 10장 본보기와 같은 초음파 + 전압 나누기(작은 브레드보드 띠), LED 는 같은 띠 오른쪽 — 짧은 다리 줄은 점퍼선으로 GND 줄에.
//   초음파 수업이라 점퍼 5V (선생님 방침).
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, note, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { breadboard, led, resistor, ultrasonic } from "../parts.mjs";
import { dividerWires, echoDivider, echoRows } from "../echo-divider.mjs";

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
  const div = echoDivider(bb, 1);
  const u = ultrasonic(110, b.bounds.y - 156);
  const t = { VCC: b.power("5V"), GND: b.power("GND"), Trig: b.gpio(13), Echo: b.gpio(12) };
  const sig = b.gpio(26), g = b.triple(26).G;
  const laneY = (b.lane.top + b.lane.bottom) / 2;
  const gap = bb.y + bb.h + 12;
  const wires = [
    ffWire(u.pins.VCC, t.VCC, C.red), ffWire(u.pins.Trig, t.Trig, C.yellow),
    // Echo · 초음파 GND 는 브레드보드의 전압 나누기로 (센서 아래로 내려와 오른쪽으로, 구멍에는 아래에서)
    mfWire(u.pins.GND, div.holes.gndSensor, C.black, [{ x: u.pins.GND.x, y: gap - 6 }, { x: div.holes.gndSensor.x - 5, y: gap - 6 }, { x: div.holes.gndSensor.x - 5, y: div.holes.gndSensor.y + 8 }], "orth"),
    mfWire(u.pins.Echo, div.holes.echo, C.green, [{ x: u.pins.Echo.x, y: gap + 2 }, { x: div.holes.echo.x, y: gap + 2 }], "orth"),
    mfWire(t.Echo, div.holes.pin, C.purple), mfWire(t.GND, div.holes.gndBoard, C.black),
    mfWire(sig, circ.signal, C.blue),
    // 짧은 다리 줄 → 브레드보드 오른쪽 바깥 → 보드 가운데 빈 띠 → io26 기둥 G (아래에서)
    mfWire(g, circ.cathode, C.black, [{ x: g.x, y: laneY }, { x: 614, y: laneY }, { x: 614, y: gap }, { x: circ.cathode.x, y: gap }], "orth"),
  ];
  const rows = [
    { color: C.red, part: "초음파 VCC", to: "5V" }, { color: C.yellow, part: "초음파 Trig", to: "io13" },
    ...echoRows(div, { echoColor: C.green, pinColor: C.purple, gndColor: C.black, pinLabel: "io12", gndLabel: "보드 GND" }),
    { color: C.blue, part: "io26", to: `${circ.cols.sig}번 줄 → 220Ω 저항 → ${circ.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${circ.cols.cathode}번 줄`, to: "io26 기둥 맨 아래 G" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — Echo 는 저항 둘을 거쳐 보드로", rows, "plus");
  const used = [t.VCC, t.GND, t.Trig, t.Echo, sig, g];
  return svgDoc("wbu", T.plus, compose(b.draw(used), [bb.svg, ...circ.svg, ...div.svg, u.svg], wires, [table.svg]), table.bottom);
}

function devkit() {
  const bb = breadboard({ x: 206, y: 8, cols: 19, rails: { top: false, bottom: false } });
  const b = makeDevkit({ x: 100, y: bb.y + bb.h + 24 });
  const circ = ledRight(bb, 3, 5);
  const div = echoDivider(bb, 13);
  const u = ultrasonic(12, b.topY - 236, { titleAt: { x: 88, y: b.topY - 252, anchor: "middle" } });
  const vin = b.power("5V"), gndTop = b.power("GND", 0), gndBot = b.power("GND", 1), trig = b.gpio(13), echo = b.gpio(12), sig = b.gpio(26);
  const under = u.pins.VCC.y + 70;
  const gap = bb.y + bb.h + 12;
  const below = b.bounds.y + b.bounds.h + 18;
  const wires = [
    ffWire(u.pins.VCC, vin, C.red, [{ x: u.pins.VCC.x, y: under }, { x: vin.x, y: under }], "orth"),
    ffWire(u.pins.Trig, trig, C.yellow),
    // Echo · 초음파 GND 는 브레드보드 아래 틈을 지나 전압 나누기로 (구멍에는 아래에서)
    mfWire(u.pins.GND, div.holes.gndSensor, C.black, [{ x: u.pins.GND.x, y: gap - 8 }, { x: div.holes.gndSensor.x - 5, y: gap - 8 }, { x: div.holes.gndSensor.x - 5, y: div.holes.gndSensor.y + 8 }], "orth"),
    mfWire(u.pins.Echo, div.holes.echo, C.green, [{ x: u.pins.Echo.x, y: gap }, { x: div.holes.echo.x, y: gap }], "orth"),
    mfWire(echo, div.holes.pin, C.purple), mfWire(gndTop, div.holes.gndBoard, C.black),
    mfWire(sig, circ.signal, C.blue),
    // 짧은 다리 줄 → 보드 오른쪽 바깥 → 보드 아래 → 아래 줄 GND
    mfWire(gndBot, circ.cathode, C.black, [{ x: gndBot.x, y: below }, { x: 604, y: below }, { x: 604, y: gap }, { x: circ.cathode.x, y: gap }], "orth"),
  ];
  const rows = [
    { color: C.red, part: "초음파 VCC", to: vin.label }, { color: C.yellow, part: "초음파 Trig", to: trig.label },
    ...echoRows(div, { echoColor: C.green, pinColor: C.purple, gndColor: C.black, pinLabel: echo.label, gndLabel: "GND (위 줄)" }),
    { color: C.blue, part: sig.label, to: `${circ.cols.sig}번 줄 → 220Ω 저항 → ${circ.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${circ.cols.cathode}번 줄`, to: "GND (아래 줄)" },
  ];
  const table = connectionTable(below + 18, "이렇게 꽂아요 — Echo 는 저항 둘을 거쳐 보드로", rows, "devkit");
  const used = [vin, gndTop, gndBot, trig, echo, sig];
  return svgDoc("wbuk", T.devkit, compose(b.draw(used), [bb.svg, ...circ.svg, ...div.svg, u.svg], wires, [table.svg]), table.bottom);
}

/* ───── 확장 보드(38핀 확장 보드 + DevKit): 점퍼 5V ───── */
function expansion() {
  const b = makeExpansion({ x: 22, y: 280, jumper: "5V" });
  const u = ultrasonic(40, 20, { titleAt: { x: 206, y: 34, anchor: "start" } });
  const bb = breadboard({ x: 250, y: 100, cols: 14, half: "bottom" });
  const div = echoDivider(bb, 1, { order: "echo-first", sensorFrom: "above" });
  // LED: 짧은 다리 8번 줄 · 긴 다리 9번 줄(f 칸), 220Ω 은 9번 줄 ~ 12번 줄(h 칸). 8번 줄 → 점퍼선 → 7번 줄(GND 줄)
  const L = { cathode: div.cols.gnd + 1, anode: div.cols.gnd + 2, sig: div.cols.gnd + 5 };
  [L.cathode, L.anode, L.sig].forEach((col) => bb.tint(col, "bottom"));
  const ledSvg = [resistor(bb.hole(L.anode, "h"), bb.hole(L.sig, "h"), { label: "220Ω" }).svg, led(bb.hole(L.anode, "f"), bb.hole(L.cathode, "f"), "#e03131").svg];
  const t = { VCC: b.power("5V"), GND: b.power("GND"), Trig: b.gpio(13), Echo: b.gpio(12) };
  const sig = b.gpio(26);
  const wires = [
    ffWire(u.pins.VCC, t.VCC, C.red), ffWire(u.pins.Trig, t.Trig, C.yellow),
    ...dividerWires(u, div, bb, { pin: t.Echo, gnd: t.GND, boardTop: b.bounds.y, turnX: 210 }),
    mfWire(sig, bb.hole(L.sig, "j"), C.blue),
    mmWire(bb.hole(L.cathode, "i"), bb.hole(div.cols.gnd, "i"), C.black, [], "line"),
  ];
  const rows = [
    { color: C.red, part: "초음파 VCC", to: "위 줄 5V 칸 S" }, { color: C.yellow, part: "초음파 Trig", to: `${t.Trig.label} 칸 S` },
    ...echoRows(div, { echoColor: C.green, pinColor: C.purple, gndColor: C.black, pinLabel: `${t.Echo.label} 칸 S`, gndLabel: "위 줄 GND 칸 S" }),
    { color: C.blue, part: `${sig.label} 칸 S`, to: `${L.sig}번 줄 → 220Ω 저항 → ${L.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${L.cathode}번 줄`, to: `점퍼선 → ${div.cols.gnd}번 줄 (GND 줄)` },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 12, "이렇게 꽂아요 — Echo 는 저항 둘을 거쳐 보드로", rows, b.legend);
  const used = [t.VCC, t.GND, t.Trig, t.Echo, sig];
  const extra = [note(bb.x + bb.w - 8, bb.y - 10, "브레드보드", "end", 13), table.svg];
  return svgDoc("wbux", T.expansion(div.cols, L), compose(b.draw(used), [bb.svg, ...div.svg, ...ledSvg, u.svg], wires, extra), table.bottom);
}

const T = {
  expansion: (d, L) => `확장 보드(ESP32 38핀 확장 보드 + DevKit) 초음파 거리 배선도: 이번 수업은 JUMP 점퍼를 5V 쪽으로. 초음파 센서 VCC 는 위 줄 5V 칸 S 핀, Trig 는 P13 칸 S 핀에 F-F 듀폰선으로 바로. Echo → 브레드보드 ${d.echo}번 줄 → 1kΩ 저항 → ${d.mid}번 줄 → P12 칸 S 핀, ${d.mid}번 줄 → 2kΩ 저항 → ${d.gnd}번 줄 ← 초음파 GND · 위 줄 GND 칸 S 핀. 경고 LED 는 같은 브레드보드에: P26 칸 S 핀 → ${L.sig}번 줄 → 220Ω 저항 → ${L.anode}번 줄 LED 긴 다리(+), 짧은 다리(−) ${L.cathode}번 줄 → 점퍼선 → ${d.gnd}번 줄`,
  plus: "초음파 거리 배선도(ESP32 Plus 확장 보드): 초음파 센서 VCC 는 보드 위쪽 5V, Trig 는 io13 에 F-F 듀폰선으로 바로. Echo 는 브레드보드 7번 줄 → 1kΩ 저항 → 4번 줄 → io12, 4번 줄 → 2kΩ 저항 → 1번 줄 ← 초음파 GND · 보드 GND. 경고 LED 는 보드 위 브레드보드에: io26 → 9번 줄 → 220Ω 저항 → 15번 줄 LED 긴 다리(+), 짧은 다리(−) 16번 줄 → io26 기둥 맨 아래 G 핀",
  devkit: "기본 보드(ESP32 DevKit 38핀) 초음파 거리 배선도: 초음파 센서 VCC 는 VIN(5V), Trig 는 D13 에 F-F 듀폰선으로 바로. Echo 는 브레드보드 19번 줄 → 1kΩ 저항 → 16번 줄 → D12, 16번 줄 → 2kΩ 저항 → 13번 줄 ← 초음파 GND · GND(위 줄). 경고 LED 는 보드 위 브레드보드에: D26 → 3번 줄 → 220Ω 저항 → 8번 줄 LED 긴 다리(+), 짧은 다리(−) 9번 줄 → 아래 줄 GND",
};

export default {
  "wiring-breadboard.svg": { plus, devkit, expansion },
};
