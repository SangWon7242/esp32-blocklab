// 센서 S23 "폰에서 보는 센서 값" — DHT11 모듈(G V S) S → 13번, 포토레지스터(맨 부품) + 10kΩ → 34번.
// 포토레지스터: 3V3 — 포토레지스터 — 34번 — 10kΩ — GND (WiFi 를 켜도 읽히는 ADC1 핀 34번).
// Plus: DHT11 은 F-F 3가닥으로 io13 기둥 S · V · G 에 바로 (세 선은 기둥 아래 빈 띠를 지나 보드 오른쪽 모듈로).
//       포토레지스터는 아래 줄 io34 · 3V3 · GND 가 가까운 보드 아래 브레드보드에.
// DevKit: 브레드보드를 보드 위에. 3V3(아래 줄)은 보드 왼쪽 바깥 길로 + 줄에. DHT11 V · G → + − 줄, S → D13.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, svgDoc, wire } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { breadboard, module, photoresistor, resistor } from "../parts.mjs";

const TEN_K = ["#8b5a2b", "#212529", "#f76707"]; // 갈 검 주

/** DHT11 모듈 (핀 G V S, 아래쪽). 핀 이름이 가리지 않게 그림을 위쪽에 둔다 */
const dht11 = (x, y, titleAt) =>
  module({
    kind: "dht",
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

/* ───── 기본 보드(DevKit 38핀) ───── */
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
    { color: C.red, part: "3V3(위 줄 끝)", to: "+ 줄" }, { color: C.black, part: "GND", to: "− 줄" },
    { color: C.blue, part: "DHT11 S", to: "D13" },
    { colors: [C.red, C.black], part: "DHT11 V · G", to: "+ 줄 · − 줄" },
    { color: C.red, part: "+ 줄", to: "14번 줄 → 포토레지스터 → 17번 줄" },
    { color: C.green, part: "D34", to: "17번 줄 (포토레지스터와 저항 사이)" },
    { color: C.black, part: "10kΩ 저항 21번 줄", to: "− 줄" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — 3V3 · GND 는 + − 줄로 나눠 써요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/**
 * 확장 보드 S · V · G 기둥 한 칸에 선을 꽂는 길: from 에서 세로로 lane 까지, 가로로 x 까지, 다시 세로로 핀에.
 * G → V → S 차례로 그리면 바깥 핀(S)의 선 머리가 안쪽 핀으로 가는 선을 덮어, 세 선이 기둥에 묶여 꽂힌 모습이 된다.
 */
const columnRun = (from, pin, color, { lane, x }) => wire(from, pin, color, { via: [{ x: from.x, y: lane }, { x, y: lane }, { x, y: pin.y }], style: "orth", ends: ["f", "f"] });

/* ───── 확장 보드(38핀 확장 보드 + DevKit): 점퍼 3.3V (DHT11 이 P13 칸 V 줄을 쓴다) ─────
 * 브레드보드는 보드 위, 34번 줄(P34 칸 S 핀)이 18번 열(+ − 줄에 구멍이 없는 열) 바로 위에 오게.
 * 포토레지스터 전압 나누기의 3.3V 는 전원 헤더 3V(GND 핀 사이 틈으로 올라감), GND 는 전원 헤더 GND — 둘 다 보드 왼쪽에서 올라가 + − 줄 왼쪽 끝으로.
 * DHT11 은 P13 칸 오른쪽 위에 두고 세 선이 왼쪽으로 꺾여 P13 칸 G · V · S 에 (3V3 · GND 선과 엇갈리지 않게).
 */
function expansion() {
  const bb = breadboard({ x: 199.2, y: 44, cols: 23, rails: { top: false, bottom: true } });
  const b = makeExpansion({ x: 22, y: 452, jumper: "3V3" });
  const parts = [], wires = [], used = [];
  const rail = (s, c) => bb.rail("bottom", s, c);
  const top = b.bounds.y;

  // 전압 나누기: + 줄 → 14번 줄, 포토레지스터 14 · 18번 줄(f), 18번 줄 ← P34, 10kΩ 18~22번 줄(h), 22번 줄 → − 줄
  // (+ 줄 점퍼는 왼쪽 13번 칸으로 비스듬히 — 아래 번호 글자 15 를 가리지 않게)
  const k = { p: 14, s: 18, t: 22 };
  [k.p, k.s, k.t].forEach((c) => bb.tint(c, "bottom"));
  wires.push(mmWire(bb.hole(k.p, "j"), rail("+", k.p - 1), C.red, [], "line"));
  const ldr = photoresistor(bb.hole(k.p, "f"), bb.hole(k.s, "f"));
  const r10k = resistor(bb.hole(k.s, "h"), bb.hole(k.t, "h"), { bands: TEN_K, label: "10kΩ" });
  wires.push(mmWire(bb.hole(k.t, "j"), rail("-", k.t), C.black));
  const p34 = b.gpio(34);
  wires.push(mfWire(p34, bb.hole(k.s, "j"), C.green));

  // 3V3 · GND: 전원 헤더에서 올라가 + − 줄 왼쪽 끝 (3V3 는 GND 핀 사이 틈으로, GND 길이 3V3 길보다 아래)
  const v33 = b.power("3V3", 0), gnd = b.power("GND", 5);
  const seam = v33.x + 10, plus1 = rail("+", 1), minus2 = rail("-", 2);
  wires.push(mfWire(v33, plus1, C.red, [{ x: seam, y: v33.y }, { x: seam, y: bb.y + bb.h + 26 }, { x: plus1.x, y: bb.y + bb.h + 26 }], "orth"));
  wires.push(mfWire(gnd, minus2, C.black, [{ x: gnd.x, y: bb.y + bb.h + 36 }, { x: minus2.x, y: bb.y + bb.h + 36 }], "orth"));
  used.push(p34, v33, gnd);

  // DHT11: P13 칸 오른쪽 위, 핀이 아래로 (G V S). 왼쪽 핀(G)일수록 높은 길로 꺾어 P13 칸으로
  const t = b.triple(13);
  const dht = dht11(340, bb.y + bb.h + 26, { x: 378, y: bb.y + bb.h + 12 });
  wires.push(
    columnRun(dht.pins.G, t.G, C.black, { lane: top - 24, x: t.G.x - 4 }),
    columnRun(dht.pins.V, t.V, C.red, { lane: top - 16, x: t.V.x }),
    columnRun(dht.pins.S, t.S, C.blue, { lane: top - 8, x: t.S.x + 4 }),
  );
  used.push(t.S, t.V, t.G);

  parts.push(bb.svg, ldr.svg, r10k.svg, dht.svg);
  const rows = [
    { colors: [C.black, C.red, C.blue], part: "DHT11 G · V · S", to: "위 줄 P13 칸 G · V · S" },
    { colors: [C.red, C.black], part: "전원 헤더 3V · GND", to: "+ 줄 · − 줄" },
    { color: C.red, part: "+ 줄", to: `${k.p}번 줄 → 포토레지스터 → ${k.s}번 줄` },
    { color: C.green, part: "P34 칸 S 핀", to: `${k.s}번 줄 (포토레지스터와 저항 사이)` },
    { color: C.black, part: `10kΩ 저항 ${k.t}번 줄`, to: "− 줄" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 12, "이렇게 꽂아요 — DHT11 은 보드에 바로, 포토레지스터는 브레드보드에", rows, b.legend);
  const title = `확장 보드(ESP32 38핀 확장 보드 + DevKit) 폰에서 보는 센서 값 배선도: DHT11 모듈의 G · V · S 를 위 줄 P13 칸의 G · V · S 핀에 F-F 듀폰선 세 가닥으로 바로. 브레드보드는 보드 위: 전원 헤더 3V → + 줄, 전원 헤더 GND → − 줄. + 줄 → ${k.p}번 줄 → 포토레지스터 → ${k.s}번 줄, ${k.s}번 줄 ← 위 줄 P34 칸 S 핀, 10kΩ 저항은 ${k.s}번 줄과 ${k.t}번 줄 사이, ${k.t}번 줄 → − 줄. JUMP 점퍼는 3.3V 쪽`;
  return svgDoc("wwsx", title, compose(b.draw(used), parts, wires, [table.svg]), table.bottom);
}

const T = {
  plus: "폰에서 보는 센서 값 배선도(ESP32 Plus 확장 보드): DHT11 모듈의 G · V · S 를 보드 위쪽 io13 기둥의 G · V · S 에 F-F 듀폰선 세 가닥으로 바로. 브레드보드는 보드 아래: 아래 줄 3V3 → + 줄, GND → − 줄. + 줄 → 17번 줄 → 포토레지스터 → 20번 줄, 20번 줄 ← 아래 줄 io34, 10kΩ 저항은 20번 줄과 23번 줄 사이, 23번 줄 → − 줄",
  devkit: "기본 보드(ESP32 DevKit 38핀) 폰에서 보는 센서 값 배선도: 브레드보드는 보드 위. 3V3 → 보드 바깥으로 돌아 + 줄, GND → − 줄. DHT11 모듈 V → + 줄, G → − 줄, S → D13. + 줄 → 14번 줄 → 포토레지스터 → 17번 줄, 17번 줄 ← D34, 10kΩ 저항은 17번 줄과 21번 줄 사이, 21번 줄 → − 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wws", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wwsk", T.devkit, r.body, r.height); },
    expansion,
  },
};
