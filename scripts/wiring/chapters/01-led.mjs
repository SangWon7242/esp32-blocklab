// 센서 S1 "LED 켜기" — LED(26번) + 220Ω 저항, 브레드보드. 두 보드 모두 브레드보드를 보드 위에 둔다.
// 아래 ledCircuit · route · ledWiring 은 02~04 장(같은 LED 회로)도 가져다 쓴다.
import { COLORS as C, compose, connectionTable, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, led, resistor } from "../parts.mjs";

/**
 * LED 하나: 신호 (k, j) → 저항 (k, h)~(k-span, h) → LED 긴 다리 (k-span, f), 짧은 다리 (k-span-1, f) → (k-span-1, j) → − 줄.
 * 반환 { svg, jumper, signalHole, cols: { sig, anode, cathode } }
 */
export function ledCircuit(bb, k, { span = 5, color = "#e03131", label = "220Ω" } = {}) {
  const svg = [];
  const an = k - span, ca = k - span - 1;
  const a = bb.hole(an, "f"), c = bb.hole(ca, "f");
  [k, an, ca].forEach((col) => bb.tint(col, "bottom"));
  svg.push(resistor(bb.hole(k, "h"), bb.hole(an, "h"), { label }).svg);
  svg.push(led(a, c, color).svg);
  const jumper = mmWire(bb.hole(ca, "j"), bb.rail("bottom", "-", bb.nearestCol(c.x, true)), C.black);
  return { svg, jumper, signalHole: bb.hole(k, "j"), cols: { sig: k, anode: an, cathode: ca } };
}

/** 직각 선 길: from 에서 세로로 laneY 까지, 가로로 to.x 까지, 다시 세로로 to (wire 의 via, style "orth") */
export const route = (from, to, laneY) => [{ x: from.x, y: laneY }, { x: to.x, y: laneY }];

function draw(board, bbX, k, idPrefix, title) {
  const bb = breadboard({ x: bbX, y: 8, cols: 26, rails: { top: false, bottom: true } });
  const circ = ledCircuit(bb, k);
  const b = board({ y: bb.y + bb.h + 24 });
  const sig = b.gpio(26), gnd = b.power("GND");
  const wires = [mfWire(sig, circ.signalHole, C.yellow), mfWire(gnd, bb.rail("bottom", "-", bb.nearestCol(gnd.x, true)), C.black), circ.jumper];
  const rows = [
    { color: C.yellow, part: `${sig.label} 핀`, to: `${circ.cols.sig}번 줄 → 220Ω 저항 → ${circ.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${circ.cols.cathode}번 줄`, to: "− 줄 → GND" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — LED 는 저항과 함께 브레드보드에", rows, b.legend);
  return svgDoc(idPrefix, title, compose(b.draw([sig, gnd]), [bb.svg, ...circ.svg], wires, [table.svg]), table.bottom);
}

/** LED 하나(26번) 배선도 두 판. 02 장(숨쉬는 LED)도 같은 그림을 쓴다 */
export function ledWiring({ plusId, devkitId, plusTitle, devkitTitle }) {
  return {
    plus: () => draw((o) => makePlus({ x: 96, ...o }), 96, 22, plusId, plusTitle),
    devkit: () => draw((o) => makeDevkit({ x: 110, ...o }), 96, 11, devkitId, devkitTitle),
  };
}

export default {
  "wiring-led.svg": ledWiring({
    plusId: "wl",
    devkitId: "wlk",
    plusTitle: "LED 배선도(ESP32 Plus 확장 보드): 보드 위쪽 io26 핀 → 브레드보드 22번 줄 → 220Ω 저항 → 17번 줄의 LED 긴 다리(+). 짧은 다리(−)는 16번 줄 → 점퍼선 → 브레드보드 − 줄 → 보드 GND",
    devkitTitle: "기본 보드(ESP32 DevKit V1 30핀) LED 배선도: D26 핀 → 브레드보드 11번 줄 → 220Ω 저항 → 6번 줄의 LED 긴 다리(+). 짧은 다리(−)는 5번 줄 → 점퍼선 → 브레드보드 − 줄 → 보드 GND",
  }),
};
