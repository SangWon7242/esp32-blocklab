// 융합 F17 "스마트 화분" — 토양 수분 센서 S → 34번, 수위 센서 S → 35번 (WiFi 를 함께 쓰니 아날로그는 ADC1 32~39번),
// 릴레이 S → 26번, OLED I2C(SCL 22 · SDA 21). 펌프 회로: 보드 5V(VIN) → 릴레이 COM, 릴레이 NO → 펌프 +, 펌프 − → GND.
// 두 센서는 3V3 으로 (5V 를 주면 34 · 35번에 3.3V 넘게 들어갈 수 있다). 릴레이 · 펌프 · OLED 는 5V.
//
// Plus: OLED 는 보드 위에서 위 한 줄 SCL · SDA · 5V · GND 로(39장과 같은 꼴).
//   릴레이는 보드 오른쪽, 입력 핀이 위로: G · V · S 는 ESP32 모듈 위 띠를 지나 io26 기둥과 오른쪽 TX · RX · G · V 장식 핀 사이 틈으로
//   올라가 기둥 G · V · S 에 옆에서 꽂는다(다른 핀 위를 지나지 않게).
//   릴레이 단자는 아래: COM → 보드 아래로 돌아 아래 줄 VIN, NO → 아래 물통 속 펌프 +.
//   두 센서는 보드 아래(핀이 아래로): S 는 두 모듈 사이로 올라가 아래 줄 io34 · io35, V · G 는 맨 아래 + − 줄 띠(3V3 · GND).
//   펌프 − 는 물통 오른쪽 바깥으로 내려와 띠 − 줄 오른쪽 끝. (COM 선이 두 센서 S 선을 한 번씩 건넌다 — VIN 이 34 · 35 보다 왼쪽이라 피할 수 없다)
// DevKit: 보드 위 왼쪽에 물통 · 릴레이 · 5V 띠(VIN · 위 줄 GND), 오른쪽에 두 센서 · 3V3 띠(3V3). 두 띠의 − 줄은 점퍼로.
//   릴레이 S · 두 센서 S 는 띠의 구멍 없는 열(12 · 6번)로 지나 D26 · D35 · D34 에 바로. OLED 는 보드 아래(39장과 같은 꼴):
//   GND · SDA · SCL 은 아래 줄에 바로, VCC 는 보드 왼쪽 바깥 길로 5V 띠 + 줄.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, name, svgDoc, wire } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, oled, relay, sensor3, waterPump } from "../parts.mjs";

/** 나사 단자 · 펌프 선 끝 (벗긴 선 끝을 꽂는다) */
const bare = (from, to, color, via = [], style = "orth") => wire(from, to, color, { via, style, ends: ["m", "m"] });
/** 작은 이름표 (선 사이 좁은 자리) */
const tag = (x, y, s, anchor = "middle") => name(x, y, s, anchor, 13);

/* ───── ESP32 Plus ───── */
function plus() {
  const b = makePlus({ x: 60, y: 200 });
  const { x: bx, y: by, w: bw, h: bh } = b.bounds;
  const parts = [], wires = [], used = [];
  const bot = by + bh - 25; // 기판 아래 끝

  // OLED: 보드 위(핀이 위로). 선은 위로 올라가 왼쪽으로 돌아 위 한 줄 SCL · SDA · 5V · GND 로 (39장과 같은 꼴)
  const o = oled(214, 58, { titleAt: { x: 332, y: 112, anchor: "start" } });
  parts.push(o.svg);
  const t = { SCL: b.pin("top:SCL"), SDA: b.pin("top:SDA"), VCC: b.pin("top:5V"), GND: b.pin("top:GND") };
  const level = { GND: o.pins.GND.y - 8, VCC: o.pins.GND.y - 16, SCL: o.pins.GND.y - 24, SDA: o.pins.GND.y - 32 };
  const oc = { GND: C.black, VCC: C.red, SCL: C.purple, SDA: C.blue };
  for (const k of ["GND", "VCC", "SCL", "SDA"]) wires.push(ffWire(o.pins[k], t[k], oc[k], [{ x: o.pins[k].x, y: level[k] }, { x: t[k].x, y: level[k] }], "orth"));
  used.push(t.SCL, t.SDA, t.VCC, t.GND);

  // 릴레이: 보드 오른쪽, 입력 핀이 위로(G · V · S), 단자가 아래로(COM · NO)
  // 입력 선은 ESP32 모듈 위 띠(오른쪽 장식 핀 아래)로 와서 io26 기둥 오른쪽 틈에서 올라가 핀 높이에서 옆으로 꽂는다.
  // S 가 가장 높은 줄 · 가장 바깥(오른쪽) 틈, G 가 가장 낮은 줄 · 가장 안쪽 틈이라 서로 건너지 않는다.
  const t26 = b.triple(26);
  const level26 = { S: 308.5, V: 313, G: 317.5 }, rise = { S: t26.S.x + 32, V: t26.S.x + 22, G: t26.S.x + 13 };
  const r = relay(bx + bw + 18, level26.G + 12, { side: "top", title: false });
  parts.push(r.svg, tag(r.pins.V.x + 10, r.pins.V.y - 24, "릴레이 모듈"));
  const rc = { G: C.black, V: C.red, S: C.yellow };
  for (const k of ["G", "V", "S"]) wires.push(ffWire(r.pins[k], t26[k], rc[k], [{ x: r.pins[k].x, y: level26[k] }, { x: rise[k], y: level26[k] }, { x: rise[k], y: t26[k].y }], "orth"));
  used.push(t26.S, t26.V, t26.G);

  // 두 센서: 보드 아래, 핀이 아래로. 토양 수분 G · V · S, 수위 S · V · G (S 끼리 두 모듈 사이로 올라간다)
  const sy = bot + 46;
  const soil = sensor3(312, sy, "soil", { title: false });
  const water = sensor3(432, sy, "water", { pins: ["S", "V", "G"], title: false });
  parts.push(soil.svg, water.svg, tag(350, sy - 12, "토양 수분 센서"), tag(470, sy - 12, "수위 센서"));
  const s34 = b.gpio(34, { at: "bottom" }), s35 = b.gpio(35, { at: "bottom" });
  const under = soil.pins.S.y + 8;
  wires.push(ffWire(soil.pins.S, s34, C.green, [{ x: soil.pins.S.x, y: under }, { x: 392, y: under }, { x: 392, y: bot - 6 }, { x: s34.x, y: bot - 6 }], "orth"));
  wires.push(ffWire(water.pins.S, s35, C.teal, [{ x: water.pins.S.x, y: under }, { x: 422, y: under }, { x: 422, y: bot }, { x: s35.x, y: bot }], "orth"));
  used.push(s34, s35);

  // 릴레이 COM → 보드 아래로 돌아 아래 줄 VIN (보드 바로 아래 길)
  const vin = b.pin("bot:VIN");
  wires.push(wire(vin, r.pins.COM, C.red, { via: [{ x: vin.x, y: bot + 10 }, { x: r.pins.COM.x, y: bot + 10 }], style: "orth", ends: ["f", "m"] }));
  used.push(vin);

  // + − 줄 띠 (3V3 · GND): 센서 아래
  const strip = breadboard({ x: 150, y: under + 30, cols: 21, railsOnly: true });
  const rail = (s, c) => strip.rail("top", s, c);
  const plusY = rail("+", 1).y, minusY = rail("-", 1).y, midY = (plusY + minusY) / 2;
  parts.push(strip.svg);
  const v33 = b.power("3V3"), gnd = b.power("GND", 1);
  wires.push(mfWire(v33, rail("+", 7), C.red, [{ x: v33.x, y: plusY - 12 }, { x: rail("+", 7).x, y: plusY - 12 }], "orth"));
  wires.push(mfWire(gnd, rail("-", 8), C.black, [{ x: gnd.x, y: midY }, { x: rail("-", 8).x, y: midY }], "orth"));
  used.push(v33, gnd);
  // 센서 V · G → 띠 (G 는 + 줄 구멍 사이로 지나 − 줄)
  const toPlus = (p, c, color) => mfWire(p, rail("+", c), color, [{ x: p.x, y: plusY - 12 }, { x: rail("+", c).x, y: plusY - 12 }], "orth");
  const toMinus = (p, c, color) => mfWire(p, rail("-", c), color, [{ x: p.x, y: minusY }], "orth");
  wires.push(toPlus(soil.pins.V, 11, C.red), toMinus(soil.pins.G, 10, C.black));
  wires.push(toPlus(water.pins.V, 19, C.red), toMinus(water.pins.G, 20, C.black));

  // 물통 · 펌프: 오른쪽 아래. NO → 펌프 +, 펌프 − → 물통 오른쪽 바깥으로 내려와 띠 − 줄 오른쪽 끝(아래에서)
  const tank = waterPump(530, sy + 40, { w: 100, h: 116, hose: "left" });
  parts.push(tank.svg);
  wires.push(bare(r.pins.NO, tank.plus, C.red, [{ x: r.pins.NO.x, y: tank.plus.y - 22 }, { x: tank.plus.x, y: tank.plus.y - 22 }]));
  const pm = rail("-", 21), low = strip.y + strip.h + 10;
  wires.push(bare(tank.minus, pm, C.black, [{ x: tank.minus.x, y: tank.minus.y - 18 }, { x: 636, y: tank.minus.y - 18 }, { x: 636, y: low }, { x: pm.x, y: low }]));

  const rows = [
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "위 한 줄 GND · 5V (보드에 바로)" },
    { colors: [C.purple, C.blue], part: "OLED SCL · SDA", to: "위 한 줄 SCL · SDA (보드에 바로)" },
    { colors: [C.black, C.red, C.yellow], part: "릴레이 G · V · S", to: "io26 기둥 G · V · S (기둥 옆 틈으로)" },
    { color: C.red, part: "릴레이 COM", to: "아래 줄 VIN (보드 아래로 돌아)" },
    { color: C.red, part: "릴레이 NO", to: "펌프 빨강(+)" },
    { color: C.black, part: "펌프 검정(−)", to: "− 줄 끝 (물통 바깥으로 돌아)" },
    { colors: [C.red, C.black], part: "3V3 · GND (아래 줄)", to: "+ 줄 · − 줄" },
    { color: C.green, part: "토양 수분 센서 S", to: "아래 줄 io34" },
    { color: C.teal, part: "수위 센서 S", to: "아래 줄 io35" },
    { colors: [C.red, C.black], part: "두 센서 V · G", to: "+ 줄 · − 줄 (3V3)" },
  ];
  const table = connectionTable(low + 24, "이렇게 꽂아요 — 센서는 3V3, 릴레이와 펌프는 5V", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit 38핀) ───── */
function devkit() {
  const BY = 232;
  const b = makeDevkit({ x: 110, y: BY });
  const bot = b.bounds.y + b.bounds.h;
  const parts = [], wires = [], used = [];

  // + − 줄 띠 둘: 왼쪽 5V(VIN), 오른쪽 3V3. − 줄은 점퍼로 잇는다
  const s5 = breadboard({ x: 40, y: BY - 80, cols: 13, railsOnly: true });
  const s3 = breadboard({ x: 300, y: BY - 80, cols: 17, railsOnly: true });
  const r5 = (s, c) => s5.rail("top", s, c), r3 = (s, c) => s3.rail("top", s, c);
  const plusY = r5("+", 1).y, minusY = r5("-", 1).y, midY = (plusY + minusY) / 2;
  parts.push(s5.svg, s3.svg);
  wires.push(mmWire(r5("-", 13), r3("-", 1), C.black, [], "line"));
  const vin = b.power("5V"), gTop = b.power("GND", 0), v33 = b.power("3V3");
  wires.push(mfWire(vin, r5("+", 4), C.red, [{ x: vin.x, y: midY }, { x: r5("+", 4).x, y: midY }], "orth"));
  wires.push(mfWire(gTop, r5("-", 11), C.black, [{ x: gTop.x, y: minusY + 14 }, { x: r5("-", 11).x, y: minusY + 14 }], "orth"));
  wires.push(mfWire(v33, r3("+", 13), C.red, [{ x: v33.x, y: minusY + 18 }, { x: v33.x + 8, y: minusY + 18 }, { x: v33.x + 8, y: plusY }], "orth"));
  used.push(vin, gTop, v33);

  // 릴레이: 5V 띠 위, 입력 핀이 아래로. G · V → 띠, S → 12번 열(구멍 없음)로 띠를 지나 D26
  const r = relay(179, BY - 180, { title: false });
  parts.push(r.svg, tag(320, BY - 156, "릴레이"), tag(320, BY - 140, "모듈"));
  wires.push(mfWire(r.pins.G, r5("-", 9), C.black, [{ x: r.pins.G.x, y: minusY }], "orth"));
  wires.push(mfWire(r.pins.V, r5("+", 11), C.red, [{ x: r.pins.V.x, y: plusY - 10 }, { x: r5("+", 11).x, y: plusY - 10 }], "orth"));
  const d26 = b.gpio(26);
  wires.push(ffWire(r.pins.S, d26, C.yellow, [{ x: r.pins.S.x, y: BY - 8 }, { x: d26.x, y: BY - 8 }], "orth"));
  used.push(d26);

  // 물통 · 펌프: 왼쪽 위. NO → 펌프 + (위로 돌아), COM → 릴레이 왼쪽으로 내려와 5V 띠 + 줄, 펌프 − → 띠 − 줄
  const tank = waterPump(20, BY - 208, { w: 100, h: 116, hose: "left" });
  parts.push(tank.svg);
  const top = tank.plus.y - 22;
  wires.push(bare(r.pins.NO, tank.plus, C.red, [{ x: r.pins.NO.x, y: top }, { x: tank.plus.x, y: top }]));
  const comX = 170; // 릴레이 왼쪽 바깥
  wires.push(bare(r.pins.COM, r5("+", 8), C.red, [{ x: r.pins.COM.x, y: r.pins.COM.y - 10 }, { x: comX, y: r.pins.COM.y - 10 }, { x: comX, y: plusY - 10 }, { x: r5("+", 8).x, y: plusY - 10 }]));
  wires.push(bare(tank.minus, r5("-", 5), C.black, [{ x: 140, y: tank.minus.y }, { x: 140, y: minusY }]));

  // 두 센서: 3V3 띠 위, 핀이 아래로. S 는 6 · 12번 열(구멍 없음)로 띠를 지나 D35 · D34
  const sy = BY - 208;
  const water = sensor3(350, sy, "water", { title: false });
  const soil = sensor3(446, sy, "soil", { title: false });
  parts.push(water.svg, soil.svg, tag(388, sy - 12, "수위 센서"), tag(484, sy - 12, "토양 수분 센서"));
  const d35 = b.gpio(35), d34 = b.gpio(34);
  wires.push(ffWire(water.pins.S, d35, C.teal, [{ x: water.pins.S.x, y: BY - 4 }, { x: d35.x, y: BY - 4 }], "orth"));
  wires.push(ffWire(soil.pins.S, d34, C.green, [{ x: soil.pins.S.x, y: BY - 14 }, { x: d34.x, y: BY - 14 }], "orth"));
  used.push(d35, d34);
  wires.push(mfWire(water.pins.G, r3("-", 4), C.black, [{ x: water.pins.G.x, y: minusY }], "orth"));
  wires.push(mfWire(water.pins.V, r3("+", 5), C.red, [{ x: water.pins.V.x, y: plusY - 10 }, { x: r3("+", 5).x, y: plusY - 10 }], "orth"));
  wires.push(mfWire(soil.pins.G, r3("-", 10), C.black, [{ x: soil.pins.G.x, y: minusY }], "orth"));
  wires.push(mfWire(soil.pins.V, r3("+", 11), C.red, [{ x: soil.pins.V.x, y: plusY - 10 }, { x: r3("+", 11).x, y: plusY - 10 }], "orth"));

  // OLED: 보드 아래(핀이 위로). GND → 아래 줄 GND, SDA → D21, SCL → D22, VCC → 보드 왼쪽 바깥 길 → 5V 띠 + 줄 1번 칸 (39장과 같은 꼴)
  const gBot = b.power("GND", 1);
  const o = oled(gBot.x - 24, bot + 70, { titleAt: { x: gBot.x + 30, y: bot + 200 } });
  parts.push(o.svg);
  const sda = b.gpio(21), scl = b.gpio(22), p1 = r5("+", 1);
  wires.push(ffWire(o.pins.GND, gBot, C.black, [], "line"));
  wires.push(ffWire(o.pins.SDA, sda, C.blue, [{ x: o.pins.SDA.x, y: bot + 30 }, { x: sda.x, y: bot + 30 }], "orth"));
  wires.push(ffWire(o.pins.SCL, scl, C.purple, [{ x: o.pins.SCL.x, y: bot + 40 }, { x: scl.x, y: bot + 40 }], "orth"));
  wires.push(mfWire(o.pins.VCC, p1, C.red, [{ x: o.pins.VCC.x, y: bot + 50 }, { x: 16, y: bot + 50 }, { x: 16, y: p1.y }], "orth"));
  used.push(gBot, sda, scl);

  const rows = [
    { colors: [C.red, C.black], part: "VIN · GND (위 줄)", to: "5V 띠 + 줄 · − 줄" },
    { color: C.red, part: "3V3 (위 줄 끝)", to: "3V3 띠 + 줄" },
    { color: C.black, part: "5V 띠 − 줄", to: "3V3 띠 − 줄 (점퍼)" },
    { colors: [C.black, C.red], part: "릴레이 G · V", to: "5V 띠 − 줄 · + 줄" },
    { color: C.yellow, part: "릴레이 S", to: "D26 (띠의 구멍 없는 칸으로)" },
    { color: C.red, part: "릴레이 COM", to: "5V 띠 + 줄" },
    { color: C.red, part: "릴레이 NO", to: "펌프 빨강(+)" },
    { color: C.black, part: "펌프 검정(−)", to: "5V 띠 − 줄" },
    { color: C.teal, part: "수위 센서 S", to: "D35 (띠의 구멍 없는 칸으로)" },
    { color: C.green, part: "토양 수분 센서 S", to: "D34 (띠의 구멍 없는 칸으로)" },
    { colors: [C.red, C.black], part: "두 센서 V · G", to: "3V3 띠 + 줄 · − 줄" },
    { colors: [C.black, C.blue, C.purple], part: "OLED GND · SDA · SCL", to: "GND · D21 · D22 (아래 줄에 바로)" },
    { color: C.red, part: "OLED VCC", to: "5V 띠 + 줄 (보드 바깥 길)" },
  ];
  const table = connectionTable(bot + 226, "이렇게 꽂아요 — 센서는 3V3 띠, 릴레이 · 펌프 · OLED 는 5V 띠", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "스마트 화분 배선도(ESP32 Plus 확장 보드): OLED 화면 GND · VCC · SCL · SDA 는 보드 위쪽 한 줄 GND · 5V · SCL · SDA 에 F-F 듀폰선으로 바로. 릴레이 모듈은 보드 옆: 입력 G · V · S → io26 기둥 G · V · S, 단자 COM → 보드 아래로 돌아 아래 줄 VIN, 단자 NO → 물통 속 미니 워터 펌프 빨강(+). 보드 아래에 토양 수분 센서와 수위 센서: S 는 아래 줄 io34 · io35, V · G 는 맨 아래 + − 줄 띠(아래 줄 3V3 → + 줄, GND → − 줄). 펌프 검정(−) → 물통 바깥으로 돌아 − 줄 끝",
  devkit: "기본 보드(ESP32 DevKit 38핀) 스마트 화분 배선도: 보드 위에 + − 줄 띠 둘 — 5V 띠는 VIN → + 줄, 위 줄 GND → − 줄, 3V3 띠는 3V3 → + 줄, − 줄은 5V 띠 − 줄과 점퍼. 릴레이 모듈 G · V → 5V 띠 − · + 줄, S → D26, 단자 COM → 5V 띠 + 줄, NO → 물통 속 미니 워터 펌프 빨강(+), 펌프 검정(−) → 5V 띠 − 줄. 수위 센서 S → D35, 토양 수분 센서 S → D34(두 선과 릴레이 S 는 띠의 구멍 없는 칸으로 지난다), 두 센서 V · G → 3V3 띠 + · − 줄. OLED 는 보드 아래: GND → 아래 줄 GND, SDA → D21, SCL → D22, VCC → 보드 바깥 길로 5V 띠 + 줄",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wsp", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wspk", T.devkit, r.body, r.height); },
  },
};
