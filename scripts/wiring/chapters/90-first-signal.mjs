// 체험 T1 "내 손으로 만드는 신호등" — 한 브레드보드가 세 단계로 자란다.
//   1단계 wiring-one-led.svg  : 빨강 LED 하나(13번)
//   2단계 wiring-traffic.svg  : + 노랑(14번) · 초록(16번) = 신호등 (3장과 같은 LED 자리)
//   3단계 wiring-crosswalk.svg: + 보행자 버튼(25번, 풀업 — 대각선 다리는 위 − 줄)
// 두 보드 모두 브레드보드를 보드 위에 두고, 25번은 두 보드 모두 13 · 14 · 16 보다 오른쪽이라 선이 엇갈리지 않는다.
import { COLORS as C, compose, connectionTable, mfWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard } from "../parts.mjs";
import { ledCircuit, route } from "./01-led.mjs";
import { buttonPullup, railLink } from "./11-button-touch.mjs";

const LEDS = [
  { gpio: 13, wire: C.purple, led: "#e03131", name: "빨강" },
  { gpio: 14, wire: C.yellow, led: "#fab005", name: "노랑" },
  { gpio: 16, wire: C.green, led: "#2f9e44", name: "초록" },
];
const KS = [6, 13, 21]; // 3장과 같은 신호 열
const BUTTON_COL = 25; // 버튼 다리 25 · 27번 줄
const BUTTON_GPIO = 25;

function draw(kind, stage) {
  const isPlus = kind === "plus";
  const withButton = stage === 3;
  const leds = stage === 1 ? LEDS.slice(0, 1) : LEDS;
  const bb = breadboard({ x: isPlus ? 96 : 80, y: 8, cols: 30, rails: { top: withButton, bottom: true } });
  const gap = 40;
  const b = isPlus ? makePlus({ x: 56, y: bb.y + bb.h + gap }) : makeDevkit({ x: 110, y: bb.y + bb.h + gap });
  const laneAbove = bb.y + bb.h + gap / 2;
  const parts = [bb.svg], wires = [], used = [], rows = [];

  const circs = leds.map((l, i) => ledCircuit(bb, KS[i], { span: 3, color: l.led }));
  circs.forEach((c) => parts.push(...c.svg));
  leds.forEach((l, i) => {
    const p = b.gpio(l.gpio), h = circs[i].signalHole;
    used.push(p);
    if (p.side === "bot") {
      // DevKit 의 16번(RX2)은 아래 줄: 보드 아래로 나와 오른쪽 바깥 길로 올라온다
      const below = b.bounds.y + b.bounds.h + 14, outX = b.bounds.x + b.bounds.w + 18;
      wires.push(mfWire(p, h, l.wire, [{ x: p.x, y: below }, { x: outX, y: below }, { x: outX, y: laneAbove }, { x: h.x, y: laneAbove }], "orth"));
    } else {
      wires.push(mfWire(p, h, l.wire, route(p, h, laneAbove), "orth"));
    }
    const c = circs[i].cols;
    rows.push({ color: l.wire, part: `${p.label} 핀`, to: `${c.sig}번 줄 → 220Ω 저항 → ${c.anode}번 줄 ${l.name} LED 긴 다리(+)` });
  });

  if (withButton) {
    const btn = buttonPullup(bb, BUTTON_COL);
    parts.push(...btn.svg);
    const p = b.gpio(BUTTON_GPIO);
    used.push(p);
    wires.push(mfWire(p, btn.signalHole, C.blue, route(p, btn.signalHole, laneAbove + 8), "orth"), btn.jumper, railLink(bb));
    rows.push({ color: C.blue, part: `${p.label} 핀`, to: `${btn.cols.sig}번 줄 (보행자 버튼 한쪽 다리)` });
    rows.push({ color: C.black, part: `버튼 대각선 다리 ${btn.cols.gnd}번 줄`, to: "위 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" });
  }

  const gnd = b.power("GND");
  const gRail = bb.rail("bottom", "-", 4);
  wires.push(mfWire(gnd, gRail, C.black, route(gnd, gRail, laneAbove), "orth"));
  used.push(gnd);
  circs.forEach((c) => wires.push(c.jumper));
  rows.push({ color: C.black, part: `LED 짧은 다리(−) ${circs.map((c) => c.cols.cathode).join(" · ")}번 줄`, to: "아래 − 줄 → GND" });

  const tableY = b.bounds.y + b.bounds.h + (isPlus ? 16 : 34);
  const heading = ["", "1단계 — LED 하나를 저항과 함께", "2단계 — LED 세 개, 저항도 하나씩", "3단계 — 신호등 + 보행자 버튼"][stage];
  const table = connectionTable(tableY, `이렇게 꽂아요 · ${heading}`, rows, b.legend);
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  1: {
    plus: "1단계 배선도(ESP32 Plus 확장 보드): 보드 위쪽 io13 → 브레드보드 6번 줄 → 220Ω 저항 → 3번 줄 빨강 LED 긴 다리(+). 짧은 다리(−) 2번 줄 → 점퍼선 → − 줄 → 보드 GND",
    devkit: "1단계 배선도(기본 보드 DevKit 38핀): D13 → 브레드보드 6번 줄 → 220Ω 저항 → 3번 줄 빨강 LED 긴 다리(+). 짧은 다리(−) 2번 줄 → 점퍼선 → − 줄 → 보드 GND",
  },
  2: {
    plus: "2단계 신호등 배선도(ESP32 Plus 확장 보드): io13 → 6번 줄 → 220Ω → 3번 줄 빨강 LED, io14 → 13번 줄 → 220Ω → 10번 줄 노랑 LED, io16 → 21번 줄 → 220Ω → 18번 줄 초록 LED. 짧은 다리(−)는 2 · 9 · 17번 줄에서 점퍼선으로 − 줄, − 줄은 보드 GND",
    devkit: "2단계 신호등 배선도(기본 보드 DevKit 38핀): D13 → 6번 줄 → 220Ω → 3번 줄 빨강 LED, D14 → 13번 줄 → 220Ω → 10번 줄 노랑 LED, 아래 줄 RX2(16) → 보드 바깥으로 돌아 21번 줄 → 220Ω → 18번 줄 초록 LED. 짧은 다리(−)는 2 · 9 · 17번 줄에서 점퍼선으로 − 줄, − 줄은 보드 GND",
  },
  3: {
    plus: "3단계 보행자 신호등 배선도(ESP32 Plus 확장 보드): 2단계 신호등에 버튼을 더해요. 버튼은 가운데 홈에 걸쳐 25 · 27번 줄, io25 → 25번 줄(버튼 한쪽 다리), 대각선 반대쪽 27번 줄 → 위 − 줄, 위 − 줄과 아래 − 줄은 점퍼선으로 이어요",
    devkit: "3단계 보행자 신호등 배선도(기본 보드 DevKit 38핀): 2단계 신호등에 버튼을 더해요. 버튼은 가운데 홈에 걸쳐 25 · 27번 줄, D25 → 25번 줄(버튼 한쪽 다리), 대각선 반대쪽 27번 줄 → 위 − 줄, 위 − 줄과 아래 − 줄은 점퍼선으로 이어요",
  },
};

const pair = (stage, id) => ({
  plus: () => { const r = draw("plus", stage); return svgDoc(id, T[stage].plus, r.body, r.height); },
  devkit: () => { const r = draw("devkit", stage); return svgDoc(`${id}k`, T[stage].devkit, r.body, r.height); },
});

export default {
  "wiring-one-led.svg": pair(1, "fs1"),
  "wiring-traffic.svg": pair(2, "fs2"),
  "wiring-crosswalk.svg": pair(3, "fs3"),
};
