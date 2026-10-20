// 센서 S11 "밝기 센서" — 포토레지스터(맨 부품) + 10kΩ 저항 전압 나누기 → 34번, LED(26번) + 220Ω.
// 이 챕터 코드는 "어두울수록 값이 커진다"(value > 2500 이면 어둡다)를 기준으로 쓴다.
// 그래서 10kΩ 을 3V3 쪽, 포토레지스터를 GND 쪽에 둔다: 3V3 — 10kΩ — 34번 — 포토레지스터 — GND.
// (어두우면 포토레지스터 저항이 커져 34번 전압이 3.3V 쪽으로 올라간다)
// Plus: 34·3V3·GND 는 아래 줄 → 브레드보드를 보드 아래에. 26번(위 줄)만 보드 왼쪽 바깥 길로.
// DevKit: D34·D26 은 위 줄 → 브레드보드를 보드 위에. 3V3(아래 줄)만 보드 왼쪽 바깥 길로.
import { COLORS as C, compose, connectionTable, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, led, photoresistor, resistor } from "../parts.mjs";

const TEN_K = ["#8b5a2b", "#212529", "#f76707"]; // 갈 검 주

/* ───── ESP32 Plus ───── */
function plus() {
  const b = makePlus({ x: 96, y: 40 });
  const bb = breadboard({ x: 96, y: 380, cols: 26, rails: { top: true, bottom: false } });
  const parts = [], wires = [], used = [];
  const v33 = b.power("3V3"), gnd = b.power("GND", 1), p26 = b.gpio(26);
  // 아래 줄 io34 를 쓴다 (ANALOG 묶음 io34 S 와 같은 핀). b.gpio(34) 는 ANALOG 묶음 S 를 준다
  const s34 = { ...b.pin("bot:io34"), label: "io34" };
  used.push(v33, gnd, s34, p26);
  const rail = (s, c) => bb.rail("top", s, c);

  wires.push(mfWire(v33, rail("+", 13), C.red));
  wires.push(mfWire(gnd, rail("-", 15), C.black, [{ x: gnd.x, y: rail("-", 15).y - 8 }, { x: rail("-", 15).x, y: rail("-", 15).y - 8 }], "orth"));

  // 전압 나누기: + 줄 → 17번 줄, 10kΩ 17~20번 줄(c), 20번 줄 ← 34번, 포토레지스터 20 · 22번 줄(e), 22번 줄 → − 줄
  [17, 20, 22].forEach((c) => bb.tint(c, "top"));
  wires.push(mmWire(bb.hole(17, "a"), rail("+", 19), C.red, [], "line"));
  const r10k = resistor(bb.hole(17, "c"), bb.hole(20, "c"), { bands: TEN_K, label: "10kΩ" });
  const ldr = photoresistor(bb.hole(20, "e"), bb.hole(22, "e"), { up: false, lift: 30 });
  wires.push(mfWire(s34, bb.hole(20, "a"), C.green, [{ x: s34.x, y: bb.hole(20, "a").y - 10 }, { x: bb.hole(20, "a").x, y: bb.hole(20, "a").y - 10 }], "orth"));
  wires.push(mmWire(bb.hole(22, "a"), rail("-", 22), C.black));

  // LED: 26번 → (왼쪽 바깥 길) → 6번 줄 a → 220Ω (6~10번 줄 c) → 10번 줄 e 긴 다리, 11번 줄 e 짧은 다리 → − 줄
  [6, 10, 11].forEach((c) => bb.tint(c, "top"));
  const res = resistor(bb.hole(6, "c"), bb.hole(10, "c"), { label: "220Ω" });
  const ledp = led(bb.hole(10, "e"), bb.hole(11, "e"), "#e03131", { up: false, lift: 32 });
  const sig = bb.hole(6, "a");
  wires.push(mfWire(p26, sig, C.yellow, [{ x: p26.x, y: 22 }, { x: 40, y: 22 }, { x: 40, y: 362 }, { x: sig.x, y: 362 }], "orth"));
  wires.push(mmWire(bb.hole(11, "a"), rail("-", 11), C.black));

  parts.push(bb.svg, r10k.svg, ldr.svg, res.svg, ledp.svg);
  const rows = [
    { colors: [C.red, C.black], part: "3V3 · GND", to: "+ 줄 · − 줄" },
    { color: C.red, part: "+ 줄", to: "17번 줄 → 10kΩ 저항 → 20번 줄" },
    { color: C.green, part: "34번(아래 줄 io34)", to: "20번 줄 (저항과 포토레지스터 사이)" },
    { color: C.black, part: "포토레지스터 22번 줄", to: "− 줄" },
    { color: C.yellow, part: "26번(위 줄 io26)", to: "6번 줄 → 220Ω → 10번 줄 LED 긴 다리" },
    { color: C.black, part: "LED 짧은 다리 11번 줄", to: "− 줄" },
  ];
  const table = connectionTable(bb.y + bb.h + 16, "이렇게 꽂아요 — 포토레지스터는 10kΩ 저항과 함께", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  const bb = breadboard({ x: 96, y: 8, cols: 22, rails: { top: false, bottom: true } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 30 });
  const parts = [], wires = [], used = [];
  const v33 = b.power("3V3"), gnd = b.power("GND", 0), a34 = b.gpio(34), p26 = b.gpio(26);
  used.push(v33, gnd, a34, p26);
  const rail = (s, c) => bb.rail("bottom", s, c);

  wires.push(mfWire(v33, rail("+", 1), C.red, [{ x: v33.x, y: v33.y + 22 }, { x: 44, y: v33.y + 22 }, { x: 44, y: rail("+", 1).y }], "orth"));
  wires.push(mfWire(gnd, rail("-", 3), C.black));

  // LED (1장과 같은 자리): D26 → 11번 줄 j → 220Ω(h) → 6번 줄 f 긴 다리, 5번 줄 f 짧은 다리 → − 줄
  [11, 6, 5].forEach((c) => bb.tint(c, "bottom"));
  const res = resistor(bb.hole(11, "h"), bb.hole(6, "h"), { label: "220Ω" });
  const ledp = led(bb.hole(6, "f"), bb.hole(5, "f"), "#e03131");
  wires.push(mfWire(p26, bb.hole(11, "j"), C.yellow));
  wires.push(mmWire(bb.hole(5, "j"), rail("-", 5), C.black));

  // 전압 나누기: + 줄 → 13번 줄, 10kΩ 13~17번 줄(h), 17번 줄 ← D34, 포토레지스터 17 · 19번 줄(f), 19번 줄 → − 줄
  [13, 17, 19].forEach((c) => bb.tint(c, "bottom"));
  wires.push(mmWire(bb.hole(13, "j"), rail("+", 14), C.red, [], "line"));
  const r10k = resistor(bb.hole(13, "h"), bb.hole(17, "h"), { bands: TEN_K, label: "10kΩ" });
  const ldr = photoresistor(bb.hole(17, "f"), bb.hole(19, "f"));
  wires.push(mfWire(a34, bb.hole(17, "j"), C.green));
  wires.push(mmWire(bb.hole(19, "j"), rail("-", 19), C.black));

  parts.push(bb.svg, res.svg, ledp.svg, r10k.svg, ldr.svg);
  const rows = [
    { color: C.red, part: "3V3(아래 줄)", to: "+ 줄" }, { color: C.black, part: "GND", to: "− 줄" },
    { color: C.red, part: "+ 줄", to: "13번 줄 → 10kΩ 저항 → 17번 줄" },
    { color: C.green, part: "D34", to: "17번 줄 (저항과 포토레지스터 사이)" },
    { color: C.black, part: "포토레지스터 19번 줄", to: "− 줄" },
    { color: C.yellow, part: "D26", to: "11번 줄 → 220Ω → 6번 줄 LED 긴 다리" },
    { color: C.black, part: "LED 짧은 다리 5번 줄", to: "− 줄" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — 포토레지스터는 10kΩ 저항과 함께", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "밝기 센서 배선도(ESP32 Plus 확장 보드): 브레드보드는 보드 아래. 아래 줄 3V3 → 브레드보드 + 줄, GND → − 줄. + 줄 → 17번 줄 → 10kΩ 저항 → 20번 줄, 20번 줄 ← 아래 줄 io34, 포토레지스터는 20번 줄과 22번 줄 사이, 22번 줄 → − 줄. LED: 위 줄 io26 → 보드 바깥으로 돌아 6번 줄 → 220Ω 저항 → 10번 줄 긴 다리(+), 짧은 다리(−) 11번 줄 → − 줄",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 밝기 센서 배선도: 브레드보드는 보드 위. 3V3 → 보드 바깥으로 돌아 + 줄, GND → − 줄. + 줄 → 13번 줄 → 10kΩ 저항 → 17번 줄, 17번 줄 ← D34, 포토레지스터는 17번 줄과 19번 줄 사이, 19번 줄 → − 줄. LED: D26 → 11번 줄 → 220Ω 저항 → 6번 줄 긴 다리(+), 짧은 다리(−) 5번 줄 → − 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wls", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wlsk", T.devkit, r.body, r.height); },
  },
};
