// 융합 F4 "안전 선풍기" — 팬(130 모터) 모듈 IN+ 13 · IN− 12, 초음파 Trig 18 · Echo 19(5V),
// 버튼 A 14 · 버튼 B 27 (풀업: 한쪽 다리 → 핀, 대각선 다리 → GND, 누르면 0), LED 1 · 2 · 3 = 25 · 26 · 33 (220Ω 셋).
// 초음파 Echo 는 5V 신호라 전압 나누기(Echo → 1kΩ → 가운데 줄 = 보드 19번 핀 → 2kΩ → GND)를 거친다.
// 저항 둘은 맨 위 브레드보드 위 칸(a~e)의 빈 세 줄에 꽂고(b · c 칸), GND 줄은 위 − 줄로 점퍼.
// 센서 Echo 선과 보드 핀 선은 아래에서 올라와 가운데 홈 바로 위 e 칸에 꽂는다(아래 칸 f~j 는 다른 줄이다).
// 두 보드 모두 버튼 · LED 브레드보드를 맨 위에 두고, 신호선은 계단처럼 꺾어 보드 핀으로 내려온다.
// Plus: 초음파 VCC · GND · Trig 는 위 줄 5V · GND · io18 에 바로, 팬 IN+ · IN− 는 io13 · io12,
//       팬 G · V 는 위 줄 GND · 5V 를 초음파가 쓰므로 io12 와 io14 사이 빈 틈 → 빈 띠 → I2C 묶음 첫 줄 GND · 5V.
//       전압 나누기는 1 · 6 · 11번 줄: Echo → 센서와 팬 사이로 올라가 1 · 2번 열 사이 빈 길 → 1번 줄,
//       io19 → 센서와 팬 사이 → 버튼 A 와 B 사이 6번 열(+ − 줄에 구멍이 없는 열) → 6번 줄, 11번 줄 → 위 − 줄.
//       LED 3 은 아래 줄 io33, 브레드보드 − 줄은 아래 줄 GND — 둘 다 보드 오른쪽 바깥으로 돌아 아래에서.
// DevKit: VIN(5V) 하나를 팬 · 초음파가 나눠 쓰므로 보드 위에 + − 줄 띠(VIN · GND). 초음파는 Trig 가 아래 줄
//       D18 이라 보드 아래(핀이 위로), VCC 는 보드 왼쪽 바깥으로 띠 + 줄, GND 는 아래 줄 GND.
//       전압 나누기는 18 · 21 · 24번 줄: Echo · D19(아래 줄) 선은 보드 오른쪽 바깥으로 돌아 올라가
//       Echo → 24번 열(+ − 줄에 구멍이 없는 열) → 24번 줄, D19 → 17 · 18번 열 사이 빈 길 → 홈에서 꺾어 21번 줄, 18번 줄 → 위 − 줄.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, note, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, button, fan, led, resistor, ultrasonic } from "../parts.mjs";
import { echoDivider, echoRows } from "../echo-divider.mjs";

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

/**
 * Echo 전압 나누기를 맨 위 브레드보드 위 칸(a~e)의 빈 세 줄에 (k 가 가장 왼쪽 줄).
 * 저항은 echoDivider 의 자리(c · d 칸)보다 한 칸씩 올려 b · c 칸에 — 버튼 몸통 · LED 머리에 닿지 않게.
 * GND 줄은 a 칸 → 위 − 줄 점퍼. 센서 Echo 선 · 보드 핀 선은 아래에서 올라와 홈 바로 위 e 칸에 꽂는다.
 */
function divider(bb, k, opts = {}) {
  const lifted = { hole: (c, r) => bb.hole(c, { c: "b", d: "c" }[r] ?? r), tint: bb.tint };
  const div = echoDivider(lifted, k, { ...opts, half: "top" });
  const { echo, mid, gnd } = div.cols;
  return {
    ...div,
    jumper: mmWire(bb.hole(gnd, "a"), bb.rail("top", "-", railHole(gnd)), C.black),
    echoHole: bb.hole(echo, "e"),
    pinHole: bb.hole(mid, "e"),
    grooveY: (bb.hole(mid, "e").y + bb.hole(mid, "f").y) / 2,
  };
}
/** c 열과 c+1 열 사이 빈 길의 x (구멍 위를 지나지 않는 세로 길) */
const alley = (bb, c) => (bb.hole(c, "a").x + bb.hole(c + 1, "a").x) / 2;

/** 전압 나누기의 연결 표 줄 셋 (위 칸 a~e 라고 밝힌다 — 아래 칸의 같은 번호 줄과 헷갈리지 않게) */
function dividerRows(div, pinLabel) {
  const [echoRow, pinRow] = echoRows(div, { echoColor: C.green, pinColor: C.brown, gndColor: C.black, pinLabel, gndLabel: "" });
  return [
    { ...echoRow, to: `a~e 칸 ${echoRow.to}` },
    { ...pinRow, to: `a~e 칸 ${pinRow.to}` },
    { color: C.black, part: `${div.cols.mid}번 줄 → 2kΩ → ${div.cols.gnd}번 줄`, to: "위 − 줄 (점퍼)" },
  ];
}

const LED_COLORS = ["#2f9e44", "#f59f00", "#e03131"]; // 1 초록 · 2 노랑 · 3 빨강

/** 맨 위 브레드보드: 버튼 A(3~5번 줄) · B(7~9번 줄), LED 1 · 2 · 3 (11 · 18 · 25번 줄부터), 위 칸에 Echo 전압 나누기(divK 번 줄부터) */
function topBoard(x, linkCol, divK, divOpts) {
  const bb = breadboard({ x, y: 8, cols: 30, rails: { top: true, bottom: true } });
  const btnA = buttonPullup(bb, 3, "A"), btnB = buttonPullup(bb, 7, "B");
  const leds = [ledRight(bb, 11, LED_COLORS[0]), ledRight(bb, 18, LED_COLORS[1]), ledRight(bb, 25, LED_COLORS[2], 28)];
  const div = divider(bb, divK, divOpts);
  const svg = [bb.svg, btnA.svg, btnB.svg, ...leds.map((l) => l.svg), ...div.svg];
  const jumpers = [btnA.jumper, btnB.jumper, ...leds.map((l) => l.jumper), div.jumper, railLink(bb, linkCol)];
  return { bb, btnA, btnB, leds, div, svg, jumpers };
}

/** 브레드보드 신호 구멍 → 아래로 laneY → 가로로 핀 x → 핀 (계단 꼴) */
const stair = (from, pin, color, laneY) => mfWire(pin, from, color, [{ x: pin.x, y: laneY }, { x: from.x, y: laneY }], "orth");

/* ───── ESP32 Plus ───── */
function plus() {
  const top = topBoard(40, 1, 1, { step: 5, order: "echo-first" }), div = top.div; // Echo 1 · 가운데 6 · GND 11번 줄
  // (Echo · io19 선이 지나는 가로 길 둘과 센서 아래 길만큼 센서 · 팬 · 보드를 내렸다)
  const b = makePlus({ x: 96, y: 546 });
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

  // 초음파: VCC · GND · Trig 는 위 줄 5V · GND · io18 에 바로
  const u = ultrasonic(40, 408, { titleAt: { x: 116, y: 394 } });
  const ut = { VCC: b.power("5V"), GND: b.power("GND"), Trig: b.gpio(18), Echo: b.gpio(19) };
  wires.push(ffWire(u.pins.VCC, ut.VCC, C.red), ffWire(u.pins.GND, ut.GND, C.black), ffWire(u.pins.Trig, ut.Trig, C.yellow));
  used.push(ut.VCC, ut.GND, ut.Trig, ut.Echo);
  // Echo 전압 나누기: 두 선 모두 센서와 팬 사이로 올라간다 (Echo 가 왼쪽 · 더 낮은 가로 길이라 서로 엇갈리지 않는다)
  // Echo → 센서 아래로 돌아 → 1 · 2번 열 사이 빈 길 → 홈에서 꺾어 (1, e)
  const eX = 200, pX = 212, eLane = 374, pLane = 366, aX = alley(top.bb, div.cols.echo), under = u.pins.Echo.y + 16;
  wires.push(mfWire(u.pins.Echo, div.echoHole, C.green, [{ x: u.pins.Echo.x, y: under }, { x: eX, y: under }, { x: eX, y: eLane }, { x: aX, y: eLane }, { x: aX, y: div.grooveY }, { x: div.echoHole.x, y: div.grooveY }], "orth"));
  // io19 → 버튼 A 와 B 사이 6번 열(+ − 줄 구멍도 번호 글자도 없는 열)로 곧장 올라가 (6, e)
  wires.push(mfWire(ut.Echo, div.pinHole, C.brown, [{ x: ut.Echo.x, y: Y + 30 }, { x: pX, y: Y + 10 }, { x: pX, y: pLane }, { x: div.pinHole.x, y: pLane }], "orth"));

  // 팬: IN+ · IN− → io13 · io12, G · V → 빈 틈(io12 와 io14 사이) → 빈 띠 → I2C 묶음 첫 줄 GND · 5V
  const f = fan(X + 126, 408, { titleAt: { x: X + 181, y: 394 } });
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
    { color: C.yellow, part: "초음파 Trig", to: "io18" },
    ...dividerRows(div, "io19"),
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
  const table = connectionTable(Y + 366, "이렇게 꽂아요 — 모듈은 보드에 바로, Echo 만 저항 둘을 거쳐요", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  const top = topBoard(40, 29, 18), div = top.div; // GND 18 · 가운데 21 · Echo 24번 줄
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

  // 초음파: 보드 아래(핀이 위로). Trig → D18, GND → 아래 줄 GND, VCC → 왼쪽 바깥 → 띠 + 줄
  const u = ultrasonic(330, bot + 90, { side: "top", title: "초음파 센서", titleAt: { x: 406, y: bot + 206 } });
  parts.push(u.svg);
  const d18 = b.gpio(18), d19 = b.gpio(19), gBot = b.power("GND", 1);
  wires.push(ffWire(u.pins.Trig, d18, C.yellow, [{ x: u.pins.Trig.x, y: bot + 44 }, { x: d18.x, y: bot + 44 }], "orth"));
  wires.push(ffWire(u.pins.GND, gBot, C.black, [{ x: u.pins.GND.x, y: bot + 30 }, { x: gBot.x, y: bot + 30 }], "orth"));
  wires.push(mfWire(u.pins.VCC, r("+", 1), C.red, [{ x: u.pins.VCC.x, y: bot + 58 }, { x: 24, y: bot + 58 }, { x: 24, y: r("+", 1).y }], "orth"));
  used.push(d18, d19, gBot);
  // Echo 전압 나누기: 두 선 모두 보드 오른쪽 바깥으로 돌아 올라간다 (D19 가 안쪽 · 더 낮은 가로 길이라 서로 엇갈리지 않는다)
  // Echo → 24번 열(+ − 줄 구멍이 없는 열)로 곧장 올라가 (24, e)
  const eX = 612, pX = 600, eLane = 356, pLane = 366, aX = alley(top.bb, div.cols.gnd - 1);
  wires.push(mfWire(u.pins.Echo, div.echoHole, C.green, [{ x: u.pins.Echo.x, y: bot + 58 }, { x: eX, y: bot + 58 }, { x: eX, y: eLane }, { x: div.echoHole.x, y: eLane }], "orth"));
  // D19 → 17 · 18번 열 사이 빈 길로 올라가 가운데 홈에서 꺾어 (21, e) — 220Ω 저항 위를 지나지 않게
  wires.push(mfWire(d19, div.pinHole, C.brown, [{ x: d19.x, y: bot + 16 }, { x: pX, y: bot + 16 }, { x: pX, y: pLane }, { x: aX, y: pLane }, { x: aX, y: div.grooveY }, { x: div.pinHole.x, y: div.grooveY }], "orth"));

  const rows = [
    { colors: [C.red, C.black], part: "VIN · GND (위 줄)", to: "띠 + 줄 · − 줄" },
    { colors: [C.black, C.red], part: "팬 G · V", to: "띠 − 줄 · + 줄" },
    { colors: [C.teal, C.pink], part: "팬 IN+ · IN−", to: "D13 · D12" },
    { color: C.red, part: "초음파 VCC", to: "보드 바깥으로 돌아 띠 + 줄" },
    { color: C.black, part: "초음파 GND", to: "GND (아래 줄)" },
    { color: C.yellow, part: "초음파 Trig", to: "D18 (아래 줄)" },
    ...dividerRows(div, "D19 (아래 줄)"),
    { color: C.blue, part: "D14 (버튼 A)", to: "3번 줄, 대각선 5번 줄 → 위 − 줄" },
    { color: C.purple, part: "D27 (버튼 B)", to: "7번 줄, 대각선 9번 줄 → 위 − 줄" },
    { color: C.green, part: "D25 (LED 1)", to: "11번 줄 → 220Ω → 15번 줄 긴 다리" },
    { color: C.yellow, part: "D26 (LED 2)", to: "18번 줄 → 220Ω → 22번 줄 긴 다리" },
    { color: C.orange, part: "D33 (LED 3)", to: "25번 줄 → 220Ω → 29번 줄 긴 다리" },
    { color: C.black, part: "LED 짧은 다리 16 · 23 · 30번 줄", to: "아래 − 줄 (위 − 줄과 점퍼로)" },
    { color: C.black, part: "브레드보드 아래 − 줄", to: "띠 − 줄 (왼쪽 바깥 점퍼)" },
  ];
  const table = connectionTable(bot + 226, "이렇게 꽂아요 — 5V 는 + − 줄 띠로 나눠 쓰고, Echo 는 저항 둘을 거쳐요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "안전 선풍기 배선도(ESP32 Plus 확장 보드): 맨 위 브레드보드에 버튼 A(3 · 5번 줄)와 버튼 B(7 · 9번 줄), LED 1 · 2 · 3(11 · 18 · 25번 줄에서 220Ω 저항 → 15 · 22 · 29번 줄 긴 다리, 짧은 다리 16 · 23 · 30번 줄 → 아래 − 줄). io14 → 3번 줄, io27 → 7번 줄, 버튼 대각선 5 · 9번 줄 → 위 − 줄, io25 → 11번 줄, io26 → 18번 줄, 아래 줄 io33 → 보드 오른쪽 바깥으로 돌아 25번 줄. 위 − 줄과 아래 − 줄은 점퍼로 잇고, 아래 − 줄 → 보드 오른쪽 바깥으로 돌아 아래 줄 GND. 초음파 센서 VCC · GND · Trig → 위 줄 5V · GND · io18, 팬 모듈 IN+ · IN− → io13 · io12, 팬 G · V → io12 와 io14 사이 빈 틈으로 내려 I2C 묶음 GND · 5V 에 F-F 듀폰선으로 바로. 초음파 Echo 는 저항 둘을 거친다: Echo → 브레드보드 a~e 칸 1번 줄 → 1kΩ 저항 → 6번 줄 → io19, 6번 줄 → 2kΩ 저항 → 11번 줄 → 위 − 줄. 배터리 홀더(AA 6개)는 외부 전원 단자에",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 안전 선풍기 배선도: 맨 위 브레드보드에 버튼 A(3 · 5번 줄)와 버튼 B(7 · 9번 줄), LED 1 · 2 · 3(11 · 18 · 25번 줄에서 220Ω 저항 → 15 · 22 · 29번 줄 긴 다리, 짧은 다리 16 · 23 · 30번 줄 → 아래 − 줄). D14 → 3번 줄, D27 → 7번 줄, 버튼 대각선 5 · 9번 줄 → 위 − 줄, D25 → 11번 줄, D26 → 18번 줄, D33 → 25번 줄. 보드 위 왼쪽에 + − 줄 띠: VIN → + 줄, GND → − 줄, 팬 모듈 G · V → 띠 − · + 줄, 팬 IN+ · IN− → D13 · D12. 브레드보드 아래 − 줄 ↔ 띠 − 줄. 초음파 센서는 보드 아래: Trig → D18, GND → 아래 줄 GND, VCC → 보드 왼쪽 바깥으로 돌아 띠 + 줄. 초음파 Echo 는 저항 둘을 거친다: Echo → 브레드보드 a~e 칸 24번 줄 → 1kΩ 저항 → 21번 줄 → D19(아래 줄), 21번 줄 → 2kΩ 저항 → 18번 줄 → 위 − 줄. Echo 선과 D19 선은 보드 오른쪽 바깥으로 돌아 올라간다",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wsf", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wsfk", T.devkit, r.body, r.height); },
  },
};
