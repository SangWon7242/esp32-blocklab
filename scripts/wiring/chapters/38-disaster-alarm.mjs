// 융합 F11 "우리 교실 재난 알리미" — 불꽃 센서 모듈(G V S, S → 34), DHT11 모듈(G V S, S → 13), 틸트 스위치(맨 부품) + 10kΩ → 14,
// 위치 버튼(27, 풀업), 수동 부저 + → 25 (ESP32 Plus 에 io15 가 없어 15번에서 옮김).
// 틸트: 코드가 "기울면 1"(Pin(14, Pin.IN), 풀 없음)이라 16장과 같은 풀업 — 3V3 — 10kΩ — 14번 — 틸트 스위치 — GND.
//   바로 서면 구슬이 두 다리를 이어 14번이 GND(0), 기울면 떨어져 10kΩ 이 3V3 로 끌어올려 1.
// Plus: 34 · 3V3 · GND 가 아래 줄이라 브레드보드를 보드 **아래**에 둔다. 불꽃 센서는 보드와 브레드보드 사이 — V · G 는 + − 줄,
//   S 는 모듈 옆으로 돌아 아래 줄 io34. DHT11 은 io13 기둥 S · V · G 에 F-F 로 바로(15장과 같은 길).
//   위 줄 14 · 27 · 25 세 선만 보드 왼쪽 바깥 길로 내려와 브레드보드 a 칸에 (서로 엇갈리지 않게 겹겹이).
// DevKit: 브레드보드는 보드 위, + − 줄은 위 · 아래 둘(왼쪽 끝 바깥 점퍼로 + 끼리, − 끼리 잇는다). DHT11 은 브레드보드 위 —
//   V · G 는 위 + − 줄, S 는 구멍 사이 빈 길로 내려가 D13. 불꽃 센서는 브레드보드 오른쪽 — V · G 는 아래 + − 줄, S 는 D34.
// 확장 보드: DHT11 · 불꽃 센서는 P13 · P34 칸 G · V · S 기둥에 F-F 셋씩 바로(V 줄 = 3.3V). 맨 부품은 보드 위 브레드보드(아래 + − 줄),
//   P14 · P27 · P25 세 선은 두 모듈 사이로 올라간다. + 줄은 전원 헤더 3V(점퍼와 상관없이 3.3V — 틸트 풀업이 14번에 3.3V 넘게 주지 않게),
//   − 줄은 전원 헤더 GND. 5V 부품이 없어 점퍼는 평소 자리(3.3V).
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { columnRun } from "./33-room-climate.mjs";
import { breadboard, button, buzzer, module, resistor, sensor3, tiltSwitch } from "../parts.mjs";
import { alley } from "./35-random-hammer.mjs";

const TEN_K = ["#8b5a2b", "#212529", "#f76707"]; // 갈 검 주

/** DHT11 모듈 (15장과 같은 그림: 핀 이름이 가리지 않게 그림을 핀 반대쪽에) */
function dht11(x, y, { side = "bottom", pins = ["G", "V", "S"], titleAt } = {}) {
  return module({
    kind: "dht",
    x, y, w: 76, h: 70, color: "#1971c2", pins, side, firstPin: 18, title: "DHT11", titleAt,
    decor: (mx, my, w) => {
      const ry = side === "top" ? my + 24 : my + 6;
      return `<rect x="${mx + 14}" y="${ry}" width="${w - 28}" height="38" rx="4" fill="#e7f5ff" stroke="#74c0fc"/>${[0, 1, 2, 3].map((k) => `<path d="M${mx + 20} ${ry + 8 + k * 8} h${w - 40}" stroke="#74c0fc" stroke-width="2"/>`).join("")}`;
    },
  });
}

/** 두 + 줄 또는 두 − 줄을 브레드보드 끝 바깥으로 잇는 점퍼 (x 는 바깥 세로 길) */
function railLink(bb, sign, col, x) {
  const t = bb.rail("top", sign, col), u = bb.rail("bottom", sign, col);
  return mmWire(t, u, sign === "+" ? C.red : C.black, [{ x, y: t.y }, { x, y: u.y }], "orth");
}

/* ───── ESP32 Plus: 브레드보드는 보드 아래, 부품은 위 칸(a~e) ───── */
function plus() {
  const b = makePlus({ x: 96, y: 48 });
  const bot = b.bounds.y + b.bounds.h;
  const bb = breadboard({ x: 96, y: bot + 120, cols: 26, rails: { top: true, bottom: true } });
  const T = (s, c) => bb.rail("top", s, c);
  const parts = [], wires = [], used = [];

  // 수동 부저: + (2,e) ← io25, − (4,e) → 위 − 줄
  [2, 4].forEach((c) => bb.tint(c, "top"));
  parts.push(buzzer(bb.hole(2, "e"), bb.hole(4, "e"), { up: false }).svg);
  wires.push(mmWire(bb.hole(4, "a"), T("-", 4), C.black));
  // 버튼: 다리 (6,e)(8,e)(6,f)(8,f). 신호 (6, a) ← io27, 대각선 (8, j) → 아래 − 줄
  const btn = button(bb, 6);
  bb.tint(6, "top");
  bb.tint(8, "bottom");
  wires.push(mmWire(bb.hole(8, "j"), bb.rail("bottom", "-", 8), C.black));
  // 틸트(풀업): 10kΩ (9,c)~(12,c), 틸트 (12,e)~(14,e). 9 → 위 + 줄, 12 ← io14, 14 → 위 − 줄
  [9, 12, 14].forEach((c) => bb.tint(c, "top"));
  parts.push(resistor(bb.hole(9, "c"), bb.hole(12, "c"), { bands: TEN_K, label: "10kΩ" }).svg);
  parts.push(tiltSwitch(bb.hole(12, "e"), bb.hole(14, "e"), { up: false }).svg);
  wires.push(mmWire(bb.hole(9, "a"), T("+", 10), C.red, [], "line"), mmWire(bb.hole(14, "a"), T("-", 14), C.black));
  // 두 − 줄 잇기 (오른쪽 끝 바깥)
  wires.push(railLink(bb, "-", 26, bb.x + bb.w + 10));

  // 위 줄 io25 · io27 · io14 → 보드 위로 나가 왼쪽 바깥 길로 내려와 a 칸에 (바깥부터 25 · 27 · 14)
  const s25 = b.gpio(25), s27 = b.gpio(27), s14 = b.gpio(14);
  const around = (p, hole, k, color) => mfWire(p, hole, color, [
    { x: p.x, y: b.bounds.y - 10 - 8 * k }, { x: 44 - 8 * k, y: b.bounds.y - 10 - 8 * k },
    { x: 44 - 8 * k, y: bot + 28 + 10 * k }, { x: hole.x, y: bot + 28 + 10 * k },
  ], "orth");
  wires.push(around(s14, bb.hole(12, "a"), 0, C.green), around(s27, bb.hole(6, "a"), 1, C.purple), around(s25, bb.hole(2, "a"), 2, C.orange));
  used.push(s25, s27, s14);

  // 3V3 · GND(아래 줄) → 위 + − 줄
  const v33 = b.power("3V3"), gnd = b.power("GND", 1);
  wires.push(mfWire(v33, T("+", 13), C.red), mfWire(gnd, T("-", 16), C.black));
  used.push(v33, gnd);

  // 불꽃 센서: 보드와 브레드보드 사이, 핀이 아래로 (G V S). G → − 줄, V → + 줄, S → 모듈 오른쪽으로 돌아 아래 줄 io34
  const fl = sensor3(458, bot + 22, "flame", { titleAt: { x: 450, y: bot + 56, anchor: "end" } });
  const s34 = b.gpio(34, { at: "bottom" });
  wires.push(mfWire(fl.pins.G, T("-", 23), C.black), mfWire(fl.pins.V, T("+", 25), C.red));
  wires.push(ffWire(fl.pins.S, s34, C.yellow, [{ x: fl.pins.S.x, y: fl.pins.S.y + 8 }, { x: 548, y: fl.pins.S.y + 8 }, { x: 548, y: bot + 12 }, { x: s34.x, y: bot + 12 }], "orth"));
  used.push(s34);

  // DHT11: 보드 오른쪽, io13 기둥 S · V · G 에 F-F 로 바로 (15장과 같은 길)
  const t = b.triple(13);
  const dht = dht11(548, b.bounds.y + 22, { titleAt: { x: 586, y: b.bounds.y + 8 } });
  const lane = (k) => b.lane.top + 4 + k * 6;
  const run = (p, pin, color, dx, k) => ffWire(p, pin, color, [{ x: p.x, y: lane(k) }, { x: t.S.x + dx, y: lane(k) }, { x: t.S.x + dx, y: pin.y + 4 }], "orth");
  wires.push(run(dht.pins.S, t.S, C.blue, -4, 2), run(dht.pins.V, t.V, C.red, 0, 1), run(dht.pins.G, t.G, C.black, 4, 0));
  used.push(t.S, t.V, t.G);

  parts.unshift(bb.svg);
  parts.push(btn.svg, fl.svg, dht.svg);
  const rows = [
    { colors: [C.black, C.red, C.blue], part: "DHT11 G · V · S", to: "io13 기둥 G · V · S" },
    { colors: [C.red, C.black], part: "3V3 · GND (아래 줄)", to: "위 + 줄 · 위 − 줄" },
    { colors: [C.red, C.black], part: "불꽃 센서 V · G", to: "위 + 줄 · 위 − 줄" },
    { color: C.yellow, part: "불꽃 센서 S", to: "io34 (아래 줄)" },
    { color: C.green, part: "io14", to: "12번 줄 (10kΩ 과 틸트 스위치 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 9번 줄 · 틸트 14번 줄", to: "위 + 줄 · 위 − 줄" },
    { color: C.purple, part: "io27", to: "6번 줄 (버튼 한쪽 다리)" },
    { color: C.black, part: "버튼 대각선 다리 8번 줄", to: "아래 − 줄 (두 − 줄은 점퍼로)" },
    { color: C.orange, part: "io25", to: "2번 줄 부저 + 다리 (− 다리 4번 줄 → 위 − 줄)" },
  ];
  const table = connectionTable(bb.y + bb.h + 16, "이렇게 꽂아요 — 모듈 둘은 보드에 바로 · + − 줄, 맨 부품은 브레드보드에", rows, "plus", { columns: 1 });
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit 38핀): 브레드보드는 보드 위, 부품은 아래 칸(f~j) ───── */
function devkit() {
  const bb = breadboard({ x: 96, y: 106, cols: 26, rails: { top: true, bottom: true } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 56 });
  const top = b.bounds.y, below = bb.y + bb.h;
  const U = (s, c) => bb.rail("top", s, c), D = (s, c) => bb.rail("bottom", s, c);
  const parts = [], wires = [], used = [];

  // 틸트(풀업): 틸트 (6,f)~(8,f), 10kΩ (8,h)~(11,h). 8 ← D14, 11 → 아래 + 줄, 6 → 아래 − 줄
  [6, 8, 11].forEach((c) => bb.tint(c, "bottom"));
  parts.push(tiltSwitch(bb.hole(6, "f"), bb.hole(8, "f")).svg);
  parts.push(resistor(bb.hole(8, "h"), bb.hole(11, "h"), { bands: TEN_K, label: "10kΩ" }).svg);
  wires.push(mmWire(bb.hole(11, "j"), D("+", 10), C.red, [], "line"), mmWire(bb.hole(6, "j"), D("-", 7), C.black, [], "line"));
  // 버튼: 다리 (12,e)(14,e)(12,f)(14,f). 신호 (14, j) ← D27, 대각선 (12, a) → 위 − 줄
  const btn = button(bb, 12);
  bb.tint(12, "top");
  bb.tint(14, "bottom");
  wires.push(mmWire(bb.hole(12, "a"), U("-", 11), C.black));
  // 수동 부저: + (16,f) ← D25, − (18,f) → 아래 − 줄
  [16, 18].forEach((c) => bb.tint(c, "bottom"));
  parts.push(buzzer(bb.hole(16, "f"), bb.hole(18, "f")).svg);
  wires.push(mmWire(bb.hole(18, "j"), D("-", 17), C.black, [], "line"));

  // 보드 → 브레드보드: D14 → (8, j) 곧장, D27 · D25 → 가로 길 둘(엇갈리지 않게 D27 이 위)
  const d14 = b.gpio(14), d27 = b.gpio(27), d25 = b.gpio(25);
  const lane1 = below + 12, lane2 = below + 20;
  wires.push(mfWire(d14, bb.hole(8, "j"), C.green));
  wires.push(mfWire(d27, bb.hole(14, "j"), C.purple, [{ x: d27.x, y: lane1 }, { x: bb.hole(14, "j").x, y: lane1 }], "orth"));
  wires.push(mfWire(d25, bb.hole(16, "j"), C.orange, [{ x: d25.x, y: lane2 }, { x: bb.hole(16, "j").x, y: lane2 }], "orth"));
  used.push(d14, d27, d25);

  // 전원: GND(위 줄) → 아래 − 줄, 3V3(위 줄 끝) → 보드 왼쪽 바깥 길 → 아래 + 줄 3번 칸(아래에서). + 끼리 · − 끼리 왼쪽 끝 바깥 점퍼
  const gnd = b.power("GND", 0), v33 = b.power("3V3");
  wires.push(mfWire(gnd, D("-", 4), C.black));
  const l3 = below + 30;
  wires.push(mfWire(v33, D("+", 3), C.red, [{ x: v33.x, y: v33.y + 22 }, { x: 44, y: v33.y + 22 }, { x: 44, y: l3 }, { x: D("+", 3).x, y: l3 }], "orth"));
  wires.push(railLink(bb, "+", 1, bb.x - 18), railLink(bb, "-", 1, bb.x - 10));
  used.push(gnd, v33);

  // DHT11: 브레드보드 위. G → 위 − 줄, V → 위 + 줄, S → 4 · 5번 열 사이 빈 길로 내려가 D13
  const dht = dht11(122, 4, { titleAt: { x: 112, y: 40, anchor: "end" } });
  const d13 = b.gpio(13), sX = alley(bb, 4);
  wires.push(mfWire(dht.pins.G, U("-", 2), C.black), mfWire(dht.pins.V, U("+", 3), C.red));
  wires.push(ffWire(dht.pins.S, d13, C.blue, [{ x: sX, y: dht.pins.S.y + 6 }, { x: sX, y: below + 38 }, { x: d13.x, y: below + 38 }], "orth"));
  used.push(d13);

  // 불꽃 센서: 브레드보드 오른쪽, 핀이 아래로 (G V S). G · V → 아래 − + 줄 오른쪽 끝, S → D34
  const fl = sensor3(556, below - 40 - 82, "flame", { titleAt: { x: 594, y: below - 40 - 96 } });
  const d34 = b.gpio(34), mEnd = D("-", 26), pEnd = D("+", 26);
  wires.push(mfWire(fl.pins.G, mEnd, C.black, [{ x: fl.pins.G.x, y: mEnd.y }], "orth"));
  wires.push(mfWire(fl.pins.V, pEnd, C.red, [{ x: fl.pins.V.x, y: pEnd.y }], "orth"));
  wires.push(ffWire(fl.pins.S, d34, C.yellow, [{ x: fl.pins.S.x, y: below + 44 }, { x: d34.x, y: below + 44 }], "orth"));
  used.push(d34);

  parts.unshift(bb.svg);
  parts.push(btn.svg, dht.svg, fl.svg);
  const rows = [
    { color: C.red, part: "3V3 (위 줄 끝)", to: "아래 + 줄 (보드 바깥으로)" },
    { color: C.black, part: "GND", to: "아래 − 줄" },
    { colors: [C.red, C.black], part: "위 + 줄 ↔ 아래 + 줄, 위 − 줄 ↔ 아래 − 줄", to: "점퍼" },
    { colors: [C.red, C.black], part: "DHT11 V · G", to: "위 + 줄 · 위 − 줄" },
    { color: C.blue, part: "DHT11 S", to: "D13 (구멍 사이로 내려가)" },
    { colors: [C.red, C.black], part: "불꽃 센서 V · G", to: "아래 + 줄 · 아래 − 줄" },
    { color: C.yellow, part: "불꽃 센서 S", to: "D34" },
    { color: C.green, part: "D14", to: "8번 줄 (틸트 스위치와 10kΩ 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 11번 줄 · 틸트 6번 줄", to: "아래 + 줄 · 아래 − 줄" },
    { color: C.purple, part: "D27", to: "14번 줄 (버튼 한쪽 다리)" },
    { color: C.black, part: "버튼 대각선 다리 12번 줄", to: "위 − 줄" },
    { color: C.orange, part: "D25", to: "16번 줄 부저 + 다리 (− 다리 18번 줄 → 아래 − 줄)" },
  ];
  const table = connectionTable(top + b.bounds.h + 20, "이렇게 꽂아요 — 3V3 · GND 는 + − 줄로 나눠 써요", rows, "devkit", { columns: 1 });
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 확장 보드(38핀 확장 보드 + DevKit): 점퍼 3.3V ───── */
function expansion() {
  const bb = breadboard({ x: 84, y: 8, cols: 26, rails: { top: false, bottom: true } });
  const b = makeExpansion({ x: 22, y: 436, jumper: "3V3" });
  const Y0 = b.bounds.y;
  const D = (s, c) => bb.rail("bottom", s, c);
  const parts = [bb.svg], wires = [], used = [];
  const lane = (k) => bb.y + bb.h + 10 + k * 8;

  // 틸트(풀업): 10kΩ (11,h)~(14,h), 틸트 (14,f)~(16,f). 11 → + 줄, 14 ← P14, 16 → − 줄
  [11, 14, 16].forEach((c) => bb.tint(c, "bottom"));
  parts.push(resistor(bb.hole(11, "h"), bb.hole(14, "h"), { bands: TEN_K, label: "10kΩ" }).svg);
  parts.push(tiltSwitch(bb.hole(14, "f"), bb.hole(16, "f")).svg);
  wires.push(mmWire(bb.hole(11, "j"), D("+", 11), C.red, [], "line"), mmWire(bb.hole(16, "j"), D("-", 16), C.black));
  // 버튼: 다리 (19,e)(21,e)(19,f)(21,f). 신호 (21, j) ← P27, 같은 쪽 다른 다리 줄 (19, j) → − 줄
  const btn = button(bb, 19);
  [19, 21].forEach((c) => bb.tint(c, "bottom"));
  wires.push(mmWire(bb.hole(19, "j"), D("-", 19), C.black));
  // 수동 부저: + (24,f) ← P25, − (26,f) → − 줄
  [24, 26].forEach((c) => bb.tint(c, "bottom"));
  parts.push(buzzer(bb.hole(24, "f"), bb.hole(26, "f")).svg);
  wires.push(mmWire(bb.hole(26, "j"), D("-", 26), C.black));

  // 보드 → 브레드보드: 두 모듈 사이로 올라간다 (P27 이 P25 보다 위 길)
  const s14 = b.gpio(14), s27 = b.gpio(27), s25 = b.gpio(25);
  const h14 = bb.hole(14, "j"), h27 = bb.hole(21, "j"), h25 = bb.hole(24, "j");
  wires.push(mfWire(s14, h14, C.green, [{ x: s14.x, y: lane(1) }, { x: h14.x, y: lane(1) }], "orth"));
  wires.push(mfWire(s27, h27, C.purple, [{ x: s27.x, y: lane(0) }, { x: h27.x, y: lane(0) }], "orth"));
  wires.push(mfWire(s25, h25, C.orange, [{ x: s25.x, y: lane(2) }, { x: h25.x, y: lane(2) }], "orth"));
  used.push(s14, s27, s25);

  // 전원: 전원 헤더 3V → 헤더 GND 핀 사이로 올라가 + 줄 3번 칸, 전원 헤더 GND → − 줄 5번 칸
  const v33 = b.power("3V3", 1), gnd = b.power("GND", 4);
  const p3 = D("+", 3);
  wires.push(mfWire(v33, p3, C.red, [{ x: p3.x, y: v33.y }], "orth"), mfWire(gnd, D("-", 5), C.black));
  used.push(v33, gnd);

  // DHT11 · 불꽃 센서: 핀이 아래로(G · V · S), P13 · P34 칸 G · V · S 기둥에 F-F 셋씩
  const my = Y0 - 118;
  const t13 = b.triple(13), t34 = b.triple(34);
  const dht = dht11(t13.S.x - 38, my, { titleAt: { x: t13.S.x - 48, y: my + 35, anchor: "end" } });
  const fl = sensor3(t34.S.x - 38, my, "flame", { titleAt: { x: t34.S.x + 48, y: my + 35, anchor: "start" } });
  parts.push(dht.svg, fl.svg, columnRun(t13, dht.pins, { turnY: Y0 - 14 }), columnRun(t34, fl.pins, { turnY: Y0 - 14, colors: { G: C.black, V: C.red, S: C.yellow } }));
  used.push(t13.G, t13.V, t13.S, t34.G, t34.V, t34.S);

  parts.push(btn.svg);
  const rows = [
    { colors: [C.black, C.red, C.blue], part: "DHT11 G · V · S", to: "P13 칸 G · V · S" },
    { colors: [C.black, C.red, C.yellow], part: "불꽃 센서 G · V · S", to: "P34 칸 G · V · S" },
    { color: C.red, part: "전원 헤더 3V", to: "+ 줄 (헤더 GND 핀 사이로)" },
    { color: C.black, part: "전원 헤더 GND", to: "− 줄" },
    { color: C.green, part: "P14 칸 S", to: "14번 줄 (10kΩ 과 틸트 스위치 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 11번 줄 · 틸트 16번 줄", to: "+ 줄 · − 줄" },
    { color: C.purple, part: "P27 칸 S", to: "21번 줄 (버튼 한쪽 다리)" },
    { color: C.black, part: "버튼 19번 줄", to: "− 줄" },
    { color: C.orange, part: "P25 칸 S", to: "24번 줄 부저 + 다리 (− 다리 26번 줄 → − 줄)" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 40, "이렇게 꽂아요 — 모듈 둘은 기둥에 바로, 맨 부품은 브레드보드에", rows, b.legend, { columns: 1 });
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const TT = {
  plus: "재난 알리미 배선도(ESP32 Plus 확장 보드): 브레드보드는 보드 아래. 아래 줄 3V3 → 위 + 줄, 아래 줄 GND → 위 − 줄, 위 − 줄과 아래 − 줄은 점퍼로. DHT11 모듈 G · V · S 는 보드 위쪽 io13 기둥 G · V · S 에 F-F 듀폰선으로 바로. 불꽃 센서 모듈 V → + 줄, G → − 줄, S → 아래 줄 io34. 틸트 스위치는 12번 줄과 14번 줄 사이, 10kΩ 저항은 9번 줄과 12번 줄 사이: 9번 줄 → + 줄, 14번 줄 → − 줄, 12번 줄 ← io14. 버튼은 가운데 홈에 걸쳐 6 · 8번 줄: io27 → 6번 줄, 대각선 8번 줄 → 아래 − 줄. 수동 부저 + 다리 2번 줄 ← io25, − 다리 4번 줄 → − 줄. io14 · io27 · io25 세 선은 보드 바깥으로 돌아 브레드보드로",
  expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) 재난 알리미 배선도: JUMP 점퍼는 3.3V 쪽(평소 자리). DHT11 모듈 G · V · S 는 P13 칸 G · V · S, 불꽃 센서 모듈 G · V · S 는 P34 칸 G · V · S 에 F-F 듀폰선으로 바로. 브레드보드는 보드 위: 전원 헤더 3V → 헤더 GND 핀 사이로 올라가 + 줄, 전원 헤더 GND → − 줄. 10kΩ 저항은 11번 줄과 14번 줄 사이, 틸트 스위치는 14번 줄과 16번 줄 사이: 11번 줄 → + 줄, 16번 줄 → − 줄, 14번 줄 ← P14 칸 S 핀. 버튼은 가운데 홈에 걸쳐 19 · 21번 줄: P27 칸 S 핀 → 21번 줄, 19번 줄 → − 줄. 수동 부저 + 다리 24번 줄 ← P25 칸 S 핀, − 다리 26번 줄 → − 줄. P14 · P27 · P25 세 선은 두 모듈 사이로 올라가요",
  devkit: "기본 보드(ESP32 DevKit 38핀) 재난 알리미 배선도: 브레드보드는 보드 위. GND → 아래 − 줄, 3V3 → 보드 바깥으로 돌아 아래 + 줄, 위 + 줄과 아래 + 줄 · 위 − 줄과 아래 − 줄은 점퍼로. DHT11 모듈 V → 위 + 줄, G → 위 − 줄, S → D13. 불꽃 센서 모듈 V → 아래 + 줄, G → 아래 − 줄, S → D34. 틸트 스위치는 6번 줄과 8번 줄 사이, 10kΩ 저항은 8번 줄과 11번 줄 사이: 11번 줄 → + 줄, 6번 줄 → − 줄, 8번 줄 ← D14. 버튼은 가운데 홈에 걸쳐 12 · 14번 줄: D27 → 14번 줄, 대각선 12번 줄 → 위 − 줄. 수동 부저 + 다리 16번 줄 ← D25, − 다리 18번 줄 → 아래 − 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wda", TT.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wdak", TT.devkit, r.body, r.height); },
    expansion: () => { const r = expansion(); return svgDoc("wdax", TT.expansion, r.body, r.height); },
  },
};
