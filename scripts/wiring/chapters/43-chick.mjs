// 융합 F16 "병아리 키우기" — DHT11 모듈(S → 13번), 틸트 스위치(맨 부품) + 10kΩ → 14번, PIR 모듈(S → 23번),
// OLED(I2C: SCL 22 · SDA 21), 풀업 시작 버튼(27번), 수동 부저 + → 25번(ESP32 Plus 에 io15 가 없어 15번에서 옮김).
// 틸트: 3V3 — 10kΩ — 14번 — 틸트 스위치 — GND (16장과 같은 풀업). 바로 서면 구슬이 다리를 이어 0, 흔들려 떨어지면 1 — 코드(tilt.value() == 1 이 "놀아 줌")와 같은 뜻.
//
// ESP32 Plus: 모듈은 모두 보드에 바로.
//   PIR → io23 기둥 S · V · G (16장처럼 기둥 아래 빈 띠로 보드 오른쪽 모듈),
//   DHT11 → io13 기둥 S · V · G (빈 띠에서 보드 가운데 틈(io12 와 io14 사이)으로 올라가 보드 위 모듈),
//   OLED → 위 왼쪽 한 줄 SCL · SDA · 5V · GND (9장처럼 선이 OLED 위로 돌아 내려온다).
//   틸트 · 버튼 · 부저는 오른쪽 위 핀 묶음 위의 작은 브레드보드. 3V3 · GND(아래 줄)는 보드 오른쪽 바깥 길로 브레드보드 + − 줄에.
// DevKit: 틸트 · 버튼 · 부저는 보드 위 브레드보드(16장 자리), PIR 은 그 오른쪽(V · G → + − 줄, S → D23).
//   보드 아래 + − 줄 띠(3V3 · GND)를 DHT11 · OLED 가 나눠 쓰고, 띠의 + 줄은 보드 바깥으로 돌아 위 브레드보드 + 줄에.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, svgDoc, wire } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, buzzer, module, oled, resistor, sensor3, tiltSwitch } from "../parts.mjs";
import { buttonPullup, railCol, railLink } from "./11-button-touch.mjs";

const TEN_K = ["#8b5a2b", "#212529", "#f76707"]; // 갈 검 주

/** DHT11 모듈 (15장 도우미와 같다 — 그림이 핀 이름을 가리지 않게 핀 반대쪽에). side "top" 은 돌려 놓아 왼→오 S V G */
function dht11(x, y, { side = "bottom", pins = ["G", "V", "S"], titleAt } = {}) {
  return module({
    x, y, w: 76, h: 70, color: "#1971c2", pins, side, firstPin: 18, title: "DHT11", titleAt,
    decor: (mx, my, w) => {
      const ry = side === "top" ? my + 24 : my + 6;
      return `<rect x="${mx + 14}" y="${ry}" width="${w - 28}" height="38" rx="4" fill="#e7f5ff" stroke="#74c0fc"/>${[0, 1, 2, 3].map((k) => `<path d="M${mx + 20} ${ry + 8 + k * 8} h${w - 40}" stroke="#74c0fc" stroke-width="2"/>`).join("")}`;
    },
  });
}

/** + 줄끼리 잇는 점퍼 (브레드보드 왼쪽 끝 바깥, − 줄 점퍼보다 바깥) */
function plusLink(bb) {
  const t = bb.rail("top", "+", 1), b = bb.rail("bottom", "+", 1);
  const x = bb.x - 18;
  return mmWire(t, b, C.red, [{ x, y: t.y }, { x, y: b.y }], "orth");
}

/**
 * 브레드보드 아래쪽(f~j) 회로 셋 (16장과 같은 꼴). 신호는 모두 아래에서 j 칸으로 들어온다.
 *   tilt: { r, n, t } — 10kΩ (r,h)~(n,h), 틸트 (n,f)~(t,f). r → 아래 + 줄, t → 아래 − 줄, n ← 14번
 *   btn: 버튼 왼쪽 열 — 신호 (btn, j) ← 27번, 대각선 (btn+2, a) → 위 − 줄
 *   buz: { plus, minus } — 수동 부저 + (plus,f) ← 25번, − (minus,f) → 아래 − 줄
 */
function circuits(bb, { tilt, btn, buz }) {
  const R = (s, c) => bb.rail("bottom", s, c);
  const svg = [], jumpers = [];
  [tilt.r, tilt.n, tilt.t, buz.plus, buz.minus].forEach((c) => bb.tint(c, "bottom"));
  svg.push(resistor(bb.hole(tilt.r, "h"), bb.hole(tilt.n, "h"), { bands: TEN_K, label: "10kΩ" }).svg);
  svg.push(tiltSwitch(bb.hole(tilt.n, "f"), bb.hole(tilt.t, "f")).svg);
  jumpers.push(mmWire(bb.hole(tilt.r, "j"), R("+", railCol(tilt.r + 1)), C.red, [], "line"));
  jumpers.push(mmWire(bb.hole(tilt.t, "j"), R("-", railCol(tilt.t)), C.black));
  const b = buttonPullup(bb, btn);
  svg.push(...b.svg);
  jumpers.push(b.jumper);
  svg.push(buzzer(bb.hole(buz.plus, "f"), bb.hole(buz.minus, "f")).svg);
  jumpers.push(mmWire(bb.hole(buz.minus, "j"), R("-", railCol(buz.minus)), C.black));
  return { svg, jumpers, j: (c) => bb.hole(c, "j"), R };
}

/** 브레드보드 위 부품 이름 (구멍 위에서도 읽히게 옅은 테두리) */
const tag = (x, y, s) =>
  `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="#343a40" stroke="#f1f3f5" stroke-width="4" paint-order="stroke">${s}</text>`;

/* ───── ESP32 Plus ───── */
function plus() {
  const bb = breadboard({ x: 316, y: 48, cols: 15, rails: { top: true, bottom: true } });
  const b = makePlus({ x: 60, y: 400 });
  const { x: bx, y: by, w: bw, h: bh } = b.bounds;
  const bot = by + bh;
  const parts = [], wires = [], used = [];

  // 브레드보드: 틸트(10kΩ 1~5, 틸트 5~7) · 버튼 9~11 · 수동 부저 13 · 15
  const spec = { tilt: { r: 1, n: 5, t: 7 }, btn: 9, buz: { plus: 13, minus: 15 } };
  const c = circuits(bb, spec);
  parts.push(bb.svg, ...c.svg);
  wires.push(...c.jumpers, railLink(bb), plusLink(bb));
  parts.push(tag(bb.hole(4, "a").x, bb.hole(1, "b").y, "틸트 스위치"), tag(bb.hole(9, "a").x + 4, bb.hole(1, "b").y, "버튼"), tag(bb.hole(14, "a").x, bb.hole(1, "c").y, "수동 부저"));

  // io14 · io27 · io25: 위로 나가 보드와 브레드보드 사이에서 옆으로, j 칸으로 (io14 가 가장 위)
  const s14 = b.gpio(14), s27 = b.gpio(27), s25 = b.gpio(25);
  const gapLow = (k) => bb.y + bb.h + 12 + k * 10;
  const up = (p, hole, color, k) => mfWire(p, hole, color, [{ x: p.x, y: gapLow(k) }, { x: hole.x, y: gapLow(k) }], "orth");
  wires.push(up(s14, c.j(spec.tilt.n), C.green, 0), up(s27, c.j(spec.btn), C.yellow, 1), up(s25, c.j(spec.buz.plus), C.orange, 2));
  used.push(s14, s27, s25);

  // 3V3 · GND(아래 줄) → 보드 오른쪽 바깥 길 → 위 + 줄 · 아래 − 줄 오른쪽 끝 (3V3 이 바깥쪽이라 두 선이 겹치지 않는다)
  const v33 = b.power("3V3"), gnd = b.power("GND", 1);
  const tp = bb.rail("top", "+", 15), bm = bb.rail("bottom", "-", 15);
  wires.push(mfWire(gnd, bm, C.black, [{ x: gnd.x, y: bot + 4 }, { x: 614, y: bot + 4 }, { x: 614, y: bm.y }], "orth"));
  wires.push(mfWire(v33, tp, C.red, [{ x: v33.x, y: bot + 12 }, { x: 626, y: bot + 12 }, { x: 626, y: tp.y }], "orth"));
  used.push(v33, gnd);

  // PIR: 보드 오른쪽, io23 기둥 S · V · G (16장과 같은 길 — 가운데 틈 왼쪽에서는 DHT11 선보다 아래 줄로)
  const t23 = b.triple(23);
  const pir = sensor3(500, by + 22, "pir", { titleAt: { x: 538, y: by + 8 } });
  parts.push(pir.svg);
  const hi = (k) => b.lane.top + 4 + k * 6; // 보드 오른쪽 부분: 빈 띠 안 세 줄
  const lo = (k) => b.lane.top + 15 + k * 5; // 가운데 틈 왼쪽: DHT11 세 선 아래
  const stepX = (k) => bx + 244 + k * 4;
  const pirRun = (p, pin, color, dx, k) =>
    ffWire(p, pin, color, [{ x: p.x, y: hi(k) }, { x: stepX(k), y: hi(k) }, { x: stepX(k), y: lo(k) }, { x: t23.S.x + dx, y: lo(k) }, { x: t23.S.x + dx, y: pin.y + 4 }], "orth");
  wires.push(pirRun(pir.pins.S, t23.S, C.blue, -4, 2), pirRun(pir.pins.V, t23.V, C.red, 0, 1), pirRun(pir.pins.G, t23.G, C.black, 4, 0));
  used.push(t23.S, t23.V, t23.G);

  // DHT11: 보드 위 가운데. io13 기둥 → 빈 띠 위쪽 세 줄 → 가운데 틈(io12 와 io14 사이)으로 올라가 → 모듈 핀
  const t13 = b.triple(13);
  const dht = dht11(196, 266);
  parts.push(dht.svg);
  const dl = (k) => b.lane.top + k * 5; // G 0 · V 1 · S 2
  const chX = (k) => bx + 220 + k * 8; // 틈 안 세 길
  const jog = (k) => by - 44 + (2 - k) * 8; // 보드 위: S 가 가장 위
  const dhtRun = (p, pin, color, dx, k) =>
    ffWire(p, pin, color, [{ x: p.x, y: jog(k) }, { x: chX(k), y: jog(k) }, { x: chX(k), y: dl(k) }, { x: t13.S.x + dx, y: dl(k) }, { x: t13.S.x + dx, y: pin.y + 4 }], "orth");
  wires.push(dhtRun(dht.pins.S, t13.S, C.blue, -4, 2), dhtRun(dht.pins.V, t13.V, C.red, 0, 1), dhtRun(dht.pins.G, t13.G, C.black, 4, 0));
  used.push(t13.S, t13.V, t13.G);

  // OLED: 보드 위 왼쪽, 핀이 위로. 선은 위로 올라가 왼쪽으로 돌아 위 왼쪽 한 줄 SCL · SDA · 5V · GND 로 (9장과 같다)
  const o = oled(158, 100);
  parts.push(o.svg);
  const hdr = { SCL: b.pin("top:SCL"), SDA: b.pin("top:SDA"), VCC: b.pin("top:5V"), GND: b.pin("top:GND") };
  const oTop = o.pins.GND.y;
  const level = { GND: oTop - 10, VCC: oTop - 19, SCL: oTop - 28, SDA: oTop - 37 };
  const loop = (k, color) => ffWire(o.pins[k], hdr[k], color, [{ x: o.pins[k].x, y: level[k] }, { x: hdr[k].x, y: level[k] }], "orth");
  wires.push(loop("GND", C.black), loop("VCC", C.red), loop("SCL", C.purple), loop("SDA", C.blue));
  used.push(hdr.SCL, hdr.SDA, hdr.VCC, hdr.GND);

  const rows = [
    { colors: [C.black, C.red, C.blue], part: "DHT11 G · V · S", to: "io13 기둥 G · V · S (보드 가운데 틈으로)" },
    { colors: [C.black, C.red, C.blue], part: "PIR G · V · S", to: "io23 기둥 G · V · S" },
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "위 왼쪽 GND · 5V" },
    { colors: [C.purple, C.blue], part: "OLED SCL · SDA", to: "위 왼쪽 SCL · SDA" },
    { colors: [C.red, C.black], part: "3V3 · GND (아래 줄)", to: "위 + 줄 · 아래 − 줄 (보드 바깥으로), + 줄끼리 · − 줄끼리 점퍼" },
    { color: C.green, part: "io14", to: `${spec.tilt.n}번 줄 (10kΩ 과 틸트 사이)` },
    { colors: [C.red, C.black], part: `10kΩ ${spec.tilt.r}번 줄 · 틸트 ${spec.tilt.t}번 줄`, to: "아래 + 줄 · 아래 − 줄" },
    { color: C.yellow, part: "io27", to: `${spec.btn}번 줄 버튼 한쪽 다리, 대각선 ${spec.btn + 2}번 줄 → 위 − 줄` },
    { color: C.orange, part: "io25", to: `${spec.buz.plus}번 줄 부저 + 다리 (− 다리 ${spec.buz.minus}번 줄 → − 줄)` },
  ];
  const table = connectionTable(bot + 30, "이렇게 꽂아요 — 모듈은 보드에 바로, 틸트 · 버튼 · 부저는 브레드보드에", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  const bb = breadboard({ x: 96, y: 40, cols: 22, rails: { top: true, bottom: true } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 30 });
  const top = b.bounds.y, bot = b.bounds.y + b.bounds.h;
  const parts = [], wires = [], used = [];

  // 브레드보드: 틸트(10kΩ 4~8, 틸트 8~10) · 버튼 11~13 · 수동 부저 15 · 17
  const spec = { tilt: { r: 4, n: 8, t: 10 }, btn: 11, buz: { plus: 15, minus: 17 } };
  const c = circuits(bb, spec);
  parts.push(bb.svg, ...c.svg);
  wires.push(...c.jumpers, railLink(bb), plusLink(bb));
  parts.push(tag(bb.hole(6, "a").x, bb.hole(1, "c").y, "틸트 스위치"), tag(bb.hole(11, "a").x - 4, bb.hole(1, "b").y, "버튼"), tag(bb.hole(16, "a").x, bb.hole(1, "c").y, "수동 부저"));
  const d14 = b.gpio(14), d27 = b.gpio(27), d25 = b.gpio(25);
  wires.push(mfWire(d14, c.j(spec.tilt.n), C.green), mfWire(d27, c.j(spec.btn), C.yellow), mfWire(d25, c.j(spec.buz.plus), C.orange));
  used.push(d14, d27, d25);
  // GND(위 줄) → 아래 − 줄 (3 · 4번 열 사이로 올라가 + 줄 구멍을 피한다)
  const gTop = b.power("GND", 0), mIn = c.R("-", 4);
  wires.push(mfWire(gTop, mIn, C.black, [{ x: gTop.x, y: mIn.y + 8 }, { x: mIn.x, y: mIn.y + 8 }], "orth"));
  used.push(gTop);

  // PIR: 브레드보드 오른쪽 (16장과 같다). V · G → + − 줄 오른쪽 끝, S → 보드 오른쪽 바깥 길 → D23(아래 줄)
  const pir = sensor3(500, bb.y + bb.h - 156, "pir", { titleAt: { x: 538, y: bb.y + bb.h - 170 } });
  parts.push(pir.svg);
  const d23 = b.gpio(23), plusEnd = c.R("+", 22), minusEnd = c.R("-", 22);
  wires.push(mfWire(pir.pins.G, minusEnd, C.black, [{ x: pir.pins.G.x, y: minusEnd.y }], "orth"));
  wires.push(mfWire(pir.pins.V, plusEnd, C.red, [{ x: pir.pins.V.x, y: plusEnd.y }], "orth"));
  wires.push(ffWire(pir.pins.S, d23, C.blue, [{ x: pir.pins.S.x, y: pir.pins.S.y + 10 }, { x: 606, y: pir.pins.S.y + 10 }, { x: 606, y: bot + 14 }, { x: d23.x, y: bot + 14 }], "orth"));
  parts.push();
  used.push(d23);

  // 보드 아래 + − 줄 띠: 3V3 → + 줄, GND(아래 줄) → − 줄 (8 · 9번 열 사이로 내려와 + 줄 구멍을 피한다)
  const strip = breadboard({ x: 20, y: bot + 28, cols: 11, railsOnly: true });
  const r = (s, col) => strip.rail("top", s, col);
  parts.push(strip.svg);
  const v33 = b.power("3V3"), gBot = b.power("GND", 1);
  const sp = r("+", 7), sm = r("-", 8), midY = (r("+", 1).y + r("-", 1).y) / 2;
  wires.push(mfWire(v33, sp, C.red));
  wires.push(mfWire(gBot, sm, C.black, [{ x: gBot.x + 2, y: midY }, { x: sm.x, y: midY }], "orth"));
  used.push(v33, gBot);

  // 띠 + 줄 → 왼쪽으로 나가 보드 아래를 돌아 보드 오른쪽 바깥 길로 → 위 브레드보드 위 + 줄 오른쪽 끝
  const lowY = bot + 300, tpEnd = bb.rail("top", "+", 22), s1 = r("+", 1);
  wires.push(mmWire(s1, tpEnd, C.red, [{ x: 6, y: s1.y }, { x: 6, y: lowY }, { x: 622, y: lowY }, { x: 622, y: tpEnd.y }], "orth"));

  // DHT11: 띠 아래, 돌려 놓아 핀이 위로(왼→오 S V G). V · G → 띠, S → 보드 왼쪽 바깥 길 → 보드와 브레드보드 사이 → D13
  const dht = dht11(50, r("-", 1).y + 46, { side: "top", pins: ["S", "V", "G"], titleAt: { x: 88, y: r("-", 1).y + 132 } });
  parts.push(dht.svg);
  const d13 = b.gpio(13);
  const vIn = r("+", 4), gIn = r("-", 5);
  wires.push(mfWire(dht.pins.G, gIn, C.black));
  wires.push(mfWire(dht.pins.V, vIn, C.red, [{ x: dht.pins.V.x, y: midY }, { x: vIn.x, y: midY }], "orth"));
  const sY = dht.pins.S.y - 10;
  wires.push(ffWire(dht.pins.S, d13, C.blue, [{ x: dht.pins.S.x, y: sY }, { x: 14, y: sY }, { x: 14, y: top - 12 }, { x: d13.x, y: top - 12 }], "orth"));
  used.push(d13);

  // OLED: 띠 오른쪽 아래, 핀이 위로. GND · VCC → 띠 오른쪽 끝, SDA → D21 바로, SCL → D22
  const sda = b.gpio(21), scl = b.gpio(22);
  const o = oled(sda.x - 84, r("-", 1).y + 58, { titleAt: { x: sda.x + 30, y: r("-", 1).y + 120, anchor: "start" } });
  parts.push(o.svg);
  const pEnd = r("+", 11), mEnd = r("-", 11);
  wires.push(mfWire(o.pins.GND, mEnd, C.black, [{ x: o.pins.GND.x, y: mEnd.y }], "orth"));
  wires.push(mfWire(o.pins.VCC, pEnd, C.red, [{ x: o.pins.VCC.x, y: pEnd.y }], "orth"));
  wires.push(ffWire(o.pins.SDA, sda, C.blue));
  wires.push(ffWire(o.pins.SCL, scl, C.purple, [{ x: o.pins.SCL.x, y: bot + 22 }, { x: scl.x, y: bot + 22 }], "orth"));
  used.push(sda, scl);

  const rows = [
    { colors: [C.red, C.black], part: "3V3 · GND (아래 줄)", to: "아래 띠 + 줄 · − 줄" },
    { color: C.red, part: "아래 띠 + 줄", to: "보드 바깥으로 돌아 브레드보드 위 + 줄" },
    { color: C.black, part: "GND (위 줄)", to: "브레드보드 아래 − 줄, + 줄끼리 · − 줄끼리 점퍼" },
    { color: C.green, part: "D14", to: `${spec.tilt.n}번 줄 (10kΩ 과 틸트 사이)` },
    { colors: [C.red, C.black], part: `10kΩ ${spec.tilt.r}번 줄 · 틸트 ${spec.tilt.t}번 줄`, to: "아래 + 줄 · 아래 − 줄" },
    { color: C.yellow, part: "D27", to: `${spec.btn}번 줄 버튼 한쪽 다리, 대각선 ${spec.btn + 2}번 줄 → 위 − 줄` },
    { color: C.orange, part: "D25", to: `${spec.buz.plus}번 줄 부저 + 다리 (− 다리 ${spec.buz.minus}번 줄 → − 줄)` },
    { colors: [C.red, C.black], part: "PIR V · G", to: "+ 줄 · − 줄 (오른쪽 끝)" },
    { color: C.blue, part: "PIR S", to: "D23 (보드 바깥으로 돌아 아래 줄)" },
    { colors: [C.red, C.black], part: "DHT11 V · G", to: "아래 띠 + 줄 · − 줄" },
    { color: C.blue, part: "DHT11 S", to: "D13 (보드 바깥으로 돌아 위 줄)" },
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "아래 띠 − 줄 · + 줄" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "D21 · D22 (보드에 바로)" },
  ];
  const table = connectionTable(lowY + 20, "이렇게 꽂아요 — 3V3 · GND 는 + − 줄로 나눠 써요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "병아리 키우기 배선도(ESP32 Plus 확장 보드): 모듈은 F-F 듀폰선으로 보드에 바로 — DHT11 G · V · S 는 io13 기둥 G · V · S(선은 보드 가운데 틈으로), PIR 센서 G · V · S 는 io23 기둥 G · V · S, OLED GND · VCC · SCL · SDA 는 위 왼쪽 GND · 5V · SCL · SDA. 오른쪽 위 핀 묶음 위 브레드보드: 아래 줄 3V3 → 보드 바깥으로 돌아 위 + 줄, 아래 줄 GND → 아래 − 줄, + 줄끼리 · − 줄끼리 점퍼. 틸트 스위치: 10kΩ 저항 1 · 5번 줄(1번 줄 → + 줄), io14 → 5번 줄, 틸트 스위치 5 · 7번 줄(7번 줄 → − 줄). 버튼은 가운데 홈에 걸쳐 9 · 11번 줄: io27 → 9번 줄, 대각선 11번 줄 → 위 − 줄. 수동 부저 + 다리 13번 줄 ← io25, − 다리 15번 줄 → − 줄",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 병아리 키우기 배선도: 보드 위 브레드보드 — 틸트 스위치: 10kΩ 저항 4 · 8번 줄(4번 줄 → + 줄), D14 → 8번 줄, 틸트 스위치 8 · 10번 줄(10번 줄 → − 줄). 버튼은 가운데 홈에 걸쳐 11 · 13번 줄: D27 → 11번 줄, 대각선 13번 줄 → 위 − 줄. 수동 부저 + 다리 15번 줄 ← D25, − 다리 17번 줄 → − 줄. 위 줄 GND → − 줄, + 줄끼리 · − 줄끼리 점퍼. PIR 센서 V · G → + − 줄 오른쪽 끝, S → 보드 바깥으로 돌아 D23. 보드 아래 + − 줄 띠: 3V3 → + 줄, 아래 줄 GND → − 줄, 띠 + 줄 → 보드 바깥으로 돌아 브레드보드 + 줄. DHT11 V · G → 띠 + · − 줄, S → 보드 바깥으로 돌아 D13. OLED GND · VCC → 띠 − · + 줄, SDA → D21, SCL → D22",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wck", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wckk", T.devkit, r.body, r.height); },
  },
};
