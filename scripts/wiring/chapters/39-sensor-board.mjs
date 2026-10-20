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
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, name, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, module, oled, photoresistor, potentiometer, resistor, sensor3, tiltSwitch } from "../parts.mjs";

const TEN_K = ["#8b5a2b", "#212529", "#f76707"]; // 갈 검 주

/** DHT11 모듈(15장 dht11 과 같은 그림 — 핀 이름이 가리지 않게 그림을 핀 반대쪽에) */
function dht11(x, y, { side = "bottom", pins = ["G", "V", "S"], titleAt } = {}) {
  return module({
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

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  const bb = breadboard({ x: 40, y: 8, cols: 28, rails: { top: false, bottom: true } });
  const b = makeDevkit({ x: 110, y: 440 });
  const top = b.bounds.y, bot = b.bounds.y + b.bounds.h;
  const parts = [], wires = [], used = [];
  const rail = (s, c) => bb.rail("bottom", s, c);
  const minusY = rail("-", 1).y, plusY = rail("+", 1).y;
  const j = (c) => bb.hole(c, "j");

  // 3V3(아래 줄) → 보드 왼쪽 바깥 길 → + 줄 2번 칸(아래에서)
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
    { color: C.red, part: "3V3 (아래 줄)", to: "+ 줄 (보드 바깥 길)" }, { color: C.black, part: "GND (위 줄)", to: "− 줄" },
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

const T = {
  plus: "우리 반 센서 상황판 배선도(ESP32 Plus 확장 보드): OLED 화면 GND · VCC · SCL · SDA 는 보드 위쪽 한 줄 GND · 5V · SCL · SDA 에, DHT11 G · V · S 는 io13 기둥 G · V · S 에 F-F 듀폰선으로 바로. 브레드보드는 보드 아래: 아래 줄 3V3 → + 줄, GND → − 줄. 포토레지스터 분압: + 줄 → 16번 줄 → 10kΩ 저항 → 19번 줄(← 아래 줄 io34) → 포토레지스터 → 21번 줄 → − 줄. 가변저항은 23 · 24 · 25번 줄, 가운데 24번 줄 ← 아래 줄 io39, 23번 줄 → − 줄, 25번 줄 → + 줄. 틸트 스위치(풀업): + 줄 → 31번 줄 → 10kΩ → 28번 줄 → 틸트 스위치 → 26번 줄 → − 줄, 28번 줄 ← 보드 바깥 길로 내려온 io14. 소리 센서 모듈 V · G → + − 줄, S → ANALOG 묶음 io35 줄 S. PIR 센서 모듈 V · G → + − 줄, S → 보드 바깥 길로 돌아 위쪽 io23",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 우리 반 센서 상황판 배선도: 브레드보드는 보드 위. 3V3 → 보드 바깥으로 돌아 아래 + 줄, 위 줄 GND → − 줄. DHT11 S → D13, 소리 센서 S → D35 에 F-F 듀폰선으로 바로, 두 모듈의 V · G 는 + − 줄. PIR 센서 V · G → + − 줄 끝, S → 보드 바깥으로 돌아 D23. 틸트 스위치(풀업): + 줄 → 8번 줄 → 10kΩ → 11번 줄(← D14) → 틸트 스위치 → 13번 줄 → − 줄. 포토레지스터 분압: + 줄 → 18번 줄 → 10kΩ → 21번 줄(← D34) → 포토레지스터 → 23번 줄 → − 줄. 가변저항 25 · 26 · 27번 줄, 가운데 26번 줄 ← VN(39), 25번 줄 → − 줄, 27번 줄 → + 줄. OLED 는 보드 아래: GND → 아래 줄 GND, SDA → D21, SCL → D22, VCC → 보드 바깥 길로 + 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wsb", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wsbk", T.devkit, r.body, r.height); },
  },
};
