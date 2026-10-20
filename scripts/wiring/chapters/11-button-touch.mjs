// 센서 S8 "버튼과 터치" — 풀업 버튼(14번) + LED(26번, 220Ω) 은 브레드보드, 터치 패드(4번)는 호일에 악어 클립.
// 두 보드 모두 브레드보드를 보드 위에 둔다. 버튼은 대각선 다리: 한쪽 → 14번, 반대쪽 → 위 − 줄.
// 이 파일의 도우미(buttonPullup · ledRight · ledLeft · railLink · foil · board 그리기 틀)는 23 · 24 · 25 장도 쓴다.
import { COLORS as C, compose, connectionTable, mfWire, mmWire, note, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, button, led, resistor } from "../parts.mjs";

/** + − 줄에서 구멍이 있는 열 (6·12·18… 은 비어 있어 옆 열로) */
export function railCol(c) {
  return (c - 1) % 6 === 5 ? c - 1 : c;
}

/**
 * 풀업 버튼: 다리 (col,e) (col+2,e) (col,f) (col+2,f). 신호는 왼쪽 아래 다리 줄 (col, j),
 * 대각선 반대쪽(오른쪽 위 다리) 줄 (col+2, a) → 점퍼 → 위 − 줄.
 */
export function buttonPullup(bb, col) {
  const b = button(bb, col);
  bb.tint(col, "bottom");
  bb.tint(col + 2, "top");
  const gndRail = bb.rail("top", "-", railCol(col + 2));
  const jumper = mmWire(bb.hole(col + 2, "a"), gndRail, C.black);
  return { svg: [b.svg], jumper, signalHole: bb.hole(col, "j"), cols: { sig: col, gnd: col + 2 } };
}

/** LED 회로(오른쪽으로): 신호 (k, j) → 저항 (k,h)~(k+4,h) → 긴 다리 (k+4, f), 짧은 다리 (k+5, f) → (k+5, j) → 아래 − 줄 */
export function ledRight(bb, k, color = "#e03131") {
  [k, k + 4, k + 5].forEach((c) => bb.tint(c, "bottom"));
  const svg = [resistor(bb.hole(k, "h"), bb.hole(k + 4, "h"), { label: "220Ω" }).svg, led(bb.hole(k + 4, "f"), bb.hole(k + 5, "f"), color).svg];
  const jumper = mmWire(bb.hole(k + 5, "j"), bb.rail("bottom", "-", railCol(k + 5)), C.black);
  return { svg, jumper, signalHole: bb.hole(k, "j"), cols: { sig: k, anode: k + 4, cathode: k + 5 } };
}

/** LED 회로(왼쪽으로, 1장과 같은 꼴): 신호 (k, j) → 저항 (k,h)~(k-5,h) → 긴 다리 (k-5, f), 짧은 다리 (k-6, f) → (k-6, j) → 아래 − 줄 */
export function ledLeft(bb, k, color = "#e03131") {
  [k, k - 5, k - 6].forEach((c) => bb.tint(c, "bottom"));
  const svg = [resistor(bb.hole(k, "h"), bb.hole(k - 5, "h"), { label: "220Ω" }).svg, led(bb.hole(k - 5, "f"), bb.hole(k - 6, "f"), color).svg];
  const jumper = mmWire(bb.hole(k - 6, "j"), bb.rail("bottom", "-", railCol(k - 6)), C.black);
  return { svg, jumper, signalHole: bb.hole(k, "j"), cols: { sig: k, anode: k - 5, cathode: k - 6 } };
}

/** 위 − 줄과 아래 − 줄을 브레드보드 끝 바깥으로 잇는 점퍼 (col 이 1 이면 왼쪽 끝, 아니면 오른쪽 끝 바깥) */
export function railLink(bb, col = 1) {
  const t = bb.rail("top", "-", col), b = bb.rail("bottom", "-", col);
  const x = col === 1 ? bb.x - 10 : bb.x + bb.w + 10;
  return mmWire(t, b, C.black, [{ x, y: t.y }, { x, y: b.y }], "orth");
}

/** 호일 터치 패드 + 악어 클립. 클립 입(선 끝)이 (x, y). 호일은 그 아래 */
export function foil(x, y, label = "호일 터치 패드") {
  const fx = x - 50, fy = y + 18;
  const svg = [
    `<path d="M${fx} ${fy + 6} l22 -6 l26 5 l30 -4 l22 6 l-3 34 l-24 4 l-28 -5 l-26 4 l-22 -3 z" fill="#ced4da" stroke="#868e96" stroke-width="2"/>`,
    `<path d="M${fx + 14} ${fy + 16} l20 4 M${fx + 50} ${fy + 26} l26 -3" stroke="#f8f9fa" stroke-width="2"/>`,
    `<path d="M${x - 7} ${y + 2} l-4 22 h22 l-4 -22 z" fill="#e03131" stroke="#a61e1e" stroke-width="1.5"/>`,
    note(fx + 112, fy + 22, label, "start", 14),
  ];
  return { svg, clip: { x, y } };
}

/* ───── 장 11 ───── */

function plus() {
  const bb = breadboard({ x: 72, y: 8, cols: 26, rails: { top: true, bottom: true } });
  const b = makePlus({ x: 60, y: bb.y + bb.h + 24 });
  const btn = buttonPullup(bb, 15), lc = ledRight(bb, 21);
  const s14 = b.gpio(14), s26 = b.gpio(26), gnd = b.power("GND"), t4 = b.gpio(4);
  const pad = foil(b.bounds.x + 124, b.bounds.y + b.bounds.h + 22);
  const wires = [
    mfWire(s14, btn.signalHole, C.green), mfWire(s26, lc.signalHole, C.yellow),
    mfWire(gnd, bb.rail("bottom", "-", railCol(bb.nearestCol(gnd.x, true))), C.black),
    btn.jumper, lc.jumper, railLink(bb),
    mfWire(t4, pad.clip, C.orange, [{ x: pad.clip.x, y: t4.y }], "orth"),
  ];
  const rows = [
    { color: C.green, part: `${s14.label} 핀`, to: `${btn.cols.sig}번 줄 (버튼 한쪽 다리)` },
    { color: C.black, part: `버튼 대각선 다리 ${btn.cols.gnd}번 줄`, to: "위 − 줄" },
    { color: C.yellow, part: `${s26.label} 핀`, to: `${lc.cols.sig}번 줄 → 220Ω 저항 → ${lc.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${lc.cols.cathode}번 줄`, to: "아래 − 줄" },
    { color: C.black, part: "GND 핀", to: "아래 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" },
    { color: C.orange, part: `${t4.label}`, to: "악어 클립 → 호일" },
  ];
  const table = connectionTable(pad.clip.y + 92, "이렇게 꽂아요 — 버튼 · LED 는 브레드보드, 터치는 호일", rows, b.legend);
  return { body: compose(b.draw([s14, s26, gnd, t4]), [bb.svg, ...btn.svg, ...lc.svg, ...pad.svg], wires, [table.svg]), height: table.bottom };
}

function devkit() {
  const bb = breadboard({ x: 72, y: 8, cols: 26, rails: { top: true, bottom: true } });
  const b = makeDevkit({ x: 95, y: bb.y + bb.h + 24 });
  const btn = buttonPullup(bb, 7), lc = ledRight(bb, 11);
  const s14 = b.gpio(14), s26 = b.gpio(26), gnd = b.power("GND", 0), t4 = b.gpio(4);
  const pad = foil(t4.x, b.bounds.y + b.bounds.h + 22);
  const wires = [
    mfWire(s14, btn.signalHole, C.green), mfWire(s26, lc.signalHole, C.yellow),
    mfWire(gnd, bb.rail("bottom", "-", railCol(bb.nearestCol(gnd.x, true))), C.black),
    btn.jumper, lc.jumper, railLink(bb),
    mfWire(t4, pad.clip, C.orange),
  ];
  const rows = [
    { color: C.green, part: `${s14.label} 핀`, to: `${btn.cols.sig}번 줄 (버튼 한쪽 다리)` },
    { color: C.black, part: `버튼 대각선 다리 ${btn.cols.gnd}번 줄`, to: "위 − 줄" },
    { color: C.yellow, part: `${s26.label} 핀`, to: `${lc.cols.sig}번 줄 → 220Ω 저항 → ${lc.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${lc.cols.cathode}번 줄`, to: "아래 − 줄" },
    { color: C.black, part: "GND 핀", to: "아래 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" },
    { color: C.orange, part: `${t4.label} 핀`, to: "악어 클립 → 호일" },
  ];
  const table = connectionTable(pad.clip.y + 92, "이렇게 꽂아요 — 버튼 · LED 는 브레드보드, 터치는 호일", rows, b.legend);
  return { body: compose(b.draw([s14, s26, gnd, t4]), [bb.svg, ...btn.svg, ...lc.svg, ...pad.svg], wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "버튼과 터치 배선도(ESP32 Plus 확장 보드): 버튼은 브레드보드 가운데 홈에 걸쳐 15 · 17번 줄에 꽂고, 보드 위쪽 io14 핀 → 15번 줄(버튼 한쪽 다리), 대각선 반대쪽 17번 줄 → 위 − 줄. LED 는 io26 핀 → 21번 줄 → 220Ω 저항 → 25번 줄의 긴 다리(+), 짧은 다리(−) 26번 줄 → 아래 − 줄. 보드 GND → 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요. ANALOG 묶음 io4 의 S 핀에 꽂은 선 끝을 악어 클립으로 호일에",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 버튼과 터치 배선도: 버튼은 브레드보드 가운데 홈에 걸쳐 7 · 9번 줄에 꽂고, D14 핀 → 7번 줄(버튼 한쪽 다리), 대각선 반대쪽 9번 줄 → 위 − 줄. LED 는 D26 핀 → 11번 줄 → 220Ω 저항 → 15번 줄의 긴 다리(+), 짧은 다리(−) 16번 줄 → 아래 − 줄. 보드 GND → 아래 − 줄, 위 − 줄과 아래 − 줄은 점퍼로 이어요. D4 핀에 꽂은 선 끝을 악어 클립으로 호일에",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wbt", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wbtk", T.devkit, r.body, r.height); },
  },
};
