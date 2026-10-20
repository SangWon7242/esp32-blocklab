// 융합 F6 "교실 온습도 알리미" — DHT11 모듈(S → 4번), OLED(I2C 22 · 21), RGB LED(공통 음극, 빨강 27 · 초록 25 · 파랑 26, 220Ω 셋),
// 130 모터(팬) 모듈(IN+ 13 · IN− 12).
// Plus: 모듈은 모두 보드에 바로 — 팬은 위 한 줄 5V · GND · io13 · io12(7장과 같음), OLED 는 보드 가운데 빈 틈(io12 와 io14 사이)으로
//       선을 내려 I2C 묶음 첫 줄에, DHT11 은 ANALOG 묶음 io4 줄 G · V · S 에(세 선을 나란히 — 서보 플러그처럼).
//       RGB LED 만 보드 위 브레드보드, − 줄은 보드 오른쪽 바깥으로 돌아 아래 줄 GND.
// DevKit: 팬은 VIN · GND · D13 · D12 에 바로(7장과 같음). RGB LED 는 보드 위 브레드보드.
//       보드 아래 + − 줄 띠(3V3 · GND)를 DHT11 · OLED · RGB LED 가 나눠 쓴다(RGB 의 − 줄은 보드 바깥으로 돌아 띠의 − 줄).
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, note, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, fan, module, oled, resistor, rgbLed, sensor3 } from "../parts.mjs";

/** + − 줄에서 구멍이 있는 열 (6·12·18… 은 비어 있어 옆 열로) */
const railHole = (c) => ((c - 1) % 6 === 5 ? c - 1 : c);

/** RGB LED: 다리 (r,d) (r+2,d) (r+4,d) (r+6,d) = 빨강 · − · 초록 · 파랑. 빨강 · 초록 · 파랑 줄은 220Ω 이 홈을 건너 (x, j) 에서 신호를 받는다 (23장과 같은 꼴) */
function rgbCircuit(bb, r) {
  const cols = { R: r, K: r + 2, G: r + 4, B: r + 6 };
  const svg = [];
  for (const c of [cols.R, cols.G, cols.B]) {
    bb.tint(c, "top");
    bb.tint(c, "bottom");
    svg.push(resistor(bb.hole(c, "e"), bb.hole(c, "h")).svg);
  }
  bb.tint(cols.K, "top");
  svg.push(rgbLed([cols.R, cols.K, cols.G, cols.B].map((c) => bb.hole(c, "d")), { lift: 30 }).svg);
  const jumper = mmWire(bb.hole(cols.K, "a"), bb.rail("top", "-", railHole(cols.K)), C.black);
  return { svg, jumper, cols, sig: (c) => bb.hole(c, "j") };
}

/** DHT11 핀이 위로 (모듈을 돌려 놓음). 그림을 핀 반대쪽(아래)에 두어 핀 이름을 가리지 않는다 */
function dhtUp(x, y, { pins, titleAt }) {
  return module({
    x, y, w: 76, h: 70, color: "#1971c2", pins, side: "top", firstPin: 18, title: "DHT11", titleAt,
    decor: (mx, my, w) => `<rect x="${mx + 14}" y="${my + 26}" width="${w - 28}" height="36" rx="4" fill="#e7f5ff" stroke="#74c0fc"/>${[0, 1, 2, 3].map((k) => `<path d="M${mx + 20} ${my + 33 + k * 7} h${w - 40}" stroke="#74c0fc" stroke-width="2"/>`).join("")}`,
  });
}

/** 모듈 핀 셋(G · V · S) → 보드 한 줄 G · V · S 를 F-F 세 가닥으로 나란히 (끝을 한 덩어리 플러그처럼 그린다) */
function plugRun(from, to, colors) {
  const out = [];
  const ex = to[0].x - 12;
  from.forEach((p, i) => {
    const ty = to[0].y - 6 + i * 6;
    const d = `M${p.x} ${p.y} V${ty - 18 + i * 6} C${p.x} ${ty} ${p.x + 10} ${ty} ${p.x + 24} ${ty} H${ex}`;
    out.push(`<path d="${d}" stroke="#ffffff" stroke-width="7.5" stroke-opacity="0.9"/><path d="${d}" stroke="${colors[i]}" stroke-width="4"/>`);
    out.push(`<rect x="${p.x - 6}" y="${p.y - 8}" width="12" height="16" rx="2" fill="#212529" stroke="${colors[i]}" stroke-width="2.5"/>`);
  });
  out.push(`<rect x="${to[0].x - 12}" y="${to[0].y - 11}" width="${to[2].x - to[0].x + 24}" height="22" rx="3" fill="#212529" stroke="#868e96" stroke-width="2"/>`);
  to.forEach((p, i) => out.push(`<rect x="${p.x - 4}" y="${p.y - 4}" width="8" height="8" rx="1" fill="${colors[i]}" stroke="none"/>`));
  return out.join("");
}

/* ───── ESP32 Plus ───── */
function plus() {
  const b = makePlus({ x: 96, y: 280 });
  const X = b.bounds.x, Y = b.bounds.y;
  const parts = [], wires = [], used = [];

  // 팬: 위 한 줄 GND · 5V · io13 · io12 (7장과 같음)
  const f = fan(X + 30, 180, { titleAt: { x: X + 85, y: 166 } });
  parts.push(f.svg);
  const ft = { G: b.power("GND"), V: b.power("5V"), INp: b.gpio(13), INm: b.gpio(12) };
  wires.push(ffWire(f.pins.G, ft.G, C.black), ffWire(f.pins.V, ft.V, C.red), ffWire(f.pins["IN+"], ft.INp, C.yellow), ffWire(f.pins["IN−"], ft.INm, C.green));
  used.push(ft.G, ft.V, ft.INp, ft.INm);
  // 외부 전원 단자 + 배터리 홀더 메모
  const jack = { x: X - 10, y: Y + 150, w: 24, h: 30 };
  parts.push(`<rect x="${jack.x}" y="${jack.y}" width="${jack.w}" height="${jack.h}" rx="5" fill="#212529" stroke="#868e96" stroke-width="2"/><circle cx="${jack.x + 9}" cy="${jack.y + jack.h / 2}" r="5" fill="#495057" stroke="none"/>`);

  // OLED: 위쪽 가운데, 선 넷을 io12 와 io14 사이 빈 틈 → 빈 띠 → I2C 묶음 첫 줄
  const o = oled(240, 24, { side: "bottom", titleAt: { x: 294, y: 12 } });
  parts.push(o.svg);
  const bus = b.i2c(0);
  const order = ["SDA", "SCL", "VCC", "GND"]; // 오른쪽 핀부터 높이 꺾는다
  const gapX = { GND: X + 218, VCC: X + 227, SCL: X + 236, SDA: X + 245 };
  const jogY = { SDA: 156, SCL: 164, VCC: 172, GND: 180 };
  const laneY = { GND: b.lane.top + 3, VCC: b.lane.top + 8, SDA: b.lane.top + 13, SCL: b.lane.top + 18 };
  const oc = { GND: C.black, VCC: C.red, SDA: C.blue, SCL: C.purple };
  for (const k of order) {
    const p = o.pins[k];
    wires.push(ffWire(p, bus[k], oc[k], [{ x: p.x, y: jogY[k] }, { x: gapX[k], y: jogY[k] }, { x: gapX[k], y: laneY[k] }, { x: bus[k].x, y: laneY[k] }], "orth"));
  }
  used.push(bus.GND, bus.VCC, bus.SDA, bus.SCL);

  // DHT11: 보드 왼쪽, ANALOG 묶음 io4 줄 G · V · S 에 세 선을 나란히
  const t4 = b.triple(4);
  const dht = sensor3(8, Y + 150, "dht", { title: "DHT11", titleAt: { x: 46, y: Y + 136 } });
  parts.push(dht.svg, plugRun([dht.pins.G, dht.pins.V, dht.pins.S], [t4.G, t4.V, t4.S], [C.black, C.red, C.blue]));
  used.push(t4.G, t4.V, t4.S);

  // RGB LED: 보드 위 브레드보드 (빨강 27 · 초록 25 · 파랑 26)
  const bb = breadboard({ x: 356, y: 30, cols: 10, rails: { top: true, bottom: false } });
  const rgb = rgbCircuit(bb, 1);
  parts.push(bb.svg, ...rgb.svg);
  const s27 = b.gpio(27), s25 = b.gpio(25), s26 = b.gpio(26);
  wires.push(mfWire(s27, rgb.sig(rgb.cols.R), C.orange), mfWire(s25, rgb.sig(rgb.cols.G), C.green), mfWire(s26, rgb.sig(rgb.cols.B), C.blue), rgb.jumper);
  used.push(s27, s25, s26);
  // − 줄 → 보드 오른쪽 바깥 → 아래 줄 GND
  const gBot = b.power("GND", 1), gr = bb.rail("top", "-", 10);
  wires.push(mfWire(gBot, gr, C.black, [{ x: gBot.x, y: Y + 316 }, { x: 618, y: Y + 316 }, { x: 618, y: gr.y }], "orth"));
  used.push(gBot);

  parts.push(note(12, Y + 330, "배터리 홀더(AA 6개)는", "start", 13), note(12, Y + 348, "USB 아래 외부 전원 단자에", "start", 13));
  const rows = [
    { colors: [C.black, C.red], part: "팬 G · V", to: "GND · 5V (위 줄)" },
    { colors: [C.yellow, C.green], part: "팬 IN+ · IN−", to: "io13 · io12" },
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C GND · 5V" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C SDA · SCL" },
    { colors: [C.black, C.red, C.blue], part: "DHT11 G · V · S", to: "ANALOG io4 줄 G · V · S" },
    { color: C.orange, part: "io27", to: "1번 줄 → 220Ω → RGB 빨강 다리" },
    { color: C.green, part: "io25", to: "5번 줄 → 220Ω → RGB 초록 다리" },
    { color: C.blue, part: "io26", to: "7번 줄 → 220Ω → RGB 파랑 다리" },
    { color: C.black, part: "RGB 가장 긴 다리(−) 3번 줄", to: "− 줄 → 아래 줄 GND" },
  ];
  const table = connectionTable(Y + 366, "이렇게 꽂아요 — 모듈은 보드에 바로, RGB LED 만 브레드보드에", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  const bb = breadboard({ x: 228, y: 8, cols: 10, rails: { top: true, bottom: false } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 40 });
  const parts = [], wires = [], used = [];
  const bot = b.bounds.y + b.bounds.h;

  // 팬: VIN · GND · D13 · D12 에 바로 (7장과 같음)
  const f = fan(100, bb.y + bb.h - 80, { titleAt: { x: 88, y: bb.y + bb.h - 46, anchor: "end" } });
  parts.push(f.svg);
  const ft = { G: b.power("GND", 0), V: b.power("5V"), INp: b.gpio(13), INm: b.gpio(12) };
  wires.push(ffWire(f.pins.G, ft.G, C.black), ffWire(f.pins.V, ft.V, C.red), ffWire(f.pins["IN+"], ft.INp, C.yellow), ffWire(f.pins["IN−"], ft.INm, C.green));
  used.push(ft.G, ft.V, ft.INp, ft.INm);

  // RGB LED: 보드 위 브레드보드 (빨강 D27 · 초록 D25 · 파랑 D26)
  const rgb = rgbCircuit(bb, 1);
  parts.push(bb.svg, ...rgb.svg);
  const s27 = b.gpio(27), s25 = b.gpio(25), s26 = b.gpio(26);
  wires.push(mfWire(s27, rgb.sig(rgb.cols.R), C.orange), mfWire(s25, rgb.sig(rgb.cols.G), C.green), mfWire(s26, rgb.sig(rgb.cols.B), C.blue), rgb.jumper);
  used.push(s27, s25, s26);

  // 보드 아래 + − 줄 띠: 3V3 → + 줄, GND(아래 줄) → − 줄
  const strip = breadboard({ x: 20, y: bot + 18, cols: 10, railsOnly: true });
  const r = (s, c) => strip.rail("top", s, c);
  parts.push(strip.svg);
  const v33 = b.power("3V3"), gBot = b.power("GND", 1);
  wires.push(mfWire(v33, r("+", 7), C.red), mfWire(gBot, r("-", 8), C.black));
  used.push(v33, gBot);

  // DHT11: 핀이 위로(왼→오 G · V · S). S → D4, G · V → 띠 오른쪽 끝
  const dht = dhtUp(210, r("-", 1).y + 34, { pins: ["G", "V", "S"], titleAt: { x: 200, y: r("-", 1).y + 69, anchor: "end" } });
  parts.push(dht.svg);
  const d4 = b.gpio(4);
  wires.push(ffWire(dht.pins.S, d4, C.blue, [{ x: dht.pins.S.x, y: b.bounds.y + b.bounds.h + 6 }, { x: d4.x, y: b.bounds.y + b.bounds.h + 6 }], "orth"));
  wires.push(mfWire(dht.pins.G, r("-", 10), C.black, [{ x: dht.pins.G.x, y: r("-", 10).y }], "orth"));
  wires.push(mfWire(dht.pins.V, r("+", 10), C.red, [{ x: dht.pins.V.x, y: r("+", 10).y }], "orth"));
  used.push(d4);

  // OLED: DHT11 아래, 핀이 위로. SDA → D21 · SCL → D22, GND · VCC → 띠 (아래에서)
  const oy = dht.pins.G.y + 150;
  const o = oled(290, oy);
  parts.push(o.svg);
  const sda = b.gpio(21), scl = b.gpio(22);
  wires.push(ffWire(o.pins.SDA, sda, C.blue));
  wires.push(ffWire(o.pins.SCL, scl, C.purple, [{ x: o.pins.SCL.x, y: oy - 40 }, { x: scl.x, y: oy - 40 }], "orth"));
  wires.push(mfWire(o.pins.VCC, r("+", 3), C.red, [{ x: o.pins.VCC.x, y: oy - 32 }, { x: r("+", 3).x, y: oy - 32 }], "orth"));
  wires.push(mfWire(o.pins.GND, r("-", 2), C.black, [{ x: o.pins.GND.x, y: oy - 24 }, { x: r("-", 2).x, y: oy - 24 }], "orth"));
  used.push(sda, scl);

  // RGB 의 − 줄 → 보드 오른쪽 바깥 → 아래로 → 띠의 − 줄 왼쪽 끝
  const gr = bb.rail("top", "-", 10), lowY = oy + 150;
  wires.push(mmWire(gr, r("-", 1), C.black, [{ x: 620, y: gr.y }, { x: 620, y: lowY }, { x: 8, y: lowY }, { x: 8, y: r("-", 1).y }], "orth"));

  const rows = [
    { colors: [C.black, C.red], part: "팬 G · V", to: "GND · VIN (보드에 바로)" },
    { colors: [C.yellow, C.green], part: "팬 IN+ · IN−", to: "D13 · D12 (보드에 바로)" },
    { color: C.orange, part: "D27", to: "1번 줄 → 220Ω → RGB 빨강 다리" },
    { color: C.green, part: "D25", to: "5번 줄 → 220Ω → RGB 초록 다리" },
    { color: C.blue, part: "D26", to: "7번 줄 → 220Ω → RGB 파랑 다리" },
    { color: C.black, part: "RGB 가장 긴 다리(−) 3번 줄", to: "위 − 줄 → 보드 바깥으로 돌아 아래 띠 − 줄" },
    { colors: [C.red, C.black], part: "3V3 · GND (아래 줄)", to: "아래 띠 + 줄 · − 줄" },
    { colors: [C.black, C.red], part: "DHT11 G · V", to: "아래 띠 − 줄 · + 줄" },
    { color: C.blue, part: "DHT11 S", to: "D4 (보드에 바로)" },
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "아래 띠 − 줄 · + 줄" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "D21 · D22 (보드에 바로)" },
  ];
  const table = connectionTable(lowY + 20, "이렇게 꽂아요 — 3V3 · GND 는 아래 + − 줄 띠로 나눠 써요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "교실 온습도 알리미 배선도(ESP32 Plus 확장 보드): 팬(130 모터) 모듈 G · V · IN+ · IN− 는 보드 위쪽 GND · 5V · io13 · io12 에, OLED 화면 GND · VCC · SDA · SCL 은 보드 가운데 빈 틈으로 내려 I2C 묶음 첫 줄 GND · 5V · SDA · SCL 에, DHT11 G · V · S 는 ANALOG 묶음 io4 줄 G · V · S 에 F-F 듀폰선으로 바로. RGB LED 만 보드 위 브레드보드: 다리는 1 · 3 · 5 · 7번 줄(빨강 · 가장 긴 다리 − · 초록 · 파랑), 220Ω 저항 셋이 1 · 5 · 7번 줄에서 가운데 홈을 건너고, io27 → 1번 줄, io25 → 5번 줄, io26 → 7번 줄. 3번 줄 → − 줄, − 줄은 보드 오른쪽 바깥으로 돌아 아래 줄 GND. 배터리 홀더(AA 6개)는 보드 외부 전원 단자에",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 교실 온습도 알리미 배선도: 팬(130 모터) 모듈 G · V · IN+ · IN− 는 GND · VIN · D13 · D12 에 F-F 듀폰선으로 바로. RGB LED 는 보드 위 브레드보드: 다리는 1 · 3 · 5 · 7번 줄(빨강 · 가장 긴 다리 − · 초록 · 파랑), 220Ω 저항 셋이 홈을 건너고, D27 → 1번 줄, D25 → 5번 줄, D26 → 7번 줄, 3번 줄 → − 줄. 보드 아래에 + − 줄 띠: 3V3 → + 줄, 아래 줄 GND → − 줄. DHT11 G · V → 띠 − · + 줄, S → D4. OLED GND · VCC → 띠 − · + 줄, SDA → D21, SCL → D22. 브레드보드 − 줄은 보드 오른쪽 바깥으로 돌아 띠의 − 줄에",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wrc", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wrck", T.devkit, r.body, r.height); },
  },
};
