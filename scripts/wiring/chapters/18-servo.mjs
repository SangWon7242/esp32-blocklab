// 센서 S15 "서보 모터" — 서보(신호 4, 5V), 가변저항(가운데 다리 39, 양 끝 3V3 · GND).
// Plus: 서보 플러그는 ANALOG io4 줄에 바로, 가변저항은 보드 아래 브레드보드(아래 줄 3V3 · GND · io39 에서 바로).
// DevKit: 서보는 보드 아래(플러그에 M-F), 가변저항은 보드 위 브레드보드(VN · 위 줄 GND 에서 바로, 3V3 은 보드 왼쪽 바깥 길).
import { COLORS as C, compose, connectionTable, mfWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, potentiometer, servo, servoWithPlug } from "../parts.mjs";

function plus() {
  const b = makePlus({ x: 96, y: 16 });
  const sv = b.triple(4);
  const s = servo(14, sv.G.y - 22, [sv.G, sv.V, sv.S]);
  const bb = breadboard({ x: 152, y: b.bounds.y + b.bounds.h + 26, cols: 20, rails: { top: false, bottom: false } });
  const L = 15, M = 16, R = 17;
  [L, M, R].forEach((c) => bb.tint(c, "top"));
  const pot = potentiometer(bb.hole(L, "c"), bb.hole(M, "c"), bb.hole(R, "c"), { up: false, lift: 34 });
  const v33 = b.power("3V3"), gnd = b.power("GND", 1), a39 = b.gpio(39);
  const wires = [
    mfWire(v33, bb.hole(L, "a"), C.pink),
    mfWire(gnd, bb.hole(R, "a"), C.black),
    mfWire(a39, bb.hole(M, "a"), C.green),
  ];
  const rows = [
    { colors: [C.brown, C.red, C.orange], part: "서보 플러그", to: "ANALOG io4 줄 G·V·S (갈색 G · 빨강 V · 주황 S)" },
    { color: C.pink, part: `3V3 (아래 줄)`, to: `${L}번 줄 → 가변저항 한쪽 끝` },
    { color: C.green, part: "io39 (아래 줄)", to: `${M}번 줄 → 가변저항 가운데 다리` },
    { color: C.black, part: `GND (아래 줄)`, to: `${R}번 줄 → 가변저항 다른 쪽 끝` },
  ];
  const table = connectionTable(bb.y + bb.h + 16, "이렇게 꽂아요 — 서보는 보드에 바로, 가변저항은 브레드보드에", rows, "plus");
  const used = [sv.G, sv.V, sv.S, v33, gnd, a39];
  return svgDoc("wbs", T.plus, compose(b.draw(used), [s.svg, bb.svg, pot.svg], wires, [table.svg]), table.bottom);
}

function devkit() {
  const bb = breadboard({ x: 74, y: 8, cols: 16, rails: { top: false, bottom: false } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 40 });
  const L = 3, M = 4, R = 5;
  [L, M, R].forEach((c) => bb.tint(c, "bottom"));
  const pot = potentiometer(bb.hole(L, "g"), bb.hole(M, "g"), bb.hole(R, "g"), { up: true, lift: 34 });
  const v33 = b.power("3V3"), gndTop = b.power("GND", 0), gndBot = b.power("GND", 1), vn = b.gpio(39), vin = b.power("5V"), d4 = b.gpio(4);
  const gapHi = bb.y + bb.h + 8, gapLo = bb.y + bb.h + 18; // 브레드보드와 보드 사이 두 길
  const under = b.bounds.y + b.bounds.h + 20;
  const s = servoWithPlug(360, under + 30, { plugSide: "left", order: ["S", "V", "G"], titleAt: { x: 394, y: under + 98 } });
  const wires = [
    // 가변저항: VN · 위 줄 GND 는 위로 바로, 3V3 은 보드 왼쪽 바깥 길로 돌아 올라와요
    mfWire(gndTop, bb.hole(R, "j"), C.black),
    mfWire(vn, bb.hole(M, "j"), C.green, [{ x: vn.x, y: gapLo }, { x: bb.hole(M, "j").x, y: gapLo }], "orth"),
    mfWire(v33, bb.hole(L, "j"), C.pink, [{ x: v33.x, y: under }, { x: 28, y: under }, { x: 28, y: gapHi }, { x: bb.hole(L, "j").x, y: gapHi }], "orth"),
    // 서보: 주황 → D4, 갈색 → 아래 줄 GND 는 아래에서 바로, 빨강 → VIN 은 보드 왼쪽 바깥 길로
    mfWire(d4, s.pins.S, C.orange, [{ x: d4.x, y: s.pins.S.y }], "orth"),
    mfWire(gndBot, s.pins.G, C.black, [{ x: gndBot.x, y: s.pins.G.y }], "orth"),
    mfWire(vin, s.pins.V, C.red, [{ x: vin.x, y: gapLo + 12 }, { x: 44, y: gapLo + 12 }, { x: 44, y: s.pins.V.y }], "orth"),
  ];
  const rows = [
    { color: C.orange, part: "서보 주황(신호)", to: d4.label },
    { color: C.red, part: "서보 빨강", to: "VIN(5V)" },
    { color: C.black, part: "서보 갈색", to: "GND (아래 줄)" },
    { color: C.pink, part: "3V3", to: `${L}번 줄 → 가변저항 한쪽 끝` },
    { color: C.green, part: vn.label, to: `${M}번 줄 → 가변저항 가운데 다리` },
    { color: C.black, part: "GND (위 줄)", to: `${R}번 줄 → 가변저항 다른 쪽 끝` },
  ];
  const table = connectionTable(s.pins.V.y + 70, "이렇게 꽂아요 — 서보 플러그에는 M-F 선, 가변저항은 브레드보드에", rows, "devkit");
  const used = [v33, gndTop, gndBot, vn, vin, d4];
  return svgDoc("wbsk", T.devkit, compose(b.draw(used), [bb.svg, pot.svg, s.svg], wires, [table.svg]), table.bottom);
}

const T = {
  plus: "서보 모터 배선도(ESP32 Plus 확장 보드): 서보 플러그는 ANALOG 묶음 io4 줄에 갈색 G, 빨강 V, 주황 S 가 맞도록 그대로. 가변저항은 보드 아래 브레드보드 c 칸 15 · 16 · 17번 줄에 꽂고, 보드 아래 줄 3V3 → 15번 줄, io39 → 16번 줄(가운데 다리), GND → 17번 줄",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 서보 모터 배선도: 서보 플러그 주황은 D4, 갈색은 아래 줄 GND, 빨강은 VIN(5V) 에 M-F 듀폰선으로. 가변저항은 보드 위 브레드보드 g 칸 3 · 4 · 5번 줄에 꽂고, 3V3 → 3번 줄, VN(39) → 4번 줄(가운데 다리), 위 줄 GND → 5번 줄",
};

export default {
  "wiring-breadboard.svg": { plus, devkit },
};
