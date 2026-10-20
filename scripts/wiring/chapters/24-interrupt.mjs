// 센서 "인터럽트" — 풀업 버튼(14번) + LED(2번, 220Ω). 버튼 · LED 자리는 S8(11장)과 같은 꼴, LED 핀만 2번.
// 2번 핀은 Plus 에서는 ANALOG 묶음 맨 아래 줄 S, 기본 보드에서는 아래 줄 D2 라서 선이 보드 안 빈 길(또는 보드 바깥)로 돌아온다.
import { COLORS as C, compose, connectionTable, mfWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard } from "../parts.mjs";
import { buttonPullup, ledLeft, ledRight, railCol, railLink } from "./11-button-touch.mjs";

/** Plus: io2(ANALOG S) 에서 보드 안 빈 길로 — 아래로 나가 오른쪽 빈 세로 길, 가운데 가로 빈 띠, 위 핀 두 묶음 사이 틈으로 올라간다 */
function plusIo2Route(b, hole) {
  const { x, y } = b.bounds;
  const p = b.gpio(2);
  const gapX = x + 233, laneY = b.lane.top + 7, colX = x + 122, lowY = y + 293;
  return mfWire(p, hole, C.yellow, [{ x: p.x, y: lowY }, { x: colX, y: lowY }, { x: colX, y: laneY }, { x: gapX, y: laneY }, { x: gapX, y: hole.y + 30 }, { x: hole.x, y: hole.y + 30 }], "orth");
}

function plus() {
  const bb = breadboard({ x: 72, y: 8, cols: 26, rails: { top: true, bottom: true } });
  const b = makePlus({ x: 60, y: bb.y + bb.h + 24 });
  const btn = buttonPullup(bb, 15), lc = ledLeft(bb, 13);
  const s14 = b.gpio(14), s2 = b.gpio(2), gnd = b.power("GND");
  const wires = [
    mfWire(s14, btn.signalHole, C.green), plusIo2Route(b, lc.signalHole),
    mfWire(gnd, bb.rail("bottom", "-", railCol(bb.nearestCol(gnd.x, true))), C.black),
    btn.jumper, lc.jumper, railLink(bb),
  ];
  const rows = [
    { color: C.green, part: `${s14.label} 핀`, to: `${btn.cols.sig}번 줄 (버튼 한쪽 다리)` },
    { color: C.black, part: `버튼 대각선 다리 ${btn.cols.gnd}번 줄`, to: "위 − 줄" },
    { color: C.yellow, part: `${s2.label}`, to: `${lc.cols.sig}번 줄 → 220Ω 저항 → ${lc.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${lc.cols.cathode}번 줄`, to: "아래 − 줄" },
    { color: C.black, part: "GND 핀", to: "아래 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — 버튼 · LED 는 브레드보드에", rows, b.legend);
  return { body: compose(b.draw([s14, s2, gnd]), [bb.svg, ...btn.svg, ...lc.svg], wires, [table.svg]), height: table.bottom };
}

function devkit() {
  const bb = breadboard({ x: 72, y: 8, cols: 26, rails: { top: true, bottom: true } });
  const b = makeDevkit({ x: 95, y: bb.y + bb.h + 24 });
  const btn = buttonPullup(bb, 7), lc = ledRight(bb, 11);
  const s14 = b.gpio(14), s2 = b.gpio(2), gnd = b.power("GND", 0);
  const { x, y, w, h } = b.bounds;
  // D2(아래 줄) → 보드 아래로 나가 보드 오른쪽 바깥으로 돌아 브레드보드로 (다른 선과 겹치지 않게)
  const outX = x + w + 18, gapY = y - 12;
  const wires = [
    mfWire(s14, btn.signalHole, C.green),
    mfWire(s2, lc.signalHole, C.yellow, [{ x: s2.x, y: y + h + 14 }, { x: outX, y: y + h + 14 }, { x: outX, y: gapY }, { x: lc.signalHole.x, y: gapY }], "orth"),
    mfWire(gnd, bb.rail("bottom", "-", railCol(bb.nearestCol(gnd.x, true))), C.black),
    btn.jumper, lc.jumper, railLink(bb),
  ];
  const rows = [
    { color: C.green, part: `${s14.label} 핀`, to: `${btn.cols.sig}번 줄 (버튼 한쪽 다리)` },
    { color: C.black, part: `버튼 대각선 다리 ${btn.cols.gnd}번 줄`, to: "위 − 줄" },
    { color: C.yellow, part: `${s2.label} 핀`, to: `${lc.cols.sig}번 줄 → 220Ω 저항 → ${lc.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${lc.cols.cathode}번 줄`, to: "아래 − 줄" },
    { color: C.black, part: "GND 핀", to: "아래 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" },
  ];
  const table = connectionTable(y + h + 36, "이렇게 꽂아요 — 버튼 · LED 는 브레드보드에", rows, b.legend);
  return { body: compose(b.draw([s14, s2, gnd]), [bb.svg, ...btn.svg, ...lc.svg], wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "인터럽트 배선도(ESP32 Plus 확장 보드): 버튼은 브레드보드 가운데 홈에 걸쳐 15 · 17번 줄에 꽂고, 보드 위쪽 io14 핀 → 15번 줄(버튼 한쪽 다리), 대각선 반대쪽 17번 줄 → 위 − 줄. LED 는 ANALOG 묶음 맨 아래 io2 의 S 핀 → 13번 줄 → 220Ω 저항 → 8번 줄의 긴 다리(+), 짧은 다리(−) 7번 줄 → 아래 − 줄. 보드 GND → 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 인터럽트 배선도: 버튼은 브레드보드 가운데 홈에 걸쳐 7 · 9번 줄에 꽂고, D14 핀 → 7번 줄(버튼 한쪽 다리), 대각선 반대쪽 9번 줄 → 위 − 줄. LED 는 아래 줄 D2 핀 → 보드 바깥으로 돌아 11번 줄 → 220Ω 저항 → 15번 줄의 긴 다리(+), 짧은 다리(−) 16번 줄 → 아래 − 줄. 보드 위 줄 GND → 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wbi", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wbik", T.devkit, r.body, r.height); },
  },
};
