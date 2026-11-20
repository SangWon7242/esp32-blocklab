// 센서 S9 "멜로디 버저" — 부저 + 다리 → 25번, − 다리 → GND. 1단계는 능동 부저, 2단계부터 같은 자리에 수동 부저.
// (ESP32 Plus 에는 io15 가 없어 부저 핀을 25번으로 쓴다.) 세 보드 모두 브레드보드를 보드 위에 둔다.
// 확장 보드 판: 맨 부품뿐이라 점퍼는 평소 자리(3.3V). 부저는 위 줄 P25 칸 바로 위 열에 둔다 (1장 LED 와 같은 꼴).
import { COLORS as C, compose, connectionTable, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { breadboard, buzzer } from "../parts.mjs";
import { railCol } from "./11-button-touch.mjs";

/** 부저: + 다리 (p, f), − 다리 (p+3, f). 신호는 (p, j), − 쪽은 (p+3, j) → 아래 − 줄 */
function draw(board, bbX, p, idPrefix, title) {
  const bb = breadboard({ x: bbX, y: 8, cols: 26, rails: { top: false, bottom: true } });
  [p, p + 3].forEach((c) => bb.tint(c, "bottom"));
  const bz = buzzer(bb.hole(p, "f"), bb.hole(p + 3, "f"), { active: true });
  const jumper = mmWire(bb.hole(p + 3, "j"), bb.rail("bottom", "-", railCol(p + 3)), C.black);
  const b = board({ y: bb.y + bb.h + 24 });
  const sig = b.gpio(25), gnd = b.power("GND");
  const wires = [mfWire(sig, bb.hole(p, "j"), C.yellow), mfWire(gnd, bb.rail("bottom", "-", railCol(bb.nearestCol(gnd.x, true))), C.black), jumper];
  const rows = [
    { color: C.yellow, part: `${sig.label} 핀`, to: `${p}번 줄 → 부저 + 다리` },
    { color: C.black, part: `부저 − 다리 ${p + 3}번 줄`, to: "− 줄 → GND" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — 1단계 능동 부저, 2단계부터 같은 자리에 수동 부저", rows, b.legend);
  return svgDoc(idPrefix, title, compose(b.draw([sig, gnd]), [bb.svg, bz.svg], wires, [table.svg]), table.bottom);
}

/** 확장 보드: 브레드보드를 보드 위에, 위 줄 P25 칸 S 핀 → M-F → 부저 + 다리 줄. GND 는 위 줄 GND 칸 S 핀 → − 줄 */
function drawExpansion() {
  const bb = breadboard({ x: 100, y: 8, cols: 26, rails: { top: false, bottom: true } });
  const b = makeExpansion({ x: 22, y: bb.y + bb.h + 30, jumper: "3V3" });
  const sig = b.gpio(25), gnd = b.power("GND");
  const p = Math.round((sig.x - (bb.x + 28)) / 16) + 1;
  [p, p + 3].forEach((c) => bb.tint(c, "bottom"));
  const bz = buzzer(bb.hole(p, "f"), bb.hole(p + 3, "f"), { active: true });
  const jumper = mmWire(bb.hole(p + 3, "j"), bb.rail("bottom", "-", railCol(p + 3)), C.black);
  const wires = [mfWire(sig, bb.hole(p, "j"), C.yellow), mfWire(gnd, bb.rail("bottom", "-", railCol(bb.nearestCol(gnd.x, true))), C.black), jumper];
  const rows = [
    { color: C.yellow, part: `${sig.label} 칸 S 핀`, to: `${p}번 줄 → 부저 + 다리` },
    { color: C.black, part: `부저 − 다리 ${p + 3}번 줄`, to: "− 줄 → 위 줄 GND 칸 S 핀" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 12, "이렇게 꽂아요 — 1단계 능동 부저, 2단계부터 같은 자리에 수동 부저", rows, b.legend);
  const title = `확장 보드(ESP32 38핀 확장 보드 + DevKit) 부저 배선도: 부저 + 다리는 브레드보드 ${p}번 줄 → 위 줄 P25 칸 S 핀, − 다리는 ${p + 3}번 줄 → 점퍼선 → − 줄 → 위 줄 GND 칸 S 핀. 1단계는 능동 부저, 2단계부터 같은 자리에 수동 부저를 꽂아요. JUMP 점퍼는 3.3V 쪽`;
  return svgDoc("wbzx", title, compose(b.draw([sig, gnd]), [bb.svg, bz.svg], wires, [table.svg]), table.bottom);
}

export default {
  "wiring-breadboard.svg": {
    plus: () => draw((o) => makePlus({ x: 60, ...o }), 72, 20, "wbz",
      "부저 배선도(ESP32 Plus 확장 보드): 부저 + 다리는 브레드보드 20번 줄 → 보드 위쪽 io25 핀, − 다리는 23번 줄 → 점퍼선 → − 줄 → 보드 GND. 1단계는 능동 부저, 2단계부터 같은 자리에 수동 부저를 꽂아요"),
    devkit: () => draw((o) => makeDevkit({ x: 95, ...o }), 72, 13, "wbzk",
      "기본 보드(ESP32 DevKit 38핀) 부저 배선도: 부저 + 다리는 브레드보드 13번 줄 → D25 핀, − 다리는 16번 줄 → 점퍼선 → − 줄 → 보드 GND. 1단계는 능동 부저, 2단계부터 같은 자리에 수동 부저를 꽂아요"),
    expansion: drawExpansion,
  },
};
