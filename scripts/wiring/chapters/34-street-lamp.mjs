// 융합 F7 "밝기 단계 가로등" — 포토레지스터(맨 부품) + 10kΩ → 36번, LED(26번, PWM) + 220Ω, OLED(I2C 22 · 21).
// 코드는 "어두울수록 값이 커진다"(가렸을 때 3500, 비췄을 때 500)를 기준으로 쓴다(14장과 같다).
// 그래서 3V3 — 10kΩ — 36번 — 포토레지스터 — GND.
// Plus: 36 · 3V3 · GND 는 아래 줄 → 브레드보드를 보드 아래에. 26번(위 줄)만 보드 왼쪽 바깥 길로. OLED 는 I2C 묶음에 바로.
// DevKit: VP(36) · D26 은 위 줄 → 브레드보드를 보드 위에(14장과 같은 꼴). OLED 는 보드 아래, SDA · SCL 은 아래 줄 D21 · D22.
// 확장 보드: SVP(36) · P26 · GND 가 위 줄 → 브레드보드를 보드 위에(LED 는 1장과 같은 자리). + 줄은 전원 헤더 3V(점퍼와 상관없이 3.3V),
//   OLED 는 I2C 헤더(10장과 같은 길). 5V 부품이 없어 점퍼는 평소 자리(3.3V).
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { ledCircuit } from "./01-led.mjs";
import { breadboard, led, oled, photoresistor, resistor } from "../parts.mjs";

const TEN_K = ["#8b5a2b", "#212529", "#f76707"]; // 갈 검 주

/* ───── ESP32 Plus ───── */
function plus() {
  const b = makePlus({ x: 96, y: 40 });
  const bb = breadboard({ x: 96, y: 380, cols: 26, rails: { top: true, bottom: false } });
  const parts = [], wires = [], used = [];
  const v33 = b.power("3V3"), gnd = b.power("GND", 1), p26 = b.gpio(26), s36 = b.gpio(36);
  used.push(v33, gnd, s36, p26);
  const rail = (s, c) => bb.rail("top", s, c);
  const over = (from, to) => [{ x: from.x, y: to.y - 10 }, { x: to.x, y: to.y - 10 }];

  wires.push(mfWire(v33, rail("+", 13), C.red));
  wires.push(mfWire(gnd, rail("-", 16), C.black, over(gnd, rail("-", 16)), "orth"));

  // 전압 나누기: + 줄 → 20번 줄, 10kΩ 20~23번 줄(c), 23번 줄 ← io36, 포토레지스터 23 · 25번 줄(e), 25번 줄 → − 줄
  [20, 23, 25].forEach((c) => bb.tint(c, "top"));
  wires.push(mmWire(bb.hole(20, "a"), rail("+", 21), C.red, [], "line"));
  const r10k = resistor(bb.hole(20, "c"), bb.hole(23, "c"), { bands: TEN_K, label: "10kΩ" });
  const ldr = photoresistor(bb.hole(23, "e"), bb.hole(25, "e"), { up: false, lift: 30 });
  wires.push(mfWire(s36, bb.hole(23, "a"), C.green, over(s36, bb.hole(23, "a")), "orth"));
  wires.push(mmWire(bb.hole(25, "a"), rail("-", 25), C.black));

  // LED: io26 → (왼쪽 바깥 길) → 6번 줄 a → 220Ω (6~10번 줄 c) → 10번 줄 e 긴 다리, 11번 줄 e 짧은 다리 → − 줄
  [6, 10, 11].forEach((c) => bb.tint(c, "top"));
  const res = resistor(bb.hole(6, "c"), bb.hole(10, "c"), { label: "220Ω" });
  const ledp = led(bb.hole(10, "e"), bb.hole(11, "e"), "#e03131", { up: false, lift: 32 });
  const sig = bb.hole(6, "a");
  wires.push(mfWire(p26, sig, C.yellow, [{ x: p26.x, y: 22 }, { x: 40, y: 22 }, { x: 40, y: 362 }, { x: sig.x, y: 362 }], "orth"));
  wires.push(mmWire(bb.hole(11, "a"), rail("-", 11), C.black));

  // OLED: 보드 오른쪽 → 빈 띠 → I2C 묶음 첫 줄 (10장과 같은 꼴)
  const o = oled(528, b.lane.bottom + 18, { titleAt: { x: 582, y: b.lane.bottom + 148 } });
  const bus = b.i2c(0);
  const lane = { GND: b.lane.top + 3, VCC: b.lane.top + 8, SDA: b.lane.top + 13, SCL: b.lane.top + 18 };
  const via = (k) => [{ x: o.pins[k].x, y: lane[k] }, { x: bus[k].x, y: lane[k] }];
  wires.push(ffWire(o.pins.GND, bus.GND, C.black, via("GND"), "orth"), ffWire(o.pins.VCC, bus.VCC, C.red, via("VCC"), "orth"), ffWire(o.pins.SDA, bus.SDA, C.blue, via("SDA"), "orth"), ffWire(o.pins.SCL, bus.SCL, C.purple, via("SCL"), "orth"));
  used.push(bus.GND, bus.VCC, bus.SDA, bus.SCL);

  parts.push(o.svg, bb.svg, r10k.svg, ldr.svg, res.svg, ledp.svg);
  const rows = [
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C GND · 5V (보드에 바로)" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C SDA · SCL (보드에 바로)" },
    { colors: [C.red, C.black], part: "3V3 · GND (아래 줄)", to: "+ 줄 · − 줄" },
    { color: C.red, part: "+ 줄", to: "20번 줄 → 10kΩ 저항 → 23번 줄" },
    { color: C.green, part: "io36 (아래 줄)", to: "23번 줄 (저항과 포토레지스터 사이)" },
    { color: C.black, part: "포토레지스터 25번 줄", to: "− 줄" },
    { color: C.yellow, part: "io26 (위 줄)", to: "6번 줄 → 220Ω → 10번 줄 LED 긴 다리" },
    { color: C.black, part: "LED 짧은 다리 11번 줄", to: "− 줄" },
  ];
  const table = connectionTable(bb.y + bb.h + 16, "이렇게 꽂아요 — OLED 는 보드에 바로, 나머지는 브레드보드에", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit 38핀) ───── */
function devkit() {
  const bb = breadboard({ x: 96, y: 8, cols: 23, rails: { top: false, bottom: true } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 30 });
  const parts = [], wires = [], used = [];
  const v33 = b.power("3V3"), gnd = b.power("GND", 0), vp = b.gpio(36), p26 = b.gpio(26);
  used.push(v33, gnd, vp, p26);
  const rail = (s, c) => bb.rail("bottom", s, c);
  const bot = b.bounds.y + b.bounds.h;

  wires.push(mfWire(v33, rail("+", 1), C.red, [{ x: v33.x, y: bot + 12 }, { x: 44, y: bot + 12 }, { x: 44, y: rail("+", 1).y }], "orth"));
  wires.push(mfWire(gnd, rail("-", 3), C.black));

  // LED (1장과 같은 자리): D26 → 11번 줄 j → 220Ω(h) → 6번 줄 f 긴 다리, 5번 줄 f 짧은 다리 → − 줄
  [11, 6, 5].forEach((c) => bb.tint(c, "bottom"));
  const res = resistor(bb.hole(11, "h"), bb.hole(6, "h"), { label: "220Ω" });
  const ledp = led(bb.hole(6, "f"), bb.hole(5, "f"), "#e03131");
  wires.push(mfWire(p26, bb.hole(11, "j"), C.yellow));
  wires.push(mmWire(bb.hole(5, "j"), rail("-", 5), C.black));

  // 전압 나누기: + 줄 → 16번 줄, 10kΩ 16~20번 줄(h), 20번 줄 ← VP(36), 포토레지스터 20 · 22번 줄(f), 22번 줄 → − 줄
  [16, 20, 22].forEach((c) => bb.tint(c, "bottom"));
  wires.push(mmWire(bb.hole(16, "j"), rail("+", 16), C.red, [], "line"));
  const r10k = resistor(bb.hole(16, "h"), bb.hole(20, "h"), { bands: TEN_K, label: "10kΩ" });
  const ldr = photoresistor(bb.hole(20, "f"), bb.hole(22, "f"));
  wires.push(mfWire(vp, bb.hole(20, "j"), C.green));
  wires.push(mmWire(bb.hole(22, "j"), rail("-", 22), C.black));

  // OLED: 보드 아래(핀이 위로). SDA → D21 · SCL → D22(아래 줄), GND → 아래 줄 GND, VCC → VIN(보드 바깥 길)
  const o = oled(330, bot + 76, { titleAt: { x: 384, y: bot + 206 } });
  const sda = b.gpio(21), scl = b.gpio(22), gBot = b.power("GND", 1), vin = b.power("5V");
  wires.push(ffWire(o.pins.SDA, sda, C.blue, [{ x: o.pins.SDA.x, y: bot + 50 }, { x: sda.x, y: bot + 50 }], "orth"));
  wires.push(ffWire(o.pins.SCL, scl, C.purple, [{ x: o.pins.SCL.x, y: bot + 42 }, { x: scl.x, y: bot + 42 }], "orth"));
  wires.push(ffWire(o.pins.GND, gBot, C.black, [{ x: o.pins.GND.x, y: bot + 28 }, { x: gBot.x, y: bot + 28 }], "orth"));
  wires.push(ffWire(o.pins.VCC, vin, C.red, [{ x: o.pins.VCC.x, y: bot + 36 }, { x: 28, y: bot + 36 }, { x: 28, y: b.bounds.y - 10 }, { x: vin.x, y: b.bounds.y - 10 }], "orth"));
  used.push(sda, scl, gBot, vin);

  parts.push(bb.svg, res.svg, ledp.svg, r10k.svg, ldr.svg, o.svg);
  const rows = [
    { color: C.red, part: "3V3 (위 줄 끝)", to: "+ 줄" }, { color: C.black, part: "GND (위 줄)", to: "− 줄" },
    { color: C.red, part: "+ 줄", to: "16번 줄 → 10kΩ 저항 → 20번 줄" },
    { color: C.green, part: "VP(36)", to: "20번 줄 (저항과 포토레지스터 사이)" },
    { color: C.black, part: "포토레지스터 22번 줄", to: "− 줄" },
    { color: C.yellow, part: "D26", to: "11번 줄 → 220Ω → 6번 줄 LED 긴 다리" },
    { color: C.black, part: "LED 짧은 다리 5번 줄", to: "− 줄" },
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "GND (아래 줄) · VIN (보드에 바로)" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "D21 · D22 (보드에 바로)" },
  ];
  const table = connectionTable(o.pins.GND.y + 150, "이렇게 꽂아요 — OLED 는 보드에 바로, 나머지는 브레드보드에", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 확장 보드(38핀 확장 보드 + DevKit): 점퍼 3.3V ───── */
function expansion() {
  const bb = breadboard({ x: 100, y: 8, cols: 26, rails: { top: false, bottom: true } });
  const b = makeExpansion({ x: 22, y: bb.y + bb.h + 36, jumper: "3V3" });
  const Y0 = b.bounds.y;
  const parts = [bb.svg], wires = [], used = [];
  const rail = (s, c) => bb.rail("bottom", s, c);

  // 전원: 전원 헤더 3V → 헤더 GND 핀 사이 틈으로 올라가 + 줄 2번 칸, 위 줄 GND 칸 S → − 줄 13번 칸
  const v33 = b.power("3V3", 1), gnd = b.power("GND");
  const p2 = rail("+", 2);
  wires.push(mfWire(v33, p2, C.red, [{ x: p2.x, y: v33.y }], "orth"));
  wires.push(mfWire(gnd, rail("-", 13), C.black));
  used.push(v33, gnd);

  // LED (1장과 같은 자리): P26 → 18번 줄 j → 220Ω → 13번 줄 긴 다리, 12번 줄 짧은 다리 → − 줄
  const p26 = b.gpio(26);
  const circ = ledCircuit(bb, 18);
  parts.push(...circ.svg);
  wires.push(mfWire(p26, circ.signalHole, C.yellow), circ.jumper);
  used.push(p26);

  // 전압 나누기: + 줄 → 21번 줄 → 10kΩ → 24번 줄(← SVP(36)) → 포토레지스터 → 26번 줄 → − 줄
  [21, 24, 26].forEach((c) => bb.tint(c, "bottom"));
  wires.push(mmWire(bb.hole(21, "j"), rail("+", 21), C.red, [], "line"));
  parts.push(resistor(bb.hole(21, "h"), bb.hole(24, "h"), { bands: TEN_K, label: "10kΩ" }).svg, photoresistor(bb.hole(24, "f"), bb.hole(26, "f")).svg);
  const s36 = b.gpio(36), hB = bb.hole(24, "j");
  const laneY = bb.y + bb.h + 14;
  wires.push(mfWire(s36, hB, C.green, [{ x: s36.x, y: laneY }, { x: hB.x, y: laneY }], "orth"));
  wires.push(mmWire(bb.hole(26, "j"), rail("-", 26), C.black));
  used.push(s36);

  // OLED: I2C 헤더 안쪽 줄. 선은 바깥 줄(UART) 핀 사이 틈으로 올라가 옆에서 꽂는다 (10장과 같은 길)
  const bus = b.i2c(0);
  const o = oled(110, Y0 + 388, { titleAt: { x: 98, y: Y0 + 444, anchor: "end" } });
  parts.push(o.svg);
  const lanes = { GND: Y0 + 362, VCC: Y0 + 354, SDA: Y0 + 338, SCL: Y0 + 346 };
  const oc = { GND: C.black, VCC: C.red, SDA: C.blue, SCL: C.purple };
  for (const k of ["GND", "VCC", "SDA", "SCL"]) {
    const p = bus[k], from = o.pins[k], seam = p.x - 9.9;
    wires.push(ffWire(from, p, oc[k], [{ x: from.x, y: lanes[k] }, { x: seam, y: lanes[k] }, { x: seam, y: p.y }], "orth"));
    used.push(p);
  }

  const rows = [
    { color: C.red, part: "전원 헤더 3V", to: "+ 줄 (헤더 GND 핀 사이로)" }, { color: C.black, part: "위 줄 GND 칸 S", to: "− 줄" },
    { color: C.red, part: "+ 줄", to: "21번 줄 → 10kΩ 저항 → 24번 줄" },
    { color: C.green, part: "SVP(36) 칸 S", to: "24번 줄 (저항과 포토레지스터 사이)" },
    { color: C.black, part: "포토레지스터 26번 줄", to: "− 줄" },
    { color: C.yellow, part: "P26 칸 S", to: `${circ.cols.sig}번 줄 → 220Ω → ${circ.cols.anode}번 줄 LED 긴 다리` },
    { color: C.black, part: `LED 짧은 다리 ${circ.cols.cathode}번 줄`, to: "− 줄" },
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C 헤더 GND · VCC (보드에 바로)" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C 헤더 D21 · D22 (보드에 바로)" },
  ];
  const table = connectionTable(Y0 + 512, "이렇게 꽂아요 — OLED 는 보드에 바로, 나머지는 브레드보드에", rows, b.legend);
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "밝기 단계 가로등 배선도(ESP32 Plus 확장 보드): 브레드보드는 보드 아래. 아래 줄 3V3 → 브레드보드 + 줄, 아래 줄 GND → − 줄. + 줄 → 20번 줄 → 10kΩ 저항 → 23번 줄, 23번 줄 ← 아래 줄 io36, 포토레지스터는 23번 줄과 25번 줄 사이, 25번 줄 → − 줄. LED: 위 줄 io26 → 보드 바깥으로 돌아 6번 줄 → 220Ω 저항 → 10번 줄 긴 다리(+), 짧은 다리(−) 11번 줄 → − 줄. OLED 화면 GND · VCC · SDA · SCL 은 보드 I2C 묶음 첫 줄의 GND · 5V · SDA · SCL 에 F-F 듀폰선으로 바로",
  expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) 밝기 단계 가로등 배선도: JUMP 점퍼는 3.3V 쪽(평소 자리). 브레드보드는 보드 위. 전원 헤더 3V → 헤더 GND 핀 사이로 올라가 + 줄, 위 줄 GND 칸 S 핀 → − 줄. + 줄 → 21번 줄 → 10kΩ 저항 → 24번 줄, 24번 줄 ← SVP(36) 칸 S 핀, 포토레지스터는 24번 줄과 26번 줄 사이, 26번 줄 → − 줄. LED: P26 칸 S 핀 → 18번 줄 → 220Ω 저항 → 13번 줄 긴 다리(+), 짧은 다리(−) 12번 줄 → − 줄. OLED 화면 GND · VCC · SDA · SCL 은 I2C 헤더의 GND · VCC · D21 · D22 에 F-F 듀폰선으로 바로",
  devkit: "기본 보드(ESP32 DevKit 38핀) 밝기 단계 가로등 배선도: 브레드보드는 보드 위. 3V3 → 보드 바깥으로 돌아 + 줄, 위 줄 GND → − 줄. + 줄 → 16번 줄 → 10kΩ 저항 → 20번 줄, 20번 줄 ← VP(36), 포토레지스터는 20번 줄과 22번 줄 사이, 22번 줄 → − 줄. LED: D26 → 11번 줄 → 220Ω 저항 → 6번 줄 긴 다리(+), 짧은 다리(−) 5번 줄 → − 줄. OLED 화면은 보드 아래: SDA → D21, SCL → D22, GND → 아래 줄 GND, VCC → 보드 바깥으로 돌아 VIN 에 F-F 듀폰선으로 바로",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wsl", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wslk", T.devkit, r.body, r.height); },
    expansion: () => { const r = expansion(); return svgDoc("wslx", T.expansion, r.body, r.height); },
  },
};
