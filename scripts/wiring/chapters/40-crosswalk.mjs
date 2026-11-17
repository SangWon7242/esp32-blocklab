// 융합 F13 "보행자 신호등" — 초음파(Trig 13 · Echo 12, 5V), RGB LED(빨강 27 · 초록 25 · 파랑 26, 220Ω 셋, S5 자리 꼴),
// 수동 부저 + → 16번(ESP32 Plus 에 io15 가 없어 15번에서 옮김 — 25 · 27 · 26 은 RGB 가 써서 다음 빈 핀 16), 서보 신호 4(5V).
// RGB LED 다리(빨강 · − · 초록 · 파랑)는 위 칸 d, 저항 셋이 가운데 홈을 건너고 신호선은 아래 칸 j 로(5장과 같은 꼴).
// 부저는 빨강과 초록 저항 사이 아래 칸에 꽂아 16번 선이 27번 · 25번 선 사이로 곧게 올라가게 했다.
// 초음파 Echo 는 5V 신호라 보드 핀에 바로 잇지 않고 브레드보드 빈 세 줄의 전압 나누기(1kΩ · 2kΩ, echo-divider.mjs)를 거친다:
//   Echo → Echo 줄 → 1kΩ → 가운데 줄 → 12번 핀, 가운데 줄 → 2kΩ → GND 줄 → 아래 − 줄(점퍼).
// Plus: 브레드보드(21줄)는 보드 위, 초음파는 그 옆. VCC · Trig 는 위 한 줄 5V · io13 에 바로, Echo 는 3번 줄 → 1kΩ → 6번 줄 → io12,
//       6번 줄 → 2kΩ → 9번 줄 → 아래 − 줄. 초음파 GND 도 아래 − 줄로(선이 서로 건너지 않게). 서보 플러그는 ANALOG io4 줄에 그대로.
//       RGB · 부저는 11번 줄부터. 브레드보드 − 줄은 아래 줄 GND 에서 보드 바깥 길로.
// DevKit: 5V 핀이 VIN 하나라 초음파 VCC · 서보 빨강 · VIN 을 브레드보드 아래 + 줄(5V)에 모은다.
//       초음파는 브레드보드와 보드 사이: Trig 는 D13 에 F-F 로 바로, VCC · GND 는 + − 줄로,
//       Echo 는 18번 줄 → 1kΩ → 15번 줄 → D12, 15번 줄 → 2kΩ → 12번 줄 → 아래 − 줄.
//       서보는 보드 아래: 주황 → D4, 빨강 · 갈색 → 보드 바깥 길로 + − 줄 끝.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, svgDoc, wire } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, buzzer, resistor, rgbSpread, servo, servoWithPlug, ultrasonic } from "../parts.mjs";
import { railCol } from "./11-button-touch.mjs";
import { echoDivider, echoRows } from "../echo-divider.mjs";

/**
 * RGB(빨강 c · − c+2 · 초록 c+4 · 파랑 c+6, d 칸) + 220Ω 셋(e~g) + 수동 부저(+ c+1 · − c+3, f 칸).
 * 신호 구멍: R (c, j) · G (c+4, j) · B (c+6, j) · 부저 (c+1, j). − 다리 → 위 − 줄, 부저 − → 아래 − 줄.
 */
function lightAndBuzzer(bb, c) {
  const col = { R: c, K: c + 2, G: c + 4, B: c + 6, bp: c + 1, bm: c + 3 };
  const svg = [], jumpers = [];
  [col.R, col.K, col.G, col.B].forEach((k) => bb.tint(k, "top"));
  [col.R, col.G, col.B, col.bp, col.bm].forEach((k) => bb.tint(k, "bottom"));
  for (const k of ["R", "G", "B"]) svg.push(resistor(bb.hole(col[k], "e"), bb.hole(col[k], "g"), { label: k === "B" ? "220Ω" : undefined }).svg);
  svg.push(rgbSpread([bb.hole(col.R, "d"), bb.hole(col.K, "d"), bb.hole(col.G, "d"), bb.hole(col.B, "d")]));
  svg.push(buzzer(bb.hole(col.bp, "h"), bb.hole(col.bm, "h")).svg);
  jumpers.push(mmWire(bb.hole(col.K, "a"), bb.rail("top", "-", railCol(col.K)), C.black, [], "line"));
  jumpers.push(mmWire(bb.hole(col.bm, "j"), bb.rail("bottom", "-", railCol(col.bm)), C.black, [], "line"));
  const sig = (k) => bb.hole(col[k], "j");
  return { svg, jumpers, col, sig };
}

/** 위 − 줄 ↔ 아래 − 줄 점퍼 (브레드보드 끝 바깥, side "left" | "right") */
function minusLink(bb, side) {
  const c = side === "left" ? 1 : railCol(bb.nearestCol(bb.x + bb.w, true));
  const t = bb.rail("top", "-", c), b = bb.rail("bottom", "-", c);
  const x = side === "left" ? bb.x - 10 : bb.x + bb.w + 10;
  return mmWire(t, b, C.black, [{ x, y: t.y }, { x, y: b.y }], "orth");
}

/* ───── ESP32 Plus ───── */
function plus() {
  const bb = breadboard({ x: 188, y: 8, cols: 21, rails: { top: true, bottom: true } });
  const b = makePlus({ x: 96, y: bb.y + bb.h + 52 });
  const parts = [bb.svg], wires = [], used = [];
  const L = lightAndBuzzer(bb, 11);
  // Echo 전압 나누기: Echo 3번 줄 → 1kΩ → 6번 줄(→ io12) → 2kΩ → 9번 줄(→ 아래 − 줄)
  const div = echoDivider(bb, 3, { order: "echo-first" });
  parts.push(...L.svg, ...div.svg);

  const p = { R: b.gpio(27), G: b.gpio(25), B: b.gpio(26), bz: b.gpio(16) };
  wires.push(mfWire(p.R, L.sig("R"), C.red), mfWire(p.bz, L.sig("bp"), C.orange), mfWire(p.G, L.sig("G"), C.green), mfWire(p.B, L.sig("B"), C.blue));
  used.push(p.R, p.G, p.B, p.bz);
  // 브레드보드 GND: 아래 줄 GND → 보드 오른쪽 바깥 길 → 아래 − 줄 오른쪽 끝
  const gBot = b.power("GND", 1), top = b.bounds.y, bot = b.bounds.y + b.bounds.h;
  const endCol = railCol(bb.nearestCol(bb.x + bb.w, true)), gIn = bb.rail("bottom", "-", endCol);
  wires.push(mfWire(gBot, gIn, C.black, [{ x: gBot.x, y: bot + 14 }, { x: 612, y: bot + 14 }, { x: 612, y: gIn.y }], "orth"));
  wires.push(...L.jumpers, minusLink(bb, "left"));
  wires.push(mmWire(div.holes.gndBoard, bb.rail("bottom", "-", railCol(div.cols.gnd)), C.black, [], "line"));
  used.push(gBot);

  // 초음파: 브레드보드 옆. 선 넷은 브레드보드와 보드 사이 가로 길 넷으로(서로 건너지 않게 GND 가 가장 위, VCC 가 가장 아래)
  const u = ultrasonic(8, 190, { titleAt: { x: 84, y: 174 } });
  parts.push(u.svg);
  const t = { VCC: b.power("5V"), Trig: b.gpio(13), Echo: b.gpio(12) };
  const lane = { GND: top - 43, Echo: top - 33, Trig: top - 23, VCC: top - 13 };
  const turn = (pin, to, y) => [{ x: pin.x, y }, { x: to.x, y }];
  // 초음파 GND → 아래 − 줄 2번 칸 (+ 줄 구멍 사이로 올라가서)
  const ugRail = bb.rail("bottom", "-", 2), gX = (bb.hole(1, "a").x + bb.hole(2, "a").x) / 2;
  wires.push(
    ffWire(u.pins.VCC, t.VCC, C.red, turn(u.pins.VCC, t.VCC, lane.VCC), "orth"),
    ffWire(u.pins.Trig, t.Trig, C.yellow, turn(u.pins.Trig, t.Trig, lane.Trig), "orth"),
    mfWire(u.pins.Echo, div.holes.echo, C.purple, turn(u.pins.Echo, div.holes.echo, lane.Echo), "orth"),
    mfWire(u.pins.GND, ugRail, C.black, [{ x: u.pins.GND.x, y: lane.GND }, { x: gX, y: lane.GND }, { x: gX, y: ugRail.y }], "orth"),
    mfWire(t.Echo, div.holes.pin, C.teal),
  );
  used.push(t.VCC, t.Trig, t.Echo);

  // 서보: 플러그를 ANALOG io4 줄에 그대로
  const sv = b.triple(4);
  parts.push(servo(14, sv.S.y - 22, [sv.G, sv.V, sv.S]).svg);
  used.push(sv.G, sv.V, sv.S);

  const rows = [
    { colors: [C.red, C.yellow], part: "초음파 VCC · Trig", to: "5V · io13 (위 한 줄에 바로)" },
    ...echoRows(div, { echoColor: C.purple, pinColor: C.teal, pinLabel: "io12 핀" }).slice(0, 2),
    { color: C.black, part: `${div.cols.mid}번 줄 → 2kΩ → ${div.cols.gnd}번 줄`, to: "아래 − 줄 (점퍼)" },
    { color: C.black, part: "초음파 GND", to: "아래 − 줄" },
    { colors: [C.brown, C.red, C.orange], part: "서보 플러그", to: "io4 줄 G · V · S" },
    { color: C.red, part: "io27 핀", to: `${L.col.R}번 줄 → 220Ω(홈 건너) → 빨강(R) 다리` },
    { color: C.green, part: "io25 핀", to: `${L.col.G}번 줄 → 220Ω(홈 건너) → 초록(G) 다리` },
    { color: C.blue, part: "io26 핀", to: `${L.col.B}번 줄 → 220Ω(홈 건너) → 파랑(B) 다리` },
    { color: C.black, part: `RGB 가장 긴 다리(−) ${L.col.K}번 줄`, to: "위 − 줄" },
    { color: C.orange, part: "io16 핀", to: `${L.col.bp}번 줄 수동 부저 + 다리 (− 다리 ${L.col.bm}번 줄 → 아래 − 줄)` },
    { color: C.black, part: "GND(아래 줄)", to: "보드 바깥으로 돌아 아래 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" },
  ];
  const table = connectionTable(bot + 34, "이렇게 꽂아요 — 초음파 Echo 는 저항 둘을 거쳐 io12 로", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  const bb = breadboard({ x: 40, y: 8, cols: 30, rails: { top: true, bottom: true } });
  const b = makeDevkit({ x: 110, y: 528 });
  const parts = [bb.svg], wires = [], used = [];
  const R = (s, c) => bb.rail("bottom", s, c);
  const top = b.bounds.y, bot = b.bounds.y + b.bounds.h;

  // RGB (S5 꼴): 빨강 19 · − 21 · 초록 23 · 파랑 25번 줄. 수동 부저: + 27 · − 29번 줄 (아래 칸)
  const col = { R: 19, K: 21, G: 23, B: 25, bp: 27, bm: 29 };
  [col.R, col.K, col.G, col.B].forEach((k) => bb.tint(k, "top"));
  [col.R, col.G, col.B, col.bp, col.bm].forEach((k) => bb.tint(k, "bottom"));
  for (const k of ["R", "G", "B"]) parts.push(resistor(bb.hole(col[k], "e"), bb.hole(col[k], "g"), { label: k === "R" ? "220Ω" : undefined }).svg);
  parts.push(rgbSpread([bb.hole(col.R, "d"), bb.hole(col.K, "d"), bb.hole(col.G, "d"), bb.hole(col.B, "d")]));
  parts.push(buzzer(bb.hole(col.bp, "h"), bb.hole(col.bm, "h")).svg);
  wires.push(mmWire(bb.hole(col.K, "a"), bb.rail("top", "-", col.K), C.black));
  wires.push(mmWire(bb.hole(col.bm, "j"), R("-", col.bm - 1), C.black, [], "line"));
  wires.push(minusLink(bb, "left"));
  // Echo 전압 나누기: Echo 18번 줄 → 1kΩ → 15번 줄(→ D12) → 2kΩ → 12번 줄(→ 아래 − 줄)
  const div = echoDivider(bb, 12);
  parts.push(...div.svg);
  wires.push(mmWire(div.holes.gndBoard, R("-", railCol(div.cols.gnd)), C.black, [], "line"));

  // 초음파: 브레드보드와 보드 사이, Trig 가 D13 바로 위. Echo 는 센서 옆으로 돌아 올라가 18번 줄(+ − 줄 빈칸 열)로,
  // 15번 줄에서 내려온 선이 D12 로 (이 선이 초음파 GND · Echo 선을 한 번씩 건넌다)
  const u = ultrasonic(122, 340, { titleAt: { x: 198, y: 326 } });
  parts.push(u.svg);
  const yp = u.pins.VCC.y;
  const trig = b.gpio(13), echo = b.gpio(12);
  wires.push(ffWire(u.pins.Trig, trig, C.yellow, [], "line"));
  wires.push(mfWire(u.pins.Echo, div.holes.echo, C.purple, [{ x: u.pins.Echo.x, y: yp + 20 }, { x: div.holes.echo.x, y: yp + 20 }], "orth"));
  wires.push(mfWire(echo, div.holes.pin, C.teal, [{ x: echo.x, y: yp + 30 }, { x: div.holes.pin.x, y: yp + 30 }], "orth"));
  used.push(trig, echo);
  // VCC → 왼쪽으로 돌아 + 줄 4번 칸(아래에서), VIN → 더 낮은 길로 + 줄 3번 칸
  const vccRail = R("+", 4), vinRail = R("+", 3), vin = b.power("5V");
  wires.push(mfWire(u.pins.VCC, vccRail, C.red, [{ x: u.pins.VCC.x, y: yp + 10 }, { x: vccRail.x, y: yp + 10 }], "orth"));
  wires.push(mfWire(vin, vinRail, C.red, [{ x: vin.x, y: top - 8 }, { x: vinRail.x, y: top - 8 }], "orth"));
  used.push(vin);
  // 초음파 GND → 센서 옆으로 돌아 + 줄 구멍 사이(16 · 17번 열 사이)로 − 줄 17번 칸
  const ugRail = R("-", 17), gapX = (bb.hole(16, "a").x + bb.hole(17, "a").x) / 2;
  wires.push(mfWire(u.pins.GND, ugRail, C.black, [{ x: u.pins.GND.x, y: yp + 10 }, { x: gapX, y: yp + 10 }, { x: gapX, y: ugRail.y }], "orth"));
  // 보드 GND(아래 줄) → 보드 왼쪽 바깥 길 → + 줄 구멍 사이로 − 줄 2번 칸
  const gBot = b.power("GND", 1), gRail = R("-", 2), gX = (bb.hole(1, "a").x + bb.hole(2, "a").x) / 2;
  wires.push(mfWire(gBot, gRail, C.black, [{ x: gBot.x, y: bot + 12 }, { x: gX, y: bot + 12 }, { x: gX, y: gRail.y }], "orth"));
  used.push(gBot);

  // RGB 신호: 보드 바로 위 세 길로 오른쪽 열까지 (빨강이 가장 높게, 파랑 · 초록 순)
  const p = { R: b.gpio(27), G: b.gpio(25), B: b.gpio(26) };
  const sig = (k) => bb.hole(col[k], "j");
  const lane = { R: top - 34, B: top - 26, G: top - 18 };
  for (const [k, color] of [["R", C.red], ["B", C.blue], ["G", C.green]]) wires.push(mfWire(p[k], sig(k), color, [{ x: p[k].x, y: lane[k] }, { x: sig(k).x, y: lane[k] }], "orth"));
  used.push(p.R, p.G, p.B);

  // 서보: 보드 아래. 플러그(오른쪽, 위→아래 S V G): 주황 → D4 바로, 빨강 → 보드 오른쪽 바깥 길로 + 줄 끝, 갈색 → 바깥 길로 − 줄 끝
  const d4 = b.gpio(4);
  const s = servoWithPlug(d4.x - 110, bot + 40, { order: ["S", "V", "G"], titleAt: { x: d4.x - 76, y: bot + 104 } });
  parts.push(s.svg);
  wires.push(mfWire(d4, s.pins.S, C.orange, [], "line"));
  const vEnd = R("+", 29), gEnd = R("-", 29);
  wires.push(wire(s.pins.V, vEnd, C.red, { via: [{ x: 612, y: s.pins.V.y }, { x: 612, y: vEnd.y }], style: "orth", ends: ["m", "m"] }));
  wires.push(wire(s.pins.G, gEnd, C.black, { via: [{ x: 626, y: s.pins.G.y }, { x: 626, y: gEnd.y }], style: "orth", ends: ["m", "m"] }));
  used.push(d4);

  // 부저 + ← RX2(16): 아래로 나와 오른쪽 바깥 길(가장 안쪽)로 올라와 27번 줄
  const bz = b.gpio(16), bzHole = sig("bp");
  wires.push(mfWire(bz, bzHole, C.orange, [{ x: bz.x, y: bot + 22 }, { x: 598, y: bot + 22 }, { x: 598, y: top - 42 }, { x: bzHole.x, y: top - 42 }], "orth"));
  used.push(bz);

  const rows = [
    { color: C.red, part: "VIN(5V) · 초음파 VCC · 서보 빨강", to: "아래 + 줄" },
    { color: C.black, part: "GND(아래 줄) · 초음파 GND · 서보 갈색", to: "아래 − 줄" },
    { color: C.yellow, part: "초음파 Trig", to: "D13 (보드에 바로)" },
    ...echoRows(div, { echoColor: C.purple, pinColor: C.teal, pinLabel: "D12 핀" }).slice(0, 2),
    { color: C.black, part: `${div.cols.mid}번 줄 → 2kΩ → ${div.cols.gnd}번 줄`, to: "아래 − 줄 (점퍼)" },
    { color: C.orange, part: "서보 주황", to: "D4" },
    { color: C.red, part: "D27 핀", to: `${col.R}번 줄 → 220Ω(홈 건너) → 빨강(R) 다리` },
    { color: C.green, part: "D25 핀", to: `${col.G}번 줄 → 220Ω(홈 건너) → 초록(G) 다리` },
    { color: C.blue, part: "D26 핀", to: `${col.B}번 줄 → 220Ω(홈 건너) → 파랑(B) 다리` },
    { color: C.black, part: `RGB 가장 긴 다리(−) ${col.K}번 줄`, to: "위 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" },
    { color: C.orange, part: "RX2(16) 핀", to: `${col.bp}번 줄 수동 부저 + 다리 (− 다리 ${col.bm}번 줄 → 아래 − 줄)` },
  ];
  const table = connectionTable(s.pins.G.y + 70, "이렇게 꽂아요 — 5V 는 + 줄로 나눠 쓰고, Echo 는 저항 둘을 거쳐 D12 로", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "보행자 신호등 배선도(ESP32 Plus 확장 보드): 브레드보드는 보드 위, 초음파 센서는 브레드보드 옆. 초음파 VCC · Trig 는 보드 위쪽 5V · io13 에 F-F 듀폰선으로 바로. Echo 는 브레드보드 3번 줄 → 1kΩ 저항 → 6번 줄 → io12, 6번 줄 → 2kΩ 저항 → 9번 줄 → 아래 − 줄. 초음파 GND 도 아래 − 줄. 서보 플러그는 ANALOG 묶음 io4 줄에 갈색 G · 빨강 V · 주황 S 가 맞게. RGB LED 다리를 d 칸 11 · 13 · 15 · 17번 줄에(빨강 · − · 초록 · 파랑), 11 · 15 · 17번 줄마다 220Ω 저항이 가운데 홈을 건너고 io27 → 11번 줄, io25 → 15번 줄, io26 → 17번 줄. 가장 긴 − 다리(13번 줄)는 위 − 줄. 수동 부저 + 다리 12번 줄 ← io16, − 다리 14번 줄 → 아래 − 줄. 아래 줄 GND → 보드 바깥으로 돌아 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 보행자 신호등 배선도: 브레드보드는 보드 위. VIN(5V) → 아래 + 줄, 아래 줄 GND → 보드 바깥으로 돌아 아래 − 줄. 초음파 센서는 브레드보드와 보드 사이: Trig → D13 에 F-F 듀폰선으로 바로, VCC → + 줄, GND → − 줄. Echo 는 브레드보드 18번 줄 → 1kΩ 저항 → 15번 줄 → D12, 15번 줄 → 2kΩ 저항 → 12번 줄 → 아래 − 줄. 서보는 보드 아래: 주황 → D4, 빨강 · 갈색 → 보드 바깥으로 돌아 + − 줄 끝. RGB LED 다리를 d 칸 19 · 21 · 23 · 25번 줄에(빨강 · − · 초록 · 파랑), 19 · 23 · 25번 줄마다 220Ω 저항이 가운데 홈을 건너고 D27 → 19번 줄, D25 → 23번 줄, D26 → 25번 줄. 가장 긴 − 다리(21번 줄)는 위 − 줄, 위 − 줄과 아래 − 줄은 점퍼로. 수동 부저 + 다리 27번 줄 ← RX2(16, 보드 바깥 길), − 다리 29번 줄 → 아래 − 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wcw", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wcwk", T.devkit, r.body, r.height); },
  },
};
