// 융합 F5 "스마트 지팡이" — 초음파(Trig 13 · Echo 12, 5V), 수동 부저 + → 25번(ESP32 Plus 에 io15 가 없어 15번에서 옮김),
// LED(26번) + 220Ω, 포토레지스터 + 10kΩ → 36번, 틸트 스위치 + 10kΩ → 14번.
// 코드: 빛 값이 클수록 어둡다(> 2500) → 3V3 — 10kΩ — 36번 — 포토레지스터 — GND.
//       틸트는 누우면 1 → 풀업: 3V3 — 10kΩ — 14번 — 틸트 스위치 — GND (서 있으면 구슬이 다리를 이어 0).
// 초음파 Echo 는 5V 신호라 전압 나누기로 12번에: Echo → 1kΩ → (가운데 줄 = 12번 선) → 2kΩ → GND.
// Plus: 초음파 VCC · Trig 는 위 한 줄 5V · io13 에 바로. Echo 는 센서 옆 작은 브레드보드(10장과 같은 꼴, 2 · 5 · 8번 줄)의
//       저항 둘을 거쳐 io12 로, 초음파 GND 와 보드 GND(위 줄)는 8번 줄에서 만난다.
//       큰 브레드보드는 보드 아래(3V3 · GND · io36 이 아래 줄), 위 줄 io14 · io25 · io26 세 선만 보드 왼쪽 바깥 길로 내려온다.
//       (큰 브레드보드의 빈 칸은 그 세 선에 둘러싸인 센서 · io12 에서 닿으려면 선을 여러 번 가로질러야 해서 작은 띠를 썼다)
// DevKit: 초음파 VCC · GND · Trig 는 VIN · GND · D13 에 바로. Echo 는 큰 브레드보드 2 · 5 · 8번 줄의 저항 둘을 거쳐 D12 로,
//       8번 줄은 − 줄로 점퍼. 브레드보드는 보드 위, 3V3 · GND(아래 줄)만 보드 왼쪽 바깥 길로.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, note, svgDoc, wire } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { breadboard, buzzer, led, photoresistor, resistor, tiltSwitch, ultrasonic } from "../parts.mjs";
import { echoDivider, echoRows } from "../echo-divider.mjs";

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
  // 센서 옆에 작은 브레드보드(Echo 전압 나누기)가 들어가며 보드 · 큰 브레드보드를 오른쪽 · 아래로 옮겼다
  const DX = 48;
  const b = makePlus({ x: 96 + DX, y: 286 });
  const bb = breadboard({ x: 40 + DX, y: b.bounds.y + b.bounds.h + 30, cols: 30, rails: { top: true, bottom: false } });
  const spec = { led: { sig: 2, anode: 6, cathode: 7 }, buz: { plus: 9, minus: 11 }, tilt: { t: 13, n: 15, r: 20 }, ldr: { p: 23, s: 26, l: 28 } };
  const c = circuits(bb, "top", spec, railHole);
  const parts = [bb.svg, ...c.svg], wires = [], used = [];

  // 초음파: VCC · Trig 는 위 한 줄 5V · io13 에 바로. Echo · GND 는 작은 브레드보드의 저항 둘을 거친다 (10장과 같은 꼴)
  const u = ultrasonic(40, 56, { titleAt: { x: 116, y: 42, anchor: "middle" } });
  const strip = breadboard({ x: 222, y: 100, cols: 8, half: "bottom" });
  const div = echoDivider(strip, 2, { order: "echo-first", sensorFrom: "above" });
  parts.push(strip.svg, ...div.svg, u.svg, note(strip.x + strip.w / 2, strip.y - 46, "작은 브레드보드", "middle", 13));
  const t = { VCC: b.power("5V"), GND: b.power("GND"), Trig: b.gpio(13), Echo: b.gpio(12) };
  // VCC · Trig: Echo · GND 선이 꺾이는 가로 길 아래까지 곧게 내려온 뒤 보드 핀으로
  const drop = u.pins.VCC.y + 26;
  wires.push(ffWire(u.pins.VCC, t.VCC, C.red, [{ x: u.pins.VCC.x, y: drop }]), ffWire(u.pins.Trig, t.Trig, C.yellow, [{ x: u.pins.Trig.x, y: drop }]));
  // 초음파 GND · Echo → 센서 아래로 조금 내려와 센서와 작은 브레드보드 사이로 올라가 맨 위 칸(f)으로
  const e = u.pins.Echo, g = u.pins.GND, h = div.holes, turnX = 200, top = b.bounds.y;
  wires.push(mfWire(g, h.gndSensor, C.black, [{ x: g.x, y: g.y + 8 }, { x: turnX, y: g.y + 8 }, { x: turnX, y: strip.y - 30 }, { x: h.gndSensor.x, y: strip.y - 30 }], "orth"));
  wires.push(mfWire(e, h.echo, C.green, [{ x: e.x, y: e.y + 16 }, { x: turnX + 8, y: e.y + 16 }, { x: turnX + 8, y: strip.y - 22 }, { x: h.echo.x, y: strip.y - 22 }], "orth"));
  // io12 → 가운데 줄 (아래 번호 글자 5 를 가리지 않게 5 · 6번 열 사이로 올라가 구멍 바로 아래에서 꺾는다), 보드 GND → GND 줄
  const alley = h.pin.x + 8;
  // (두 가로 길은 보드에서 넉넉히 띄워, VCC · Trig 선이 그 아래로 보드 글자를 덜 가리며 지나가게)
  wires.push(mfWire(t.Echo, h.pin, C.pink, [{ x: t.Echo.x, y: top - 32 }, { x: alley, y: top - 32 }, { x: alley, y: h.pin.y + 8 }, { x: h.pin.x, y: h.pin.y + 8 }], "orth"));
  wires.push(mfWire(t.GND, h.gndBoard, C.black, [{ x: t.GND.x, y: top - 40 }, { x: h.gndBoard.x, y: top - 40 }], "orth"));
  used.push(t.VCC, t.GND, t.Trig, t.Echo);

  // 아래 줄 3V3 · GND · io36 → 브레드보드 (바로 아래)
  const v33 = b.power("3V3"), gnd = b.power("GND", 1), s36 = b.gpio(36);
  const over = (from, to) => [{ x: from.x, y: to.y - 10 }, { x: to.x, y: to.y - 10 }];
  wires.push(mfWire(v33, c.R("+", 16), C.red, over(v33, c.R("+", 16)), "orth"));
  wires.push(mfWire(gnd, c.R("-", 17), C.black, over(gnd, c.R("-", 17)), "orth"));
  wires.push(mfWire(s36, c.hole(26), C.teal, over(s36, c.hole(26)), "orth"));
  used.push(v33, gnd, s36);

  // 위 줄 io26 · io25 · io14 → 보드 왼쪽 바깥 길 → 브레드보드 (바깥쪽부터 26 · 25 · 14)
  const lanes = [[26, 2, 14, 10, bb.y - 6, C.orange], [25, 9, 22, 18, bb.y - 12, C.purple], [14, 15, 30, 26, bb.y - 18, C.blue]];
  for (const [gp, col, mx, ty, by, color] of lanes) {
    const p = b.gpio(gp), hole = c.hole(col);
    wires.push(mfWire(p, hole, color, [{ x: p.x, y: ty }, { x: mx, y: ty }, { x: mx, y: by }, { x: hole.x, y: by }], "orth"));
    used.push(p);
  }
  wires.push(...c.jumpers);

  const small = (r) => ({ ...r, to: `작은 브레드보드 ${r.to}` });
  const rows = [
    { color: C.red, part: "초음파 VCC", to: "5V (위 줄에 바로)" },
    { color: C.yellow, part: "초음파 Trig", to: "io13 (위 줄에 바로)" },
    ...echoRows(div, { echoColor: C.green, pinColor: C.pink, gndColor: C.black, pinLabel: "io12 (위 줄)", gndLabel: "보드 GND (위 줄)" }).map(small),
    { colors: [C.red, C.black], part: "3V3 · GND (아래 줄)", to: "+ 줄 · − 줄" },
    { color: C.orange, part: "io26 (위 줄)", to: "2번 줄 → 220Ω → 6번 줄 LED 긴 다리" },
    { color: C.purple, part: "io25 (위 줄)", to: "9번 줄 수동 부저 + 다리" },
    { color: C.black, part: "LED 짧은 다리 7번 · 부저 − 다리 11번 줄", to: "− 줄" },
    { color: C.blue, part: "io14 (위 줄)", to: "15번 줄 (10kΩ 저항과 틸트 스위치 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 20번 줄 · 틸트 13번 줄", to: "+ 줄 · − 줄" },
    { color: C.teal, part: "io36 (아래 줄)", to: "26번 줄 (10kΩ 저항과 포토레지스터 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 23번 줄 · 포토레지스터 28번 줄", to: "+ 줄 · − 줄" },
  ];
  const table = connectionTable(bb.y + bb.h + 16, "이렇게 꽂아요 — 초음파 Echo 는 저항 둘을 거쳐 보드로", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit 38핀) ───── */
function devkit() {
  const bb = breadboard({ x: 50, y: 8, cols: 30, rails: { top: false, bottom: true } });
  const below = bb.y + bb.h; // 브레드보드 아래 끝
  const b = makeDevkit({ x: 110, y: below + 230 });
  // (보드 핀 선이 꽂히는 12 · 19 · 22 · 26번 줄은 아래 번호 글자가 없는 열 — LED 와 부저는 신호 다리가 뒤쪽에 온다)
  const spec = { tilt: { r: 9, n: 12, t: 14 }, led: { cathode: 15, anode: 16, sig: 19 }, buz: { minus: 20, plus: 22 }, ldr: { p: 23, s: 26, l: 28 } };
  const c = circuits(bb, "bottom", spec, railHole);
  // Echo 전압 나누기: 센서 바로 위 2 · 5 · 8번 줄 (Echo 줄 · 가운데 줄 · GND 줄)
  const div = echoDivider(bb, 2, { order: "echo-first" });
  const parts = [bb.svg, ...c.svg, ...div.svg], wires = [], used = [];

  // 초음파: VCC · GND · Trig 는 VIN · GND · D13 에 바로 (센서 이름은 센서와 가로 선 사이에)
  const u = ultrasonic(30, below + 52, { titleAt: { x: 106, y: below + 38, anchor: "middle" } });
  parts.push(u.svg);
  const vin = b.power("5V"), gTop = b.power("GND", 0), trig = b.gpio(13), echo = b.gpio(12);
  wires.push(ffWire(u.pins.VCC, vin, C.red), ffWire(u.pins.GND, gTop, C.black), ffWire(u.pins.Trig, trig, C.yellow));
  used.push(vin, gTop, trig, echo);
  // Echo → 센서 아래로 조금 내려와 센서 옆으로 올라가 센서 위를 지나 Echo 줄로, D12 → 그 바깥으로 올라가 가운데 줄로.
  // + − 줄 구멍과 아래 번호 글자를 가리지 않게 열과 열 사이로 올라가 구멍 바로 아래에서 꺾는다
  const e = u.pins.Echo, h = div.holes, riseX = 198;
  const into = (hole) => [{ x: hole.x + 8, y: hole.y + 7 }, { x: hole.x, y: hole.y + 7 }];
  wires.push(mfWire(e, h.echo, C.green, [{ x: e.x, y: e.y + 18 }, { x: riseX, y: e.y + 18 }, { x: riseX, y: below + 22 }, { x: h.echo.x + 8, y: below + 22 }, ...into(h.echo)], "orth"));
  wires.push(mfWire(echo, h.pin, C.pink, [{ x: echo.x, y: below + 12 }, { x: h.pin.x + 8, y: below + 12 }, ...into(h.pin)], "orth"));
  // GND 줄 → 바로 아래 − 줄
  wires.push(mmWire(h.gndBoard, c.R("-", div.cols.gnd), C.black, [], "line"));

  // 3V3 · GND(아래 줄) → 보드 왼쪽 바깥 길 → + − 줄 왼쪽 끝
  const bot = b.bounds.y + b.bounds.h;
  const v33 = b.power("3V3"), gBot = b.power("GND", 1);
  wires.push(mfWire(v33, c.R("+", 1), C.red, [{ x: v33.x, y: bot + 12 }, { x: 24, y: bot + 12 }, { x: 24, y: c.R("+", 1).y }], "orth"));
  wires.push(mfWire(gBot, c.R("-", 1), C.black, [{ x: gBot.x, y: bot + 22 }, { x: 12, y: bot + 22 }, { x: 12, y: c.R("-", 1).y }], "orth"));
  used.push(v33, gBot);

  const d14 = b.gpio(14), d26 = b.gpio(26), d25 = b.gpio(25), vp = b.gpio(36);
  wires.push(mfWire(d14, c.hole(spec.tilt.n), C.blue), mfWire(d26, c.hole(spec.led.sig), C.orange), mfWire(d25, c.hole(spec.buz.plus), C.purple), mfWire(vp, c.hole(spec.ldr.s), C.teal));
  used.push(d14, d26, d25, vp);
  wires.push(...c.jumpers);

  const [echoRow, pinRow] = echoRows(div, { echoColor: C.green, pinColor: C.pink, gndColor: C.black, pinLabel: "D12", gndLabel: "" });
  const rows = [
    { colors: [C.red, C.black], part: "초음파 VCC · GND", to: "VIN · GND (보드에 바로)" },
    { color: C.yellow, part: "초음파 Trig", to: "D13 (보드에 바로)" },
    echoRow,
    pinRow,
    { color: C.black, part: `${div.cols.mid}번 줄 → 2kΩ → ${div.cols.gnd}번 줄`, to: "− 줄" },
    { colors: [C.red, C.black], part: "3V3(위 줄 끝) · GND(아래 줄)", to: "+ 줄 · − 줄" },
    { color: C.blue, part: "D14", to: "12번 줄 (10kΩ 저항과 틸트 스위치 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 9번 줄 · 틸트 14번 줄", to: "+ 줄 · − 줄" },
    { color: C.orange, part: "D26", to: "19번 줄 → 220Ω → 16번 줄 LED 긴 다리" },
    { color: C.purple, part: "D25", to: "22번 줄 수동 부저 + 다리" },
    { color: C.black, part: "LED 짧은 다리 15번 · 부저 − 다리 20번 줄", to: "− 줄" },
    { color: C.teal, part: "VP(36)", to: "26번 줄 (10kΩ 저항과 포토레지스터 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 23번 줄 · 포토레지스터 28번 줄", to: "+ 줄 · − 줄" },
  ];
  const table = connectionTable(bot + 40, "이렇게 꽂아요 — 초음파 Echo 는 저항 둘을 거쳐 보드로", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/** 확장 보드 S · V · G 기둥 한 칸에 꽂는 선: from → 세로 lane → 가로 x → 세로 핀 높이 → 핀 */
const columnRun = (from, pin, color, { lane, x, ends = ["f", "f"] }) => wire(from, pin, color, { via: [{ x: from.x, y: lane }, { x, y: lane }, { x, y: pin.y }], style: "orth", ends });

/* ───── 확장 보드(38핀 확장 보드 + DevKit): 점퍼 5V (초음파가 V 줄 전기를 쓴다) ─────
 * 핀이 모두 위 줄 칸이라 브레드보드를 보드 위에. 틸트 풀업 · 포토레지스터 10kΩ 의 3.3V 는 전원 헤더 3V(점퍼와 상관없이 3.3V),
 * GND 는 전원 헤더 GND — 둘 다 보드 왼쪽 바깥으로 올라가 큰 브레드보드 + − 줄 왼쪽 끝으로.
 * 초음파(핀이 위로)는 큰 브레드보드와 보드 사이 왼쪽: VCC · Trig 는 센서 왼쪽으로 돌아 P13 칸 V · S, GND 는 오른쪽으로 돌아 위 줄 GND 칸 S,
 * Echo 는 곧게 올라가 작은 브레드보드(f~j)의 전압 나누기로 (Echo 2번 줄 → 1kΩ → 5번 줄 ← P12 칸 S, 5번 줄 → 2kΩ → 8번 줄 → 큰 브레드보드 − 줄).
 * 큰 브레드보드 회로는 P14 · P26 · P25 · SVP 칸 바로 위 오른쪽에 차례로 (선이 엇갈리지 않게).
 */
function expansion() {
  const bb = breadboard({ x: 36, y: 44, cols: 35, rails: { top: false, bottom: true } });
  const spec = { tilt: { t: 17, n: 19, r: 21 }, led: { cathode: 22, anode: 23, sig: 26 }, buz: { minus: 27, plus: 29 }, ldr: { p: 30, s: 33, l: 35 } };
  const c = circuits(bb, "bottom", spec, railHole);
  const b = makeExpansion({ x: 22, y: 702, jumper: "5V" });
  const top = b.bounds.y;
  const parts = [bb.svg, ...c.svg], wires = [], used = [];

  // 큰 브레드보드 회로 신호: 위 줄 칸 S 핀에서 곧게
  const p14 = b.gpio(14), p26 = b.gpio(26), p25 = b.gpio(25), p36 = b.gpio(36);
  wires.push(mfWire(p14, c.hole(spec.tilt.n), C.blue), mfWire(p26, c.hole(spec.led.sig), C.orange), mfWire(p25, c.hole(spec.buz.plus), C.purple), mfWire(p36, c.hole(spec.ldr.s), C.teal));
  used.push(p14, p26, p25, p36);

  // 전원 헤더 3V · GND → 보드 왼쪽 바깥 길(3V 가 바깥) → + − 줄 왼쪽 끝 (GND 길이 3V 길보다 아래)
  const v33 = b.power("3V3", 0), gH = b.power("GND", 3);
  const plus1 = c.R("+", 1), minus2 = c.R("-", 2), under = bb.y + bb.h;
  wires.push(mfWire(v33, plus1, C.red, [{ x: v33.x - 30, y: v33.y }, { x: v33.x - 30, y: top - 6 }, { x: 12, y: top - 6 }, { x: 12, y: under + 12 }, { x: plus1.x, y: under + 12 }], "orth"));
  wires.push(mfWire(gH, minus2, C.black, [{ x: gH.x, y: top - 14 }, { x: 20, y: top - 14 }, { x: 20, y: under + 20 }, { x: minus2.x, y: under + 20 }], "orth"));
  used.push(v33, gH);

  // 작은 브레드보드(f~j): Echo 2 · 가운데 5 · GND 8번 줄
  const sb = breadboard({ x: 82, y: under + 30, cols: 8, half: "bottom" });
  const div = echoDivider(sb, 2, { order: "echo-first" });
  parts.push(sb.svg, ...div.svg, note(sb.x + sb.w + 8, sb.y + 20, "작은 브레드보드", "start", 13));
  const h = { echo: sb.hole(div.cols.echo, "j"), pin: sb.hole(div.cols.mid, "j"), gnd: sb.hole(div.cols.gnd, "f") };
  // GND 줄(f) → 바로 위 큰 브레드보드 − 줄
  wires.push(mmWire(h.gnd, c.R("-", bb.nearestCol(h.gnd.x, true)), C.black));
  // P12 칸 S → 센서 위 가로 길 → 가운데 줄(j)
  const p12 = b.gpio(12), sbot = sb.y + sb.h;
  wires.push(mfWire(p12, h.pin, C.pink, [{ x: p12.x, y: sbot + 16 }, { x: h.pin.x, y: sbot + 16 }], "orth"));
  used.push(p12);

  // 초음파: 핀이 위로, Echo 핀이 작은 브레드보드 Echo 줄 바로 아래
  const u = ultrasonic(h.echo.x - 86, sbot + 54, { side: "top", title: "초음파 센서", titleAt: { x: h.echo.x - 10, y: sbot + 54 + 114 } });
  parts.push(u.svg);
  const t13 = b.triple(13), gT = b.power("GND", 0);
  const pin = u.pins, upY = pin.VCC.y - 10;
  wires.push(mfWire(pin.Echo, h.echo, C.green));
  // VCC · Trig: 센서 왼쪽 바깥으로 내려와 P13 칸 V · S (V 는 점퍼 5V)
  wires.push(wire(pin.VCC, t13.V, C.red, { via: [{ x: pin.VCC.x, y: upY }, { x: 36, y: upY }, { x: 36, y: top - 34 }, { x: t13.V.x + 4, y: top - 34 }, { x: t13.V.x + 4, y: t13.V.y }], style: "orth" }));
  wires.push(wire(pin.Trig, t13.S, C.yellow, { via: [{ x: pin.Trig.x, y: upY - 8 }, { x: 28, y: upY - 8 }, { x: 28, y: top - 26 }, { x: t13.S.x - 4, y: top - 26 }, { x: t13.S.x - 4, y: t13.S.y }], style: "orth" }));
  // GND: 센서 오른쪽으로 돌아 위 줄 GND 칸 S
  const gx = u.pins.GND.x + 54;
  wires.push(ffWire(pin.GND, gT, C.black, [{ x: pin.GND.x, y: upY }, { x: gx, y: upY }, { x: gx, y: top - 42 }, { x: gT.x, y: top - 42 }], "orth"));
  used.push(t13.V, t13.S, gT);
  wires.push(...c.jumpers);

  const small = (r) => ({ ...r, to: `작은 브레드보드 ${r.to}` });
  const [echoRow, pinRow] = echoRows(div, { echoColor: C.green, pinColor: C.pink, gndColor: C.black, pinLabel: "P12 칸 S", gndLabel: "" });
  const rows = [
    { colors: [C.red, C.yellow], part: "초음파 VCC · Trig", to: "위 줄 P13 칸 V · S (센서 왼쪽으로 돌아)" },
    { color: C.black, part: "초음파 GND", to: "위 줄 GND 칸 S" },
    small(echoRow), small(pinRow),
    { color: C.black, part: `작은 브레드보드 ${div.cols.mid}번 줄 → 2kΩ → ${div.cols.gnd}번 줄`, to: "큰 브레드보드 − 줄" },
    { colors: [C.red, C.black], part: "전원 헤더 3V · GND", to: "+ 줄 · − 줄 (보드 왼쪽 바깥으로)" },
    { color: C.blue, part: "P14 칸 S", to: `${spec.tilt.n}번 줄 (10kΩ 저항과 틸트 스위치 사이)` },
    { colors: [C.red, C.black], part: `10kΩ ${spec.tilt.r}번 줄 · 틸트 ${spec.tilt.t}번 줄`, to: "+ 줄 · − 줄" },
    { color: C.orange, part: "P26 칸 S", to: `${spec.led.sig}번 줄 → 220Ω → ${spec.led.anode}번 줄 LED 긴 다리` },
    { color: C.purple, part: "P25 칸 S", to: `${spec.buz.plus}번 줄 수동 부저 + 다리` },
    { color: C.black, part: `LED 짧은 다리 ${spec.led.cathode}번 · 부저 − 다리 ${spec.buz.minus}번 줄`, to: "− 줄" },
    { color: C.teal, part: "SVP(36) 칸 S", to: `${spec.ldr.s}번 줄 (10kΩ 저항과 포토레지스터 사이)` },
    { colors: [C.red, C.black], part: `10kΩ ${spec.ldr.p}번 줄 · 포토레지스터 ${spec.ldr.l}번 줄`, to: "+ 줄 · − 줄" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 12, "이렇게 꽂아요 — 초음파 Echo 는 저항 둘을 거쳐 보드로 (점퍼 5V)", rows, b.legend);
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom, spec, div: div.cols };
}

const T = {
  plus: "스마트 지팡이 배선도(ESP32 Plus 확장 보드): 초음파 센서 VCC · Trig 는 보드 위쪽 5V · io13 에 F-F 듀폰선으로 바로. Echo 는 센서 옆 작은 브레드보드 2번 줄 → 1kΩ 저항 → 5번 줄 → io12, 5번 줄 → 2kΩ 저항 → 8번 줄 ← 초음파 GND · 보드 위쪽 GND. 큰 브레드보드는 보드 아래, 아래 줄 3V3 → + 줄, GND → − 줄. 위 줄 io26 · io25 · io14 는 보드 왼쪽 바깥으로 돌아 내려와요. io26 → 2번 줄 → 220Ω → 6번 줄 LED 긴 다리, 짧은 다리 7번 줄 → − 줄. io25 → 9번 줄 수동 부저 + 다리, − 다리 11번 줄 → − 줄. io14 → 15번 줄, 10kΩ 저항 15~20번 줄(20번 → + 줄), 틸트 스위치 13 · 15번 줄(13번 → − 줄). 아래 줄 io36 → 26번 줄, 10kΩ 저항 23~26번 줄(23번 → + 줄), 포토레지스터 26 · 28번 줄(28번 → − 줄)",
  devkit: "기본 보드(ESP32 DevKit 38핀) 스마트 지팡이 배선도: 초음파 센서 VCC · GND · Trig 는 VIN · GND · D13 에 F-F 듀폰선으로 바로. 브레드보드는 보드 위. Echo → 2번 줄 → 1kΩ 저항 → 5번 줄 → D12, 5번 줄 → 2kΩ 저항 → 8번 줄 → − 줄. 3V3 · GND(아래 줄) → 보드 왼쪽 바깥으로 돌아 + 줄 · − 줄. D14 → 12번 줄, 10kΩ 저항 9~12번 줄(9번 → + 줄), 틸트 스위치 12 · 14번 줄(14번 → − 줄). D26 → 19번 줄 → 220Ω → 16번 줄 LED 긴 다리, 짧은 다리 15번 줄 → − 줄. D25 → 22번 줄 수동 부저 + 다리, − 다리 20번 줄 → − 줄. VP(36) → 26번 줄, 10kΩ 저항 23~26번 줄(23번 → + 줄), 포토레지스터 26 · 28번 줄(28번 → − 줄)",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wsc", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wsck", T.devkit, r.body, r.height); },
    expansion: () => {
      const r = expansion(), { tilt, led, buz, ldr } = r.spec, d = r.div;
      const title = `확장 보드(ESP32 38핀 확장 보드 + DevKit) 스마트 지팡이 배선도: 이번 수업은 JUMP 점퍼를 5V 쪽으로. 초음파 센서 VCC · Trig 는 위 줄 P13 칸 V · S, GND 는 위 줄 GND 칸 S 핀에 F-F 듀폰선으로 바로. Echo 는 작은 브레드보드 ${d.echo}번 줄 → 1kΩ 저항 → ${d.mid}번 줄 → P12 칸 S 핀, ${d.mid}번 줄 → 2kΩ 저항 → ${d.gnd}번 줄 → 큰 브레드보드 − 줄. 큰 브레드보드는 보드 위: 전원 헤더 3V → + 줄, 전원 헤더 GND → − 줄 (보드 왼쪽 바깥으로 돌아). P14 칸 → ${tilt.n}번 줄, 10kΩ 저항 ${tilt.n}~${tilt.r}번 줄(${tilt.r}번 → + 줄), 틸트 스위치 ${tilt.t} · ${tilt.n}번 줄(${tilt.t}번 → − 줄). P26 칸 → ${led.sig}번 줄 → 220Ω → ${led.anode}번 줄 LED 긴 다리, 짧은 다리 ${led.cathode}번 줄 → − 줄. P25 칸 → ${buz.plus}번 줄 수동 부저 + 다리, − 다리 ${buz.minus}번 줄 → − 줄. SVP(36) 칸 → ${ldr.s}번 줄, 10kΩ 저항 ${ldr.p}~${ldr.s}번 줄(${ldr.p}번 → + 줄), 포토레지스터 ${ldr.s} · ${ldr.l}번 줄(${ldr.l}번 → − 줄)`;
      return svgDoc("wscx", title, r.body, r.height);
    },
  },
};
