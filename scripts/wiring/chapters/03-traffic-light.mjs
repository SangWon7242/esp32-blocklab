// 센서 S3 "신호등" — LED 셋: 빨강 13번 · 노랑 14번 · 초록 16번, LED 마다 220Ω 저항. 두 보드 모두 브레드보드를 보드 위에.
// Plus 는 세 핀이 모두 위 한 줄. DevKit 은 D13·D14 가 위 줄, 16번(RX2)은 아래 줄이라 보드 오른쪽 바깥으로 돌아 올라온다.
// 확장 보드: P13 · P14 · GND 는 위 줄, P16 은 아래 줄. 보드 오른쪽에 길이 없어(폭 640) P16 선은 칸 사이 틈(핀 간격의 절반)으로
// 보드를 세로로 건너 올라온다 (seamVia — 다른 핀 위를 지나지 않는다). 맨 부품뿐이라 점퍼 3.3V.
import { COLORS as C, compose, connectionTable, mfWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { breadboard } from "../parts.mjs";
import { ledCircuit, route } from "./01-led.mjs";

const LEDS = [
  { gpio: 13, wire: C.purple, led: "#e03131", name: "빨강" },
  { gpio: 14, wire: C.yellow, led: "#fab005", name: "노랑" },
  { gpio: 16, wire: C.green, led: "#2f9e44", name: "초록" },
];
const KS = [6, 13, 21]; // 신호 열 (저항 → 3칸 왼쪽 LED 긴 다리, 4칸 왼쪽 짧은 다리). 열 번호 글자(5·10·15·20)를 가리지 않게

function draw(kind) {
  const isPlus = kind === "plus";
  const bbX = isPlus ? 96 : 80;
  const bb = breadboard({ x: bbX, y: 8, cols: 26, rails: { top: false, bottom: true } });
  const gap = 40;
  const b = isPlus ? makePlus({ x: 56, y: bb.y + bb.h + gap }) : makeDevkit({ x: 110, y: bb.y + bb.h + gap });
  const laneAbove = bb.y + bb.h + gap / 2;
  const parts = [bb.svg], wires = [], used = [], rows = [];
  const circs = LEDS.map((l, i) => ledCircuit(bb, KS[i], { span: 3, color: l.led }));
  circs.forEach((c) => parts.push(...c.svg));
  LEDS.forEach((l, i) => {
    const p = b.gpio(l.gpio), h = circs[i].signalHole;
    used.push(p);
    if (p.side === "bot") {
      // 아래 줄 핀: 보드 아래로 나와 오른쪽 바깥 길로 올라온다
      const below = b.bounds.y + b.bounds.h + 14, outX = b.bounds.x + b.bounds.w + 18;
      wires.push(mfWire(p, h, l.wire, [{ x: p.x, y: below }, { x: outX, y: below }, { x: outX, y: laneAbove }, { x: h.x, y: laneAbove }], "orth"));
    } else {
      wires.push(mfWire(p, h, l.wire, route(p, h, laneAbove), "orth"));
    }
    const c = circs[i].cols;
    rows.push({ color: l.wire, part: `${p.label} 핀`, to: `${c.sig}번 줄 → 220Ω 저항 → ${c.anode}번 줄 ${l.name} LED 긴 다리(+)` });
  });
  const gnd = b.power("GND");
  const gRail = bb.rail("bottom", "-", 4);
  wires.push(mfWire(gnd, gRail, C.black, route(gnd, gRail, laneAbove), "orth"));
  used.push(gnd);
  circs.forEach((c) => wires.push(c.jumper));
  rows.push({ color: C.black, part: `LED 짧은 다리(−) ${circs.map((c) => c.cols.cathode).join(" · ")}번 줄`, to: "− 줄 → GND" });
  const tableY = b.bounds.y + b.bounds.h + (isPlus ? 16 : 34);
  const table = connectionTable(tableY, "이렇게 꽂아요 — LED 마다 220Ω 저항을 하나씩", rows, b.legend);
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/**
 * 확장 보드 아래 줄 핀 p 에서 브레드보드(보드 위) 구멍 hole 까지: 칸 사이 틈 x = sx (두 칸 가운데, 핀 간격 19.8 의 절반 자리)로
 * 보드를 세로로 건너 올라와 lane 에서 가로로 hole 아래까지. 틈이 핀 바로 옆이 아니면 보드 아래(under)로 나가 틈까지 간다.
 * 이웃 칸이 쓰는 핀이면 노란 테두리에 붙으므로 둘 다 안 쓰는 칸 사이 틈을 고른다. mfWire(p, hole, color, seamVia(...), "orth")
 */
export function seamVia(p, hole, sx, lane, under) {
  const up = [{ x: sx, y: lane }, { x: hole.x, y: lane }];
  if (Math.abs(sx - p.x) < 10) return [{ x: sx, y: p.y }, ...up];
  return [{ x: p.x, y: under }, { x: sx, y: under }, ...up];
}
/** 확장 보드 칸 i 와 i+1 사이 틈의 x (보드 x 기준) */
export const seamX = (bx, i) => Math.round((bx + 200 + (i + 0.5) * 19.8) * 10) / 10;

/** 확장 보드: 빨강 P13 은 12번 줄로 곧게, 노랑 P14 · 초록 P16(틈으로) 은 오른쪽으로. 점퍼 3.3V */
const XKS = [12, 17, 23]; // 신호 열 — 짧은 다리 열(8 · 13 · 19)과 함께 열 번호(5 · 10 · 15 · 20) 글자를 가리지 않게
function expansion() {
  const b0x = 22, p13 = b0x + 200 + 4 * 19.8;
  const bb = breadboard({ x: Math.round((p13 - 28 - 16 * (XKS[0] - 1)) * 10) / 10, y: 8, cols: 26, rails: { top: false, bottom: true } });
  const gap = 52;
  const b = makeExpansion({ x: b0x, y: bb.y + bb.h + gap, jumper: "3V3" });
  const top = bb.y + bb.h; // 브레드보드 아래 끝
  const lane = { Y: top + 16, G: top + 28, K: top + 40 };
  const parts = [bb.svg], wires = [], used = [], rows = [];
  const circs = LEDS.map((l, i) => ledCircuit(bb, XKS[i], { span: 3, color: l.led }));
  circs.forEach((c) => parts.push(...c.svg));
  const [red, yellow, green] = LEDS.map((l) => b.gpio(l.gpio));
  const h = circs.map((c) => c.signalHole);
  wires.push(mfWire(red, h[0], LEDS[0].wire));
  wires.push(mfWire(yellow, h[1], LEDS[1].wire, route(yellow, h[1], lane.Y), "orth"));
  // P16 칸 양옆(P4 · P17 / 위 P12 · P14)은 노란 테두리에 붙으므로 P17 · P5 (위 P27 · P26) 사이 틈으로
  wires.push(mfWire(green, h[2], LEDS[2].wire, seamVia(green, h[2], seamX(b0x, 8), lane.G, b.bounds.y + 322), "orth"));
  used.push(red, yellow, green);
  LEDS.forEach((l, i) => {
    const c = circs[i].cols, p = [red, yellow, green][i];
    rows.push({ color: l.wire, part: `${p.label} 칸 S 핀${i === 2 ? "(아래 줄)" : ""}`, to: `${c.sig}번 줄 → 220Ω → ${c.anode}번 줄 ${l.name} LED` });
  });
  const gnd = b.power("GND");
  const gRail = bb.rail("bottom", "-", 14);
  wires.push(mfWire(gnd, gRail, C.black, route(gnd, gRail, lane.K), "orth"));
  used.push(gnd);
  circs.forEach((c) => wires.push(c.jumper));
  rows.push({ color: C.black, part: `LED 짧은 다리(−) ${circs.map((c) => c.cols.cathode).join(" · ")}번 줄`, to: "− 줄 → 위 줄 GND 칸 S 핀" });
  const table = connectionTable(b.bounds.y + b.bounds.h + 12, "이렇게 꽂아요 — LED 마다 220Ω 저항을 하나씩", rows, b.legend);
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "신호등 배선도(ESP32 Plus 확장 보드): 보드 위쪽 io13 → 브레드보드 6번 줄 → 220Ω 저항 → 3번 줄 빨강 LED 긴 다리(+), io14 → 13번 줄 → 220Ω → 10번 줄 노랑 LED, io16 → 21번 줄 → 220Ω → 18번 줄 초록 LED. LED 짧은 다리(−)는 2 · 9 · 17번 줄에서 점퍼선으로 − 줄, − 줄은 보드 GND",
  expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) 신호등 배선도: 위 줄 P13 칸 S 핀 → 브레드보드 12번 줄 → 220Ω 저항 → 9번 줄 빨강 LED 긴 다리(+), 위 줄 P14 칸 S 핀 → 17번 줄 → 220Ω → 14번 줄 노랑 LED, 아래 줄 P16 칸 S 핀 → 칸 사이 틈으로 보드를 건너 23번 줄 → 220Ω → 20번 줄 초록 LED. LED 짧은 다리(−)는 8 · 13 · 19번 줄에서 점퍼선으로 − 줄, − 줄은 위 줄 GND 칸 S 핀. JUMP 점퍼는 3.3V 쪽",
  devkit: "기본 보드(ESP32 DevKit 38핀) 신호등 배선도: D13 → 브레드보드 6번 줄 → 220Ω 저항 → 3번 줄 빨강 LED 긴 다리(+), D14 → 13번 줄 → 220Ω → 10번 줄 노랑 LED, 아래 줄 RX2(16) → 보드 바깥으로 돌아 21번 줄 → 220Ω → 18번 줄 초록 LED. LED 짧은 다리(−)는 2 · 9 · 17번 줄에서 점퍼선으로 − 줄, − 줄은 보드 GND",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = draw("plus"); return svgDoc("wt", T.plus, r.body, r.height); },
    devkit: () => { const r = draw("devkit"); return svgDoc("wtk", T.devkit, r.body, r.height); },
    expansion: () => { const r = expansion(); return svgDoc("wtx", T.expansion, r.body, r.height); },
  },
};
