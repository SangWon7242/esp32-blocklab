// 센서 S23 "폰에서 보는 센서 값" — DHT11 모듈(G V S) S → 13번, 포토레지스터(맨 부품) + 10kΩ → 34번.
// 포토레지스터: 3V3 — 포토레지스터 — 34번 — 10kΩ — GND (WiFi 를 켜도 읽히는 ADC1 핀 34번).
// Plus: DHT11 은 F-F 3가닥으로 io13 기둥 S · V · G 에 바로 (세 선은 기둥 아래 빈 띠를 지나 보드 오른쪽 모듈로).
//       포토레지스터는 아래 줄 io34 · 3V3 · GND 가 가까운 보드 아래 브레드보드에.
// DevKit: 브레드보드를 보드 위에. 3V3(아래 줄)은 보드 왼쪽 바깥 길로 + 줄에. DHT11 V · G → + − 줄, S → D13.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, module, photoresistor, resistor } from "../parts.mjs";

const TEN_K = ["#8b5a2b", "#212529", "#f76707"]; // 갈 검 주

/** DHT11 모듈 (핀 G V S, 아래쪽). 핀 이름이 가리지 않게 그림을 위쪽에 둔다 */
const dht11 = (x, y, titleAt) =>
  module({
    x, y, w: 76, h: 70, color: "#1971c2", pins: ["G", "V", "S"], side: "bottom", firstPin: 18, title: "DHT11", titleAt,
    decor: (mx, my, w) => `<rect x="${mx + 14}" y="${my + 6}" width="${w - 28}" height="38" rx="4" fill="#e7f5ff" stroke="#74c0fc"/>${[0, 1, 2, 3].map((k) => `<path d="M${mx + 20} ${my + 14 + k * 8} h${w - 40}" stroke="#74c0fc" stroke-width="2"/>`).join("")}`,
  });

/* ───── ESP32 Plus ───── */
function plus() {
  const b = makePlus({ x: 96, y: 60 });
  const bb = breadboard({ x: 96, y: 400, cols: 26, rails: { top: true, bottom: false } });
  const parts = [], wires = [], used = [];
  const v33 = b.power("3V3"), gnd = b.power("GND", 1);
  const s34 = { ...b.pin("bot:io34"), label: "io34" }; // 아래 줄 io34 (ANALOG 묶음 io34 S 와 같은 핀)
  used.push(v33, gnd, s34);
  const rail = (s, c) => bb.rail("top", s, c);

  wires.push(mfWire(v33, rail("+", 13), C.red));
  wires.push(mfWire(gnd, rail("-", 15), C.black, [{ x: gnd.x, y: rail("-", 15).y - 8 }, { x: rail("-", 15).x, y: rail("-", 15).y - 8 }], "orth"));

  // 전압 나누기: + 줄 → 17번 줄, 포토레지스터 17 · 20번 줄(e), 20번 줄 ← 34번, 10kΩ 20~23번 줄(c), 23번 줄 → − 줄
  [17, 20, 23].forEach((c) => bb.tint(c, "top"));
  wires.push(mmWire(bb.hole(17, "a"), rail("+", 19), C.red, [], "line"));
  const ldr = photoresistor(bb.hole(17, "e"), bb.hole(20, "e"), { up: false, lift: 30 });
  const r10k = resistor(bb.hole(20, "c"), bb.hole(23, "c"), { bands: TEN_K, label: "10kΩ" });
  const n = bb.hole(20, "a");
  wires.push(mfWire(s34, n, C.green, [{ x: s34.x, y: n.y - 10 }, { x: n.x, y: n.y - 10 }], "orth"));
  wires.push(mmWire(bb.hole(23, "a"), rail("-", 23), C.black));

  // DHT11: 보드 오른쪽, 핀이 아래로. io13 기둥 S · V · G 에 F-F 로 바로
  const t = b.triple(13);
  const dht = dht11(548, b.bounds.y + 22, { x: 586, y: b.bounds.y + 8 });
  const lane = (k) => b.lane.top + 4 + k * 6;
  const run = (p, pin, color, dx, k) => ffWire(p, pin, color, [{ x: p.x, y: lane(k) }, { x: t.S.x + dx, y: lane(k) }, { x: t.S.x + dx, y: pin.y + 4 }], "orth");
  wires.push(run(dht.pins.S, t.S, C.blue, -4, 2), run(dht.pins.V, t.V, C.red, 0, 1), run(dht.pins.G, t.G, C.black, 4, 0));
  used.push(t.S, t.V, t.G);

  parts.push(bb.svg, ldr.svg, r10k.svg, dht.svg);
  const rows = [
    { colors: [C.black, C.red, C.blue], part: "DHT11 G · V · S", to: "io13 기둥 G · V · S" },
    { colors: [C.red, C.black], part: "3V3 · GND(아래 줄)", to: "+ 줄 · − 줄" },
    { color: C.red, part: "+ 줄", to: "17번 줄 → 포토레지스터 → 20번 줄" },
    { color: C.green, part: "34번(아래 줄 io34)", to: "20번 줄 (포토레지스터와 저항 사이)" },
    { color: C.black, part: "10kΩ 저항 23번 줄", to: "− 줄" },
  ];
  const table = connectionTable(bb.y + bb.h + 16, "이렇게 꽂아요 — DHT11 은 보드에 바로, 포토레지스터는 브레드보드에", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  const bb = breadboard({ x: 96, y: 8, cols: 24, rails: { top: false, bottom: true } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 30 });
  const parts = [], wires = [], used = [];
  const v33 = b.power("3V3"), gnd = b.power("GND", 0), a34 = b.gpio(34), d13 = b.gpio(13);
  used.push(v33, gnd, a34, d13);
  const rail = (s, c) => bb.rail("bottom", s, c);

  wires.push(mfWire(v33, rail("+", 1), C.red, [{ x: v33.x, y: v33.y + 22 }, { x: 44, y: v33.y + 22 }, { x: 44, y: rail("+", 1).y }], "orth"));
  wires.push(mfWire(gnd, rail("-", 3), C.black));

  // 전압 나누기: + 줄 → 14번 줄, 포토레지스터 14 · 17번 줄(f), 17번 줄 ← D34, 10kΩ 17~21번 줄(h), 21번 줄 → − 줄
  [14, 17, 21].forEach((c) => bb.tint(c, "bottom"));
  wires.push(mmWire(bb.hole(14, "j"), rail("+", 15), C.red, [], "line"));
  const ldr = photoresistor(bb.hole(14, "f"), bb.hole(17, "f"));
  const r10k = resistor(bb.hole(17, "h"), bb.hole(21, "h"), { bands: TEN_K, label: "10kΩ" });
  wires.push(mfWire(a34, bb.hole(17, "j"), C.green));
  wires.push(mmWire(bb.hole(21, "j"), rail("-", 21), C.black));

  // DHT11: 브레드보드 오른쪽, 핀이 아래로 (G V S). V · G → + − 줄 오른쪽 끝, S → 보드와 브레드보드 사이 길 → D13
  const dht = dht11(530, 112, { x: 568, y: 96 });
  const plusEnd = rail("+", 23), minusEnd = rail("-", 22);
  wires.push(mfWire(dht.pins.G, minusEnd, C.black, [{ x: dht.pins.G.x, y: minusEnd.y }], "orth"));
  wires.push(mfWire(dht.pins.V, plusEnd, C.red, [{ x: dht.pins.V.x, y: plusEnd.y }], "orth"));
  const gap = b.bounds.y - 12;
  wires.push(ffWire(dht.pins.S, d13, C.blue, [{ x: dht.pins.S.x, y: gap }, { x: d13.x, y: gap }], "orth"));

  parts.push(bb.svg, ldr.svg, r10k.svg, dht.svg);
  const rows = [
    { color: C.red, part: "3V3(아래 줄)", to: "+ 줄" }, { color: C.black, part: "GND", to: "− 줄" },
    { color: C.blue, part: "DHT11 S", to: "D13" },
    { colors: [C.red, C.black], part: "DHT11 V · G", to: "+ 줄 · − 줄" },
    { color: C.red, part: "+ 줄", to: "14번 줄 → 포토레지스터 → 17번 줄" },
    { color: C.green, part: "D34", to: "17번 줄 (포토레지스터와 저항 사이)" },
    { color: C.black, part: "10kΩ 저항 21번 줄", to: "− 줄" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — 3V3 · GND 는 + − 줄로 나눠 써요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "폰에서 보는 센서 값 배선도(ESP32 Plus 확장 보드): DHT11 모듈의 G · V · S 를 보드 위쪽 io13 기둥의 G · V · S 에 F-F 듀폰선 세 가닥으로 바로. 브레드보드는 보드 아래: 아래 줄 3V3 → + 줄, GND → − 줄. + 줄 → 17번 줄 → 포토레지스터 → 20번 줄, 20번 줄 ← 아래 줄 io34, 10kΩ 저항은 20번 줄과 23번 줄 사이, 23번 줄 → − 줄",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 폰에서 보는 센서 값 배선도: 브레드보드는 보드 위. 3V3 → 보드 바깥으로 돌아 + 줄, GND → − 줄. DHT11 모듈 V → + 줄, G → − 줄, S → D13. + 줄 → 14번 줄 → 포토레지스터 → 17번 줄, 17번 줄 ← D34, 10kΩ 저항은 17번 줄과 21번 줄 사이, 21번 줄 → − 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wws", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wwsk", T.devkit, r.body, r.height); },
  },
};
