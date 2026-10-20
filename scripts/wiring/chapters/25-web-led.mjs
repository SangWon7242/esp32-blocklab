// 센서 "폰으로 켜는 LED" — LED(2번) + 220Ω 저항. 1장과 같은 회로에서 핀만 2번.
// 2번 핀은 Plus 의 ANALOG 묶음 맨 아래 줄, 기본 보드의 아래 줄이라 두 보드 모두 브레드보드를 보드 **아래**에 둔다.
import { COLORS as C, compose, connectionTable, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, led, resistor } from "../parts.mjs";
import { railCol } from "./11-button-touch.mjs";

/** 위에서 내려오는 LED 회로: 신호 (k, a) → 저항 (k,c)~(k+4,c) → 긴 다리 (k+4, e), 짧은 다리 (k+5, e) → (k+5, a) → 위 − 줄 */
function ledFromTop(bb, k) {
  [k, k + 4, k + 5].forEach((c) => bb.tint(c, "top"));
  const svg = [resistor(bb.hole(k, "c"), bb.hole(k + 4, "c"), { label: "220Ω" }).svg, led(bb.hole(k + 4, "e"), bb.hole(k + 5, "e"), "#e03131", { up: false }).svg];
  const jumper = mmWire(bb.hole(k + 5, "a"), bb.rail("top", "-", railCol(k + 5)), C.black);
  return { svg, jumper, signalHole: bb.hole(k, "a"), cols: { sig: k, anode: k + 4, cathode: k + 5 } };
}

function draw(b, k) {
  const bb = breadboard({ x: 72, y: b.bounds.y + b.bounds.h + 24, cols: 26, rails: { top: true, bottom: false } });
  const lc = ledFromTop(bb, k);
  const sig = b.gpio(2), gnd = b.power("GND", 1);
  const wires = [mfWire(sig, lc.signalHole, C.yellow), mfWire(gnd, bb.rail("top", "-", railCol(bb.nearestCol(gnd.x, true))), C.black), lc.jumper];
  const rows = [
    { color: C.yellow, part: `${sig.label}${b.id === "plus" ? "" : " 핀"}`, to: `${lc.cols.sig}번 줄 → 220Ω 저항 → ${lc.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${lc.cols.cathode}번 줄`, to: "− 줄 → GND" },
  ];
  const table = connectionTable(bb.y + bb.h + 16, "이렇게 꽂아요 — LED 는 저항과 함께 브레드보드에", rows, b.legend);
  return { body: compose(b.draw([sig, gnd]), [bb.svg, ...lc.svg], wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "폰으로 켜는 LED 배선도(ESP32 Plus 확장 보드, 브레드보드는 보드 아래): ANALOG 묶음 맨 아래 io2 의 S 핀 → 브레드보드 3번 줄 → 220Ω 저항 → 7번 줄의 LED 긴 다리(+). 짧은 다리(−)는 8번 줄 → 점퍼선 → − 줄 → 보드 아래 줄 GND. 폰은 선 없이 WiFi 로 요청을 보내요",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 폰으로 켜는 LED 배선도(브레드보드는 보드 아래): 아래 줄 D2 핀 → 브레드보드 6번 줄 → 220Ω 저항 → 10번 줄의 LED 긴 다리(+). 짧은 다리(−)는 11번 줄 → 점퍼선 → − 줄 → 아래 줄 GND. 폰은 선 없이 WiFi 로 요청을 보내요",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = draw(makePlus({ x: 60, y: 8 }), 3); return svgDoc("wbw", T.plus, r.body, r.height); },
    devkit: () => { const r = draw(makeDevkit({ x: 80, y: 8 }), 6); return svgDoc("wbwk", T.devkit, r.body, r.height); },
  },
};
