// 융합 F3 "다가가면 열리는 자동문" — 초음파(Trig 13 · Echo 12), OLED(I2C 21 · 22), 서보(4)
import { COLORS as C, compose, connectionTable, ffWire, mfWire, mmWire, note, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, oled, servo, servoWithPlug, ultrasonic } from "../parts.mjs";

/* ───── ESP32 Plus: 브레드보드 없이 보드에 바로 ───── */
function plus(which) {
  const b = makePlus();
  const parts = [], wires = [], used = [];
  const u = ultrasonic(150, 22);
  parts.push(u.svg);
  const t = { VCC: b.power("5V"), GND: b.power("GND"), Trig: b.gpio(13), Echo: b.gpio(12) };
  wires.push(ffWire(u.pins.VCC, t.VCC, C.red), ffWire(u.pins.GND, t.GND, C.black), ffWire(u.pins.Trig, t.Trig, C.yellow), ffWire(u.pins.Echo, t.Echo, C.green));
  used.push(t.VCC, t.GND, t.Trig, t.Echo);
  const rows = [
    { color: C.red, part: "초음파 VCC", to: "5V" }, { color: C.black, part: "초음파 GND", to: "GND" },
    { color: C.yellow, part: "초음파 Trig", to: t.Trig.label }, { color: C.green, part: "초음파 Echo", to: t.Echo.label },
  ];
  if (which === "door") {
    const o = oled(528, 312);
    const bus = b.i2c(0);
    const lane = { GND: b.lane.top + 3, VCC: b.lane.top + 8, SDA: b.lane.top + 13, SCL: b.lane.top + 18 };
    const via = (k) => [{ x: o.pins[k].x, y: lane[k] }, { x: bus[k].x, y: lane[k] }];
    wires.push(ffWire(o.pins.GND, bus.GND, C.black, via("GND"), "orth"), ffWire(o.pins.VCC, bus.VCC, C.red, via("VCC"), "orth"), ffWire(o.pins.SDA, bus.SDA, C.blue, via("SDA"), "orth"), ffWire(o.pins.SCL, bus.SCL, C.purple, via("SCL"), "orth"));
    used.push(bus.GND, bus.VCC, bus.SDA, bus.SCL);
    const sv = b.triple(4);
    parts.push(o.svg, servo(14, 384, [sv.G, sv.V, sv.S]).svg);
    used.push(sv.G, sv.V, sv.S);
    rows.push({ colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C GND · 5V" }, { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C SDA · SCL" }, { colors: [C.brown, C.red, C.orange], part: "서보 플러그", to: "io4 줄 G·V·S" });
  }
  const table = connectionTable(462, which === "door" ? "이렇게 꽂아요 — 브레드보드 없이 보드에 바로" : "이렇게 꽂아요 — F-F 듀폰선 4가닥", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀): 모듈은 F-F 로 바로, 5V 를 나눠 쓰는 곳만 브레드보드 + − 줄 ───── */
function devkit(which) {
  const b = makeDevkit({ x: 95, y: 176 });
  const parts = [], wires = [], used = [], rows = [];
  const u = ultrasonic(100, 4, { titleAt: { x: 88, y: 38, anchor: "end" } });
  parts.push(u.svg);
  const trig = b.gpio(13), echo = b.gpio(12), gndTop = b.power("GND", 0);
  wires.push(ffWire(u.pins.Trig, trig, C.yellow), ffWire(u.pins.Echo, echo, C.green));
  used.push(trig, echo);
  if (which === "ultra") {
    const vin = b.power("5V");
    wires.push(ffWire(u.pins.VCC, vin, C.red, [{ x: u.pins.VCC.x, y: 150 }, { x: vin.x, y: 150 }], "orth"), ffWire(u.pins.GND, gndTop, C.black, [{ x: u.pins.GND.x, y: 158 }, { x: gndTop.x, y: 158 }], "orth"));
    used.push(vin, gndTop);
    rows.push(
      { color: C.red, part: "초음파 VCC", to: vin.label }, { color: C.black, part: "초음파 GND", to: "GND" },
      { color: C.yellow, part: "초음파 Trig", to: trig.label }, { color: C.green, part: "초음파 Echo", to: echo.label },
    );
    const table = connectionTable(372, "이렇게 꽂아요 — F-F 듀폰선 4가닥", rows, "devkit");
    return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
  }
  throw new Error("devkit() 은 ultra 만");
}

/** 자동문(기본 보드): VIN(5V) 하나를 초음파·서보가 나눠 쓴다 → 보드 위에 브레드보드 + − 줄 띠 */
function devkitDoor() {
  const b = makeDevkit({ x: 110, y: 196 });
  const parts = [], wires = [], used = [];
  const strip = breadboard({ x: 96, y: 136, cols: 14, railsOnly: true });
  const r = (sign, c) => strip.rail("top", sign, c);
  parts.push(strip.svg);
  const u = ultrasonic(120, 4, { titleAt: { x: 108, y: 38, anchor: "end" } });
  parts.push(u.svg);
  const vin = b.power("5V"), gndTop = b.power("GND", 0), trig = b.gpio(13), echo = b.gpio(12);
  // 보드 VIN·GND → + − 줄, 초음파 VCC·GND → + − 줄, Trig·Echo → D13·D12
  wires.push(mfWire(vin, r("+", 2), C.red), mfWire(gndTop, r("-", 3), C.black));
  wires.push(mfWire(u.pins.VCC, r("+", 4), C.red), mfWire(u.pins.GND, r("-", 8), C.black));
  wires.push(ffWire(u.pins.Trig, trig, C.yellow), ffWire(u.pins.Echo, echo, C.green));
  used.push(vin, gndTop, trig, echo);
  // 서보: 플러그(왼쪽)에 M-M · M-F 선 — 빨강 V·갈색 G 는 + − 줄, 주황 S 는 보드 오른쪽 바깥 길로 D4
  const s = servoWithPlug(486, 108, { plugSide: "left", titleAt: { x: 520, y: 176 } });
  parts.push(s.svg);
  wires.push(mmWire(s.pins.V, r("+", 14), C.red, [{ x: 400, y: s.pins.V.y }, { x: 400, y: r("+", 14).y - 12 }, { x: r("+", 14).x, y: r("+", 14).y - 12 }], "orth"));
  wires.push(mmWire(s.pins.G, r("-", 13), C.black, [{ x: 390, y: s.pins.G.y }, { x: 390, y: r("-", 13).y + 12 }, { x: r("-", 13).x, y: r("-", 13).y + 12 }], "orth"));
  const d4 = b.gpio(4);
  wires.push(mfWire(d4, s.pins.S, C.orange, [{ x: d4.x, y: 366 }, { x: 618, y: 366 }, { x: 618, y: 188 }, { x: 412, y: 188 }, { x: 412, y: s.pins.S.y }], "orth"));
  used.push(d4);
  // OLED: 3V3 · 아래 GND 에 바로, SDA·SCL → D21·D22
  const o = oled(20, 404, { titleAt: { x: 74, y: 532 } });
  parts.push(o.svg);
  const v33 = b.power("3V3"), gndBot = b.power("GND", 1), sda = b.gpio(21), scl = b.gpio(22);
  wires.push(ffWire(o.pins.VCC, v33, C.red, [{ x: o.pins.VCC.x, y: 352 }, { x: v33.x, y: 352 }], "orth"));
  wires.push(ffWire(o.pins.GND, gndBot, C.black, [{ x: o.pins.GND.x, y: 344 }, { x: gndBot.x, y: 344 }], "orth"));
  wires.push(ffWire(o.pins.SDA, sda, C.blue, [{ x: o.pins.SDA.x, y: 376 }, { x: sda.x, y: 376 }], "orth"));
  wires.push(ffWire(o.pins.SCL, scl, C.purple, [{ x: o.pins.SCL.x, y: 384 }, { x: scl.x, y: 384 }], "orth"));
  used.push(v33, gndBot, sda, scl);
  const rows = [
    { color: C.red, part: "VIN · 초음파 VCC · 서보 빨강", to: "+ 줄" },
    { color: C.black, part: "GND · 초음파 GND · 서보 갈색", to: "− 줄" },
    { color: C.yellow, part: "초음파 Trig", to: trig.label }, { color: C.green, part: "초음파 Echo", to: echo.label },
    { color: C.orange, part: "서보 주황(신호)", to: d4.label },
    { colors: [C.red, C.black], part: "OLED VCC · GND", to: "3V3 · GND" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "D21 · D22" },
  ];
  const table = connectionTable(552, "이렇게 꽂아요 — 5V 는 브레드보드 + 줄로 나눠 써요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg, note(88, 150, "브레드보드", "end", 13), note(88, 168, "+ − 줄", "end", 13)]), height: table.bottom };
}

const T = {
  doorPlus: "자동문 배선도(ESP32 Plus 확장 보드, 브레드보드 없이 보드에 바로): 초음파 센서 VCC 는 보드 위쪽 5V, GND 는 GND, Trig 는 io13, Echo 는 io12 에 F-F 듀폰선으로. OLED 화면 GND·VCC·SDA·SCL 은 보드 I2C 묶음의 GND·5V·SDA·SCL 에. 서보 모터 플러그는 ANALOG 묶음 io4 줄에 갈색 G, 빨강 V, 주황 S 가 맞도록 그대로 꽂기",
  doorDevkit: "기본 보드(ESP32 DevKit V1 30핀) 자동문 배선도: 보드 VIN(5V)과 GND 를 브레드보드 + − 줄에 잇고, 초음파 센서 VCC 와 서보 빨강은 + 줄, 초음파 GND 와 서보 갈색은 − 줄. 초음파 Trig 는 D13, Echo 는 D12, 서보 주황은 D4. OLED VCC 는 3V3, GND 는 GND, SDA 는 D21, SCL 은 D22",
  ultraPlus: "초음파 센서 배선도(ESP32 Plus 확장 보드, 브레드보드 없이 보드에 바로): VCC 는 보드 위쪽 5V, GND 는 GND, Trig 는 io13, Echo 는 io12 에 F-F 듀폰선 네 가닥으로",
  ultraDevkit: "기본 보드(ESP32 DevKit V1 30핀) 초음파 센서 배선도: VCC 는 VIN(5V), GND 는 GND, Trig 는 D13, Echo 는 D12 에 F-F 듀폰선 네 가닥으로",
};

export default {
  "wiring-door.svg": {
    plus: () => { const r = plus("door"); return svgDoc("wd", T.doorPlus, r.body, r.height); },
    devkit: () => { const r = devkitDoor(); return svgDoc("wdk", T.doorDevkit, r.body, r.height); },
  },
  "wiring-ultrasonic.svg": {
    plus: () => { const r = plus("ultra"); return svgDoc("wu", T.ultraPlus, r.body, r.height); },
    devkit: () => { const r = devkit("ultra"); return svgDoc("wuk", T.ultraDevkit, r.body, r.height); },
  },
};
