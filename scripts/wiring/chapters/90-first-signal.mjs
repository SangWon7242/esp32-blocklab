// 체험 T1 "내 손으로 만드는 신호등" — 한 브레드보드가 세 단계로 자란다.
//   1단계 wiring-one-led.svg  : 빨강 LED 하나(13번)
//   2단계 wiring-traffic.svg  : + 노랑(14번) · 초록(16번) = 신호등 (3장과 같은 LED 자리)
//   3단계 wiring-crosswalk.svg: + 보행자 버튼(25번, 풀업 — 대각선 다리는 위 − 줄)
// 두 보드 모두 브레드보드를 보드 위에 두고, 25번은 두 보드 모두 13 · 14 · 16 보다 오른쪽이라 선이 엇갈리지 않는다.
// 확장 보드(점퍼 3.3V — LED 와 버튼뿐): 16번(P16)이 아래 줄이라 보드 아래로 나와 오른쪽 바깥 길로 올라온다.
//   그래서 초록 LED 를 맨 오른쪽(24번 줄)에, 버튼은 노랑과 초록 사이(14 · 16번 줄)에 둔다 — 선이 엇갈리지 않게.
//   신호 열은 6 · 12 · 24(+ − 줄에 구멍이 없는 열)와 14. 보드는 x 18 (오른쪽 바깥 길이 그림 폭 안에 들게).
import { COLORS as C, compose, connectionTable, mfWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
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

/* ───── 확장 보드(38핀 확장 보드 + DevKit), 점퍼 3.3V ───── */
const XKS = [6, 12, 24]; // 빨강 · 노랑 · 초록 신호 열
const XBUTTON = 14;
function drawExpansion(stage) {
  const withButton = stage === 3;
  const leds = stage === 1 ? LEDS.slice(0, 1) : LEDS;
  const bb = breadboard({ x: 72, y: 8, cols: 28, rails: { top: withButton, bottom: true } });
  const b = makeExpansion({ x: 18, y: bb.y + bb.h + 60, jumper: "3V3" });
  const top = b.bounds.y, bot = top + b.bounds.h - 24;
  const lane = (k) => top - 12 - k * 9; // 왼쪽으로 가는 선: 오른쪽 것일수록 브레드보드에 가까운 길
  const parts = [bb.svg], wires = [], used = [], rows = [];

  const circs = leds.map((l, i) => ledCircuit(bb, XKS[i], { span: 3, color: l.led }));
  circs.forEach((c) => parts.push(...c.svg));
  const go = (p, h, color, k) => mfWire(p, h, color, route(p, h, lane(k)), "orth");
  leds.forEach((l, i) => {
    const p = b.gpio(l.gpio), h = circs[i].signalHole;
    used.push(p);
    if (l.gpio === 16) {
      // 아래 줄 P16: 보드 아래로 나와 오른쪽 바깥 길로 올라와 24번 줄
      const outX = 636, below = bot + 10;
      wires.push(mfWire(p, h, l.wire, [{ x: p.x, y: below }, { x: outX, y: below }, { x: outX, y: lane(1) }, { x: h.x, y: lane(1) }], "orth"));
    } else {
      wires.push(go(p, h, l.wire, l.gpio === 13 ? 0 : 2));
    }
    const c = circs[i].cols;
    rows.push({ color: l.wire, part: `${l.gpio === 16 ? "아래 줄 " : ""}${p.label} 칸 S`, to: `${c.sig}번 줄 → 220Ω 저항 → ${c.anode}번 줄 ${l.name} LED 긴 다리(+)` });
  });

  if (withButton) {
    const btn = buttonPullup(bb, XBUTTON);
    parts.push(...btn.svg);
    const p = b.gpio(BUTTON_GPIO);
    used.push(p);
    wires.push(go(p, btn.signalHole, C.blue, 3), btn.jumper, railLink(bb));
    rows.push({ color: C.blue, part: `${p.label} 칸 S`, to: `${btn.cols.sig}번 줄 (보행자 버튼 한쪽 다리)` });
    rows.push({ color: C.black, part: `버튼 대각선 다리 ${btn.cols.gnd}번 줄`, to: "위 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" });
  }

  // GND: 위 줄 GND 칸 S → 아래 − 줄 10번 칸 (9 · 10번 열 사이로 올라가 + 줄 구멍을 피한다)
  const gnd = b.power("GND");
  const gRail = bb.rail("bottom", "-", 10), gapX = (bb.hole(9, "a").x + gRail.x) / 2;
  wires.push(mfWire(gnd, gRail, C.black, [{ x: gnd.x, y: lane(1) }, { x: gapX, y: lane(1) }, { x: gapX, y: gRail.y + 8 }, { x: gRail.x, y: gRail.y + 8 }], "orth"));
  used.push(gnd);
  circs.forEach((c) => wires.push(c.jumper));
  rows.push({ color: C.black, part: `LED 짧은 다리(−) ${circs.map((c) => c.cols.cathode).join(" · ")}번 줄`, to: "아래 − 줄 → 위 줄 GND 칸 S" });

  const heading = ["", "1단계 — LED 하나를 저항과 함께", "2단계 — LED 세 개, 저항도 하나씩", "3단계 — 신호등 + 보행자 버튼"][stage];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, `이렇게 꽂아요 · ${heading}`, rows, b.legend);
  return { body: compose(b.draw(used, { note: "left" }), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  1: {
    plus: "1단계 배선도(ESP32 Plus 확장 보드): 보드 위쪽 io13 → 브레드보드 6번 줄 → 220Ω 저항 → 3번 줄 빨강 LED 긴 다리(+). 짧은 다리(−) 2번 줄 → 점퍼선 → − 줄 → 보드 GND",
    devkit: "1단계 배선도(기본 보드 DevKit 38핀): D13 → 브레드보드 6번 줄 → 220Ω 저항 → 3번 줄 빨강 LED 긴 다리(+). 짧은 다리(−) 2번 줄 → 점퍼선 → − 줄 → 보드 GND",
    expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) 1단계 배선도: JUMP 점퍼는 평소 자리(3.3V 쪽). 위 줄 P13 칸 S 핀 → 브레드보드 6번 줄 → 220Ω 저항 → 3번 줄 빨강 LED 긴 다리(+). 짧은 다리(−) 2번 줄 → 점퍼선 → − 줄 → 위 줄 GND 칸 S 핀",
  },
  2: {
    plus: "2단계 신호등 배선도(ESP32 Plus 확장 보드): io13 → 6번 줄 → 220Ω → 3번 줄 빨강 LED, io14 → 13번 줄 → 220Ω → 10번 줄 노랑 LED, io16 → 21번 줄 → 220Ω → 18번 줄 초록 LED. 짧은 다리(−)는 2 · 9 · 17번 줄에서 점퍼선으로 − 줄, − 줄은 보드 GND",
    devkit: "2단계 신호등 배선도(기본 보드 DevKit 38핀): D13 → 6번 줄 → 220Ω → 3번 줄 빨강 LED, D14 → 13번 줄 → 220Ω → 10번 줄 노랑 LED, 아래 줄 RX2(16) → 보드 바깥으로 돌아 21번 줄 → 220Ω → 18번 줄 초록 LED. 짧은 다리(−)는 2 · 9 · 17번 줄에서 점퍼선으로 − 줄, − 줄은 보드 GND",
    expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) 2단계 신호등 배선도: JUMP 점퍼는 평소 자리(3.3V 쪽). P13 칸 S 핀 → 6번 줄 → 220Ω → 3번 줄 빨강 LED, P14 칸 S 핀 → 12번 줄 → 220Ω → 9번 줄 노랑 LED, 아래 줄 P16 칸 S 핀 → 보드 아래로 나와 오른쪽 바깥으로 돌아 24번 줄 → 220Ω → 21번 줄 초록 LED. 짧은 다리(−)는 2 · 8 · 20번 줄에서 점퍼선으로 − 줄, − 줄은 위 줄 GND 칸 S 핀",
  },
  3: {
    plus: "3단계 보행자 신호등 배선도(ESP32 Plus 확장 보드): 2단계 신호등에 버튼을 더해요. 버튼은 가운데 홈에 걸쳐 25 · 27번 줄, io25 → 25번 줄(버튼 한쪽 다리), 대각선 반대쪽 27번 줄 → 위 − 줄, 위 − 줄과 아래 − 줄은 점퍼선으로 이어요",
    devkit: "3단계 보행자 신호등 배선도(기본 보드 DevKit 38핀): 2단계 신호등에 버튼을 더해요. 버튼은 가운데 홈에 걸쳐 25 · 27번 줄, D25 → 25번 줄(버튼 한쪽 다리), 대각선 반대쪽 27번 줄 → 위 − 줄, 위 − 줄과 아래 − 줄은 점퍼선으로 이어요",
    expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) 3단계 보행자 신호등 배선도: JUMP 점퍼는 평소 자리(3.3V 쪽). 2단계 신호등에 버튼을 더해요. 버튼은 노랑과 초록 LED 사이, 가운데 홈에 걸쳐 14 · 16번 줄: P25 칸 S 핀 → 14번 줄(버튼 한쪽 다리), 대각선 반대쪽 16번 줄 → 위 − 줄, 위 − 줄과 아래 − 줄은 점퍼선으로 이어요",
  },
};

const pair = (stage, id) => ({
  plus: () => { const r = draw("plus", stage); return svgDoc(id, T[stage].plus, r.body, r.height); },
  devkit: () => { const r = draw("devkit", stage); return svgDoc(`${id}k`, T[stage].devkit, r.body, r.height); },
  expansion: () => { const r = drawExpansion(stage); return svgDoc(`${id}x`, T[stage].expansion, r.body, r.height); },
});

export default {
  "wiring-one-led.svg": pair(1, "fs1"),
  "wiring-traffic.svg": pair(2, "fs2"),
  "wiring-crosswalk.svg": pair(3, "fs3"),
};
