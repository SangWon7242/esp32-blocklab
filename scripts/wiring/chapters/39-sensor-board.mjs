// 융합 F12 "우리 반 센서 상황판" — OLED(I2C SCL 22 · SDA 21), 포토레지스터 + 10kΩ → 34번, 소리 센서 모듈 S → 35번,
// 가변저항 가운데 → 39번, DHT11 모듈 S → 13번, 틸트 스위치 + 10kΩ → 14번, PIR 모듈 S → 23번.
// 포토레지스터: 미션 코드가 "빛 값이 기준보다 크면(어두우면) 느낌표"라 어두울수록 값이 커지게 — 3V3 — 10kΩ — 34번 — 포토레지스터 — GND (14장과 같음).
// 틸트: 코드가 "기울면 1" — 풀업: 3V3 — 10kΩ — 14번 — 틸트 스위치 — GND (16장과 같음).
// 소리 · DHT11 · PIR 은 모듈, 포토레지스터 · 틸트 스위치 · 가변저항은 맨 부품(브레드보드).
//
// Plus: 아날로그(34 · 39 · 3V3 · GND)가 아래 줄이라 브레드보드는 보드 아래(위쪽 + − 줄).
//   OLED 는 보드 위에서 위 한 줄 SCL · SDA · 5V · GND 로(9장과 같은 꼴), DHT11 은 io13 기둥 G · V · S 에 빈 띠로(15장과 같음).
//   소리 센서 S 는 ANALOG 묶음 io35 줄 S 에(ANALOG 글자와 I2C 묶음 사이 빈 길로 올라가 오른쪽에서), V · G 는 + − 줄.
//   PIR 은 V · G 를 + − 줄에, S 는 보드 오른쪽 바깥 길로 올라가 위 한 줄 io23 에. 틸트 선(io14)도 오른쪽 바깥 길로 내려온다.
// DevKit: 위 줄 D13 · D14 · D35 · D34 · VN 이 브레드보드 쪽이라 브레드보드는 보드 위(아래쪽 + − 줄).
//   DHT11 · 소리 센서는 브레드보드와 보드 사이: S 는 D13 · D35 에 바로, V · G 는 모듈 왼쪽으로 돌아 + − 줄.
//   PIR 은 브레드보드 오른쪽(16장과 같음). OLED 는 보드 아래: SDA · SCL · GND 는 아래 줄에 바로, VCC 는 보드 왼쪽 바깥 길로 + 줄.
// 확장 보드: DHT11 은 P13 칸, 소리 센서는 P35 칸 G · V · S 기둥에 F-F 셋씩(보드 위), PIR 은 아래 줄 P23 칸 기둥에(보드 아래), V 줄 = 3.3V.
//   소리 센서는 P34 · SVN 선이 곧게 올라가도록 왼쪽으로 비켜 두고 세 선을 계단처럼 꺾는다. 맨 부품은 보드 위 브레드보드(아래 + − 줄):
//   + 줄은 전원 헤더 3V(점퍼와 상관없이 3.3V — 풀업 · 분압 · 가변저항이 핀에 3.3V 넘게 주지 않게), − 줄은 전원 헤더 GND.
//   OLED 는 I2C 헤더(10장과 같은 길). 5V 부품이 없어 점퍼는 평소 자리(3.3V).
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, name, note, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { columnRun } from "./33-room-climate.mjs";
import { breadboard, module, oled, photoresistor, potentiometer, resistor, sensor3, tiltSwitch } from "../parts.mjs";

const TEN_K = ["#8b5a2b", "#212529", "#f76707"]; // 갈 검 주

/** DHT11 모듈(15장 dht11 과 같은 그림 — 핀 이름이 가리지 않게 그림을 핀 반대쪽에) */
function dht11(x, y, { side = "bottom", pins = ["G", "V", "S"], titleAt } = {}) {
  return module({
    kind: "dht",
    x, y, w: 76, h: 70, color: "#1971c2", pins, side, firstPin: 18, title: "DHT11", titleAt,
    decor: (mx, my, w) => {
      const ry = side === "top" ? my + 24 : my + 6;
      return `<rect x="${mx + 14}" y="${ry}" width="${w - 28}" height="38" rx="4" fill="#e7f5ff" stroke="#74c0fc"/>${[0, 1, 2, 3].map((k) => `<path d="M${mx + 20} ${ry + 8 + k * 8} h${w - 40}" stroke="#74c0fc" stroke-width="2"/>`).join("")}`;
    },
  });
}

/**
 * 가까운 + − 줄을 건너 먼 줄 구멍에 꽂는 길: 구멍 사이(x+8)로 세로로 지나 먼 줄 높이에서 구멍으로.
 * from: 시작점, hole: 먼 줄 구멍, nearY: 건너는 줄 높이. 반환 via (style "orth")
 */
const pastRail = (from, hole, nearY, dx = 8) => {
  const midY = from.y < nearY ? (from.y + nearY) / 2 : (from.y + nearY) / 2;
  return [{ x: from.x, y: midY }, { x: hole.x + dx, y: midY }, { x: hole.x + dx, y: hole.y }];
};

/* ───── ESP32 Plus ───── */
function plus() {
  const b = makePlus({ x: 56, y: 200 });
  const top = b.bounds.y, bot = b.bounds.y + b.bounds.h;
  const parts = [], wires = [], used = [];

  // OLED: 보드 위(핀이 위로). 선은 위로 올라가 왼쪽으로 돌아 위 한 줄 SCL · SDA · 5V · GND 로 내려온다 (9장과 같은 꼴)
  const o = oled(214, 58, { titleAt: { x: 332, y: 112, anchor: "start" } });
  parts.push(o.svg);
  const t = { SCL: b.pin("top:SCL"), SDA: b.pin("top:SDA"), VCC: b.pin("top:5V"), GND: b.pin("top:GND") };
  const level = { GND: o.pins.GND.y - 8, VCC: o.pins.GND.y - 16, SCL: o.pins.GND.y - 24, SDA: o.pins.GND.y - 32 };
  const oc = { GND: C.black, VCC: C.red, SCL: C.purple, SDA: C.blue };
  for (const k of ["GND", "VCC", "SCL", "SDA"]) wires.push(ffWire(o.pins[k], t[k], oc[k], [{ x: o.pins[k].x, y: level[k] }, { x: t[k].x, y: level[k] }], "orth"));
  used.push(t.SCL, t.SDA, t.VCC, t.GND);

  // DHT11: 보드 오른쪽, 핀이 아래로. io13 기둥 S · V · G 에 F-F 로 바로 (15장과 같은 빈 띠 길)
  const t13 = b.triple(13);
  const dht = dht11(508, top + 22, { titleAt: { x: 546, y: top + 8 } });
  parts.push(dht.svg);
  const lane = (k) => b.lane.top + 4 + k * 6;
  const run = (p, pin, color, dx, k) => ffWire(p, pin, color, [{ x: p.x, y: lane(k) }, { x: t13.S.x + dx, y: lane(k) }, { x: t13.S.x + dx, y: pin.y + 4 }], "orth");
  wires.push(run(dht.pins.S, t13.S, C.blue, -4, 2), run(dht.pins.V, t13.V, C.red, 0, 1), run(dht.pins.G, t13.G, C.black, 4, 0));
  used.push(t13.S, t13.V, t13.G);

  // 브레드보드: 보드 아래, 위쪽 + − 줄 (+ 줄 3V3, − 줄 GND)
  const bb = breadboard({ x: 56, y: 650, cols: 32, rails: { top: true, bottom: false } });
  const rail = (s, c) => bb.rail("top", s, c);
  const plusY = rail("+", 1).y, minusY = rail("-", 1).y;

  const v33 = b.power("3V3"), gnd = b.power("GND", 1);
  wires.push(mfWire(v33, rail("+", 13), C.red));
  wires.push(mfWire(gnd, rail("-", 15), C.black, [{ x: gnd.x, y: minusY }], "orth"));
  used.push(v33, gnd);

  // 포토레지스터 분압: + 줄 → 16번 줄 → 10kΩ → 19번 줄(← io34) → 포토레지스터 → 21번 줄 → − 줄
  const s34 = b.gpio(34, { at: "bottom" });
  [16, 19, 21].forEach((c) => bb.tint(c, "top"));
  const r10a = resistor(bb.hole(16, "c"), bb.hole(19, "c"), { bands: TEN_K, label: "10kΩ" });
  const ldr = photoresistor(bb.hole(19, "e"), bb.hole(21, "e"), { up: false, lift: 30 });
  wires.push(mmWire(bb.hole(16, "a"), rail("+", 16), C.red, pastRail(bb.hole(16, "a"), rail("+", 16), minusY), "orth"));
  wires.push(mfWire(s34, bb.hole(19, "a"), C.green));
  wires.push(mmWire(bb.hole(21, "a"), rail("-", 21), C.black));
  used.push(s34);

  // 가변저항: 23 · 24 · 25번 줄, 가운데 24 ← io39, 23 → − 줄, 25 → + 줄
  const s39 = b.gpio(39);
  [23, 24, 25].forEach((c) => bb.tint(c, "top"));
  const pot = potentiometer(bb.hole(23, "e"), bb.hole(24, "e"), bb.hole(25, "e"), { up: false, lift: 32 });
  wires.push(mfWire(s39, bb.hole(24, "a"), C.teal));
  wires.push(mmWire(bb.hole(23, "a"), rail("-", 23), C.black));
  wires.push(mmWire(bb.hole(25, "a"), rail("+", 25), C.red, pastRail(bb.hole(25, "a"), rail("+", 25), minusY), "orth"));
  used.push(s39);

  // 틸트 스위치(풀업): + 줄 → 31번 줄 → 10kΩ → 28번 줄(← io14) → 틸트 스위치 → 26번 줄 → − 줄
  [26, 28, 31].forEach((c) => bb.tint(c, "top"));
  const r10b = resistor(bb.hole(28, "c"), bb.hole(31, "c"), { bands: TEN_K, label: "10kΩ" });
  const tilt = tiltSwitch(bb.hole(26, "e"), bb.hole(28, "e"), { up: false, lift: 30 });
  wires.push(mmWire(bb.hole(31, "a"), rail("+", 31), C.red, pastRail(bb.hole(31, "a"), rail("+", 31), minusY), "orth"));
  wires.push(mmWire(bb.hole(26, "a"), rail("-", 26), C.black));
  parts.push(bb.svg, r10a.svg, ldr.svg, pot.svg, r10b.svg, tilt.svg);

  // 소리 센서: 보드와 브레드보드 사이 왼쪽. V · G → + − 줄, S → 빈 길(ANALOG 글자와 I2C 묶음 사이)로 올라가 io35 줄 S
  const snd = sensor3(90, 540, "sound");
  parts.push(snd.svg);
  const a35 = b.gpio(35), lanex = b.bounds.x + 124;
  wires.push(ffWire(snd.pins.S, a35, C.orange, [{ x: snd.pins.S.x, y: snd.pins.S.y + 8 }, { x: lanex, y: snd.pins.S.y + 8 }, { x: lanex, y: a35.y }], "orth"));
  wires.push(mfWire(snd.pins.V, rail("+", 4), C.red, [{ x: snd.pins.V.x, y: plusY - 10 }, { x: rail("+", 4).x, y: plusY - 10 }], "orth"));
  wires.push(mfWire(snd.pins.G, rail("-", 3), C.black, [{ x: snd.pins.G.x, y: minusY }], "orth"));
  used.push(a35);

  // PIR: 보드와 브레드보드 사이 오른쪽. V · G → + − 줄, S → 보드 오른쪽 바깥 길 → 보드 위 → 위 한 줄 io23
  const pir = sensor3(542, 540, "pir");
  parts.push(pir.svg);
  const p23 = b.gpio(23), Lp = top - 20;
  wires.push(ffWire(pir.pins.S, p23, C.blue, [{ x: pir.pins.S.x, y: pir.pins.S.y + 8 }, { x: 630, y: pir.pins.S.y + 8 }, { x: 630, y: Lp }, { x: p23.x, y: Lp }], "orth"));
  wires.push(mfWire(pir.pins.V, rail("+", 32), C.red));
  const pg = rail("-", 29);
  wires.push(mfWire(pir.pins.G, pg, C.black, [{ x: pir.pins.G.x, y: pir.pins.G.y + 22 }, { x: pg.x + 8, y: pir.pins.G.y + 22 }, { x: pg.x + 8, y: minusY }], "orth"));
  used.push(p23);

  // 틸트 선: 위 한 줄 io14 → 보드 위 → 오른쪽 바깥 길 → PIR 위를 지나 28번 줄
  const p14 = b.gpio(14), Lt = top - 8, tIn = bb.hole(28, "a"), yT = bot + 10;
  wires.push(mfWire(p14, tIn, C.yellow, [{ x: p14.x, y: Lt }, { x: 618, y: Lt }, { x: 618, y: yT }, { x: tIn.x + 8, y: yT }, { x: tIn.x + 8, y: tIn.y - 14 }, { x: tIn.x, y: tIn.y - 14 }], "orth"));
  used.push(p14);

  const rows = [
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "위 한 줄 GND · 5V (보드에 바로)" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "위 한 줄 SDA · SCL (보드에 바로)" },
    { colors: [C.black, C.red, C.blue], part: "DHT11 G · V · S", to: "io13 기둥 G · V · S (보드에 바로)" },
    { color: C.blue, part: "PIR S", to: "io23 (보드 바깥으로 돌아 위 한 줄)" },
    { color: C.orange, part: "소리 센서 S", to: "ANALOG 묶음 io35 줄 S" },
    { colors: [C.red, C.black], part: "PIR · 소리 센서 V · G", to: "+ 줄 · − 줄" },
    { colors: [C.red, C.black], part: "3V3 · GND (아래 줄)", to: "+ 줄 · − 줄" },
    { color: C.green, part: "io34 (아래 줄)", to: "19번 줄 (10kΩ 과 포토레지스터 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 16번 줄 · 포토레지스터 21번 줄", to: "+ 줄 · − 줄" },
    { color: C.teal, part: "io39 (아래 줄)", to: "24번 줄 (가변저항 가운데 다리)" },
    { colors: [C.black, C.red], part: "가변저항 23번 줄 · 25번 줄", to: "− 줄 · + 줄" },
    { color: C.yellow, part: "io14", to: "28번 줄 (10kΩ 과 틸트 스위치 사이, 보드 바깥 길)" },
    { colors: [C.red, C.black], part: "10kΩ 31번 줄 · 틸트 26번 줄", to: "+ 줄 · − 줄" },
  ];
  const table = connectionTable(bb.y + bb.h + 16, "이렇게 꽂아요 — 모듈은 보드에 바로, 맨 부품은 브레드보드에", rows, "plus", { columns: 1 });
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit 38핀) ───── */
function devkit() {
  const bb = breadboard({ x: 40, y: 8, cols: 28, rails: { top: false, bottom: true } });
  const b = makeDevkit({ x: 110, y: 440 });
  const top = b.bounds.y, bot = b.bounds.y + b.bounds.h;
  const parts = [], wires = [], used = [];
  const rail = (s, c) => bb.rail("bottom", s, c);
  const minusY = rail("-", 1).y, plusY = rail("+", 1).y;
  const j = (c) => bb.hole(c, "j");

  // 3V3(위 줄 끝) → 보드 왼쪽 바깥 길 → + 줄 2번 칸(아래에서)
  const v33 = b.power("3V3");
  wires.push(mfWire(v33, rail("+", 2), C.red, [{ x: v33.x, y: bot + 8 }, { x: rail("+", 2).x, y: bot + 8 }], "orth"));
  used.push(v33);
  // 위 줄 GND → 보드 바로 위에서 왼쪽으로 → + 줄 구멍 사이로 − 줄 3번 칸
  const gTop = b.power("GND", 0), g3 = rail("-", 3);
  wires.push(mfWire(gTop, g3, C.black, [{ x: gTop.x, y: top - 14 }, { x: g3.x - 8, y: top - 14 }, { x: g3.x - 8, y: g3.y + 8 }, { x: g3.x, y: g3.y + 8 }], "orth"));
  used.push(gTop);

  // DHT11: D13 바로 위(핀이 아래로). S → D13, V · G → 모듈 왼쪽으로 돌아 + 줄 4번 · − 줄 5번
  const dht = dht11(140, 300, { titleAt: { x: 178, y: 284 } });
  parts.push(dht.svg);
  const d13 = b.gpio(13);
  wires.push(ffWire(dht.pins.S, d13, C.blue, [{ x: dht.pins.S.x, y: top - 30 }, { x: d13.x, y: top - 30 }], "orth"));
  const dV = rail("+", 4), dG = rail("-", 5);
  wires.push(mfWire(dht.pins.V, dV, C.red, [{ x: dht.pins.V.x, y: dht.pins.V.y + 22 }, { x: dV.x, y: dht.pins.V.y + 22 }], "orth"));
  wires.push(mfWire(dht.pins.G, dG, C.black, [{ x: dht.pins.G.x, y: dht.pins.G.y + 12 }, { x: dG.x - 8, y: dht.pins.G.y + 12 }, { x: dG.x - 8, y: dG.y + 8 }, { x: dG.x, y: dG.y + 8 }], "orth"));
  used.push(d13);

  // + 줄(아래 칸 j 에서 − 줄을 건너): 구멍 사이 길로 내려가 + 줄 구멍에
  const toPlus = (c, pc = c) => mmWire(j(c), rail("+", pc), C.red, pastRail(j(c), rail("+", pc), minusY), "orth");

  // 틸트 스위치(풀업): + 줄 → 8번 줄 → 10kΩ → 11번 줄(← D14) → 틸트 스위치 → 13번 줄 → − 줄
  const d14 = b.gpio(14);
  [8, 11, 13].forEach((c) => bb.tint(c, "bottom"));
  parts.push(resistor(bb.hole(8, "h"), bb.hole(11, "h"), { bands: TEN_K, label: "10kΩ" }).svg, tiltSwitch(bb.hole(11, "f"), bb.hole(13, "f")).svg);
  wires.push(mfWire(d14, j(11), C.yellow));
  wires.push(toPlus(8), mmWire(j(13), rail("-", 13), C.black));
  used.push(d14);

  // 소리 센서: D35 왼쪽 위(핀이 아래로). S → D35, V · G → 모듈 왼쪽으로 돌아 + 줄 14번 · − 줄 15번
  const snd = sensor3(296, 300, "sound", { titleAt: { x: 334, y: 284 } });
  parts.push(snd.svg);
  const d35 = b.gpio(35);
  wires.push(ffWire(snd.pins.S, d35, C.orange, [{ x: snd.pins.S.x, y: top - 30 }, { x: d35.x, y: top - 30 }], "orth"));
  const sV = rail("+", 14), sG = rail("-", 15);
  wires.push(mfWire(snd.pins.V, sV, C.red, [{ x: snd.pins.V.x, y: snd.pins.V.y + 22 }, { x: sV.x, y: snd.pins.V.y + 22 }], "orth"));
  wires.push(mfWire(snd.pins.G, sG, C.black, [{ x: snd.pins.G.x, y: snd.pins.G.y + 12 }, { x: sG.x - 8, y: snd.pins.G.y + 12 }, { x: sG.x - 8, y: sG.y + 8 }, { x: sG.x, y: sG.y + 8 }], "orth"));
  used.push(d35);

  // 포토레지스터 분압: + 줄 → 18번 줄 → 10kΩ → 21번 줄(← D34) → 포토레지스터 → 23번 줄 → − 줄
  const d34 = b.gpio(34);
  [18, 21, 23].forEach((c) => bb.tint(c, "bottom"));
  parts.push(resistor(bb.hole(18, "h"), bb.hole(21, "h"), { bands: TEN_K, label: "10kΩ" }).svg, photoresistor(bb.hole(21, "f"), bb.hole(23, "f")).svg);
  wires.push(mfWire(d34, j(21), C.green));
  wires.push(toPlus(18, 19), mmWire(j(23), rail("-", 23), C.black));
  used.push(d34);

  // 가변저항: 25 · 26 · 27번 줄(f), 가운데 26 ← VN(39), 25 → − 줄, 27 → + 줄
  const vn = b.gpio(39);
  [25, 26, 27].forEach((c) => bb.tint(c, "bottom"));
  parts.push(potentiometer(bb.hole(25, "f"), bb.hole(26, "f"), bb.hole(27, "f")).svg);
  wires.push(mfWire(vn, j(26), C.teal));
  wires.push(mmWire(j(25), rail("-", 25), C.black), toPlus(27));
  used.push(vn);

  // PIR: 브레드보드 오른쪽(핀이 아래로). V · G → + − 줄 오른쪽 끝, S → 보드 오른쪽 바깥 길 → D23(아래 줄)
  const pir = sensor3(546, 112, "pir", { titleAt: { x: 584, y: 96 } });
  parts.unshift(bb.svg);
  parts.push(pir.svg);
  const d23 = b.gpio(23), plusEnd = rail("+", 28), minusEnd = rail("-", 28);
  wires.push(mfWire(pir.pins.G, minusEnd, C.black, [{ x: pir.pins.G.x, y: minusEnd.y }], "orth"));
  wires.push(mfWire(pir.pins.V, plusEnd, C.red, [{ x: pir.pins.V.x, y: plusEnd.y }], "orth"));
  wires.push(ffWire(pir.pins.S, d23, C.blue, [{ x: pir.pins.S.x, y: pir.pins.S.y + 10 }, { x: 624, y: pir.pins.S.y + 10 }, { x: 624, y: bot + 14 }, { x: d23.x, y: bot + 14 }], "orth"));
  used.push(d23);

  // OLED: 보드 아래(핀이 위로). GND → 아래 줄 GND, SDA → D21, SCL → D22, VCC → 보드 왼쪽 바깥 길 → + 줄 1번 칸
  const gBot = b.power("GND", 1);
  const o = oled(gBot.x - 24, bot + 70, { titleAt: { x: gBot.x + 30, y: bot + 200 } });
  parts.push(o.svg);
  const sda = b.gpio(21), scl = b.gpio(22), p1 = rail("+", 1);
  wires.push(ffWire(o.pins.GND, gBot, C.black, [], "line"));
  wires.push(ffWire(o.pins.SDA, sda, C.blue, [{ x: o.pins.SDA.x, y: bot + 30 }, { x: sda.x, y: bot + 30 }], "orth"));
  wires.push(ffWire(o.pins.SCL, scl, C.purple, [{ x: o.pins.SCL.x, y: bot + 40 }, { x: scl.x, y: bot + 40 }], "orth"));
  wires.push(mfWire(o.pins.VCC, p1, C.red, [{ x: o.pins.VCC.x, y: bot + 50 }, { x: 20, y: bot + 50 }, { x: 20, y: p1.y }], "orth"));
  used.push(gBot, sda, scl);

  const rows = [
    { color: C.red, part: "3V3 (위 줄 끝)", to: "+ 줄 (보드 바깥 길)" }, { color: C.black, part: "GND (위 줄)", to: "− 줄" },
    { color: C.blue, part: "DHT11 S", to: "D13 (보드에 바로)" },
    { color: C.orange, part: "소리 센서 S", to: "D35 (보드에 바로)" },
    { color: C.blue, part: "PIR S", to: "D23 (보드 바깥으로 돌아 아래 줄)" },
    { colors: [C.red, C.black], part: "DHT11 · 소리 센서 · PIR V · G", to: "+ 줄 · − 줄" },
    { colors: [C.black, C.blue, C.purple], part: "OLED GND · SDA · SCL", to: "GND · D21 · D22 (아래 줄에 바로)" },
    { color: C.red, part: "OLED VCC", to: "+ 줄 (보드 바깥 길)" },
    { color: C.yellow, part: "D14", to: "11번 줄 (10kΩ 과 틸트 스위치 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 8번 줄 · 틸트 13번 줄", to: "+ 줄 · − 줄" },
    { color: C.green, part: "D34", to: "21번 줄 (10kΩ 과 포토레지스터 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 18번 줄 · 포토레지스터 23번 줄", to: "+ 줄 · − 줄" },
    { color: C.teal, part: "VN(39)", to: "26번 줄 (가변저항 가운데 다리)" },
    { colors: [C.black, C.red], part: "가변저항 25번 줄 · 27번 줄", to: "− 줄 · + 줄" },
  ];
  const table = connectionTable(o.pins.GND.y + 150, "이렇게 꽂아요 — 3V3 · GND 는 + − 줄로 나눠 써요", rows, "devkit", { columns: 1 });
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 확장 보드(38핀 확장 보드 + DevKit): 점퍼 3.3V ───── */
function expansion() {
  const bb = breadboard({ x: 40, y: 8, cols: 30, rails: { top: false, bottom: true } });
  const b = makeExpansion({ x: 22, y: 436, jumper: "3V3" });
  const Y0 = b.bounds.y;
  const parts = [bb.svg], wires = [], used = [];
  const rail = (s, c) => bb.rail("bottom", s, c);
  const j = (c) => bb.hole(c, "j");
  const lane = (k) => bb.y + bb.h + 10 + k * 8;
  const toRail = (c, s, rc = c) => mmWire(j(c), rail(s, rc), s === "+" ? C.red : C.black, [], "line");

  // 전원: 전원 헤더 3V → 헤더 GND 핀 사이로 올라가 + 줄 7번 칸, 전원 헤더 GND → − 줄 9번 칸
  const v33 = b.power("3V3", 1), gnd = b.power("GND", 5);
  const p7 = rail("+", 7);
  wires.push(mfWire(v33, p7, C.red, [{ x: p7.x, y: v33.y }], "orth"), mfWire(gnd, rail("-", 9), C.black));
  used.push(v33, gnd);

  // 틸트 스위치(풀업): + 줄 → 14번 줄 → 10kΩ → 17번 줄(← P14) → 틸트 스위치 → 19번 줄 → − 줄
  [14, 17, 19].forEach((c) => bb.tint(c, "bottom"));
  parts.push(resistor(bb.hole(14, "h"), bb.hole(17, "h"), { bands: TEN_K, label: "10kΩ" }).svg, tiltSwitch(bb.hole(17, "f"), bb.hole(19, "f")).svg);
  wires.push(toRail(14, "+"), toRail(19, "-"));
  // 포토레지스터 분압: + 줄 → 22번 줄 → 10kΩ → 26번 줄(← P34) → 포토레지스터 → 24번 줄 → − 줄
  [22, 24, 26].forEach((c) => bb.tint(c, "bottom"));
  parts.push(resistor(bb.hole(22, "h"), bb.hole(26, "h"), { bands: TEN_K, label: "10kΩ" }).svg, photoresistor(bb.hole(24, "f"), bb.hole(26, "f")).svg);
  wires.push(toRail(22, "+"), toRail(24, "-", 23));
  // 가변저항: 27 · 28 · 29번 줄, 가운데 28 ← SVN(39), 27 → − 줄, 29 → + 줄
  [27, 28, 29].forEach((c) => bb.tint(c, "bottom"));
  parts.push(potentiometer(bb.hole(27, "f"), bb.hole(28, "f"), bb.hole(29, "f")).svg);
  wires.push(toRail(27, "-"), toRail(29, "+"));

  // 보드 → 브레드보드 (위 줄): P14 → 17, P34 → 26, SVN(39) → 28. SVN 선이 P34 선보다 위 길
  const s14 = b.gpio(14), s34 = b.gpio(34), s39 = b.gpio(39);
  wires.push(mfWire(s14, j(17), C.yellow, [{ x: s14.x, y: lane(2) }, { x: j(17).x, y: lane(2) }], "orth"));
  wires.push(mfWire(s34, j(26), C.green, [{ x: s34.x, y: lane(1) }, { x: j(26).x, y: lane(1) }], "orth"));
  wires.push(mfWire(s39, j(28), C.teal, [{ x: s39.x, y: lane(0) }, { x: j(28).x, y: lane(0) }], "orth"));
  used.push(s14, s34, s39);

  // DHT11: P13 칸 바로 위(핀이 아래로). 소리 센서: P35 칸 왼쪽 위로 비켜(핀이 아래로), 세 선을 계단처럼
  const my = Y0 - 118;
  const t13 = b.triple(13), t35 = b.triple(35);
  const dht = dht11(t13.S.x - 38, my, { titleAt: { x: t13.S.x - 48, y: my + 35, anchor: "end" } });
  const snd = sensor3(380, my, "sound", { titleAt: { x: 418, y: my - 14 } });
  parts.push(dht.svg, snd.svg);
  parts.push(columnRun(t13, dht.pins, { turnY: Y0 - 14 }));
  parts.push(columnRun(t35, snd.pins, { turnY: { S: Y0 - 26, V: Y0 - 18, G: Y0 - 10 }, colors: { G: C.black, V: C.red, S: C.orange } }));
  used.push(t13.G, t13.V, t13.S, t35.G, t35.V, t35.S);

  // PIR: 아래 줄 P23 칸 기둥 바로 아래(핀이 위로)
  const t23 = b.triple(23);
  const py = Y0 + 380;
  const pir = sensor3(t23.S.x - 38, py, "pir", { side: "top", titleAt: { x: t23.S.x - 48, y: py + 35, anchor: "end" } });
  parts.push(pir.svg, columnRun(t23, pir.pins, { turnY: Y0 + 340, colors: { G: C.black, V: C.red, S: C.purple } }));
  used.push(t23.G, t23.V, t23.S);

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
    { colors: [C.black, C.red, C.blue], part: "DHT11 G · V · S", to: "P13 칸 G · V · S (보드에 바로)" },
    { colors: [C.black, C.red, C.orange], part: "소리 센서 G · V · S", to: "P35 칸 G · V · S (보드에 바로)" },
    { colors: [C.black, C.red, C.purple], part: "PIR G · V · S", to: "아래 줄 P23 칸 G · V · S (보드에 바로)" },
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C 헤더 GND · VCC" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C 헤더 D21 · D22" },
    { colors: [C.red, C.black], part: "전원 헤더 3V · GND", to: "+ 줄 · − 줄 (3V 는 헤더 GND 핀 사이로)" },
    { color: C.yellow, part: "P14 칸 S", to: "17번 줄 (10kΩ 과 틸트 스위치 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 14번 줄 · 틸트 19번 줄", to: "+ 줄 · − 줄" },
    { color: C.green, part: "P34 칸 S", to: "26번 줄 (10kΩ 과 포토레지스터 사이)" },
    { colors: [C.red, C.black], part: "10kΩ 22번 줄 · 포토레지스터 24번 줄", to: "+ 줄 · − 줄" },
    { color: C.teal, part: "SVN(39) 칸 S", to: "28번 줄 (가변저항 가운데 다리)" },
    { colors: [C.black, C.red], part: "가변저항 27번 줄 · 29번 줄", to: "− 줄 · + 줄" },
  ];
  const table = connectionTable(Y0 + 512, "이렇게 꽂아요 — 모듈은 기둥에 바로, 맨 부품은 브레드보드에", rows, b.legend, { columns: 1 });
  const jumperNote = note(232, Y0 + 328, "JUMP 점퍼는 3.3V 쪽 (V 줄 = 3.3V)", "start", 12);
  return { body: compose(b.draw(used, { note: false }), parts, wires, [jumperNote, table.svg]), height: table.bottom };
}

const T = {
  plus: "우리 반 센서 상황판 배선도(ESP32 Plus 확장 보드): OLED 화면 GND · VCC · SCL · SDA 는 보드 위쪽 한 줄 GND · 5V · SCL · SDA 에, DHT11 G · V · S 는 io13 기둥 G · V · S 에 F-F 듀폰선으로 바로. 브레드보드는 보드 아래: 아래 줄 3V3 → + 줄, GND → − 줄. 포토레지스터 분압: + 줄 → 16번 줄 → 10kΩ 저항 → 19번 줄(← 아래 줄 io34) → 포토레지스터 → 21번 줄 → − 줄. 가변저항은 23 · 24 · 25번 줄, 가운데 24번 줄 ← 아래 줄 io39, 23번 줄 → − 줄, 25번 줄 → + 줄. 틸트 스위치(풀업): + 줄 → 31번 줄 → 10kΩ → 28번 줄 → 틸트 스위치 → 26번 줄 → − 줄, 28번 줄 ← 보드 바깥 길로 내려온 io14. 소리 센서 모듈 V · G → + − 줄, S → ANALOG 묶음 io35 줄 S. PIR 센서 모듈 V · G → + − 줄, S → 보드 바깥 길로 돌아 위쪽 io23",
  expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) 우리 반 센서 상황판 배선도: JUMP 점퍼는 3.3V 쪽(평소 자리). DHT11 G · V · S 는 P13 칸 G · V · S, 소리 센서 G · V · S 는 P35 칸 G · V · S, PIR 센서 G · V · S 는 아래 줄 P23 칸 G · V · S 에 F-F 듀폰선으로 바로. OLED 화면 GND · VCC · SDA · SCL 은 I2C 헤더의 GND · VCC · D21 · D22 에. 브레드보드는 보드 위: 전원 헤더 3V → 헤더 GND 핀 사이로 올라가 + 줄, 전원 헤더 GND → − 줄. 틸트 스위치(풀업): + 줄 → 14번 줄 → 10kΩ → 17번 줄(← P14 칸 S 핀) → 틸트 스위치 → 19번 줄 → − 줄. 포토레지스터 분압: + 줄 → 22번 줄 → 10kΩ → 26번 줄(← P34 칸 S 핀) → 포토레지스터 → 24번 줄 → − 줄. 가변저항 27 · 28 · 29번 줄, 가운데 28번 줄 ← SVN(39) 칸 S 핀, 27번 줄 → − 줄, 29번 줄 → + 줄",
  devkit: "기본 보드(ESP32 DevKit 38핀) 우리 반 센서 상황판 배선도: 브레드보드는 보드 위. 3V3 → 보드 바깥으로 돌아 아래 + 줄, 위 줄 GND → − 줄. DHT11 S → D13, 소리 센서 S → D35 에 F-F 듀폰선으로 바로, 두 모듈의 V · G 는 + − 줄. PIR 센서 V · G → + − 줄 끝, S → 보드 바깥으로 돌아 D23. 틸트 스위치(풀업): + 줄 → 8번 줄 → 10kΩ → 11번 줄(← D14) → 틸트 스위치 → 13번 줄 → − 줄. 포토레지스터 분압: + 줄 → 18번 줄 → 10kΩ → 21번 줄(← D34) → 포토레지스터 → 23번 줄 → − 줄. 가변저항 25 · 26 · 27번 줄, 가운데 26번 줄 ← VN(39), 25번 줄 → − 줄, 27번 줄 → + 줄. OLED 는 보드 아래: GND → 아래 줄 GND, SDA → D21, SCL → D22, VCC → 보드 바깥 길로 + 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wsb", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wsbk", T.devkit, r.body, r.height); },
    expansion: () => { const r = expansion(); return svgDoc("wsbx", T.expansion, r.body, r.height); },
  },
};
