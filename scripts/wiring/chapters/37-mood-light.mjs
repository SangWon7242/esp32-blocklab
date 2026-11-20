// 융합 F10 "감성 스마트 무드등" — RGB LED(공통 음극: 빨강 27 · 초록 25 · 파랑 26, 220Ω 셋), 가변저항(가운데 → 39),
// 모드 버튼(14, 풀업). 두 보드 모두 브레드보드를 보드 위에 두고 + − 줄은 위 · 아래 둘, 두 − 줄은 오른쪽 끝 바깥 점퍼로 잇는다.
// RGB LED 다리(빨강 · − · 초록 · 파랑)는 위 칸 d, 저항 셋이 가운데 홈을 건너 아래 칸으로, 신호선은 j 칸에 (23장 버튼 왕과 같은 꼴).
// 버튼은 대각선: 한쪽 다리 줄(j 칸) ← 14번, 반대쪽 다리 줄(a 칸) → 위 − 줄.
// Plus: 39 · 3V3 이 아래 줄이라 두 선만 보드 왼쪽 바깥 길로 올라와 가변저항 다리에 바로 (+ 줄 없이).
// DevKit: VN(39) 이 위 줄이라 가변저항은 아래 + − 줄에서 3V3 · GND 를 받는다. 3V3(아래 줄)만 보드 왼쪽 바깥 길로 + 줄에.
// 확장 보드: P14 · P27 · P26 · P25 · SVN(39) · GND 가 모두 위 줄 → 브레드보드는 보드 위(DevKit 과 같은 꼴). 아래 + 줄은 전원 헤더 3V
//   (점퍼와 상관없이 3.3V — 가변저항이 39번에 3.3V 넘게 주지 않게), 아래 − 줄은 전원 헤더 GND. 두 − 줄은 왼쪽 끝 바깥 점퍼. 점퍼는 평소 자리(3.3V).
import { COLORS as C, compose, connectionTable, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { breadboard, button, potentiometer, resistor, rgbLed } from "../parts.mjs";
import { railCol } from "./35-random-hammer.mjs";

/** RGB LED: 다리 (r,d)(r+2,d)(r+4,d)(r+6,d) = 빨강 · − · 초록 · 파랑. 빨강 · 초록 · 파랑 줄은 저항 (x,e)~(x,h) 로 홈을 건너 (x, j) 에서 신호 */
function rgbCircuit(bb, r, { labelOn = "B" } = {}) {
  const cols = { R: r, K: r + 2, G: r + 4, B: r + 6 };
  const svg = [];
  for (const c of [cols.R, cols.G, cols.B]) {
    bb.tint(c, "top");
    bb.tint(c, "bottom");
    svg.push(resistor(bb.hole(c, "e"), bb.hole(c, "h"), { label: c === cols[labelOn] ? "220Ω" : undefined }).svg);
  }
  bb.tint(cols.K, "top");
  svg.push(rgbLed([cols.R, cols.K, cols.G, cols.B].map((c) => bb.hole(c, "d")), { lift: 30 }).svg);
  const jumper = mmWire(bb.hole(cols.K, "a"), bb.rail("top", "-", railCol(cols.K)), C.black);
  return { svg, jumper, cols, sig: (c) => bb.hole(c, "j") };
}

/** 풀업 버튼: 다리 (c,e)(c+2,e)(c,f)(c+2,f). 신호 = (c+2, j), 대각선 (c, a) → 위 − 줄 */
function buttonUp(bb, c) {
  const b = button(bb, c);
  bb.tint(c, "top");
  bb.tint(c + 2, "bottom");
  return { svg: b.svg, jumper: mmWire(bb.hole(c, "a"), bb.rail("top", "-", railCol(c)), C.black), sigHole: bb.hole(c + 2, "j"), cols: { gnd: c, sig: c + 2 } };
}

/** 위 − 줄과 아래 − 줄을 브레드보드 오른쪽 끝 바깥으로 잇는 점퍼 */
function railLinkRight(bb, col) {
  const t = bb.rail("top", "-", col), u = bb.rail("bottom", "-", col);
  const x = bb.x + bb.w + 10;
  return mmWire(t, u, C.black, [{ x, y: t.y }, { x, y: u.y }], "orth");
}

/* ───── ESP32 Plus ───── */
function plus() {
  const bb = breadboard({ x: 60, y: 8, cols: 26, rails: { top: true, bottom: true } });
  const b = makePlus({ x: 96, y: bb.y + bb.h + 34 });
  const parts = [bb.svg], wires = [], used = [];

  // RGB LED: 19 · 21 · 23 · 25번 줄, io27 → 19, io25 → 23, io26 → 25
  const rgb = rgbCircuit(bb, 19);
  const sR = b.gpio(27), sG = b.gpio(25), sB = b.gpio(26);
  wires.push(mfWire(sR, rgb.sig(rgb.cols.R), C.orange), mfWire(sG, rgb.sig(rgb.cols.G), C.green), mfWire(sB, rgb.sig(rgb.cols.B), C.blue), rgb.jumper);
  // 버튼: 15 · 17번 줄. io14 → (17, j), (15, a) → 위 − 줄
  const btn = buttonUp(bb, 15);
  const s14 = b.gpio(14);
  wires.push(mfWire(s14, btn.sigHole, C.purple), btn.jumper);
  // GND(위 한 줄) → 아래 − 줄, 두 − 줄 잇기
  const gnd = b.power("GND");
  wires.push(mfWire(gnd, bb.rail("bottom", "-", railCol(bb.nearestCol(gnd.x, true))), C.black), railLinkRight(bb, 26));
  used.push(sR, sG, sB, s14, gnd);

  // 가변저항: 2 · 3 · 4번 줄 (f 칸). 2 → 아래 − 줄, 3(가운데) ← io39, 4 ← 3V3. 39 · 3V3 은 아래 줄이라 보드 왼쪽 바깥 길로
  [2, 3, 4].forEach((c) => bb.tint(c, "bottom"));
  parts.push(potentiometer(bb.hole(2, "f"), bb.hole(3, "f"), bb.hole(4, "f")).svg);
  wires.push(mmWire(bb.hole(2, "j"), bb.rail("bottom", "-", 2), C.black));
  const k39 = b.gpio(39), v33 = b.power("3V3");
  const bot = b.bounds.y + b.bounds.h, corr = bb.y + bb.h + 10;
  wires.push(mfWire(k39, bb.hole(3, "j"), C.teal, [{ x: k39.x, y: bot + 22 }, { x: 24, y: bot + 22 }, { x: 24, y: corr }, { x: bb.hole(3, "j").x, y: corr }], "orth"));
  wires.push(mfWire(v33, bb.hole(4, "j"), C.red, [{ x: v33.x, y: bot + 12 }, { x: 38, y: bot + 12 }, { x: 38, y: corr + 12 }, { x: bb.hole(4, "j").x, y: corr + 12 }], "orth"));
  used.push(k39, v33);

  parts.push(...rgb.svg, btn.svg);
  const rows = [
    { color: C.orange, part: "io27", to: "19번 줄 → 220Ω → RGB 빨강 다리" },
    { color: C.green, part: "io25", to: "23번 줄 → 220Ω → RGB 초록 다리" },
    { color: C.blue, part: "io26", to: "25번 줄 → 220Ω → RGB 파랑 다리" },
    { color: C.black, part: "RGB 가장 긴 다리(−) 21번 줄", to: "위 − 줄" },
    { color: C.purple, part: "io14", to: "17번 줄 (버튼 한쪽 다리)" },
    { color: C.black, part: "버튼 대각선 다리 15번 줄", to: "위 − 줄" },
    { color: C.black, part: "GND (위 한 줄)", to: "아래 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" },
    { color: C.teal, part: "io39 (아래 줄)", to: "3번 줄 가변저항 가운데 다리 (보드 바깥으로)" },
    { color: C.red, part: "3V3 (아래 줄)", to: "4번 줄 가변저항 다리 (보드 바깥으로)" },
    { color: C.black, part: "가변저항 2번 줄 다리", to: "아래 − 줄" },
  ];
  const table = connectionTable(bot + 44, "이렇게 꽂아요 — 저항 셋은 가운데 홈을 건너", rows, "plus", { columns: 1 });
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit 38핀) ───── */
function devkit() {
  const bb = breadboard({ x: 96, y: 8, cols: 26, rails: { top: true, bottom: true } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 40 });
  const parts = [bb.svg], wires = [], used = [];
  const R = (s, c) => bb.rail("bottom", s, c);
  const laneLow = b.bounds.y - 12, laneHigh = bb.y + bb.h + 12;

  // RGB LED: 9 · 11 · 13 · 15번 줄. D27 → 9, D25 → 13, D26 → 15 (D26 이 D25 선을 한 번 건넌다 — 보드 핀 순서가 27 · 26 · 25)
  const rgb = rgbCircuit(bb, 9);
  const sR = b.gpio(27), sG = b.gpio(25), sB = b.gpio(26);
  const hR = rgb.sig(rgb.cols.R), hG = rgb.sig(rgb.cols.G), hB = rgb.sig(rgb.cols.B);
  wires.push(mfWire(sR, hR, C.orange));
  wires.push(mfWire(sG, hG, C.green, [{ x: sG.x, y: laneLow }, { x: hG.x, y: laneLow }], "orth"));
  wires.push(mfWire(sB, hB, C.blue, [{ x: sB.x, y: laneHigh }, { x: hB.x, y: laneHigh }], "orth"));
  wires.push(rgb.jumper);
  // 버튼: 6 · 8번 줄. D14 → (8, j), (6, a) → 위 − 줄
  const btn = buttonUp(bb, 6);
  const s14 = b.gpio(14);
  wires.push(mfWire(s14, btn.sigHole, C.purple), btn.jumper);
  // GND → 아래 − 줄, 3V3(위 줄 끝) → 보드 왼쪽 바깥 길 → 아래 + 줄, 두 − 줄 잇기
  const gnd = b.power("GND", 0), v33 = b.power("3V3");
  wires.push(mfWire(gnd, R("-", 3), C.black));
  wires.push(mfWire(v33, R("+", 1), C.red, [{ x: v33.x, y: v33.y + 22 }, { x: 44, y: v33.y + 22 }, { x: 44, y: R("+", 1).y }], "orth"));
  wires.push(railLinkRight(bb, 26));
  used.push(sR, sG, sB, s14, gnd, v33);

  // 가변저항: 17 · 18 · 19번 줄 (f 칸). 18(가운데) ← VN(39), 17 → + 줄(16번 칸으로 비스듬히, − 줄 구멍을 피해), 19 → − 줄
  [17, 18, 19].forEach((c) => bb.tint(c, "bottom"));
  parts.push(potentiometer(bb.hole(17, "f"), bb.hole(18, "f"), bb.hole(19, "f")).svg);
  const k39 = b.gpio(39);
  wires.push(mfWire(k39, bb.hole(18, "j"), C.teal));
  wires.push(mmWire(bb.hole(17, "j"), R("+", 16), C.red, [], "line"));
  wires.push(mmWire(bb.hole(19, "j"), R("-", 19), C.black));
  used.push(k39);

  parts.push(...rgb.svg, btn.svg);
  const rows = [
    { color: C.orange, part: "D27", to: "9번 줄 → 220Ω → RGB 빨강 다리" },
    { color: C.green, part: "D25", to: "13번 줄 → 220Ω → RGB 초록 다리" },
    { color: C.blue, part: "D26", to: "15번 줄 → 220Ω → RGB 파랑 다리" },
    { color: C.black, part: "RGB 가장 긴 다리(−) 11번 줄", to: "위 − 줄" },
    { color: C.purple, part: "D14", to: "8번 줄 (버튼 한쪽 다리)" },
    { color: C.black, part: "버튼 대각선 다리 6번 줄", to: "위 − 줄" },
    { color: C.red, part: "3V3 (위 줄 끝)", to: "아래 + 줄 (보드 바깥으로)" },
    { color: C.black, part: "GND", to: "아래 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" },
    { color: C.teal, part: k39.label, to: "18번 줄 가변저항 가운데 다리" },
    { colors: [C.red, C.black], part: "가변저항 17 · 19번 줄", to: "아래 + 줄 · − 줄" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 34, "이렇게 꽂아요 — 저항 셋은 가운데 홈을 건너", rows, "devkit", { columns: 1 });
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 확장 보드(38핀 확장 보드 + DevKit): 점퍼 3.3V ───── */
function expansion() {
  const bb = breadboard({ x: 72, y: 12, cols: 28, rails: { top: true, bottom: true } });
  const b = makeExpansion({ x: 22, y: bb.y + bb.h + 46, jumper: "3V3" });
  const parts = [bb.svg], wires = [], used = [];
  const R = (s, c) => bb.rail("bottom", s, c);
  const lane = (k) => bb.y + bb.h + 10 + k * 8;

  // 버튼: 12 · 14번 줄. P14 → (14, j), (12, a) → 위 − 줄
  const btn = buttonUp(bb, 12);
  const s14 = b.gpio(14);
  wires.push(mfWire(s14, btn.sigHole, C.purple, [{ x: s14.x, y: lane(2) }, { x: btn.sigHole.x, y: lane(2) }], "orth"), btn.jumper);
  // RGB LED: 17 · 19 · 21 · 23번 줄. P27 → 17, P25 → 21, P26 → 23 (P26 이 P25 선을 한 번 건넌다 — 칸 순서가 27 · 26 · 25)
  const rgb = rgbCircuit(bb, 17, { labelOn: "R" });
  const sR = b.gpio(27), sG = b.gpio(25), sB = b.gpio(26);
  const hR = rgb.sig(rgb.cols.R), hG = rgb.sig(rgb.cols.G), hB = rgb.sig(rgb.cols.B);
  wires.push(mfWire(sR, hR, C.orange, [{ x: sR.x, y: lane(0) }, { x: hR.x, y: lane(0) }], "orth"));
  wires.push(mfWire(sB, hB, C.blue, [{ x: sB.x, y: lane(1) }, { x: hB.x, y: lane(1) }], "orth"));
  wires.push(mfWire(sG, hG, C.green));
  wires.push(rgb.jumper);
  used.push(s14, sR, sG, sB);

  // 전원: 전원 헤더 GND → 아래 − 줄, 전원 헤더 3V → 헤더 GND 핀 사이로 올라가 아래 + 줄, 두 − 줄은 왼쪽 끝 바깥 점퍼
  const gnd = b.power("GND", 5), v33 = b.power("3V3", 1);
  const p5 = R("+", 5);
  wires.push(mfWire(gnd, R("-", 7), C.black));
  wires.push(mfWire(v33, p5, C.red, [{ x: p5.x, y: v33.y }], "orth"));
  { const t = bb.rail("top", "-", 1), u = R("-", 1), x = bb.x - 10; wires.push(mmWire(t, u, C.black, [{ x, y: t.y }, { x, y: u.y }], "orth")); }
  used.push(gnd, v33);

  // 가변저항: 26 · 27 · 28번 줄 (f 칸). 27(가운데) ← SVN(39), 26 → − 줄, 28 → + 줄
  [26, 27, 28].forEach((c) => bb.tint(c, "bottom"));
  parts.push(potentiometer(bb.hole(26, "f"), bb.hole(27, "f"), bb.hole(28, "f")).svg);
  const k39 = b.gpio(39), hM = bb.hole(27, "j");
  wires.push(mfWire(k39, hM, C.teal));
  wires.push(mmWire(bb.hole(26, "j"), R("-", 26), C.black));
  wires.push(mmWire(bb.hole(28, "j"), R("+", 28), C.red, [], "line"));
  used.push(k39);

  parts.push(...rgb.svg, btn.svg);
  const rows = [
    { color: C.orange, part: "P27 칸 S", to: "17번 줄 → 220Ω → RGB 빨강 다리" },
    { color: C.green, part: "P25 칸 S", to: "21번 줄 → 220Ω → RGB 초록 다리" },
    { color: C.blue, part: "P26 칸 S", to: "23번 줄 → 220Ω → RGB 파랑 다리" },
    { color: C.black, part: "RGB 가장 긴 다리(−) 19번 줄", to: "위 − 줄" },
    { color: C.purple, part: "P14 칸 S", to: "14번 줄 (버튼 한쪽 다리)" },
    { color: C.black, part: "버튼 대각선 다리 12번 줄", to: "위 − 줄" },
    { color: C.red, part: "전원 헤더 3V", to: "아래 + 줄 (헤더 GND 핀 사이로)" },
    { color: C.black, part: "전원 헤더 GND", to: "아래 − 줄, 위 − 줄 ↔ 아래 − 줄 점퍼" },
    { color: C.teal, part: "SVN(39) 칸 S", to: "27번 줄 가변저항 가운데 다리" },
    { colors: [C.black, C.red], part: "가변저항 26 · 28번 줄", to: "아래 − 줄 · + 줄" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 40, "이렇게 꽂아요 — 저항 셋은 가운데 홈을 건너", rows, b.legend, { columns: 1 });
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "감성 스마트 무드등 배선도(ESP32 Plus 확장 보드): 브레드보드는 보드 위. RGB LED 다리를 위 칸 d 의 19 · 21 · 23 · 25번 줄에(빨강 · 가장 긴 다리 − · 초록 · 파랑), 220Ω 저항 셋이 19 · 23 · 25번 줄에서 가운데 홈을 건너고, 보드 위쪽 io27 → 19번 줄, io25 → 23번 줄, io26 → 25번 줄. 21번 줄 → 위 − 줄. 버튼은 가운데 홈에 걸쳐 15 · 17번 줄: io14 → 17번 줄, 대각선 15번 줄 → 위 − 줄. 위쪽 GND → 아래 − 줄, 두 − 줄은 점퍼로. 가변저항은 2 · 3 · 4번 줄: 가운데 3번 줄 ← 아래 줄 io39, 4번 줄 ← 아래 줄 3V3 (두 선은 보드 바깥으로 돌아), 2번 줄 → 아래 − 줄",
  expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) 감성 스마트 무드등 배선도: JUMP 점퍼는 3.3V 쪽(평소 자리). 브레드보드는 보드 위. RGB LED 다리를 위 칸 d 의 17 · 19 · 21 · 23번 줄에(빨강 · 가장 긴 다리 − · 초록 · 파랑), 220Ω 저항 셋이 17 · 21 · 23번 줄에서 가운데 홈을 건너고, P27 칸 S 핀 → 17번 줄, P25 칸 S 핀 → 21번 줄, P26 칸 S 핀 → 23번 줄. 19번 줄 → 위 − 줄. 버튼은 가운데 홈에 걸쳐 12 · 14번 줄: P14 칸 S 핀 → 14번 줄, 대각선 12번 줄 → 위 − 줄. 전원 헤더 GND → 아래 − 줄, 전원 헤더 3V → 헤더 GND 핀 사이로 올라가 아래 + 줄, 두 − 줄은 점퍼로. 가변저항은 26 · 27 · 28번 줄: 가운데 27번 줄 ← SVN(39) 칸 S 핀, 26번 줄 → − 줄, 28번 줄 → + 줄",
  devkit: "기본 보드(ESP32 DevKit 38핀) 감성 스마트 무드등 배선도: 브레드보드는 보드 위. RGB LED 다리를 위 칸 d 의 9 · 11 · 13 · 15번 줄에(빨강 · 가장 긴 다리 − · 초록 · 파랑), 220Ω 저항 셋이 9 · 13 · 15번 줄에서 가운데 홈을 건너고, D27 → 9번 줄, D25 → 13번 줄, D26 → 15번 줄. 11번 줄 → 위 − 줄. 버튼은 가운데 홈에 걸쳐 6 · 8번 줄: D14 → 8번 줄, 대각선 6번 줄 → 위 − 줄. GND → 아래 − 줄, 3V3 → 보드 바깥으로 돌아 아래 + 줄, 두 − 줄은 점퍼로. 가변저항은 17 · 18 · 19번 줄: 가운데 18번 줄 ← VN(39), 17번 줄 → + 줄, 19번 줄 → − 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wml", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wmlk", T.devkit, r.body, r.height); },
    expansion: () => { const r = expansion(); return svgDoc("wmlx", T.expansion, r.body, r.height); },
  },
};
