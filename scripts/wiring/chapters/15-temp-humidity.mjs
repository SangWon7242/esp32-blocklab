// 센서 S12 "온습도 센서" — DHT11 모듈(G V S) S → 13번, LED(26번) + 220Ω (1장과 같은 자리).
// Plus: DHT11 은 F-F 3가닥으로 io13 기둥의 S · V · G 에 바로. 세 선은 기둥 아래로 나와 위 G 줄과 ESP32 사이 빈 띠를 지나 보드 오른쪽 모듈로.
// DevKit: DHT11 은 보드 아래(핀이 위로, 그래서 왼→오 S V G): V → 3V3, G → GND(아래 줄) 바로, S → 보드 왼쪽 바깥 길로 D13.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, led, module, resistor } from "../parts.mjs";

/**
 * DHT11 모듈 (핀 G V S). parts.sensor3("dht") 와 같은 모양이지만 핀 이름이 그림에 가리지 않게 그림을 핀 반대쪽에 둔다.
 * side "top" 은 모듈을 돌려 놓은 것이라 핀 순서도 왼→오 S V G 로 준다.
 */
function dht11(x, y, { side = "bottom", pins = ["G", "V", "S"], titleAt } = {}) {
  return module({
    x, y, w: 76, h: 70, color: "#1971c2", pins, side, firstPin: 18, title: "DHT11", titleAt,
    decor: (mx, my, w) => {
      const ry = side === "top" ? my + 24 : my + 6;
      return `<rect x="${mx + 14}" y="${ry}" width="${w - 28}" height="38" rx="4" fill="#e7f5ff" stroke="#74c0fc"/>${[0, 1, 2, 3].map((k) => `<path d="M${mx + 20} ${ry + 8 + k * 8} h${w - 40}" stroke="#74c0fc" stroke-width="2"/>`).join("")}`;
    },
  });
}

/** 1장 LED 회로: 26번 → (k, j) → 220Ω (k, h)~(k-5, h) → LED 긴 다리 (k-5, f), 짧은 다리 (k-6, f) → (k-6, j) → − 줄 */
function ledCircuit(bb, k) {
  [k, k - 5, k - 6].forEach((col) => bb.tint(col, "bottom"));
  const svg = [resistor(bb.hole(k, "h"), bb.hole(k - 5, "h"), { label: "220Ω" }).svg, led(bb.hole(k - 5, "f"), bb.hole(k - 6, "f"), "#e03131").svg];
  return { svg, jumper: mmWire(bb.hole(k - 6, "j"), bb.rail("bottom", "-", k - 6), C.black), signalHole: bb.hole(k, "j") };
}

/* ───── ESP32 Plus ───── */
function plus() {
  const bb = breadboard({ x: 96, y: 8, cols: 26, rails: { top: false, bottom: true } });
  const b = makePlus({ x: 96, y: bb.y + bb.h + 24 });
  const parts = [], wires = [], used = [];
  const circ = ledCircuit(bb, 22);
  const p26 = b.gpio(26), gnd = b.power("GND");
  wires.push(mfWire(p26, circ.signalHole, C.yellow), mfWire(gnd, bb.rail("bottom", "-", bb.nearestCol(gnd.x, true)), C.black), circ.jumper);
  used.push(p26, gnd);

  // DHT11: 보드 오른쪽, 핀이 아래로 (왼→오 G V S). io13 기둥 S · V · G 에 F-F 로 바로
  const t = b.triple(13);
  const dht = dht11(548, b.bounds.y + 22, { titleAt: { x: 586, y: b.bounds.y + 8 } });
  const lane = (k) => b.lane.top + 4 + k * 6; // 빈 띠 안 세 줄
  // 그리는 순서 S → V → G: 아래 핀의 선 머리가 위 핀에서 내려온 선을 덮어, 세 선이 기둥 아래로 묶여 나가 보인다
  const run = (p, pin, color, dx, k) => ffWire(p, pin, color, [{ x: p.x, y: lane(k) }, { x: t.S.x + dx, y: lane(k) }, { x: t.S.x + dx, y: pin.y + 4 }], "orth");
  wires.push(run(dht.pins.S, t.S, C.blue, -4, 2), run(dht.pins.V, t.V, C.red, 0, 1), run(dht.pins.G, t.G, C.black, 4, 0));
  used.push(t.S, t.V, t.G);

  parts.push(bb.svg, ...circ.svg, dht.svg);
  const rows = [
    { colors: [C.black, C.red, C.blue], part: "DHT11 G · V · S", to: "io13 기둥 G · V · S" },
    { color: C.yellow, part: "io26 핀", to: "22번 줄 → 220Ω 저항 → 17번 줄 LED 긴 다리(+)" },
    { color: C.black, part: "LED 짧은 다리(−) 16번 줄", to: "− 줄 → GND" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — DHT11 은 보드에 바로, LED 는 브레드보드에", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  const bb = breadboard({ x: 96, y: 8, cols: 26, rails: { top: false, bottom: true } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 24 });
  const parts = [], wires = [], used = [];
  const circ = ledCircuit(bb, 11);
  const p26 = b.gpio(26), gndTop = b.power("GND", 0);
  wires.push(mfWire(p26, circ.signalHole, C.yellow), mfWire(gndTop, bb.rail("bottom", "-", bb.nearestCol(gndTop.x, true)), C.black), circ.jumper);
  used.push(p26, gndTop);

  // DHT11: 보드 아래, 핀이 위로 (돌려 놓아 왼→오 S V G). V → 3V3, G → GND 바로, S → 왼쪽 바깥 길 → D13
  const v33 = b.power("3V3"), gndBot = b.power("GND", 1), d13 = b.gpio(13);
  const dht = dht11(v33.x - 38, b.bounds.y + b.bounds.h + 34, { side: "top", pins: ["S", "V", "G"], titleAt: { x: v33.x + 60, y: b.bounds.y + b.bounds.h + 70, anchor: "start" } });
  wires.push(ffWire(dht.pins.V, v33, C.red), ffWire(dht.pins.G, gndBot, C.black));
  const top = b.bounds.y;
  wires.push(ffWire(dht.pins.S, d13, C.blue, [{ x: dht.pins.S.x, y: dht.pins.S.y - 10 }, { x: 44, y: dht.pins.S.y - 10 }, { x: 44, y: top - 10 }, { x: d13.x, y: top - 10 }], "orth"));
  used.push(v33, gndBot, d13);

  parts.push(bb.svg, ...circ.svg, dht.svg);
  const rows = [
    { color: C.blue, part: "DHT11 S", to: "D13 (보드 바깥으로 돌아 위 줄)" },
    { colors: [C.red, C.black], part: "DHT11 V · G", to: "3V3 · GND (아래 줄)" },
    { color: C.yellow, part: "D26 핀", to: "11번 줄 → 220Ω 저항 → 6번 줄 LED 긴 다리(+)" },
    { color: C.black, part: "LED 짧은 다리(−) 5번 줄", to: "− 줄 → GND" },
  ];
  const table = connectionTable(dht.pins.S.y + 70 + 26, "이렇게 꽂아요 — DHT11 은 보드에 바로, LED 는 브레드보드에", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "온습도 센서 배선도(ESP32 Plus 확장 보드): DHT11 모듈의 G · V · S 를 보드 위쪽 io13 기둥의 G · V · S 에 F-F 듀폰선 세 가닥으로 바로. LED 는 1장과 같은 자리: 보드 위쪽 io26 → 브레드보드 22번 줄 → 220Ω 저항 → 17번 줄 긴 다리(+), 짧은 다리(−) 16번 줄 → − 줄 → 보드 GND",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 온습도 센서 배선도: DHT11 모듈 V → 3V3, G → GND(아래 줄), S → 보드 바깥으로 돌아 D13 에 F-F 듀폰선으로 바로. LED 는 1장과 같은 자리: D26 → 브레드보드 11번 줄 → 220Ω 저항 → 6번 줄 긴 다리(+), 짧은 다리(−) 5번 줄 → − 줄 → 보드 GND",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wth", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wthk", T.devkit, r.body, r.height); },
  },
};
