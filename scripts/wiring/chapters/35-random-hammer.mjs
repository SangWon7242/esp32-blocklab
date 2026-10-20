// 융합 F8 "복불복 랜덤 망치" — 초음파(Trig 13 · Echo 12), 서보(4), 풀업 버튼(14), OLED(I2C 21 · 22).
// Plus: 10장 자동문처럼 초음파 · OLED · 서보는 보드에 바로. 버튼만 보드 위 작은 브레드보드에 꽂는다.
//   버튼 한쪽 다리 ← io14(위 한 줄), 대각선 다리 → io14 기둥의 G(접지). G 선은 기둥 아래 빈 띠로 나와
//   io12 와 io14 사이 빈 틈으로 올라간다 (위 GND 핀은 초음파가 쓴다).
// DevKit: VIN(5V) 하나를 초음파 · 서보가 나눠 쓰므로 브레드보드 위 + − 줄로. 초음파는 브레드보드 위에 두고
//   Trig · Echo 선은 구멍 사이 빈 길(열과 열 사이)로 내려가 D13 · D12 에. VIN · GND 선도 빈 길로 올라가 + − 줄에.
// 이 파일의 도우미(alley · upInto · TEN_K 등)는 36 · 37 · 38 장도 쓴다.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, note, svgDoc, wire } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, button, oled, servo, servoWithPlug, ultrasonic } from "../parts.mjs";

export const HOLE = 16;
/** c 열과 c+1 열 사이 빈 길의 x (구멍 위를 지나지 않는 세로 길) */
export const alley = (bb, c) => bb.hole(c, "a").x + HOLE / 2;
/** + − 줄에서 구멍이 있는 열 (6 · 12 · 18 … 은 비어 있어 한 칸 앞으로) */
export const railCol = (c) => ((c - 1) % 6 === 5 ? c - 1 : c);

/* ───── ESP32 Plus ───── */
function plus() {
  // 버튼: 다리 (2,e)(4,e)(2,f)(4,f). 신호 = 오른쪽 위 다리(4,e) 줄, 접지 = 왼쪽 아래 다리(2,f) 줄 (대각선)
  const bb = breadboard({ x: 272, y: 8, cols: 10, rails: { top: false, bottom: false } });
  const b = makePlus({ x: 96, y: bb.y + bb.h + 24 });
  const parts = [], wires = [], used = [];
  const btn = button(bb, 2);
  bb.tint(4, "top");
  bb.tint(2, "bottom");
  const p14 = b.gpio(14), col14 = b.triple(14);
  // 신호: io14 → 곧장 위로, 4 · 5번 열 사이 빈 길로 올라가 (4, c) 로
  const sigHole = bb.hole(4, "c");
  wires.push(mfWire(p14, sigHole, C.green, [{ x: p14.x, y: sigHole.y }], "orth"));
  // 접지: io14 기둥 G → 아래 빈 띠 → io12 와 io14 사이 틈으로 위로 → (2, j)
  const gapX = b.pin("top:io12").x + 27, under = bb.y + bb.h + 12, gHole = bb.hole(2, "j");
  wires.push(mfWire(col14.G, gHole, C.black, [{ x: col14.G.x, y: b.lane.top }, { x: gapX, y: b.lane.top }, { x: gapX, y: under }, { x: gHole.x, y: under }], "orth"));
  used.push(p14, col14.G);

  // 초음파: 보드 위 왼쪽 (10장과 같은 연결)
  const u = ultrasonic(96, b.bounds.y - 128, { titleAt: { x: 172, y: b.bounds.y - 142 } });
  const t = { VCC: b.power("5V"), GND: b.power("GND"), Trig: b.gpio(13), Echo: b.gpio(12) };
  wires.push(ffWire(u.pins.VCC, t.VCC, C.red), ffWire(u.pins.GND, t.GND, C.black), ffWire(u.pins.Trig, t.Trig, C.yellow), ffWire(u.pins.Echo, t.Echo, C.orange));
  used.push(t.VCC, t.GND, t.Trig, t.Echo);

  // OLED: 보드 오른쪽 → 빈 띠(접지 선 아래 네 줄) → I2C 묶음 첫 줄
  const o = oled(528, b.lane.bottom + 18, { titleAt: { x: 582, y: b.lane.bottom + 148 } });
  const bus = b.i2c(0);
  const lane = { GND: b.lane.top + 5, VCC: b.lane.top + 10, SDA: b.lane.top + 15, SCL: b.lane.top + 20 };
  const via = (k) => [{ x: o.pins[k].x, y: lane[k] }, { x: bus[k].x, y: lane[k] }];
  wires.push(ffWire(o.pins.GND, bus.GND, C.black, via("GND"), "orth"), ffWire(o.pins.VCC, bus.VCC, C.red, via("VCC"), "orth"), ffWire(o.pins.SDA, bus.SDA, C.blue, via("SDA"), "orth"), ffWire(o.pins.SCL, bus.SCL, C.purple, via("SCL"), "orth"));
  used.push(bus.GND, bus.VCC, bus.SDA, bus.SCL);

  // 서보: 플러그를 ANALOG io4 줄에 그대로
  const sv = b.triple(4);
  parts.push(bb.svg, btn.svg, u.svg, o.svg, servo(14, sv.S.y - 22, [sv.G, sv.V, sv.S], { titleAt: { x: 46, y: sv.S.y + 42 } }).svg);
  used.push(sv.G, sv.V, sv.S);

  const rows = [
    { colors: [C.red, C.black], part: "초음파 VCC · GND", to: "5V · GND (위 한 줄)" },
    { colors: [C.yellow, C.orange], part: "초음파 Trig · Echo", to: "io13 · io12" },
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C 묶음 GND · 5V" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C 묶음 SDA · SCL" },
    { colors: [C.brown, C.red, C.orange], part: "서보 플러그", to: "ANALOG io4 줄 G · V · S" },
    { color: C.green, part: "io14", to: "4번 줄 (버튼 한쪽 다리)" },
    { color: C.black, part: "io14 기둥 G", to: "2번 줄 (버튼 대각선 다리)" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 30, "이렇게 꽂아요 — 버튼만 브레드보드, 나머지는 보드에 바로", rows, "plus", { columns: 1 });
  return { body: compose(b.draw(used), parts, wires, [table.svg, note(bb.x - 10, bb.y + 40, "버튼", "end", 14)]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀) ───── */
function devkit() {
  const bb = breadboard({ x: 96, y: 132, cols: 20, rails: { top: true, bottom: false } });
  const b = makeDevkit({ x: 110, y: bb.y + bb.h + 30 });
  const parts = [], wires = [], used = [];
  const rail = (s, c) => bb.rail("top", s, c);
  const top = b.bounds.y, below = bb.y + bb.h; // 브레드보드 아래 ~ 보드 위 사이
  const midY = (below + top) / 2;

  // 보드 VIN · GND → 빈 길로 올라가 + − 줄 (VIN 은 2 · 3번 열 사이, GND 는 3 · 4번 열 사이)
  const vin = b.power("5V"), gnd = b.power("GND", 0);
  const vinUp = alley(bb, 1), gndUp = alley(bb, 2);
  wires.push(mfWire(vin, rail("+", 1), C.red, [{ x: vin.x, y: midY + 4 }, { x: vinUp, y: midY + 4 }, { x: vinUp, y: rail("+", 1).y }], "orth"));
  wires.push(mfWire(gnd, rail("-", 3), C.black, [{ x: gnd.x, y: midY - 4 }, { x: gndUp, y: midY - 4 }, { x: gndUp, y: rail("-", 3).y }], "orth"));
  used.push(vin, gnd);

  // 초음파: 브레드보드 위. VCC · GND → + − 줄, Trig · Echo → 빈 길로 내려가 D13 · D12
  const u = ultrasonic(130, 4, { titleAt: { x: 118, y: 38, anchor: "end" } });
  const trig = b.gpio(13), echo = b.gpio(12);
  wires.push(mfWire(u.pins.VCC, rail("+", 4), C.red), mfWire(u.pins.GND, rail("-", 8), C.black));
  const tX = alley(bb, 5), eX = alley(bb, 6), jog = u.pins.Trig.y + 8;
  wires.push(ffWire(u.pins.Trig, trig, C.yellow, [{ x: u.pins.Trig.x, y: jog }, { x: tX, y: jog }, { x: tX, y: midY - 8 }, { x: trig.x, y: midY - 8 }], "orth"));
  wires.push(ffWire(u.pins.Echo, echo, C.orange, [{ x: u.pins.Echo.x, y: jog + 6 }, { x: eX, y: jog + 6 }, { x: eX, y: midY }, { x: echo.x, y: midY }], "orth"));
  used.push(trig, echo);

  // 버튼: 다리 (8,e)(10,e)(8,f)(10,f). D14 → (8, j), 대각선 (10, a) → 위 − 줄
  const btn = button(bb, 8);
  bb.tint(8, "bottom");
  bb.tint(10, "top");
  const d14 = b.gpio(14);
  wires.push(mfWire(d14, bb.hole(8, "j"), C.green), mmWire(bb.hole(10, "a"), rail("-", 10), C.black));
  used.push(d14);

  // 서보: 브레드보드 오른쪽, 플러그 빨강 · 갈색 → + − 줄 오른쪽 끝, 주황 → 보드 오른쪽 바깥 길로 D4
  const s = servoWithPlug(520, 152, { plugSide: "left", titleAt: { x: 554, y: 220 } });
  const pEnd = rail("+", 19), mEnd = rail("-", 20);
  // 브레드보드 오른쪽 끝의 + − 글자를 가리지 않게 바깥(x 466)으로 돌아 + 줄은 위에서, − 줄은 아래에서 꽂는다
  const outX = bb.x + bb.w + 10;
  wires.push(mmWire(s.pins.V, pEnd, C.red, [{ x: outX, y: s.pins.V.y }, { x: outX, y: pEnd.y - 12 }, { x: pEnd.x, y: pEnd.y - 12 }], "orth"));
  wires.push(mmWire(s.pins.G, mEnd, C.black, [{ x: outX + 6, y: s.pins.G.y }, { x: outX + 6, y: mEnd.y + 14 }, { x: mEnd.x, y: mEnd.y + 14 }], "orth"));
  const d4 = b.gpio(4), underB = b.bounds.y + b.bounds.h + 12;
  const sX = s.pins.S.x - 12, aboveB = b.bounds.y - 12;
  wires.push(mfWire(d4, s.pins.S, C.purple, [{ x: d4.x, y: underB }, { x: 618, y: underB }, { x: 618, y: aboveB }, { x: sX, y: aboveB }, { x: sX, y: s.pins.S.y }], "orth"));
  used.push(d4);

  // OLED: 보드 아래. VCC → 3V3, GND → GND(아래 줄), SDA → D21, SCL → D22
  const oY = underB + 64;
  const o = oled(20, oY, { titleAt: { x: 74, y: oY + 128 } });
  const v33 = b.power("3V3"), gBot = b.power("GND", 1), sda = b.gpio(21), scl = b.gpio(22);
  const lv = (k) => underB + 8 + k * 8;
  wires.push(ffWire(o.pins.VCC, v33, C.red, [{ x: o.pins.VCC.x, y: lv(1) }, { x: v33.x, y: lv(1) }], "orth"));
  wires.push(ffWire(o.pins.GND, gBot, C.black, [{ x: o.pins.GND.x, y: lv(0) }, { x: gBot.x, y: lv(0) }], "orth"));
  wires.push(ffWire(o.pins.SDA, sda, C.blue, [{ x: o.pins.SDA.x, y: lv(3) }, { x: sda.x, y: lv(3) }], "orth"));
  wires.push(ffWire(o.pins.SCL, scl, C.teal, [{ x: o.pins.SCL.x, y: lv(4) }, { x: scl.x, y: lv(4) }], "orth"));
  used.push(v33, gBot, sda, scl);

  parts.push(bb.svg, btn.svg, u.svg, s.svg, o.svg);
  const rows = [
    { color: C.red, part: "VIN · 초음파 VCC · 서보 빨강", to: "+ 줄" },
    { color: C.black, part: "GND · 초음파 GND · 서보 갈색", to: "− 줄" },
    { colors: [C.yellow, C.orange], part: "초음파 Trig · Echo", to: "D13 · D12" },
    { color: C.purple, part: "서보 주황(신호)", to: "D4" },
    { color: C.green, part: "D14", to: "8번 줄 (버튼 한쪽 다리)" },
    { color: C.black, part: "버튼 대각선 다리 10번 줄", to: "− 줄" },
    { colors: [C.red, C.black], part: "OLED VCC · GND", to: "3V3 · GND" },
    { colors: [C.blue, C.teal], part: "OLED SDA · SCL", to: "D21 · D22" },
  ];
  const table = connectionTable(oY + 150, "이렇게 꽂아요 — 5V 는 브레드보드 + 줄로 나눠 써요", rows, "devkit", { columns: 1 });
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "복불복 랜덤 망치 배선도(ESP32 Plus 확장 보드): 초음파 센서 VCC 는 보드 위쪽 5V, GND 는 GND, Trig 는 io13, Echo 는 io12 에 F-F 듀폰선으로 바로. OLED 화면 GND · VCC · SDA · SCL 은 I2C 묶음 GND · 5V · SDA · SCL 에. 서보 모터 플러그는 ANALOG 묶음 io4 줄에 갈색 G, 빨강 V, 주황 S 가 맞도록. 버튼만 브레드보드 가운데 홈에 걸쳐 2 · 4번 줄에 꽂고, io14 → 4번 줄(버튼 한쪽 다리), io14 기둥의 G → 2번 줄(대각선 다리)",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 복불복 랜덤 망치 배선도: 브레드보드는 보드 위, + − 줄은 브레드보드 위쪽. 보드 VIN(5V) → + 줄, GND → − 줄. 초음파 센서 VCC → + 줄, GND → − 줄, Trig → D13, Echo → D12. 서보 빨강 → + 줄, 갈색 → − 줄, 주황 → D4. 버튼은 가운데 홈에 걸쳐 8 · 10번 줄: D14 → 8번 줄, 대각선 10번 줄 → − 줄. OLED VCC → 3V3, GND → GND, SDA → D21, SCL → D22",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wrh", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wrhk", T.devkit, r.body, r.height); },
  },
};
