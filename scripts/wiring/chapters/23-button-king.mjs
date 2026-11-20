// 센서 "버튼 왕" — 풀업 버튼(14번) + RGB LED(공통 음극, 빨강 27 · 초록 25 · 파랑 26, 220Ω 셋).
// RGB LED 다리(빨강 · − · 초록 · 파랑)는 위 칸, 저항 셋이 가운데 홈을 건너 아래 칸으로, 신호선은 아래 칸 j 줄에.
// 가장 긴 다리(−)와 버튼 대각선 다리는 위 − 줄, 보드 GND 는 아래 − 줄, 두 − 줄은 점퍼로 잇는다. 두 보드 모두 브레드보드를 보드 위에.
import { COLORS as C, compose, connectionTable, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
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

/** 확장 보드면 표의 핀 이름을 칸 이름으로 (위 줄 P14 칸 S 핀 · 위 줄 GND 칸 S 핀) */
function draw(b, bb, btnCol, r) {
  const ex = b.id === "expansion";
  const btn = buttonPullup(bb, btnCol), rgb = rgbCircuit(bb, r);
  const s14 = b.gpio(14), sR = b.gpio(27), sG = b.gpio(25), sB = b.gpio(26), gnd = b.power("GND");
  const pin = (p) => (ex ? `${p.label} 칸 S 핀` : `${p.label} 핀`);
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
    { color: C.black, part: ex ? "위 줄 GND 칸 S 핀" : "GND 핀", to: "아래 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + (ex ? 12 : 16), "이렇게 꽂아요 — 저항 셋은 가운데 홈을 건너", rows, b.legend);
  return { body: compose(b.draw([s14, sR, sG, sB, gnd]), [bb.svg, ...btn.svg, ...rgb.svg], wires, [table.svg]), height: table.bottom, btn: btn.cols, rgb: rgb.cols };
}

const T = {
  plus: "버튼 왕 배선도(ESP32 Plus 확장 보드): RGB LED 다리를 브레드보드 위 칸 15 · 17 · 19 · 21번 줄에(빨강 · 가장 긴 다리 − · 초록 · 파랑), 220Ω 저항 셋이 15 · 19 · 21번 줄에서 가운데 홈을 건너고, 보드 위쪽 io27 → 15번 줄, io25 → 19번 줄, io26 → 21번 줄. 가장 긴 다리 줄(17번) → 위 − 줄. 버튼은 가운데 홈에 걸쳐 11 · 13번 줄에 꽂고 io14 → 11번 줄, 대각선 반대쪽 13번 줄 → 위 − 줄. 보드 GND → 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요",
  devkit: "기본 보드(ESP32 DevKit 38핀) 버튼 왕 배선도: RGB LED 다리를 브레드보드 위 칸 9 · 11 · 13 · 15번 줄에(빨강 · 가장 긴 다리 − · 초록 · 파랑), 220Ω 저항 셋이 9 · 13 · 15번 줄에서 가운데 홈을 건너고, D27 → 9번 줄, D25 → 13번 줄, D26 → 15번 줄. 가장 긴 다리 줄(11번) → 위 − 줄. 버튼은 가운데 홈에 걸쳐 5 · 7번 줄에 꽂고 D14 → 5번 줄, 대각선 반대쪽 7번 줄 → 위 − 줄. 보드 GND → 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요",
};

/** 확장 보드: 위 줄 칸(P14 · P27 · P26 · P25 · GND)만 쓰니 브레드보드는 보드 위. 맨 부품뿐이라 점퍼는 평소 자리(3.3V) */
const expansionTitle = ({ btn, rgb }) =>
  `확장 보드(ESP32 38핀 확장 보드 + DevKit) 버튼 왕 배선도: RGB LED 다리를 브레드보드 위 칸 ${rgb.R} · ${rgb.K} · ${rgb.G} · ${rgb.B}번 줄에(빨강 · 가장 긴 다리 − · 초록 · 파랑), 220Ω 저항 셋이 ${rgb.R} · ${rgb.G} · ${rgb.B}번 줄에서 가운데 홈을 건너고, 위 줄 P27 칸 S 핀 → ${rgb.R}번 줄, P25 칸 S 핀 → ${rgb.G}번 줄, P26 칸 S 핀 → ${rgb.B}번 줄. 가장 긴 다리 줄(${rgb.K}번) → 위 − 줄. 버튼은 가운데 홈에 걸쳐 ${btn.sig} · ${btn.gnd}번 줄에 꽂고 P14 칸 S 핀 → ${btn.sig}번 줄, 대각선 반대쪽 ${btn.gnd}번 줄 → 위 − 줄. 위 줄 GND 칸 S 핀 → 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요. JUMP 점퍼는 3.3V 쪽`;

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
    expansion: () => {
      const bb = breadboard({ x: 40, y: 8, cols: 28, rails: { top: true, bottom: true } });
      const r = draw(makeExpansion({ x: 22, y: bb.y + bb.h + 30, jumper: "3V3" }), bb, 19, 22);
      return svgDoc("wbkx", expansionTitle(r), r.body, r.height);
    },
  },
};
