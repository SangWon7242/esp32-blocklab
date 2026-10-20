// 융합 F4 "안전 선풍기" — 팬(130 모터) 모듈 IN+ 13 · IN− 12, 초음파 Trig 18 · Echo 19(5V),
// 버튼 A 14 · 버튼 B 27 (풀업: 한쪽 다리 → 핀, 대각선 다리 → GND, 누르면 0), LED 1 · 2 · 3 = 25 · 26 · 33 (220Ω 셋).
// 두 보드 모두 버튼 · LED 브레드보드를 맨 위에 두고, 신호선은 계단처럼 꺾어 보드 핀으로 내려온다.
// Plus: 모듈은 보드에 바로 — 초음파는 위 줄 5V · GND · io18 · io19(10장과 같은 꼴), 팬 IN+ · IN− 는 io13 · io12,
//       팬 G · V 는 위 줄 GND · 5V 를 초음파가 쓰므로 io12 와 io14 사이 빈 틈 → 빈 띠 → I2C 묶음 첫 줄 GND · 5V.
//       LED 3 은 아래 줄 io33, 브레드보드 − 줄은 아래 줄 GND — 둘 다 보드 오른쪽 바깥으로 돌아 아래에서.
// DevKit: VIN(5V) 하나를 팬 · 초음파가 나눠 쓰므로 보드 위에 + − 줄 띠(VIN · GND). 초음파는 Trig · Echo 가 아래 줄
//       D18 · D19 라 보드 아래(핀이 위로), VCC 는 보드 왼쪽 바깥으로 띠 + 줄, GND 는 아래 줄 GND.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, note, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, button, fan, led, resistor, ultrasonic } from "../parts.mjs";

/** + − 줄에서 구멍이 있는 열 (6·12·18… 은 비어 있어 옆 열로) */
const railHole = (c) => ((c - 1) % 6 === 5 ? c - 1 : c);

/** 풀업 버튼: 신호는 왼쪽 아래 다리 줄 (col, j), 대각선 반대쪽 줄 (col+2, a) → 위 − 줄 (11장과 같은 꼴) */
function buttonPullup(bb, col, label) {
  const b = button(bb, col, { label });
  bb.tint(col, "bottom");
  bb.tint(col + 2, "top");
  const jumper = mmWire(bb.hole(col + 2, "a"), bb.rail("top", "-", railHole(col + 2)), C.black);
  return { svg: b.svg, jumper, hole: bb.hole(col, "j"), cols: { sig: col, gnd: col + 2 } };
}

/** LED 회로: 신호 (k, j) → 220Ω (k,h)~(k+4,h) → 긴 다리 (k+4, f), 짧은 다리 (k+5, f) → (k+5, j) → 아래 − 줄 */
function ledRight(bb, k, color, railCol = railHole(k + 5)) {
  [k, k + 4, k + 5].forEach((c) => bb.tint(c, "bottom"));
  const svg = [resistor(bb.hole(k, "h"), bb.hole(k + 4, "h"), { label: "220Ω" }).svg, led(bb.hole(k + 4, "f"), bb.hole(k + 5, "f"), color).svg].join("");
  const jumper = mmWire(bb.hole(k + 5, "j"), bb.rail("bottom", "-", railCol), C.black);
  return { svg, jumper, hole: bb.hole(k, "j"), cols: { sig: k, anode: k + 4, cathode: k + 5 } };
}

/** 위 − 줄과 아래 − 줄을 브레드보드 끝 바깥으로 잇는 점퍼 (col 이 1 이면 왼쪽, 아니면 오른쪽) */
function railLink(bb, col = 1) {
  const t = bb.rail("top", "-", col), b = bb.rail("bottom", "-", col), x = col === 1 ? bb.x - 10 : bb.x + bb.w + 10;
  return mmWire(t, b, C.black, [{ x, y: t.y }, { x, y: b.y }], "orth");
}

const LED_COLORS = ["#2f9e44", "#f59f00", "#e03131"]; // 1 초록 · 2 노랑 · 3 빨강

/** 맨 위 브레드보드: 버튼 A(3~5번 줄) · B(7~9번 줄), LED 1 · 2 · 3 (11 · 18 · 25번 줄부터) */
function topBoard(x, linkCol = 1) {
  const bb = breadboard({ x, y: 8, cols: 30, rails: { top: true, bottom: true } });
  const btnA = buttonPullup(bb, 3, "A"), btnB = buttonPullup(bb, 7, "B");
  const leds = [ledRight(bb, 11, LED_COLORS[0]), ledRight(bb, 18, LED_COLORS[1]), ledRight(bb, 25, LED_COLORS[2], 28)];
  const svg = [bb.svg, btnA.svg, btnB.svg, ...leds.map((l) => l.svg)];
  const jumpers = [btnA.jumper, btnB.jumper, ...leds.map((l) => l.jumper), railLink(bb, linkCol)];
  return { bb, btnA, btnB, leds, svg, jumpers };
}

/** 브레드보드 신호 구멍 → 아래로 laneY → 가로로 핀 x → 핀 (계단 꼴) */
const stair = (from, pin, color, laneY) => mfWire(pin, from, color, [{ x: pin.x, y: laneY }, { x: from.x, y: laneY }], "orth");

/* ───── ESP32 Plus ───── */
function plus() {
  const top = topBoard(40);
  const b = makePlus({ x: 96, y: 504 });
  const X = b.bounds.x, Y = b.bounds.y;
  const parts = [...top.svg], wires = [], used = [];

  // 버튼 · LED 신호: 왼쪽 것일수록 깊이 꺾는다
  const sA = b.gpio(14), sB = b.gpio(27), s25 = b.gpio(25), s26 = b.gpio(26);
  wires.push(stair(top.btnA.hole, sA, C.blue, 358), stair(top.btnB.hole, sB, C.purple, 350), stair(top.leds[0].hole, s25, C.green, 342), stair(top.leds[1].hole, s26, C.yellow, 334));
  used.push(sA, sB, s25, s26);
  // LED 3: 아래 줄 io33 (보드 오른쪽 바깥 → 아래에서)
  const s33 = b.gpio(33, { at: "bottom" }), h3 = top.leds[2].hole;
  wires.push(mfWire(s33, h3, C.orange, [{ x: s33.x, y: Y + 310 }, { x: 600, y: Y + 310 }, { x: 600, y: 326 }, { x: h3.x, y: 326 }], "orth"));
  // 브레드보드 − 줄 → 아래 줄 GND
  const gBot = b.power("GND", 1), gr = top.bb.rail("bottom", "-", 29);
  wires.push(mfWire(gBot, gr, C.black, [{ x: gBot.x, y: Y + 322 }, { x: 616, y: Y + 322 }, { x: 616, y: gr.y }], "orth"));
  used.push(s33, gBot);
  wires.push(...top.jumpers);

  // 초음파: 위 줄 5V · GND · io18 · io19 (10장과 같은 꼴)
  const u = ultrasonic(50, 392, { titleAt: { x: 126, y: 378 } });
  const ut = { VCC: b.power("5V"), GND: b.power("GND"), Trig: b.gpio(18), Echo: b.gpio(19) };
  wires.push(ffWire(u.pins.VCC, ut.VCC, C.red), ffWire(u.pins.GND, ut.GND, C.black), ffWire(u.pins.Trig, ut.Trig, C.yellow), ffWire(u.pins.Echo, ut.Echo, C.green));
  used.push(ut.VCC, ut.GND, ut.Trig, ut.Echo);

  // 팬: IN+ · IN− → io13 · io12, G · V → 빈 틈(io12 와 io14 사이) → 빈 띠 → I2C 묶음 첫 줄 GND · 5V
  const f = fan(X + 121, 398, { titleAt: { x: X + 176, y: 384 } });
  const bus = b.i2c(0);
  wires.push(ffWire(f.pins["IN+"], b.gpio(13), C.teal), ffWire(f.pins["IN−"], b.gpio(12), C.pink));
  const gapG = X + 222, gapV = X + 238;
  wires.push(ffWire(f.pins.G, bus.GND, C.black, [{ x: f.pins.G.x, y: f.pins.G.y + 18 }, { x: gapG, y: f.pins.G.y + 18 }, { x: gapG, y: b.lane.top + 4 }, { x: bus.GND.x, y: b.lane.top + 4 }], "orth"));
  wires.push(ffWire(f.pins.V, bus.VCC, C.red, [{ x: f.pins.V.x, y: f.pins.V.y + 10 }, { x: gapV, y: f.pins.V.y + 10 }, { x: gapV, y: b.lane.top + 12 }, { x: bus.VCC.x, y: b.lane.top + 12 }], "orth"));
  used.push(b.gpio(13), b.gpio(12), bus.GND, bus.VCC);
  parts.push(u.svg, f.svg);
  // 외부 전원 단자 + 배터리 홀더 메모
  const jack = { x: X - 10, y: Y + 150, w: 24, h: 30 };
  parts.push(`<rect x="${jack.x}" y="${jack.y}" width="${jack.w}" height="${jack.h}" rx="5" fill="#212529" stroke="#868e96" stroke-width="2"/><circle cx="${jack.x + 9}" cy="${jack.y + jack.h / 2}" r="5" fill="#495057" stroke="none"/>`);
  parts.push(note(12, Y + 332, "배터리 홀더(AA 6개)는", "start", 13), note(12, Y + 350, "USB 아래 외부 전원 단자에", "start", 13));

  const rows = [
    { colors: [C.red, C.black], part: "초음파 VCC · GND", to: "5V · GND (위 줄)" },
    { colors: [C.yellow, C.green], part: "초음파 Trig · Echo", to: "io18 · io19" },
    { colors: [C.teal, C.pink], part: "팬 IN+ · IN−", to: "io13 · io12" },
    { colors: [C.black, C.red], part: "팬 G · V", to: "가운데 빈 틈으로 → I2C GND · 5V" },
    { color: C.blue, part: "io14 (버튼 A)", to: "3번 줄, 대각선 5번 줄 → 위 − 줄" },
    { color: C.purple, part: "io27 (버튼 B)", to: "7번 줄, 대각선 9번 줄 → 위 − 줄" },
    { color: C.green, part: "io25 (LED 1)", to: "11번 줄 → 220Ω → 15번 줄 긴 다리" },
    { color: C.yellow, part: "io26 (LED 2)", to: "18번 줄 → 220Ω → 22번 줄 긴 다리" },
    { color: C.orange, part: "io33 (LED 3, 아래 줄)", to: "25번 줄 → 220Ω → 29번 줄 긴 다리" },
    { color: C.black, part: "LED 짧은 다리 16 · 23 · 30번 줄", to: "아래 − 줄 (위 − 줄과 점퍼로)" },
    { color: C.black, part: "아래 − 줄", to: "아래 줄 GND (보드 바깥으로 돌아)" },
  ];
  const table = connectionTable(Y + 366, "이렇게 꽂아요 — 모듈은 보드에 바로, 버튼 · LED 는 브레드보드에", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  const top = topBoard(40, 29);
  const b = makeDevkit({ x: 110, y: 600 });
  const parts = [...top.svg], wires = [], used = [];
  const bot = b.bounds.y + b.bounds.h;

  // 버튼 · LED 신호 (D14 · D27 · D25 · D26 · D33)
  const sA = b.gpio(14), sB = b.gpio(27), s25 = b.gpio(25), s26 = b.gpio(26), s33 = b.gpio(33);
  wires.push(stair(top.btnA.hole, sA, C.blue, 366), stair(top.btnB.hole, sB, C.purple, 358), stair(top.leds[0].hole, s25, C.green, 350), stair(top.leds[1].hole, s26, C.yellow, 334), stair(top.leds[2].hole, s33, C.orange, 342));
  used.push(sA, sB, s25, s26, s33);
  wires.push(...top.jumpers);

  // VIN · GND 를 나눠 쓰는 + − 줄 띠 (보드 위 왼쪽)
  const strip = breadboard({ x: 40, y: 520, cols: 7, railsOnly: true });
  const r = (s, c) => strip.rail("top", s, c);
  parts.push(strip.svg);
  const vin = b.power("5V"), gTop = b.power("GND", 0);
  wires.push(mfWire(vin, r("+", 3), C.red, [{ x: vin.x, y: b.bounds.y - 10 }, { x: r("+", 3).x, y: b.bounds.y - 10 }], "orth"));
  wires.push(mfWire(gTop, r("-", 7), C.black));
  used.push(vin, gTop);

  // 팬: G · V → 띠, IN+ · IN− → D13 · D12
  const f = fan(90, 398, { titleAt: { x: 145, y: 384 } });
  parts.push(f.svg);
  wires.push(mfWire(f.pins.G, r("-", 4), C.black), mfWire(f.pins.V, r("+", 5), C.red));
  const d13 = b.gpio(13), d12 = b.gpio(12);
  wires.push(ffWire(f.pins["IN+"], d13, C.teal), ffWire(f.pins["IN−"], d12, C.pink));
  used.push(d13, d12);

  // 브레드보드 − 줄 ↔ 띠 − 줄 (왼쪽 바깥)
  const bm = top.bb.rail("bottom", "-", 1);
  wires.push(mmWire(r("-", 1), bm, C.black, [{ x: 12, y: r("-", 1).y }, { x: 12, y: bm.y }], "orth"));

  // 초음파: 보드 아래(핀이 위로). Trig → D18 · Echo → D19, GND → 아래 줄 GND, VCC → 왼쪽 바깥 → 띠 + 줄
  const u = ultrasonic(330, bot + 80, { side: "top", title: "초음파 센서", titleAt: { x: 406, y: bot + 196 } });
  parts.push(u.svg);
  const d18 = b.gpio(18), d19 = b.gpio(19), gBot = b.power("GND", 1);
  wires.push(ffWire(u.pins.Trig, d18, C.yellow), ffWire(u.pins.Echo, d19, C.green));
  wires.push(ffWire(u.pins.GND, gBot, C.black, [{ x: u.pins.GND.x, y: bot + 30 }, { x: gBot.x, y: bot + 30 }], "orth"));
  wires.push(mfWire(u.pins.VCC, r("+", 1), C.red, [{ x: u.pins.VCC.x, y: bot + 50 }, { x: 24, y: bot + 50 }, { x: 24, y: r("+", 1).y }], "orth"));
  used.push(d18, d19, gBot);

  const rows = [
    { colors: [C.red, C.black], part: "VIN · GND (위 줄)", to: "띠 + 줄 · − 줄" },
    { colors: [C.black, C.red], part: "팬 G · V", to: "띠 − 줄 · + 줄" },
    { colors: [C.teal, C.pink], part: "팬 IN+ · IN−", to: "D13 · D12" },
    { color: C.red, part: "초음파 VCC", to: "보드 바깥으로 돌아 띠 + 줄" },
    { color: C.black, part: "초음파 GND", to: "GND (아래 줄)" },
    { colors: [C.yellow, C.green], part: "초음파 Trig · Echo", to: "D18 · D19 (아래 줄)" },
    { color: C.blue, part: "D14 (버튼 A)", to: "3번 줄, 대각선 5번 줄 → 위 − 줄" },
    { color: C.purple, part: "D27 (버튼 B)", to: "7번 줄, 대각선 9번 줄 → 위 − 줄" },
    { color: C.green, part: "D25 (LED 1)", to: "11번 줄 → 220Ω → 15번 줄 긴 다리" },
    { color: C.yellow, part: "D26 (LED 2)", to: "18번 줄 → 220Ω → 22번 줄 긴 다리" },
    { color: C.orange, part: "D33 (LED 3)", to: "25번 줄 → 220Ω → 29번 줄 긴 다리" },
    { color: C.black, part: "LED 짧은 다리 16 · 23 · 30번 줄", to: "아래 − 줄 (위 − 줄과 점퍼로)" },
    { color: C.black, part: "브레드보드 아래 − 줄", to: "띠 − 줄 (왼쪽 바깥 점퍼)" },
  ];
  const table = connectionTable(bot + 216, "이렇게 꽂아요 — VIN(5V) 은 + − 줄 띠로 팬과 초음파가 나눠 써요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "안전 선풍기 배선도(ESP32 Plus 확장 보드): 맨 위 브레드보드에 버튼 A(3 · 5번 줄)와 버튼 B(7 · 9번 줄), LED 1 · 2 · 3(11 · 18 · 25번 줄에서 220Ω 저항 → 15 · 22 · 29번 줄 긴 다리, 짧은 다리 16 · 23 · 30번 줄 → 아래 − 줄). io14 → 3번 줄, io27 → 7번 줄, 버튼 대각선 5 · 9번 줄 → 위 − 줄, io25 → 11번 줄, io26 → 18번 줄, 아래 줄 io33 → 보드 오른쪽 바깥으로 돌아 25번 줄. 위 − 줄과 아래 − 줄은 점퍼로 잇고, 아래 − 줄 → 보드 오른쪽 바깥으로 돌아 아래 줄 GND. 초음파 센서 VCC · GND · Trig · Echo → 위 줄 5V · GND · io18 · io19, 팬 모듈 IN+ · IN− → io13 · io12, 팬 G · V → io12 와 io14 사이 빈 틈으로 내려 I2C 묶음 GND · 5V 에 F-F 듀폰선으로 바로. 배터리 홀더(AA 6개)는 외부 전원 단자에",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 안전 선풍기 배선도: 맨 위 브레드보드에 버튼 A(3 · 5번 줄)와 버튼 B(7 · 9번 줄), LED 1 · 2 · 3(11 · 18 · 25번 줄에서 220Ω 저항 → 15 · 22 · 29번 줄 긴 다리, 짧은 다리 16 · 23 · 30번 줄 → 아래 − 줄). D14 → 3번 줄, D27 → 7번 줄, 버튼 대각선 5 · 9번 줄 → 위 − 줄, D25 → 11번 줄, D26 → 18번 줄, D33 → 25번 줄. 보드 위 왼쪽에 + − 줄 띠: VIN → + 줄, GND → − 줄, 팬 모듈 G · V → 띠 − · + 줄, 팬 IN+ · IN− → D13 · D12. 브레드보드 아래 − 줄 ↔ 띠 − 줄. 초음파 센서는 보드 아래: Trig → D18, Echo → D19, GND → 아래 줄 GND, VCC → 보드 왼쪽 바깥으로 돌아 띠 + 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wsf", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wsfk", T.devkit, r.body, r.height); },
  },
};
