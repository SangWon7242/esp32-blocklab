// 센서 "버튼 왕" — 풀업 버튼(14번) + RGB LED(공통 음극, 빨강 27 · 초록 25 · 파랑 26, 220Ω 셋).
// RGB LED 다리(빨강 · − · 초록 · 파랑)는 위 칸, 저항 셋이 가운데 홈을 건너 아래 칸으로, 신호선은 아래 칸 j 줄에.
// 가장 긴 다리(−)와 버튼 대각선 다리는 위 − 줄, 보드 GND 는 아래 − 줄, 두 − 줄은 점퍼로 잇는다. 두 보드 모두 브레드보드를 보드 위에.
import { COLORS as C, compose, connectionTable, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, resistor, rgbLed } from "../parts.mjs";
import { buttonPullup, railCol, railLink } from "./11-button-touch.mjs";

/** RGB LED: 다리 (r,d) (r+2,d) (r+4,d) (r+6,d) = 빨강 · − · 초록 · 파랑. 빨강·초록·파랑 줄은 저항 (x,e)~(x,h) 로 홈을 건너 (x, j) 에서 신호를 받는다 */
function rgbCircuit(bb, r) {
  const cols = { R: r, K: r + 2, G: r + 4, B: r + 6 };
  const svg = [];
  for (const c of [cols.R, cols.G, cols.B]) {
    bb.tint(c, "top");
    bb.tint(c, "bottom");
    svg.push(resistor(bb.hole(c, "e"), bb.hole(c, "h")).svg);
  }
  bb.tint(cols.K, "top");
  svg.push(rgbLed([cols.R, cols.K, cols.G, cols.B].map((c) => bb.hole(c, "d")), { lift: 30 }).svg);
  const jumper = mmWire(bb.hole(cols.K, "a"), bb.rail("top", "-", railCol(cols.K) === cols.K ? cols.K : cols.K - 1), C.black);
  return { svg, jumper, cols, sig: (c) => bb.hole(c, "j") };
}

function draw(b, bb, btnCol, r) {
  const btn = buttonPullup(bb, btnCol), rgb = rgbCircuit(bb, r);
  const s14 = b.gpio(14), sR = b.gpio(27), sG = b.gpio(25), sB = b.gpio(26), gnd = b.power("GND");
  const pin = (p) => `${p.label} 핀`;
  const wires = [
    mfWire(s14, btn.signalHole, C.purple),
    mfWire(sR, rgb.sig(rgb.cols.R), C.orange), mfWire(sG, rgb.sig(rgb.cols.G), C.green), mfWire(sB, rgb.sig(rgb.cols.B), C.blue),
    mfWire(gnd, bb.rail("bottom", "-", railCol(bb.nearestCol(gnd.x, true))), C.black),
    btn.jumper, rgb.jumper, railLink(bb),
  ];
  const rows = [
    { color: C.orange, part: pin(sR), to: `${rgb.cols.R}번 줄 → 220Ω → RGB 빨강 다리` },
    { color: C.green, part: pin(sG), to: `${rgb.cols.G}번 줄 → 220Ω → RGB 초록 다리` },
    { color: C.blue, part: pin(sB), to: `${rgb.cols.B}번 줄 → 220Ω → RGB 파랑 다리` },
    { color: C.black, part: `RGB 가장 긴 다리(−) ${rgb.cols.K}번 줄`, to: "위 − 줄" },
    { color: C.purple, part: pin(s14), to: `${btn.cols.sig}번 줄 (버튼 한쪽 다리)` },
    { color: C.black, part: `버튼 대각선 다리 ${btn.cols.gnd}번 줄`, to: "위 − 줄" },
    { color: C.black, part: "GND 핀", to: "아래 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — 저항 셋은 가운데 홈을 건너", rows, b.legend);
  return { body: compose(b.draw([s14, sR, sG, sB, gnd]), [bb.svg, ...btn.svg, ...rgb.svg], wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "버튼 왕 배선도(ESP32 Plus 확장 보드): RGB LED 다리를 브레드보드 위 칸 15 · 17 · 19 · 21번 줄에(빨강 · 가장 긴 다리 − · 초록 · 파랑), 220Ω 저항 셋이 15 · 19 · 21번 줄에서 가운데 홈을 건너고, 보드 위쪽 io27 → 15번 줄, io25 → 19번 줄, io26 → 21번 줄. 가장 긴 다리 줄(17번) → 위 − 줄. 버튼은 가운데 홈에 걸쳐 11 · 13번 줄에 꽂고 io14 → 11번 줄, 대각선 반대쪽 13번 줄 → 위 − 줄. 보드 GND → 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 버튼 왕 배선도: RGB LED 다리를 브레드보드 위 칸 9 · 11 · 13 · 15번 줄에(빨강 · 가장 긴 다리 − · 초록 · 파랑), 220Ω 저항 셋이 9 · 13 · 15번 줄에서 가운데 홈을 건너고, D27 → 9번 줄, D25 → 13번 줄, D26 → 15번 줄. 가장 긴 다리 줄(11번) → 위 − 줄. 버튼은 가운데 홈에 걸쳐 5 · 7번 줄에 꽂고 D14 → 5번 줄, 대각선 반대쪽 7번 줄 → 위 − 줄. 보드 GND → 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요",
};

const BB = () => breadboard({ x: 72, y: 8, cols: 26, rails: { top: true, bottom: true } });

export default {
  "wiring-breadboard.svg": {
    plus: () => {
      const bb = BB();
      const r = draw(makePlus({ x: 60, y: bb.y + bb.h + 24 }), bb, 11, 15);
      return svgDoc("wbk", T.plus, r.body, r.height);
    },
    devkit: () => {
      const bb = BB();
      const r = draw(makeDevkit({ x: 95, y: bb.y + bb.h + 24 }), bb, 5, 9);
      return svgDoc("wbkk", T.devkit, r.body, r.height);
    },
  },
};
