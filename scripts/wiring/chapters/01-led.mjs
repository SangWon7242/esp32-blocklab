// 센서 S1 "LED 켜기" — LED(26번) + 220Ω 저항, 브레드보드. 두 보드 모두 브레드보드를 보드 위에 둔다.
import { COLORS as C, compose, connectionTable, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, led, resistor } from "../parts.mjs";

/** 26번 → (k, j) → 저항 (k, h)~(k-5, h) → LED 긴 다리 (k-5, f), 짧은 다리 (k-6, f) → (k-6, j) → − 줄 */
function ledCircuit(bb, k) {
  const svg = [];
  const a = bb.hole(k - 5, "f"), c = bb.hole(k - 6, "f");
  [k, k - 5, k - 6].forEach((col) => bb.tint(col, "bottom"));
  svg.push(resistor(bb.hole(k, "h"), bb.hole(k - 5, "h"), { label: "220Ω" }).svg);
  svg.push(led(a, c, "#e03131").svg);
  const jumper = mmWire(bb.hole(k - 6, "j"), bb.rail("bottom", "-", k - 6), C.black);
  return { svg, jumper, signalHole: bb.hole(k, "j"), cols: { sig: k, anode: k - 5, cathode: k - 6 } };
}

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

export default {
  "wiring-led.svg": {
    plus: () => draw((o) => makePlus({ x: 96, ...o }), 96, 22, "wl",
      "LED 배선도(ESP32 Plus 확장 보드): 보드 위쪽 io26 핀 → 브레드보드 22번 줄 → 220Ω 저항 → 17번 줄의 LED 긴 다리(+). 짧은 다리(−)는 16번 줄 → 점퍼선 → 브레드보드 − 줄 → 보드 GND"),
    devkit: () => draw((o) => makeDevkit({ x: 110, ...o }), 96, 11, "wlk",
      "기본 보드(ESP32 DevKit V1 30핀) LED 배선도: D26 핀 → 브레드보드 11번 줄 → 220Ω 저항 → 6번 줄의 LED 긴 다리(+). 짧은 다리(−)는 5번 줄 → 점퍼선 → 브레드보드 − 줄 → 보드 GND"),
  },
};
