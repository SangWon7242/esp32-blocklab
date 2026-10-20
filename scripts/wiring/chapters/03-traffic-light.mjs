// 센서 S3 "신호등" — LED 셋: 빨강 13번 · 노랑 14번 · 초록 16번, LED 마다 220Ω 저항. 두 보드 모두 브레드보드를 보드 위에.
// Plus 는 세 핀이 모두 위 한 줄. DevKit 은 D13·D14 가 위 줄, 16번(RX2)은 아래 줄이라 보드 오른쪽 바깥으로 돌아 올라온다.
import { COLORS as C, compose, connectionTable, mfWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
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

const T = {
  plus: "신호등 배선도(ESP32 Plus 확장 보드): 보드 위쪽 io13 → 브레드보드 6번 줄 → 220Ω 저항 → 3번 줄 빨강 LED 긴 다리(+), io14 → 13번 줄 → 220Ω → 10번 줄 노랑 LED, io16 → 21번 줄 → 220Ω → 18번 줄 초록 LED. LED 짧은 다리(−)는 2 · 9 · 17번 줄에서 점퍼선으로 − 줄, − 줄은 보드 GND",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 신호등 배선도: D13 → 브레드보드 6번 줄 → 220Ω 저항 → 3번 줄 빨강 LED 긴 다리(+), D14 → 13번 줄 → 220Ω → 10번 줄 노랑 LED, 아래 줄 RX2(16) → 보드 바깥으로 돌아 21번 줄 → 220Ω → 18번 줄 초록 LED. LED 짧은 다리(−)는 2 · 9 · 17번 줄에서 점퍼선으로 − 줄, − 줄은 보드 GND",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = draw("plus"); return svgDoc("wt", T.plus, r.body, r.height); },
    devkit: () => { const r = draw("devkit"); return svgDoc("wtk", T.devkit, r.body, r.height); },
  },
};
