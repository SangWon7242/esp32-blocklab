// 융합 F3 "다가가면 열리는 자동문" — 초음파(Trig 13 · Echo 12), OLED(I2C 21 · 22), 서보(4)
// Echo 는 5V 신호라 작은 브레드보드 띠의 전압 나누기(1kΩ · 2kΩ, echo-divider.mjs)를 거쳐 12번으로.
// 확장 보드 판: 서보가 P4 칸 V 줄(점퍼로 정하는 전압)을 쓰므로 이 수업은 점퍼를 5V 쪽으로 (두 그림 모두).
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, note, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { columnServo, makeExpansion } from "../boards/expansion.mjs";
import { breadboard, oled, servo, servoWithPlug, ultrasonic } from "../parts.mjs";
import { dividerWires, echoDivider, echoRows } from "../echo-divider.mjs";

// Echo 전압 나누기를 꽂는 작은 브레드보드 띠가 들어가며 보드와 그 아래 부품이 내려간 만큼
const DY = 130;

/* ───── ESP32 Plus: 모듈은 보드에 바로, Echo 만 작은 브레드보드(저항 둘)를 거친다 ───── */
function plus(which) {
  const b = makePlus({ x: 96, y: 150 + DY });
  const parts = [], wires = [], used = [];
  const u = ultrasonic(110, 22);
  const bb = breadboard({ x: 330, y: 124, cols: 9, half: "bottom" });
  const div = echoDivider(bb, 2, { order: "echo-first", sensorFrom: "above" });
  parts.push(bb.svg, ...div.svg, u.svg, note(bb.x + bb.w / 2, bb.y - 10, "브레드보드", "middle", 13));
  const t = { VCC: b.power("5V"), GND: b.power("GND"), Trig: b.gpio(13), Echo: b.gpio(12) };
  wires.push(ffWire(u.pins.VCC, t.VCC, C.red), ffWire(u.pins.Trig, t.Trig, C.yellow));
  wires.push(...dividerWires(u, div, bb, { pin: t.Echo, gnd: t.GND, boardTop: b.bounds.y, turnX: 310 }));
  used.push(t.VCC, t.GND, t.Trig, t.Echo);
  const rows = [
    { color: C.red, part: "초음파 VCC", to: "5V" }, { color: C.yellow, part: "초음파 Trig", to: t.Trig.label },
    ...echoRows(div, { echoColor: C.green, pinColor: C.purple, gndColor: C.black, pinLabel: t.Echo.label, gndLabel: "보드 GND" }),
  ];
  if (which === "door") {
    const o = oled(528, 312 + DY);
    const bus = b.i2c(0);
    const lane = { GND: b.lane.top + 3, VCC: b.lane.top + 8, SDA: b.lane.top + 13, SCL: b.lane.top + 18 };
    const via = (k) => [{ x: o.pins[k].x, y: lane[k] }, { x: bus[k].x, y: lane[k] }];
    wires.push(ffWire(o.pins.GND, bus.GND, C.black, via("GND"), "orth"), ffWire(o.pins.VCC, bus.VCC, C.red, via("VCC"), "orth"), ffWire(o.pins.SDA, bus.SDA, C.blue, via("SDA"), "orth"), ffWire(o.pins.SCL, bus.SCL, C.purple, via("SCL"), "orth"));
    used.push(bus.GND, bus.VCC, bus.SDA, bus.SCL);
    const sv = b.triple(4);
    parts.push(o.svg, servo(14, 384 + DY, [sv.G, sv.V, sv.S]).svg);
    used.push(sv.G, sv.V, sv.S);
    rows.push({ colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C GND · 5V" }, { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C SDA · SCL" }, { colors: [C.brown, C.red, C.orange], part: "서보 플러그", to: "io4 줄 G·V·S" });
  }
  const table = connectionTable(462 + DY, "이렇게 꽂아요 — Echo 는 저항 둘을 거쳐 보드로", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit 38핀): 모듈은 F-F 로 바로, 5V 를 나눠 쓰는 곳만 브레드보드 + − 줄 ───── */
function devkit(which) {
  const b = makeDevkit({ x: 95, y: 206 });
  const parts = [], wires = [], used = [], rows = [];
  const u = ultrasonic(100, 4, { titleAt: { x: 88, y: 38, anchor: "end" } });
  const bb = breadboard({ x: 320, y: 44, cols: 9, half: "bottom" });
  const div = echoDivider(bb, 2, { order: "echo-first", sensorFrom: "above" });
  parts.push(bb.svg, ...div.svg, u.svg, note(bb.x + bb.w / 2, bb.y - 10, "브레드보드", "middle", 13));
  const trig = b.gpio(13), echo = b.gpio(12), gndTop = b.power("GND", 0);
  wires.push(ffWire(u.pins.Trig, trig, C.yellow));
  used.push(trig, echo);
  if (which === "ultra") {
    const vin = b.power("5V");
    wires.push(ffWire(u.pins.VCC, vin, C.red, [{ x: u.pins.VCC.x, y: 150 }, { x: vin.x, y: 150 }], "orth"));
    wires.push(...dividerWires(u, div, bb, { pin: echo, gnd: gndTop, boardTop: b.bounds.y, turnX: 290 }));
    used.push(vin, gndTop);
    rows.push(
      { color: C.red, part: "초음파 VCC", to: vin.label }, { color: C.yellow, part: "초음파 Trig", to: trig.label },
      ...echoRows(div, { echoColor: C.green, pinColor: C.purple, gndColor: C.black, pinLabel: echo.label, gndLabel: "보드 GND" }),
    );
    const table = connectionTable(402, "이렇게 꽂아요 — Echo 는 저항 둘을 거쳐 보드로", rows, "devkit");
    return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
  }
  throw new Error("devkit() 은 ultra 만");
}

/** 자동문(기본 보드): VIN(5V) 하나를 초음파·서보가 나눠 쓴다 → 보드 위에 브레드보드 + − 줄 띠 */
function devkitDoor() {
  const D = 70; // Echo 전압 나누기 띠가 위에 들어가 나머지가 내려간 만큼
  const b = makeDevkit({ x: 110, y: 196 + D });
  const parts = [], wires = [], used = [];
  const strip = breadboard({ x: 96, y: 136 + D, cols: 14, railsOnly: true });
  const r = (sign, c) => strip.rail("top", sign, c);
  parts.push(strip.svg);
  const u = ultrasonic(60, 22, { titleAt: { x: 136, y: 10, anchor: "middle" } });
  const bb = breadboard({ x: 230, y: 44, cols: 8, half: "bottom" });
  const div = echoDivider(bb, 1, { sensorFrom: "above" });
  parts.push(bb.svg, ...div.svg, u.svg, note(bb.x + bb.w / 2, bb.y - 10, "브레드보드", "middle", 13));
  const vin = b.power("5V"), gndTop = b.power("GND", 0), trig = b.gpio(13), echo = b.gpio(12);
  // 보드 VIN·GND → + − 줄, 초음파 VCC·GND → + − 줄, Trig → D13, Echo → 전압 나누기(1kΩ · 2kΩ) → D12
  wires.push(mfWire(vin, r("+", 2), C.red), mfWire(gndTop, r("-", 3), C.black));
  wires.push(mfWire(u.pins.VCC, r("+", 4), C.red), mfWire(u.pins.GND, r("-", 8), C.black));
  wires.push(ffWire(u.pins.Trig, trig, C.yellow));
  wires.push(...dividerWires(u, div, bb, { pin: echo, boardTop: b.bounds.y, turnX: 218, sensorGnd: false }));
  // 전압 나누기의 GND 줄 → 바로 아래 − 줄
  wires.push(mmWire(div.holes.gndBoard, r("-", 10), C.black));
  used.push(vin, gndTop, trig, echo);
  // 서보: 플러그(왼쪽)에 M-M · M-F 선 — 빨강 V·갈색 G 는 + − 줄, 주황 S 는 보드 오른쪽 바깥 길로 D4
  const s = servoWithPlug(486, 108 + D, { plugSide: "left", titleAt: { x: 520, y: 176 + D } });
  parts.push(s.svg);
  wires.push(mmWire(s.pins.V, r("+", 14), C.red, [{ x: 400, y: s.pins.V.y }, { x: 400, y: r("+", 14).y - 12 }, { x: r("+", 14).x, y: r("+", 14).y - 12 }], "orth"));
  wires.push(mmWire(s.pins.G, r("-", 13), C.black, [{ x: 390, y: s.pins.G.y }, { x: 390, y: r("-", 13).y + 12 }, { x: r("-", 13).x, y: r("-", 13).y + 12 }], "orth"));
  const d4 = b.gpio(4);
  wires.push(mfWire(d4, s.pins.S, C.orange, [{ x: d4.x, y: 366 + D }, { x: 618, y: 366 + D }, { x: 618, y: 188 + D }, { x: 412, y: 188 + D }, { x: 412, y: s.pins.S.y }], "orth"));
  used.push(d4);
  // OLED: 3V3 · 아래 GND 에 바로, SDA·SCL → D21·D22
  const o = oled(20, 404 + D, { titleAt: { x: 74, y: 532 + D } });
  parts.push(o.svg);
  const v33 = b.power("3V3"), gndBot = b.power("GND", 1), sda = b.gpio(21), scl = b.gpio(22);
  wires.push(ffWire(o.pins.VCC, v33, C.red, [{ x: o.pins.VCC.x, y: 352 + D }, { x: v33.x, y: 352 + D }], "orth"));
  wires.push(ffWire(o.pins.GND, gndBot, C.black, [{ x: o.pins.GND.x, y: 344 + D }, { x: gndBot.x, y: 344 + D }], "orth"));
  wires.push(ffWire(o.pins.SDA, sda, C.blue, [{ x: o.pins.SDA.x, y: 376 + D }, { x: sda.x, y: 376 + D }], "orth"));
  wires.push(ffWire(o.pins.SCL, scl, C.purple, [{ x: o.pins.SCL.x, y: 384 + D }, { x: scl.x, y: 384 + D }], "orth"));
  used.push(v33, gndBot, sda, scl);
  const rows = [
    { color: C.red, part: "VIN · 초음파 VCC · 서보 빨강", to: "+ 줄" },
    { color: C.black, part: "GND · 초음파 GND · 서보 갈색", to: "− 줄" },
    { color: C.yellow, part: "초음파 Trig", to: trig.label },
    { color: C.green, part: "초음파 Echo", to: `작은 브레드보드 ${div.cols.echo}번 줄 → 1kΩ → ${div.cols.mid}번 줄` },
    { color: C.purple, part: echo.label, to: `${div.cols.mid}번 줄 (1kΩ 과 2kΩ 사이)` },
    { color: C.black, part: `${div.cols.mid}번 줄 → 2kΩ → ${div.cols.gnd}번 줄`, to: "− 줄" },
    { color: C.orange, part: "서보 주황(신호)", to: d4.label },
    { colors: [C.red, C.black], part: "OLED VCC · GND", to: "3V3 · GND" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "D21 · D22" },
  ];
  const table = connectionTable(552 + D, "이렇게 꽂아요 — 5V 는 브레드보드 + 줄로 나눠 써요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg, note(88, 150 + D, "브레드보드", "end", 13), note(88, 168 + D, "+ − 줄", "end", 13)]), height: table.bottom };
}

/* ───── 확장 보드(38핀 확장 보드 + DevKit): 모듈은 F-F 로 S 핀에 바로, 서보는 P4 기둥에 플러그째, 점퍼 5V ───── */
function expansion(which) {
  const b = makeExpansion({ x: 22, y: 280, jumper: "5V" });
  const parts = [], wires = [], used = [];
  const u = ultrasonic(150, 20);
  const bb = breadboard({ x: 400, y: 100, cols: 9, half: "bottom" });
  const div = echoDivider(bb, 2, { order: "echo-first", sensorFrom: "above" });
  parts.push(bb.svg, ...div.svg, u.svg, note(bb.x + bb.w / 2, bb.y - 10, "브레드보드", "middle", 13));
  const t = { VCC: b.power("5V"), GND: b.power("GND"), Trig: b.gpio(13), Echo: b.gpio(12) };
  wires.push(ffWire(u.pins.VCC, t.VCC, C.red), ffWire(u.pins.Trig, t.Trig, C.yellow));
  wires.push(...dividerWires(u, div, bb, { pin: t.Echo, gnd: t.GND, boardTop: b.bounds.y, turnX: 352 }));
  used.push(t.VCC, t.GND, t.Trig, t.Echo);
  const rows = [
    { color: C.red, part: "초음파 VCC", to: "위 줄 5V 칸 S" }, { color: C.yellow, part: "초음파 Trig", to: `${t.Trig.label} 칸 S` },
    ...echoRows(div, { echoColor: C.green, pinColor: C.purple, gndColor: C.black, pinLabel: `${t.Echo.label} 칸 S`, gndLabel: "위 줄 GND 칸 S" }),
  ];
  let bottom = b.bounds.y + b.bounds.h + 12;
  if (which === "door") {
    // OLED: I2C 헤더 안쪽 줄. 선은 바깥 줄(UART) 핀 사이 틈으로 올라가 옆에서 꽂는다 (UART 핀 위를 지나지 않게)
    const bus = b.i2c(0);
    const o = oled(110, 668, { titleAt: { x: 98, y: 724, anchor: "end" } });
    parts.push(o.svg);
    const lanes = { GND: 642, VCC: 634, SDA: 618, SCL: 626 };
    const color = { GND: C.black, VCC: C.red, SDA: C.blue, SCL: C.purple };
    for (const k of ["GND", "VCC", "SDA", "SCL"]) {
      const p = bus[k], from = o.pins[k], seam = p.x - 9.9;
      wires.push(ffWire(from, p, color[k], [{ x: from.x, y: lanes[k] }, { x: seam, y: lanes[k] }, { x: seam, y: p.y }], "orth"));
      used.push(p);
    }
    // 서보: 4번 칸(아래 줄)의 G · V · S 에 플러그 그대로
    const sv = b.triple(4);
    parts.push(columnServo(sv, { gap: 84 }).svg);
    used.push(sv.G, sv.V, sv.S);
    rows.push(
      { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C 헤더 GND · VCC" }, { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C 헤더 D21 · D22" },
      { colors: [C.brown, C.red, C.orange], part: "서보 플러그", to: "P4 칸 G · V · S (V 는 점퍼 5V)" },
    );
    bottom = 806;
  }
  const table = connectionTable(bottom, "이렇게 꽂아요 — Echo 는 저항 둘을 거쳐 보드로", rows, b.legend);
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  doorPlus: "자동문 배선도(ESP32 Plus 확장 보드): 초음파 센서 VCC 는 보드 위쪽 5V, Trig 는 io13 에 F-F 듀폰선으로 바로. Echo → 작은 브레드보드 2번 줄 → 1kΩ 저항 → 5번 줄 → 12번 핀, 5번 줄 → 2kΩ 저항 → 8번 줄 ← 초음파 GND · 보드 GND. OLED 화면 GND·VCC·SDA·SCL 은 보드 I2C 묶음의 GND·5V·SDA·SCL 에. 서보 모터 플러그는 ANALOG 묶음 io4 줄에 갈색 G, 빨강 V, 주황 S 가 맞도록 그대로 꽂기",
  doorDevkit: "기본 보드(ESP32 DevKit 38핀) 자동문 배선도: 보드 VIN(5V)과 GND 를 브레드보드 + − 줄에 잇고, 초음파 센서 VCC 와 서보 빨강은 + 줄, 초음파 GND 와 서보 갈색은 − 줄. 초음파 Trig 는 D13. Echo 는 작은 브레드보드 7번 줄 → 1kΩ 저항 → 4번 줄 → D12, 4번 줄 → 2kΩ 저항 → 1번 줄 → − 줄. 서보 주황은 D4. OLED VCC 는 3V3, GND 는 GND, SDA 는 D21, SCL 은 D22",
  ultraPlus: "초음파 센서 배선도(ESP32 Plus 확장 보드): VCC 는 보드 위쪽 5V, Trig 는 io13 에 F-F 듀폰선으로 바로. Echo → 작은 브레드보드 2번 줄 → 1kΩ 저항 → 5번 줄 → 12번 핀, 5번 줄 → 2kΩ 저항 → 8번 줄 ← 초음파 GND · 보드 GND",
  doorExpansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) 자동문 배선도: 이번 수업은 JUMP 점퍼를 5V 쪽으로. 초음파 센서 VCC 는 위 줄 5V 칸 S 핀, Trig 는 P13 칸 S 핀에 F-F 듀폰선으로 바로. Echo → 작은 브레드보드 2번 줄 → 1kΩ 저항 → 5번 줄 → P12 칸 S 핀, 5번 줄 → 2kΩ 저항 → 8번 줄 ← 초음파 GND · 위 줄 GND 칸 S 핀. OLED 화면 GND · VCC · SDA · SCL 은 I2C 헤더의 GND · VCC · D21 · D22 에. 서보 모터 플러그는 아래 줄 P4 칸에 갈색 G, 빨강 V, 주황 S 가 맞도록 그대로 꽂기",
  ultraExpansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) 초음파 센서 배선도: 이번 수업은 JUMP 점퍼를 5V 쪽으로. VCC 는 위 줄 5V 칸 S 핀, Trig 는 P13 칸 S 핀에 F-F 듀폰선으로 바로. Echo → 작은 브레드보드 2번 줄 → 1kΩ 저항 → 5번 줄 → P12 칸 S 핀, 5번 줄 → 2kΩ 저항 → 8번 줄 ← 초음파 GND · 위 줄 GND 칸 S 핀",
  ultraDevkit: "기본 보드(ESP32 DevKit 38핀) 초음파 센서 배선도: VCC 는 VIN(5V), Trig 는 D13 에 F-F 듀폰선으로 바로. Echo → 작은 브레드보드 2번 줄 → 1kΩ 저항 → 5번 줄 → 12번 핀, 5번 줄 → 2kΩ 저항 → 8번 줄 ← 초음파 GND · 보드 GND",
};

export default {
  "wiring-door.svg": {
    plus: () => { const r = plus("door"); return svgDoc("wd", T.doorPlus, r.body, r.height); },
    devkit: () => { const r = devkitDoor(); return svgDoc("wdk", T.doorDevkit, r.body, r.height); },
    expansion: () => { const r = expansion("door"); return svgDoc("wdx", T.doorExpansion, r.body, r.height); },
  },
  "wiring-ultrasonic.svg": {
    plus: () => { const r = plus("ultra"); return svgDoc("wu", T.ultraPlus, r.body, r.height); },
    devkit: () => { const r = devkit("ultra"); return svgDoc("wuk", T.ultraDevkit, r.body, r.height); },
    expansion: () => { const r = expansion("ultra"); return svgDoc("wux", T.ultraExpansion, r.body, r.height); },
  },
};
