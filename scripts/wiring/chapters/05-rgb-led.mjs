// 센서 S5 "RGB LED" — 공통 음극 RGB LED: 빨강 27번 · 초록 25번 · 파랑 26번(각 220Ω), 가장 긴 다리는 GND.
// 다리를 d 칸에 한 칸씩 띄워 꽂고(R · − · G · B), 빨강·초록·파랑 줄마다 220Ω 저항이 가운데 홈을 건넌다.
// − 다리는 위 − 줄로, 보드 GND 는 브레드보드 바깥 왼쪽으로 돌아 위 − 줄에. 세 보드 모두 브레드보드를 보드 위에.
// 확장 보드: P27 · P25 · P26 · GND 가 모두 위 줄(바깥 S 핀). 맨 부품뿐이라 점퍼 3.3V.
import { COLORS as C, compose, connectionTable, mfWire, mmWire, svgDoc, wire } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { breadboard, resistor, rgbSpread } from "../parts.mjs";
import { route } from "./01-led.mjs";

const LEGS = [
  { key: "R", gpio: 27, wire: C.orange, name: "빨강(R)" },
  { key: "G", gpio: 25, wire: C.green, name: "초록(G)" },
  { key: "B", gpio: 26, wire: C.blue, name: "파랑(B)" },
];

/** c: 빨강 다리 열. 다리는 c · c+2 · c+4 · c+6 (R · − · G · B) */
function draw(kind) {
  const isPlus = kind === "plus", isX = kind === "expansion";
  const c = isPlus ? 15 : isX ? 17 : 9; // 확장 보드: 다리 줄이 열 번호(5 · 10 · 15 · 20)를 가리지 않게
  const bb = breadboard({ x: isPlus ? 84 : isX ? 100 : 98, y: 8, cols: 26, rails: { top: true, bottom: false } });
  const gap = isX ? 44 : 40;
  const b = isPlus ? makePlus({ x: 56, y: bb.y + bb.h + gap }) : isX ? makeExpansion({ x: 22, y: bb.y + bb.h + gap, jumper: "3V3" }) : makeDevkit({ x: 110, y: bb.y + bb.h + gap });
  const laneLow = bb.y + bb.h + gap - 12, laneHigh = bb.y + bb.h + 12;
  const col = { R: c, minus: c + 2, G: c + 4, B: c + 6 };
  const parts = [bb.svg], wires = [], used = [], rows = [];
  for (const k of ["R", "minus", "G", "B"]) bb.tint(col[k], "top");
  for (const k of ["R", "G", "B"]) {
    bb.tint(col[k], "bottom");
    parts.push(resistor(bb.hole(col[k], "e"), bb.hole(col[k], "g"), { label: k === "B" ? "220Ω" : undefined }).svg);
  }
  parts.push(rgbSpread([bb.hole(col.R, "d"), bb.hole(col.minus, "d"), bb.hole(col.G, "d"), bb.hole(col.B, "d")]));
  // − 다리 → 위 − 줄
  wires.push(mmWire(bb.hole(col.minus, "a"), bb.rail("top", "-", bb.nearestCol(bb.hole(col.minus, "a").x, true)), C.black));
  LEGS.forEach((l) => {
    const p = b.gpio(l.gpio), h = bb.hole(col[l.key], "j");
    used.push(p);
    if (isPlus) wires.push(mfWire(p, h, l.wire));
    else {
      // DevKit: D27 · D26 · D25 순서라 파랑(D26)이 초록(D25) 선을 한 번 건넌다
      const lane = l.key === "G" ? laneLow : l.key === "B" ? laneHigh : (laneLow + laneHigh) / 2;
      wires.push(mfWire(p, h, l.wire, route(p, h, lane), "orth"));
    }
    rows.push({ color: l.wire, part: `${p.label} ${isX ? "칸 S 핀" : "핀"}`, to: `${col[l.key]}번 줄 → 220Ω 저항(홈 건너) → ${l.name} 다리` });
  });
  // 보드 GND → 브레드보드 왼쪽 바깥 → 위 − 줄 1번 칸
  const gnd = b.power("GND"), gRail = bb.rail("top", "-", 1), outX = bb.x - 12;
  wires.push(wire(gnd, gRail, C.black, { via: [{ x: gnd.x, y: (laneLow + laneHigh) / 2 }, { x: outX, y: (laneLow + laneHigh) / 2 }, { x: outX, y: gRail.y }], style: "orth", ends: ["f", "m"] }));
  used.push(gnd);
  rows.push({ color: C.black, part: `− 다리(가장 긴 다리) ${col.minus}번 줄`, to: isX ? "위 − 줄 → 위 줄 GND 칸 S 핀" : "위 − 줄 → GND" });
  const table = connectionTable(b.bounds.y + b.bounds.h + (isX ? 12 : 16), "이렇게 꽂아요 — 다리를 한 칸씩 띄워 d 칸에", rows, b.legend);
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "RGB LED 배선도(ESP32 Plus 확장 보드): RGB LED 다리를 브레드보드 d 칸 15 · 17 · 19 · 21번 줄에(빨강 · − · 초록 · 파랑). 15 · 19 · 21번 줄마다 220Ω 저항이 가운데 홈을 건너고, 보드 위쪽 io27 → 15번 줄, io25 → 19번 줄, io26 → 21번 줄. 가장 긴 − 다리(17번 줄)는 점퍼선으로 위 − 줄, 위 − 줄은 브레드보드 바깥으로 돌아 보드 GND",
  expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) RGB LED 배선도: RGB LED 다리를 브레드보드 d 칸 17 · 19 · 21 · 23번 줄에(빨강 · − · 초록 · 파랑). 17 · 21 · 23번 줄마다 220Ω 저항이 가운데 홈을 건너고, 위 줄 P27 칸 S 핀 → 17번 줄, P25 칸 S 핀 → 21번 줄, P26 칸 S 핀 → 23번 줄. 가장 긴 − 다리(19번 줄)는 점퍼선으로 위 − 줄, 위 − 줄은 브레드보드 바깥으로 돌아 위 줄 GND 칸 S 핀. JUMP 점퍼는 3.3V 쪽",
  devkit: "기본 보드(ESP32 DevKit 38핀) RGB LED 배선도: RGB LED 다리를 브레드보드 d 칸 9 · 11 · 13 · 15번 줄에(빨강 · − · 초록 · 파랑). 9 · 13 · 15번 줄마다 220Ω 저항이 가운데 홈을 건너고, D27 → 9번 줄, D25 → 13번 줄, D26 → 15번 줄. 가장 긴 − 다리(11번 줄)는 점퍼선으로 위 − 줄, 위 − 줄은 브레드보드 바깥으로 돌아 보드 GND",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = draw("plus"); return svgDoc("wr", T.plus, r.body, r.height); },
    devkit: () => { const r = draw("devkit"); return svgDoc("wrk", T.devkit, r.body, r.height); },
    expansion: () => { const r = draw("expansion"); return svgDoc("wrx", T.expansion, r.body, r.height); },
  },
};
