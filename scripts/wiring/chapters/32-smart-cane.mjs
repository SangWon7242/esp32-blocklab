// 융합 F5 "스마트 지팡이" — 초음파(Trig 13 · Echo 12, 5V), 수동 부저 + → 25번(ESP32 Plus 에 io15 가 없어 15번에서 옮김),
// LED(26번) + 220Ω, 포토레지스터 + 10kΩ → 36번, 틸트 스위치 + 10kΩ → 14번.
// 코드: 빛 값이 클수록 어둡다(> 2500) → 3V3 — 10kΩ — 36번 — 포토레지스터 — GND.
//       틸트는 누우면 1 → 풀업: 3V3 — 10kΩ — 14번 — 틸트 스위치 — GND (서 있으면 구슬이 다리를 이어 0).
// Plus: 초음파는 위 한 줄에 바로(10장과 같음). 3V3 · GND · io36 이 아래 줄이라 브레드보드는 보드 아래,
//       위 줄 io14 · io25 · io26 세 선만 보드 왼쪽 바깥 길로 내려온다.
// DevKit: 초음파는 VIN · GND · D13 · D12 에 바로. 브레드보드는 보드 위, 3V3 · GND(아래 줄)만 보드 왼쪽 바깥 길로.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, buzzer, led, photoresistor, resistor, tiltSwitch, ultrasonic } from "../parts.mjs";

const TEN_K = ["#8b5a2b", "#212529", "#f76707"]; // 갈 검 주

/**
 * 브레드보드 한쪽 칸(half: "top" 이면 a~e 에 다리, 신호는 a / "bottom" 이면 f~j, 신호는 j)에 회로 넷.
 *   tilt: { r, n, t } 10kΩ (n)~(r) → r 은 + 줄, 틸트 (n)~(t) → t 는 − 줄, n ← 14번
 *   buz: { plus, minus } 수동 부저, minus → − 줄, plus ← 25번
 *   led: { sig, anode, cathode } 220Ω (sig)~(anode), LED, cathode → − 줄, sig ← 26번
 *   ldr: { p, s, l } p → + 줄, 10kΩ (p)~(s), 포토레지스터 (s)~(l), l → − 줄, s ← 36번
 */
function circuits(bb, side, { tilt, buz, led: L, ldr }, railCol = (c) => c) {
  const top = side === "top";
  const [legRow, resRow, sigRow] = top ? ["e", "c", "a"] : ["f", "h", "j"];
  const R = (s, c) => bb.rail(side, s, railCol(c));
  const svg = [], jumpers = [];
  const lift = top ? { up: false, lift: 30 } : {};
  [tilt.r, tilt.n, tilt.t, buz.plus, buz.minus, L.sig, L.anode, L.cathode, ldr.p, ldr.s, ldr.l].forEach((c) => bb.tint(c, side));
  // 틸트(풀업)
  svg.push(resistor(bb.hole(tilt.n, resRow), bb.hole(tilt.r, resRow), { bands: TEN_K, label: "10kΩ" }).svg);
  svg.push(tiltSwitch(bb.hole(tilt.n, legRow), bb.hole(tilt.t, legRow), lift).svg);
  jumpers.push(mmWire(bb.hole(tilt.r, sigRow), R("+", tilt.r), C.red, [], "line"));
  jumpers.push(mmWire(bb.hole(tilt.t, sigRow), R("-", tilt.t), C.black, [], "line"));
  // 수동 부저
  svg.push(buzzer(bb.hole(buz.plus, legRow), bb.hole(buz.minus, legRow), top ? { up: false, lift: 28 } : {}).svg);
  jumpers.push(mmWire(bb.hole(buz.minus, sigRow), R("-", buz.minus), C.black, [], "line"));
  // LED
  svg.push(resistor(bb.hole(L.sig, resRow), bb.hole(L.anode, resRow), { label: "220Ω" }).svg);
  svg.push(led(bb.hole(L.anode, legRow), bb.hole(L.cathode, legRow), "#e03131", top ? { up: false, lift: 32 } : {}).svg);
  jumpers.push(mmWire(bb.hole(L.cathode, sigRow), R("-", L.cathode), C.black, [], "line"));
  // 빛: 3V3 — 10kΩ — s(36번) — 포토레지스터 — GND
  jumpers.push(mmWire(bb.hole(ldr.p, sigRow), R("+", ldr.p), C.red, [], "line"));
  svg.push(resistor(bb.hole(ldr.p, resRow), bb.hole(ldr.s, resRow), { bands: TEN_K, label: "10kΩ" }).svg);
  svg.push(photoresistor(bb.hole(ldr.s, legRow), bb.hole(ldr.l, legRow), lift).svg);
  jumpers.push(mmWire(bb.hole(ldr.l, sigRow), R("-", ldr.l), C.black, [], "line"));
  return { svg, jumpers, hole: (c) => bb.hole(c, sigRow), R };
}

/** + − 줄에서 구멍이 있는 열 (6·12·18… 은 비어 있어 옆 열로) */
const railHole = (c) => ((c - 1) % 6 === 5 ? c - 1 : c);

/* ───── ESP32 Plus ───── */
function plus() {
  const b = makePlus({ x: 96, y: 170 });
  const bb = breadboard({ x: 40, y: 500, cols: 30, rails: { top: true, bottom: false } });
  const spec = { led: { sig: 2, anode: 6, cathode: 7 }, buz: { plus: 9, minus: 11 }, tilt: { t: 13, n: 15, r: 20 }, ldr: { p: 23, s: 26, l: 28 } };
  const c = circuits(bb, "top", spec, railHole);
  const parts = [bb.svg, ...c.svg], wires = [], used = [];

  // 초음파: 위 한 줄 5V · GND · io13 · io12 에 바로 (10장과 같음)
  const u = ultrasonic(150, 42);
  parts.push(u.svg);
  const t = { VCC: b.power("5V"), GND: b.power("GND"), Trig: b.gpio(13), Echo: b.gpio(12) };
  wires.push(ffWire(u.pins.VCC, t.VCC, C.red), ffWire(u.pins.GND, t.GND, C.black), ffWire(u.pins.Trig, t.Trig, C.yellow), ffWire(u.pins.Echo, t.Echo, C.green));
  used.push(t.VCC, t.GND, t.Trig, t.Echo);

  // 아래 줄 3V3 · GND · io36 → 브레드보드 (바로 아래)
  const v33 = b.power("3V3"), gnd = b.power("GND", 1), s36 = b.gpio(36);
  const over = (from, to) => [{ x: from.x, y: to.y - 10 }, { x: to.x, y: to.y - 10 }];
  wires.push(mfWire(v33, c.R("+", 16), C.red, over(v33, c.R("+", 16)), "orth"));
  wires.push(mfWire(gnd, c.R("-", 17), C.black, over(gnd, c.R("-", 17)), "orth"));
  wires.push(mfWire(s36, c.hole(26), C.teal, over(s36, c.hole(26)), "orth"));
  used.push(v33, gnd, s36);

  // 위 줄 io26 · io25 · io14 → 보드 왼쪽 바깥 길 → 브레드보드 (바깥쪽부터 26 · 25 · 14)
  const lanes = [[26, 2, 14, 10, 494, C.orange], [25, 9, 22, 18, 488, C.purple], [14, 15, 30, 26, 482, C.blue]];
  for (const [g, col, mx, ty, by, color] of lanes) {
    const p = b.gpio(g), h = c.hole(col);
    wires.push(mfWire(p, h, color, [{ x: p.x, y: ty }, { x: mx, y: ty }, { x: mx, y: by }, { x: h.x, y: by }], "orth"));
    used.push(p);
  }
  wires.push(...c.jumpers);

  const rows = [
    { colors: [C.red, C.black], part: "초음파 VCC · GND", to: "5V · GND (위 줄에 바로)" },
    { colors: [C.yellow, C.green], part: "초음파 Trig · Echo", to: "io13 · io12 (위 줄에 바로)" },
    { colors: [C.red, C.black], part: "3V3 · GND (아래 줄)", to: "+ 줄 · − 줄" },
    { color: C.orange, part: "io26 (위 줄)", to: "2번 줄 → 220Ω → 6번 줄 LED 긴 다리" },
    { color: C.purple, part: "io25 (위 줄)", to: "9번 줄 수동 부저 + 다리" },
    { color: C.black, part: "LED 짧은 다리 7번 · 부저 − 다리 11번 줄", to: "− 줄" },
    { color: C.blue, part: "io14 (위 줄)", to: "15번 줄 (10kΩ 저항과 틸트 스위치 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 20번 줄 · 틸트 13번 줄", to: "+ 줄 · − 줄" },
    { color: C.teal, part: "io36 (아래 줄)", to: "26번 줄 (10kΩ 저항과 포토레지스터 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 23번 줄 · 포토레지스터 28번 줄", to: "+ 줄 · − 줄" },
  ];
  const table = connectionTable(bb.y + bb.h + 16, "이렇게 꽂아요 — 초음파는 보드에 바로, 나머지는 브레드보드에", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  const bb = breadboard({ x: 50, y: 8, cols: 30, rails: { top: false, bottom: true } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 150 });
  const spec = { tilt: { r: 4, n: 8, t: 10 }, led: { sig: 11, anode: 15, cathode: 16 }, buz: { plus: 18, minus: 20 }, ldr: { p: 22, s: 26, l: 28 } };
  const c = circuits(bb, "bottom", spec, railHole);
  const parts = [bb.svg, ...c.svg], wires = [], used = [];

  // 초음파: VIN · GND · D13 · D12 에 바로
  const u = ultrasonic(30, bb.y + bb.h + 22, { titleAt: { x: 106, y: bb.y + bb.h + 10, anchor: "middle" } });
  parts.push(u.svg);
  const vin = b.power("5V"), gTop = b.power("GND", 0), trig = b.gpio(13), echo = b.gpio(12);
  wires.push(ffWire(u.pins.VCC, vin, C.red), ffWire(u.pins.GND, gTop, C.black), ffWire(u.pins.Trig, trig, C.yellow), ffWire(u.pins.Echo, echo, C.green));
  used.push(vin, gTop, trig, echo);

  // 3V3 · GND(아래 줄) → 보드 왼쪽 바깥 길 → + − 줄 왼쪽 끝
  const bot = b.bounds.y + b.bounds.h;
  const v33 = b.power("3V3"), gBot = b.power("GND", 1);
  wires.push(mfWire(v33, c.R("+", 1), C.red, [{ x: v33.x, y: bot + 12 }, { x: 24, y: bot + 12 }, { x: 24, y: c.R("+", 1).y }], "orth"));
  wires.push(mfWire(gBot, c.R("-", 1), C.black, [{ x: gBot.x, y: bot + 22 }, { x: 12, y: bot + 22 }, { x: 12, y: c.R("-", 1).y }], "orth"));
  used.push(v33, gBot);

  const d14 = b.gpio(14), d26 = b.gpio(26), d25 = b.gpio(25), vp = b.gpio(36);
  wires.push(mfWire(d14, c.hole(8), C.blue), mfWire(d26, c.hole(11), C.orange), mfWire(d25, c.hole(18), C.purple), mfWire(vp, c.hole(26), C.teal));
  used.push(d14, d26, d25, vp);
  wires.push(...c.jumpers);

  const rows = [
    { colors: [C.red, C.black], part: "초음파 VCC · GND", to: "VIN · GND (보드에 바로)" },
    { colors: [C.yellow, C.green], part: "초음파 Trig · Echo", to: "D13 · D12 (보드에 바로)" },
    { colors: [C.red, C.black], part: "3V3 · GND (아래 줄)", to: "+ 줄 · − 줄" },
    { color: C.blue, part: "D14", to: "8번 줄 (10kΩ 저항과 틸트 스위치 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 4번 줄 · 틸트 10번 줄", to: "+ 줄 · − 줄" },
    { color: C.orange, part: "D26", to: "11번 줄 → 220Ω → 15번 줄 LED 긴 다리" },
    { color: C.purple, part: "D25", to: "18번 줄 수동 부저 + 다리" },
    { color: C.black, part: "LED 짧은 다리 16번 · 부저 − 다리 20번 줄", to: "− 줄" },
    { color: C.teal, part: "VP(36)", to: "26번 줄 (10kΩ 저항과 포토레지스터 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 22번 줄 · 포토레지스터 28번 줄", to: "+ 줄 · − 줄" },
  ];
  const table = connectionTable(bot + 40, "이렇게 꽂아요 — 초음파는 보드에 바로, 나머지는 브레드보드에", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "스마트 지팡이 배선도(ESP32 Plus 확장 보드): 초음파 센서 VCC · GND · Trig · Echo 는 보드 위쪽 5V · GND · io13 · io12 에 F-F 듀폰선으로 바로. 브레드보드는 보드 아래, 아래 줄 3V3 → + 줄, GND → − 줄. 위 줄 io26 · io25 · io14 는 보드 왼쪽 바깥으로 돌아 내려와요. io26 → 2번 줄 → 220Ω → 6번 줄 LED 긴 다리, 짧은 다리 7번 줄 → − 줄. io25 → 9번 줄 수동 부저 + 다리, − 다리 11번 줄 → − 줄. io14 → 15번 줄, 10kΩ 저항 15~20번 줄(20번 → + 줄), 틸트 스위치 13 · 15번 줄(13번 → − 줄). 아래 줄 io36 → 26번 줄, 10kΩ 저항 23~26번 줄(23번 → + 줄), 포토레지스터 26 · 28번 줄(28번 → − 줄)",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 스마트 지팡이 배선도: 초음파 센서 VCC · GND · Trig · Echo 는 VIN · GND · D13 · D12 에 F-F 듀폰선으로 바로. 브레드보드는 보드 위, 3V3 · GND(아래 줄) → 보드 왼쪽 바깥으로 돌아 + 줄 · − 줄. D14 → 8번 줄, 10kΩ 저항 4~8번 줄(4번 → + 줄), 틸트 스위치 8 · 10번 줄(10번 → − 줄). D26 → 11번 줄 → 220Ω → 15번 줄 LED 긴 다리, 짧은 다리 16번 줄 → − 줄. D25 → 18번 줄 수동 부저 + 다리, − 다리 20번 줄 → − 줄. VP(36) → 26번 줄, 10kΩ 저항 22~26번 줄(22번 → + 줄), 포토레지스터 26 · 28번 줄(28번 → − 줄)",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wsc", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wsck", T.devkit, r.body, r.height); },
  },
};
