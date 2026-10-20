// 센서 S4 "흐르는 물빛" — LED 다섯 개: 18 · 5 · 14 · 17 · 26번, LED 마다 220Ω 저항. 브레드보드에 목록 순서(왼→오)대로.
// Plus 는 다섯 핀이 모두 위 한 줄에 같은 순서로 있다.
// DevKit 은 D14 · D26 · GND 가 위 줄, D18 · D5 · TX2(17) 이 아래 줄이라 아래 줄 선은 보드 바깥으로 돌아 올라온다
// (D18 · D5 는 왼쪽 바깥, TX2 는 오른쪽 바깥). 순서를 지키느라 세 군데에서 선이 엇갈린다.
import { COLORS as C, compose, connectionTable, mfWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard } from "../parts.mjs";
import { ledCircuit, route } from "./01-led.mjs";

const PINS = [
  { gpio: 18, wire: C.yellow },
  { gpio: 5, wire: C.green },
  { gpio: 14, wire: C.blue },
  { gpio: 17, wire: C.purple },
  { gpio: 26, wire: C.orange },
];
const KS = [6, 12, 18, 24, 30]; // 신호 열 (3칸 왼쪽 LED 긴 다리, 4칸 왼쪽 짧은 다리)
const GAP = { plus: 40, devkit: 56 };

function common(kind) {
  const bb = breadboard({ x: 36, y: 8, cols: 30, rails: { top: false, bottom: true } });
  const circs = KS.map((k) => ledCircuit(bb, k, { span: 3 }));
  const top = bb.y + bb.h; // 브레드보드 아래 끝
  const b = kind === "plus" ? makePlus({ x: 76, y: top + GAP.plus }) : makeDevkit({ x: 116, y: top + GAP.devkit });
  return { bb, circs, top, b };
}

function rowsFor(b, circs) {
  const rows = PINS.map((p, i) => {
    const c = circs[i].cols;
    return { color: p.wire, part: `${b.gpio(p.gpio).label} 핀`, to: `${c.sig}번 줄 → 220Ω 저항 → ${c.anode}번 줄 LED 긴 다리(+)` };
  });
  rows.push({ color: C.black, part: `LED 짧은 다리(−) ${circs.map((c) => c.cols.cathode).join(" · ")}번 줄`, to: "− 줄 → GND" });
  return rows;
}

function plus() {
  const { bb, circs, top, b } = common("plus");
  const lane = top + GAP.plus / 2;
  const wires = [], used = [];
  PINS.forEach((p, i) => {
    const pin = b.gpio(p.gpio), h = circs[i].signalHole;
    // io18 은 GND 선 위를 지나 왼쪽으로 가므로 한 칸 높은 길
    wires.push(mfWire(pin, h, p.wire, route(pin, h, p.gpio === 18 ? lane - 6 : lane), "orth"));
    used.push(pin);
  });
  const gnd = b.power("GND"), gRail = bb.rail("bottom", "-", 4);
  wires.push(mfWire(gnd, gRail, C.black, route(gnd, gRail, lane + 6), "orth"));
  used.push(gnd);
  circs.forEach((c) => wires.push(c.jumper));
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — LED 마다 220Ω 저항을 하나씩", rowsFor(b, circs), b.legend);
  return { body: compose(b.draw(used), [bb.svg, ...circs.flatMap((c) => c.svg)], wires, [table.svg]), height: table.bottom };
}

function devkit() {
  const { bb, circs, top, b } = common("devkit");
  const L = (k) => top + 9 * k; // 위 빈 띠의 가로 길: 1(브레드보드 쪽) ~ 5(보드 쪽)
  const below = (k) => b.bounds.y + b.bounds.h + 10 * k; // 보드 아래 가로 길
  const leftX = { 18: b.bounds.x - 72, 5: b.bounds.x - 62 };
  const rightX = b.bounds.x + b.bounds.w + 18;
  const hole = (g) => circs[PINS.findIndex((p) => p.gpio === g)].signalHole;
  const color = (g) => PINS.find((p) => p.gpio === g).wire;
  const wires = [], used = [];
  // 위 줄: D14 · D26 · GND
  const d14 = b.gpio(14), d26 = b.gpio(26), gnd = b.power("GND", 0), gRail = bb.rail("bottom", "-", 16);
  wires.push(mfWire(d26, hole(26), color(26), route(d26, hole(26), L(5)), "orth"));
  wires.push(mfWire(d14, hole(14), color(14), route(d14, hole(14), L(4)), "orth"));
  wires.push(mfWire(gnd, gRail, C.black, route(gnd, gRail, L(3)), "orth"));
  // 아래 줄: D5 · D18 은 왼쪽 바깥으로, TX2(17) 은 오른쪽 바깥으로
  for (const [g, lv, bl] of [[5, 2, 1], [18, 1, 2]]) {
    const p = b.gpio(g), h = hole(g);
    wires.push(mfWire(p, h, color(g), [{ x: p.x, y: below(bl) }, { x: leftX[g], y: below(bl) }, { x: leftX[g], y: L(lv) }, { x: h.x, y: L(lv) }], "orth"));
    used.push(p);
  }
  const tx2 = b.gpio(17), h17 = hole(17);
  wires.push(mfWire(tx2, h17, color(17), [{ x: tx2.x, y: below(3) }, { x: rightX, y: below(3) }, { x: rightX, y: L(1) }, { x: h17.x, y: L(1) }], "orth"));
  used.push(d14, d26, gnd, tx2);
  circs.forEach((c) => wires.push(c.jumper));
  const table = connectionTable(below(3) + 18, "이렇게 꽂아요 — LED 마다 220Ω 저항을 하나씩", rowsFor(b, circs), b.legend);
  return { body: compose(b.draw(used), [bb.svg, ...circs.flatMap((c) => c.svg)], wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "흐르는 물빛 배선도(ESP32 Plus 확장 보드): 보드 위쪽 한 줄의 io18 · io5 · io14 · io17 · io26 핀을 차례로 브레드보드 6 · 12 · 18 · 24 · 30번 줄에 잇고, 줄마다 220Ω 저항 → 3칸 왼쪽(3 · 9 · 15 · 21 · 27번 줄) LED 긴 다리(+). LED 짧은 다리(−)는 2 · 8 · 14 · 20 · 26번 줄에서 점퍼선으로 − 줄, − 줄은 보드 GND",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 흐르는 물빛 배선도: D18 · D5 · D14 · TX2(17) · D26 핀을 차례로 브레드보드 6 · 12 · 18 · 24 · 30번 줄에 잇고, 줄마다 220Ω 저항 → 3칸 왼쪽(3 · 9 · 15 · 21 · 27번 줄) LED 긴 다리(+). D18 · D5 · TX2 는 아래 줄이라 보드 바깥으로 돌아 올라와요. LED 짧은 다리(−)는 2 · 8 · 14 · 20 · 26번 줄에서 점퍼선으로 − 줄, − 줄은 보드 GND",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wf", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wfk", T.devkit, r.body, r.height); },
  },
};
