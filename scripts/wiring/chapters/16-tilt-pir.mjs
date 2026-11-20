// 센서 S13 "기울기와 사람 감지" — 틸트 스위치(맨 부품) + 10kΩ → 14번, PIR 모듈(G V S) S → 23번,
// 능동 부저 + → 25번 (ESP32 Plus 에 io15 가 없어 15번에서 옮김), LED(26번) + 220Ω.
// 틸트: 3V3 — 10kΩ — 14번 — 틸트 스위치 — GND. 10kΩ 이 끌어올리는(풀업) 저항이라, 바로 서서 구슬이 다리를 이으면 0,
// 기울어 떨어지면 1 — 이 챕터의 원리 글·그림(tilt-ball.svg)·코드(기울면 1)와 같다.
// 브레드보드는 두 보드 모두 보드 위. 3V3(아래 줄)만 보드 왼쪽 바깥 길로 + 줄에.
// Plus: PIR 은 F-F 3가닥으로 io23 기둥 S · V · G 에 바로 — 세 선은 기둥 아래 빈 띠를 지나 보드 오른쪽 모듈로.
// DevKit: PIR S → D23(아래 줄, 보드 오른쪽 바깥 길), V · G → + − 줄.
// 확장 보드: 맨 부품은 보드 위 브레드보드(M-F), 3V3 은 전원 헤더 3V(GND 핀 사이 틈으로 올라감), GND 는 전원 헤더 GND.
//   PIR 은 F-F 3가닥으로 아래 줄 P23 칸 S · V · G 에 바로 (S 는 아래에서, V · G 는 보드 오른쪽 가장자리에서 옆으로). 점퍼 3.3V.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { breadboard, buzzer, led, resistor, sensor3, tiltSwitch } from "../parts.mjs";
import { mark } from "../record.mjs";

const TEN_K = ["#8b5a2b", "#212529", "#f76707"]; // 갈 검 주

/**
 * 브레드보드 아래쪽(f~j) 회로 셋. cols: 열 번호
 *   tilt: { r, n, t, rRail } — 10kΩ (n,h)~(r,h), 틸트 (n,f)~(t,f), r → + 줄(rRail 칸), t → − 줄, n ← 14번
 *   buz: { plus, minus } — 부저 + (plus,f), − (minus,f) → − 줄, plus ← 25번
 *   led: { sig, anode, cathode } — 220Ω (sig,h)~(anode,h), LED (anode,f)(cathode,f), cathode → − 줄, sig ← 26번
 */
function circuits(bb, { tilt, buz, led: L }) {
  const R = (s, c) => bb.rail("bottom", s, c);
  const svg = [], jumpers = [];
  [tilt.r, tilt.n, tilt.t, buz.plus, buz.minus, L.sig, L.anode, L.cathode].forEach((c) => bb.tint(c, "bottom"));
  svg.push(resistor(bb.hole(tilt.n, "h"), bb.hole(tilt.r, "h"), { bands: TEN_K, label: "10kΩ" }).svg);
  svg.push(tiltSwitch(bb.hole(tilt.n, "f"), bb.hole(tilt.t, "f")).svg);
  jumpers.push(mmWire(bb.hole(tilt.r, "j"), R("+", tilt.rRail), C.red, [], "line"));
  jumpers.push(mmWire(bb.hole(tilt.t, "j"), R("-", tilt.t), C.black));
  svg.push(buzzer(bb.hole(buz.plus, "f"), bb.hole(buz.minus, "f"), { active: true }).svg);
  jumpers.push(mmWire(bb.hole(buz.minus, "j"), R("-", buz.minus), C.black));
  svg.push(resistor(bb.hole(L.sig, "h"), bb.hole(L.anode, "h"), { label: "220Ω" }).svg);
  svg.push(led(bb.hole(L.anode, "f"), bb.hole(L.cathode, "f"), "#e03131").svg);
  jumpers.push(mmWire(bb.hole(L.cathode, "j"), R("-", L.cathode), C.black));
  return { svg, jumpers, hole: (c) => bb.hole(c, "j"), R };
}

/* ───── ESP32 Plus ───── */
function plus() {
  const bb = breadboard({ x: 96, y: 8, cols: 26, rails: { top: false, bottom: true } });
  const b = makePlus({ x: 96, y: bb.y + bb.h + 24 });
  const spec = { tilt: { r: 11, n: 15, t: 17, rRail: 10 }, buz: { plus: 21, minus: 19 }, led: { sig: 22, anode: 25, cathode: 26 } };
  const c = circuits(bb, spec);
  const parts = [bb.svg, ...c.svg], wires = [], used = [];
  const p14 = b.gpio(14), p25 = b.gpio(25), p26 = b.gpio(26), gnd = b.power("GND"), v33 = b.power("3V3");
  wires.push(mfWire(p14, c.hole(15), C.green), mfWire(p25, c.hole(21), C.orange), mfWire(p26, c.hole(22), C.yellow));
  wires.push(mfWire(gnd, c.R("-", bb.nearestCol(gnd.x, true)), C.black));
  const bot = b.bounds.y + b.bounds.h;
  wires.push(mfWire(v33, c.R("+", 1), C.red, [{ x: v33.x, y: bot + 14 }, { x: 40, y: bot + 14 }, { x: 40, y: c.R("+", 1).y }], "orth"));
  wires.push(...c.jumpers);
  used.push(p14, p25, p26, gnd, v33);

  // PIR: 보드 오른쪽, 핀이 아래로 (왼→오 G V S). io23 기둥 S · V · G 에 F-F 로 바로
  const t = b.triple(23);
  const pir = sensor3(548, b.bounds.y + 22, "pir", { titleAt: { x: 586, y: b.bounds.y + 8 } });
  const lane = (k) => b.lane.top + 4 + k * 6;
  const run = (p, pin, color, dx, k) => ffWire(p, pin, color, [{ x: p.x, y: lane(k) }, { x: t.S.x + dx, y: lane(k) }, { x: t.S.x + dx, y: pin.y + 4 }], "orth");
  wires.push(run(pir.pins.S, t.S, C.blue, -4, 2), run(pir.pins.V, t.V, C.red, 0, 1), run(pir.pins.G, t.G, C.black, 4, 0));
  used.push(t.S, t.V, t.G);
  parts.push(pir.svg);

  const rows = [
    { colors: [C.black, C.red, C.blue], part: "PIR G · V · S", to: "io23 기둥 G · V · S" },
    { color: C.red, part: "3V3(아래 줄)", to: "+ 줄" }, { color: C.black, part: "GND(위 줄)", to: "− 줄" },
    { color: C.green, part: "io14", to: "15번 줄 (틸트 스위치와 10kΩ 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 11번 줄 · 틸트 17번 줄", to: "+ 줄 · − 줄" },
    { color: C.orange, part: "io25", to: "21번 줄 부저 + 다리 (− 다리 19번 줄 → − 줄)" },
    { color: C.yellow, part: "io26", to: "22번 줄 → 220Ω → 25번 줄 LED 긴 다리" },
    { color: C.black, part: "LED 짧은 다리 26번 줄", to: "− 줄" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 30, "이렇게 꽂아요 — PIR 은 보드에 바로, 나머지는 브레드보드에", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit 38핀) ───── */
function devkit() {
  const bb = breadboard({ x: 96, y: 8, cols: 24, rails: { top: false, bottom: true } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 24 });
  const spec = { tilt: { r: 4, n: 8, t: 10, rRail: 5 }, buz: { plus: 18, minus: 20 }, led: { sig: 11, anode: 15, cathode: 16 } };
  const c = circuits(bb, spec);
  const parts = [bb.svg, ...c.svg], wires = [], used = [];
  const d14 = b.gpio(14), d25 = b.gpio(25), d26 = b.gpio(26), gnd = b.power("GND", 0), v33 = b.power("3V3");
  const gap = b.bounds.y - 10;
  wires.push(mfWire(d14, c.hole(8), C.green), mfWire(d26, c.hole(11), C.yellow));
  wires.push(mfWire(d25, c.hole(18), C.orange, [{ x: d25.x, y: gap }, { x: c.hole(18).x, y: gap }], "orth"));
  wires.push(mfWire(gnd, c.R("-", 3), C.black));
  wires.push(mfWire(v33, c.R("+", 1), C.red, [{ x: v33.x, y: v33.y + 22 }, { x: 44, y: v33.y + 22 }, { x: 44, y: c.R("+", 1).y }], "orth"));
  wires.push(...c.jumpers);
  used.push(d14, d25, d26, gnd, v33);

  // PIR: 브레드보드 오른쪽, 핀이 아래로 (G V S). V · G → + − 줄 오른쪽 끝, S → 보드 오른쪽 바깥 길 → D23(아래 줄)
  const pir = sensor3(530, 112, "pir", { titleAt: { x: 568, y: 96 } });
  const d23 = b.gpio(23), plusEnd = c.R("+", 23), minusEnd = c.R("-", 22);
  wires.push(mfWire(pir.pins.G, minusEnd, C.black, [{ x: pir.pins.G.x, y: minusEnd.y }], "orth"));
  wires.push(mfWire(pir.pins.V, plusEnd, C.red, [{ x: pir.pins.V.x, y: plusEnd.y }], "orth"));
  const bot = b.bounds.y + b.bounds.h;
  wires.push(ffWire(pir.pins.S, d23, C.blue, [{ x: pir.pins.S.x, y: pir.pins.S.y + 10 }, { x: 618, y: pir.pins.S.y + 10 }, { x: 618, y: bot + 14 }, { x: d23.x, y: bot + 14 }], "orth"));
  used.push(d23);
  parts.push(pir.svg);

  const rows = [
    { color: C.red, part: "3V3(위 줄 끝)", to: "+ 줄" }, { color: C.black, part: "GND", to: "− 줄" },
    { color: C.blue, part: "PIR S", to: "D23 (보드 바깥으로 돌아 아래 줄)" },
    { colors: [C.red, C.black], part: "PIR V · G", to: "+ 줄 · − 줄" },
    { color: C.green, part: "D14", to: "8번 줄 (틸트 스위치와 10kΩ 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 4번 줄 · 틸트 10번 줄", to: "+ 줄 · − 줄" },
    { color: C.orange, part: "D25", to: "18번 줄 부저 + 다리 (− 다리 20번 줄 → − 줄)" },
    { color: C.yellow, part: "D26", to: "11번 줄 → 220Ω → 15번 줄 LED 긴 다리" },
    { color: C.black, part: "LED 짧은 다리 16번 줄", to: "− 줄" },
  ];
  const table = connectionTable(bot + 30, "이렇게 꽂아요 — 3V3 · GND 는 + − 줄로 나눠 써요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/**
 * 핀이 위로 오는 PIR 모듈. parts.sensor3 의 PIR 렌즈 그림은 핀이 아래인 모양에 맞춰져 있어(렌즈 중심 y+32),
 * 핀이 위면 렌즈가 핀 이름(S V G)을 가린다 — 렌즈만 10 아래로 옮긴다 (3D 기록은 그대로).
 */
function pirUp(x, y, opt) {
  const m = sensor3(x, y, "pir", { ...opt, side: "top" });
  const svg = mark(m.svg
    .replace(`cy="${y + 32}" r="24"`, `cy="${y + 42}" r="24"`)
    .replace(`M${x + 22} ${y + 32} q16 -16 32 0 M${x + 26} ${y + 40}`, `M${x + 22} ${y + 42} q16 -16 32 0 M${x + 26} ${y + 50}`));
  return { ...m, svg };
}

/* ───── 확장 보드(38핀 확장 보드 + DevKit): 점퍼 3.3V ───── */
function expansion() {
  const bb = breadboard({ x: 100, y: 8, cols: 26, rails: { top: false, bottom: true } });
  const b = makeExpansion({ x: 22, y: bb.y + bb.h + 30, jumper: "3V3" });
  const spec = { tilt: { r: 9, n: 13, t: 15, rRail: 10 }, buz: { plus: 21, minus: 23 }, led: { sig: 20, anode: 17, cathode: 16 } };
  const c = circuits(bb, spec);
  const parts = [bb.svg, ...c.svg], wires = [], used = [];
  const p14 = b.gpio(14), p25 = b.gpio(25), p26 = b.gpio(26), gnd = b.power("GND", 5), v33 = b.power("3V3", 0);
  wires.push(mfWire(p14, c.hole(spec.tilt.n), C.green), mfWire(p25, c.hole(spec.buz.plus), C.orange), mfWire(p26, c.hole(spec.led.sig), C.yellow));
  wires.push(mfWire(gnd, c.R("-", bb.nearestCol(gnd.x, true)), C.black));
  // 3V3: 전원 헤더 3V 에서 왼쪽으로 나와 헤더 바깥(GND 핀 왼쪽)으로 올라가 + 줄 1번 칸
  const side = v33.x - 30, plusHole = c.R("+", 1);
  wires.push(mfWire(v33, plusHole, C.red, [{ x: side, y: v33.y }, { x: side, y: plusHole.y + 12 }, { x: plusHole.x, y: plusHole.y + 12 }], "orth"));
  wires.push(...c.jumpers);
  used.push(p14, p25, p26, gnd, v33);

  // PIR: 보드 오른쪽 아래, 핀이 위로 (모듈을 돌려 왼→오 S V G). S 는 아래에서 곧게, V · G 는 보드 오른쪽 가장자리 길로 올라가 옆에서
  const t = b.triple(23);
  const bot = b.bounds.y + b.bounds.h;
  const pir = pirUp(t.S.x - 18, bot + 46, { pins: ["S", "V", "G"], titleAt: { x: t.S.x - 30, y: bot + 82, anchor: "end" } });
  const laneV = bot + 18, laneG = bot + 30;
  wires.push(ffWire(pir.pins.S, t.S, C.blue));
  wires.push(ffWire(pir.pins.V, t.V, C.red, [{ x: pir.pins.V.x, y: laneV }, { x: 612, y: laneV }, { x: 612, y: t.V.y }], "orth"));
  wires.push(ffWire(pir.pins.G, t.G, C.black, [{ x: pir.pins.G.x, y: laneG }, { x: 624, y: laneG }, { x: 624, y: t.G.y }], "orth"));
  used.push(t.S, t.V, t.G);
  parts.push(pir.svg);

  const { tilt, buz, led: L } = spec;
  const rows = [
    { colors: [C.blue, C.red, C.black], part: "PIR S · V · G", to: "아래 줄 P23 칸 S · V · G" },
    { color: C.red, part: "전원 헤더 3V", to: "+ 줄" }, { color: C.black, part: "전원 헤더 GND", to: "− 줄" },
    { color: C.green, part: "P14 칸 S", to: `${tilt.n}번 줄 (틸트 스위치와 10kΩ 사이)` },
    { colors: [C.red, C.black], part: `10kΩ ${tilt.r}번 줄 · 틸트 ${tilt.t}번 줄`, to: "+ 줄 · − 줄" },
    { color: C.orange, part: "P25 칸 S", to: `${buz.plus}번 줄 부저 + 다리 (− 다리 ${buz.minus}번 줄 → − 줄)` },
    { color: C.yellow, part: "P26 칸 S", to: `${L.sig}번 줄 → 220Ω → ${L.anode}번 줄 LED 긴 다리` },
    { color: C.black, part: `LED 짧은 다리 ${L.cathode}번 줄`, to: "− 줄" },
  ];
  const table = connectionTable(pir.pins.S.y + 104, "이렇게 꽂아요 — PIR 은 보드에 바로, 나머지는 브레드보드에", rows, b.legend);
  return { body: compose(b.draw(used, { note: "left" }), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "기울기와 사람 감지 배선도(ESP32 Plus 확장 보드): 브레드보드는 보드 위. 아래 줄 3V3 → 보드 바깥으로 돌아 + 줄, 위쪽 GND → − 줄. 10kΩ 저항은 11번 줄과 15번 줄 사이, 11번 줄 → + 줄, 15번 줄 ← io14, 틸트 스위치는 15번 줄과 17번 줄 사이, 17번 줄 → − 줄. 능동 부저 + 다리 21번 줄 ← io25, − 다리 19번 줄 → − 줄. LED: io26 → 22번 줄 → 220Ω 저항 → 25번 줄 긴 다리(+), 짧은 다리(−) 26번 줄 → − 줄. PIR 센서 모듈 G · V · S 는 io23 기둥 G · V · S 에 F-F 듀폰선으로 바로",
  expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) 기울기와 사람 감지 배선도: JUMP 점퍼는 3.3V 쪽. 브레드보드는 보드 위. 전원 헤더 3V → 헤더 왼쪽으로 돌아 + 줄, 전원 헤더 GND → − 줄. 10kΩ 저항은 9번 줄과 13번 줄 사이, 9번 줄 → + 줄, 13번 줄 ← P14 칸 S 핀, 틸트 스위치는 13번 줄과 15번 줄 사이, 15번 줄 → − 줄. 능동 부저 + 다리 21번 줄 ← P25 칸 S 핀, − 다리 23번 줄 → − 줄. LED: P26 칸 S 핀 → 20번 줄 → 220Ω 저항 → 17번 줄 긴 다리(+), 짧은 다리(−) 16번 줄 → − 줄. PIR 센서 모듈 S · V · G 는 아래 줄 P23 칸 S · V · G 에 F-F 듀폰선으로 바로",
  devkit: "기본 보드(ESP32 DevKit 38핀) 기울기와 사람 감지 배선도: 브레드보드는 보드 위. 3V3 → 보드 바깥으로 돌아 + 줄, GND → − 줄. 10kΩ 저항은 4번 줄과 8번 줄 사이, 4번 줄 → + 줄, 8번 줄 ← D14, 틸트 스위치는 8번 줄과 10번 줄 사이, 10번 줄 → − 줄. 능동 부저 + 다리 18번 줄 ← D25, − 다리 20번 줄 → − 줄. LED: D26 → 11번 줄 → 220Ω 저항 → 15번 줄 긴 다리(+), 짧은 다리(−) 16번 줄 → − 줄. PIR 센서 모듈 V → + 줄, G → − 줄, S → 보드 바깥으로 돌아 D23",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wtp", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wtpk", T.devkit, r.body, r.height); },
    expansion: () => { const r = expansion(); return svgDoc("wtpx", T.expansion, r.body, r.height); },
  },
};
