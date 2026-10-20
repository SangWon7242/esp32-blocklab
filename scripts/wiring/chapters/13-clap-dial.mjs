// 센서 S10 "박수 스위치와 다이얼" — LED(26번) + 220Ω, 가변저항 가운데 다리 → 39번, 소리 센서 모듈 S → 36번.
// 가변저항 양 끝과 소리 센서 V·G 는 브레드보드 + 줄(3V3) · − 줄(GND)을 나눠 쓴다 (3V3 핀은 하나뿐).
// Plus: 39·36·3V3·GND 가 모두 아래 줄이라 브레드보드를 보드 **아래**에 둔다. 26번(위 줄)만 보드 왼쪽 바깥 길로.
// DevKit: 26·VN(39)·VP(36) 이 위 줄이라 브레드보드를 보드 **위**에 둔다. 3V3(아래 줄)만 보드 왼쪽 바깥 길로.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, name, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, led, potentiometer, resistor, sensor3 } from "../parts.mjs";

/* ───── ESP32 Plus ───── */
function plus() {
  const b = makePlus({ x: 96, y: 40 });
  const bb = breadboard({ x: 96, y: 470, cols: 26, rails: { top: true, bottom: false } });
  const parts = [], wires = [], used = [];
  const v33 = b.power("3V3"), gnd = b.power("GND", 1), k39 = b.gpio(39), s36 = b.gpio(36), p26 = b.gpio(26);
  used.push(v33, gnd, k39, s36, p26);
  const rail = (s, c) => bb.rail("top", s, c);
  const aY = bb.hole(1, "a").y;

  // 3V3 → + 줄, GND → − 줄 (보드 아래 줄에서 곧장 아래로)
  wires.push(mfWire(v33, rail("+", 13), C.red));
  wires.push(mfWire(gnd, rail("-", 16), C.black, [{ x: gnd.x, y: rail("-", 16).y - 8 }], "orth"));

  // 가변저항: 다리 23 · 24 · 25번 줄 (e 칸), 몸통은 홈 쪽. 24번(가운데) ← 39번, 23 → − 줄, 25 → + 줄
  [23, 24, 25].forEach((c) => bb.tint(c, "top"));
  const pot = potentiometer(bb.hole(23, "e"), bb.hole(24, "e"), bb.hole(25, "e"), { up: false, lift: 32 });
  wires.push(mfWire(k39, bb.hole(24, "a"), C.green));
  wires.push(mmWire(bb.hole(23, "b"), rail("-", 23), C.black));
  wires.push(mmWire(bb.hole(25, "b"), rail("+", 26), C.red, [], "line"));

  // LED: 26번 → (왼쪽 바깥 길) → 6번 줄 a → 220Ω (6~10번 줄 c) → 10번 줄 e 긴 다리, 11번 줄 e 짧은 다리 → − 줄
  [6, 10, 11].forEach((c) => bb.tint(c, "top"));
  const res = resistor(bb.hole(6, "c"), bb.hole(10, "c"), { label: "220Ω" });
  const ledp = led(bb.hole(10, "e"), bb.hole(11, "e"), "#e03131", { up: false, lift: 32 });
  const sig = bb.hole(6, "a");
  wires.push(mfWire(p26, sig, C.yellow, [{ x: p26.x, y: 22 }, { x: 40, y: 22 }, { x: 40, y: 452 }, { x: sig.x, y: 452 }], "orth"));
  wires.push(mmWire(bb.hole(11, "a"), rail("-", 11), C.black));

  // 소리 센서 모듈: 보드와 브레드보드 사이 (3V3·GND 선과 39번 선 사이). S → 36번(아래 줄) F-F, V·G → + − 줄 M-F
  const snd = sensor3(392, 374, "sound", { titleAt: { x: 430, y: 358 } });
  wires.push(ffWire(snd.pins.S, s36, C.blue, [{ x: snd.pins.S.x, y: 462 }, { x: s36.x, y: 462 }], "orth"));
  wires.push(mfWire(snd.pins.V, rail("+", 20), C.red));
  wires.push(mfWire(snd.pins.G, rail("-", 19), C.black, [{ x: snd.pins.G.x, y: rail("-", 19).y - 8 }], "orth"));

  parts.push(bb.svg, pot.svg, res.svg, ledp.svg, snd.svg);
  parts.push(name(bb.x + bb.w + 6, bb.hole(24, "f").y + 2, "가변저항", "start", 14));
  const rows = [
    { colors: [C.red, C.black], part: "3V3 · GND", to: "+ 줄 · − 줄" },
    { color: C.green, part: "39번(아래 줄 io39)", to: "24번 줄 가변저항 가운데 다리" },
    { colors: [C.red, C.black], part: "가변저항 25 · 23번 줄", to: "+ 줄 · − 줄" },
    { color: C.blue, part: "소리 센서 S", to: "36번(아래 줄 io36)" },
    { colors: [C.red, C.black], part: "소리 센서 V · G", to: "+ 줄 · − 줄" },
    { color: C.yellow, part: "26번(위 줄 io26)", to: "6번 줄 → 220Ω → 10번 줄 LED 긴 다리" },
    { color: C.black, part: "LED 짧은 다리 11번 줄", to: "− 줄" },
  ];
  const table = connectionTable(bb.y + bb.h + 16, "이렇게 꽂아요 — 3V3 · GND 는 + − 줄로 나눠 써요", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  const bb = breadboard({ x: 96, y: 8, cols: 22, rails: { top: false, bottom: true } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 30 });
  const parts = [], wires = [], used = [];
  const v33 = b.power("3V3"), gnd = b.power("GND", 0), k39 = b.gpio(39), s36 = b.gpio(36), p26 = b.gpio(26);
  used.push(v33, gnd, k39, s36, p26);
  const rail = (s, c) => bb.rail("bottom", s, c);

  // 3V3(아래 줄) → 보드 왼쪽 바깥 길 → + 줄 1번 칸, GND(위 줄) → − 줄
  const top = b.bounds.y;
  wires.push(mfWire(v33, rail("+", 1), C.red, [{ x: v33.x, y: v33.y + 22 }, { x: 44, y: v33.y + 22 }, { x: 44, y: rail("+", 1).y }], "orth"));
  wires.push(mfWire(gnd, rail("-", 3), C.black));

  // LED (1장과 같은 자리): D26 → 11번 줄 j → 220Ω(h) → 6번 줄 f 긴 다리, 5번 줄 f 짧은 다리 → − 줄
  [11, 6, 5].forEach((c) => bb.tint(c, "bottom"));
  const res = resistor(bb.hole(11, "h"), bb.hole(6, "h"), { label: "220Ω" });
  const ledp = led(bb.hole(6, "f"), bb.hole(5, "f"), "#e03131");
  wires.push(mfWire(p26, bb.hole(11, "j"), C.yellow));
  wires.push(mmWire(bb.hole(5, "j"), rail("-", 5), C.black));

  // 가변저항: 18 · 19 · 20번 줄 (f 칸). 19번(가운데) ← VN(39), 18 → + 줄, 20 → − 줄
  [18, 19, 20].forEach((c) => bb.tint(c, "bottom"));
  const pot = potentiometer(bb.hole(18, "f"), bb.hole(19, "f"), bb.hole(20, "f"));
  wires.push(mfWire(k39, bb.hole(19, "j"), C.green));
  wires.push(mmWire(bb.hole(18, "j"), rail("+", 17), C.red, [], "line"));
  wires.push(mmWire(bb.hole(20, "j"), rail("-", 21), C.black, [], "line"));

  // 소리 센서 모듈: 브레드보드 오른쪽. S → VP(36) F-F, V · G → + − 줄 M-F (오른쪽 끝에서 가로로)
  const snd = sensor3(512, 120, "sound", { titleAt: { x: 550, y: 104 } });
  const plusEnd = rail("+", 22), minusEnd = rail("-", 22);
  wires.push(mfWire(snd.pins.G, minusEnd, C.black, [{ x: snd.pins.G.x, y: minusEnd.y }], "orth"));
  wires.push(mfWire(snd.pins.V, plusEnd, C.red, [{ x: snd.pins.V.x, y: plusEnd.y }], "orth"));
  wires.push(ffWire(snd.pins.S, s36, C.blue, [{ x: snd.pins.S.x, y: top - 8 }, { x: s36.x, y: top - 8 }], "orth"));

  parts.push(bb.svg, res.svg, ledp.svg, pot.svg, snd.svg);
  const rows = [
    { color: C.red, part: "3V3(아래 줄)", to: "+ 줄" }, { color: C.black, part: "GND", to: "− 줄" },
    { color: C.green, part: k39.label, to: "19번 줄 가변저항 가운데 다리" },
    { colors: [C.red, C.black], part: "가변저항 18 · 20번 줄", to: "+ 줄 · − 줄" },
    { color: C.blue, part: "소리 센서 S", to: s36.label },
    { colors: [C.red, C.black], part: "소리 센서 V · G", to: "+ 줄 · − 줄" },
    { color: C.yellow, part: "D26", to: "11번 줄 → 220Ω → 6번 줄 LED 긴 다리" },
    { color: C.black, part: "LED 짧은 다리 5번 줄", to: "− 줄" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — 3V3 · GND 는 + − 줄로 나눠 써요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "박수 스위치와 다이얼 배선도(ESP32 Plus 확장 보드): 브레드보드는 보드 아래. 아래 줄 3V3 → 브레드보드 + 줄, GND → − 줄. 가변저항 다리 셋은 23 · 24 · 25번 줄: 가운데 24번 ← 아래 줄 io39, 23번 → − 줄, 25번 → + 줄. 소리 센서 모듈 S → 아래 줄 io36, V → + 줄, G → − 줄. LED: 위 줄 io26 → 보드 바깥으로 돌아 6번 줄 → 220Ω 저항 → 10번 줄 긴 다리(+), 짧은 다리(−) 11번 줄 → − 줄",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 박수 스위치와 다이얼 배선도: 브레드보드는 보드 위. 3V3 → 보드 바깥으로 돌아 + 줄, GND → − 줄. 가변저항 다리 셋은 18 · 19 · 20번 줄: 가운데 19번 ← VN(39), 18번 → + 줄, 20번 → − 줄. 소리 센서 모듈 S → VP(36), V → + 줄, G → − 줄. LED: D26 → 11번 줄 → 220Ω 저항 → 6번 줄 긴 다리(+), 짧은 다리(−) 5번 줄 → − 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wcd", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wcdk", T.devkit, r.body, r.height); },
  },
};
