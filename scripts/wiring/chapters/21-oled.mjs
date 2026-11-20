// 센서 S18 "OLED 화면" — OLED(I2C: SCL 22 · SDA 21). 두 보드 모두 브레드보드 없이 F-F 듀폰선 4가닥으로 바로.
// ESP32 Plus: I2C 묶음 첫 줄(GND · 5V · SDA · SCL). 기본 보드: 아래 줄 3V3 · GND · D21 · D22.
// 확장 보드: I2C 헤더 안쪽 줄(GND · VCC · D21 · D22), 점퍼 3.3V (VCC 가 V 줄을 따라 3.3V). 선은 10장 본보기처럼 UART 핀 사이 틈으로.
import { COLORS as C, compose, connectionTable, ffWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { oled } from "../parts.mjs";

function plus() {
  const b = makePlus({ x: 96, y: 40 });
  const o = oled(528, 202);
  const bus = b.i2c(0);
  const lane = { GND: b.lane.top + 3, VCC: b.lane.top + 8, SDA: b.lane.top + 13, SCL: b.lane.top + 18 };
  const via = (k) => [{ x: o.pins[k].x, y: lane[k] }, { x: bus[k].x, y: lane[k] }];
  const wires = [
    ffWire(o.pins.GND, bus.GND, C.black, via("GND"), "orth"), ffWire(o.pins.VCC, bus.VCC, C.red, via("VCC"), "orth"),
    ffWire(o.pins.SDA, bus.SDA, C.blue, via("SDA"), "orth"), ffWire(o.pins.SCL, bus.SCL, C.purple, via("SCL"), "orth"),
  ];
  const rows = [
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C GND · 5V" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C SDA · SCL" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 22, "이렇게 꽂아요 — F-F 듀폰선 4가닥, I2C 묶음 첫 줄에", rows, "plus", { columns: 1 });
  return { body: compose(b.draw([bus.GND, bus.VCC, bus.SDA, bus.SCL]), [o.svg], wires, [table.svg]), height: table.bottom };
}

function devkit() {
  const b = makeDevkit({ x: 110, y: 30 });
  const o = oled(150, 280, { titleAt: { x: 138, y: 336, anchor: "end" } });
  const v33 = b.power("3V3"), gnd = b.power("GND", 1), sda = b.gpio(21), scl = b.gpio(22);
  const at = (k, y) => [{ x: o.pins[k].x, y }];
  const wires = [
    ffWire(o.pins.VCC, v33, C.red, [{ x: o.pins.VCC.x, y: 226 }, { x: v33.x, y: 226 }], "orth"),
    ffWire(o.pins.GND, gnd, C.black, [{ x: o.pins.GND.x, y: 216 }, { x: gnd.x, y: 216 }], "orth"),
    ffWire(o.pins.SDA, sda, C.blue, [...at("SDA", 236), { x: sda.x, y: 236 }], "orth"),
    ffWire(o.pins.SCL, scl, C.purple, [...at("SCL", 246), { x: scl.x, y: 246 }], "orth"),
  ];
  const rows = [
    { colors: [C.red, C.black], part: "OLED VCC · GND", to: "3V3 · GND" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "D21 · D22" },
  ];
  const table = connectionTable(420, "이렇게 꽂아요 — F-F 듀폰선 4가닥", rows, "devkit", { columns: 1 });
  return { body: compose(b.draw([v33, gnd, sda, scl]), [o.svg], wires, [table.svg]), height: table.bottom };
}

/* ───── 확장 보드(38핀 확장 보드 + DevKit): 점퍼 3.3V ───── */
function expansion() {
  const b = makeExpansion({ x: 22, y: 48, jumper: "3V3" });
  const bot = b.bounds.y + 314;
  // OLED: I2C 헤더 안쪽 줄. 선은 바깥 줄(UART) 핀 사이 틈으로 올라가 옆에서 꽂는다 (UART 핀 위를 지나지 않게)
  const bus = b.i2c(0);
  const o = oled(110, bot + 74, { titleAt: { x: 98, y: bot + 130, anchor: "end" } });
  const lanes = { SDA: bot + 24, SCL: bot + 32, VCC: bot + 40, GND: bot + 48 };
  const color = { GND: C.black, VCC: C.red, SDA: C.blue, SCL: C.purple };
  const wires = [], used = [];
  for (const k of ["GND", "VCC", "SDA", "SCL"]) {
    const p = bus[k], from = o.pins[k], seam = p.x - 9.9;
    wires.push(ffWire(from, p, color[k], [{ x: from.x, y: lanes[k] }, { x: seam, y: lanes[k] }, { x: seam, y: p.y }], "orth"));
    used.push(p);
  }
  const rows = [
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C 헤더 GND · VCC (점퍼 3.3V)" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C 헤더 D21 · D22" },
  ];
  const table = connectionTable(o.pins.GND.y + 150, "이렇게 꽂아요 — F-F 듀폰선 4가닥, I2C 헤더 안쪽 줄에", rows, b.legend, { columns: 1 });
  return { body: compose(b.draw(used), [o.svg], wires, [table.svg]), height: table.bottom };
}

const T = {
  expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) OLED 화면 배선도(브레드보드 없이 보드에 바로): JUMP 점퍼는 3.3V 쪽. OLED 의 GND · VCC · SDA · SCL 네 핀을 F-F 듀폰선으로 왼쪽 아래 I2C 헤더 안쪽 줄의 GND · VCC · D21 · D22 에 (선은 UART 핀 사이 틈으로)",
  plus: "OLED 화면 배선도(ESP32 Plus 확장 보드, 브레드보드 없이 보드에 바로): OLED 의 GND · VCC · SDA · SCL 네 핀을 F-F 듀폰선으로 보드 I2C 묶음 첫 줄의 GND · 5V · SDA(21) · SCL(22) 에",
  devkit: "기본 보드(ESP32 DevKit 38핀) OLED 화면 배선도: OLED VCC 는 3V3, GND 는 GND, SDA 는 D21, SCL 은 D22 에 F-F 듀폰선 네 가닥으로 바로",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("odw", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("odwk", T.devkit, r.body, r.height); },
    expansion: () => { const r = expansion(); return svgDoc("odwx", T.expansion, r.body, r.height); },
  },
};
