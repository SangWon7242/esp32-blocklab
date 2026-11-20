// 융합 F2 "OLED 출입 화면" — OLED + RFID 가 I2C 두 선(SCL 22 · SDA 21)을 나눠 쓰고, 서보(4)가 문.
// ESP32 Plus: RFID 는 8 장처럼 I2C 묶음 첫 줄, OLED 는 보드 위쪽 왼쪽 SCL · SDA · 5V · GND(같은 I2C 선), 서보 플러그는 ANALOG io4 줄 — 브레드보드 없이.
// 기본 보드: 보드 아래 브레드보드 — 3V3 · GND 를 아래 + − 줄에, D21 · D22 를 세로줄 둘(SDA 줄 · SCL 줄)에 꽂고
//   OLED · RFID 의 선을 그 줄에 모은다. 서보는 VIN · GND · D4 에 M-F 선으로 바로.
// 확장 보드: 브레드보드 없이 — OLED 는 I2C 헤더(GND · VCC · D21 · D22, 10장과 같은 자리), RFID 는 두 번째 I2C 자리
//   (아래 줄 P21 칸 G · V · S + P22 칸 S, b.i2c(1)), 서보 플러그는 아래 줄 P4 칸 기둥. 서보가 V 줄을 쓰므로 점퍼 5V.
//   RFID 선이 오른쪽 아래로 내려가 보드 아래 점퍼 메모 자리를 지나므로, 점퍼 메모는 보드 위 왼쪽에 따로 적는다.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, note, svgDoc, wire } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { columnServo, makeExpansion } from "../boards/expansion.mjs";
import { breadboard, oled, rfid, servo, servoWithPlug } from "../parts.mjs";
import { columnRun } from "./15-temp-humidity.mjs";

/* ───── ESP32 Plus ───── */
function plus() {
  const b = makePlus({ x: 78, y: 206 });
  const parts = [], wires = [], used = [];
  // RFID: 8 장과 같은 자리 — 보드 오른쪽 → I2C 묶음 첫 줄
  const r = rfid(508, b.lane.bottom + 18, { titleAt: { x: 573, y: b.lane.bottom + 146 } });
  parts.push(r.svg);
  const bus = b.i2c(0);
  const lane = { GND: b.lane.top + 3, VCC: b.lane.top + 8, SDA: b.lane.top + 13, SCL: b.lane.top + 18 };
  const via = (k) => [{ x: r.pins[k].x, y: lane[k] }, { x: bus[k].x, y: lane[k] }];
  wires.push(ffWire(r.pins.GND, bus.GND, C.black, via("GND"), "orth"), ffWire(r.pins.VCC, bus.VCC, C.red, via("VCC"), "orth"), ffWire(r.pins.SDA, bus.SDA, C.blue, via("SDA"), "orth"), ffWire(r.pins.SCL, bus.SCL, C.purple, via("SCL"), "orth"));
  used.push(bus.GND, bus.VCC, bus.SDA, bus.SCL);
  // OLED: 보드 위, 핀이 위로. 선은 위로 올라가 왼쪽으로 돌아 위쪽 한 줄 SCL · SDA · 5V · GND 로 내려온다
  const o = oled(204, 62, { titleAt: { x: 324, y: 118, anchor: "start" } });
  parts.push(o.svg);
  const t = { SCL: b.pin("top:SCL"), SDA: b.pin("top:SDA"), VCC: b.pin("top:5V"), GND: b.pin("top:GND") };
  const top = o.pins.GND.y;
  const level = { GND: top - 10, VCC: top - 19, SCL: top - 28, SDA: top - 37 };
  const loop = (k, color) => ffWire(o.pins[k], t[k], color, [{ x: o.pins[k].x, y: level[k] }, { x: t[k].x, y: level[k] }], "orth");
  wires.push(loop("GND", C.black), loop("VCC", C.red), loop("SCL", C.purple), loop("SDA", C.blue));
  used.push(t.SCL, t.SDA, t.VCC, t.GND);
  // 서보: 플러그를 ANALOG io4 줄에 그대로 (8 장과 같다)
  const sv = b.triple(4);
  parts.push(servo(8, sv.S.y - 22, [sv.G, sv.V, sv.S], { titleAt: { x: 40, y: sv.S.y + 42 } }).svg);
  used.push(sv.G, sv.V, sv.S);
  const rows = [
    { colors: [C.black, C.red], part: "RFID GND · VCC", to: "I2C GND · 5V" },
    { colors: [C.blue, C.purple], part: "RFID SDA · SCL", to: "I2C SDA · SCL" },
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "위쪽 GND · 5V" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "위쪽 SDA · SCL" },
    { colors: [C.brown, C.red, C.orange], part: "서보 플러그", to: "io4 줄 G · V · S" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 34, "이렇게 꽂아요 — 브레드보드 없이 보드에 바로", rows, "plus", { columns: 1 });
  return { body: compose(b.draw(used), parts, wires, [table.svg, note(204, 196, "위쪽 SDA · SCL 도 I2C 묶음과 같은 21 · 22번 선이에요", "start", 13)]), height: table.bottom };
}

/* ───── 기본 보드 ───── */

function devkit() {
  const b = makeDevkit({ x: 110, y: 112 });
  const parts = [], wires = [], used = [];
  // 서보: 보드 위 왼쪽. 빨강 → VIN, 갈색 → 위 GND 에 바로, 주황 → 보드 왼쪽 바깥 길로 D4
  const s = servoWithPlug(10, 14, { titleAt: { x: 44, y: 76 } });
  parts.push(s.svg);
  const vin = b.power("5V"), gTop = b.power("GND", 0), d4 = b.gpio(4);
  wires.push(mfWire(vin, s.pins.V, C.red, [{ x: vin.x, y: s.pins.V.y }], "orth"), mfWire(gTop, s.pins.G, C.black, [{ x: gTop.x, y: s.pins.G.y }], "orth"));
  const underY = b.bounds.y + b.bounds.h + 12;
  wires.push(mfWire(d4, s.pins.S, C.yellow, [{ x: d4.x, y: underY }, { x: 30, y: underY }, { x: 30, y: 96 }, { x: s.pins.S.x, y: 96 }], "orth"));
  used.push(vin, gTop, d4);
  // 브레드보드: 보드 아래, + − 줄은 아래쪽. SCL 줄(9번)과 SDA 줄(14번)
  const bb = breadboard({ x: 196, y: b.bounds.y + b.bounds.h + 38, cols: 16, rails: { top: false, bottom: true } });
  const HOLE = 16, alley = (c) => bb.hole(c, "a").x + HOLE / 2; // c 열과 c+1 열 사이 빈 길 (구멍 위를 지나지 않게)
  const SCLc = 9, SDAc = 14;
  bb.tint(SCLc, "top"); bb.tint(SDAc, "top");
  parts.push(bb.svg);
  const v33 = b.power("3V3"), gBot = b.power("GND", 1), sda = b.gpio(21), scl = b.gpio(22);
  // 보드 3V3 · GND → 브레드보드 왼쪽 끝에서 + − 줄로, D21 · D22 → SDA 줄 · SCL 줄 a 칸
  const pIn = bb.rail("bottom", "+", 1), mIn = bb.rail("bottom", "-", 1);
  wires.push(mfWire(v33, pIn, C.red, [{ x: v33.x, y: pIn.y }], "orth"), mfWire(gBot, mIn, C.black, [{ x: gBot.x, y: mIn.y }], "orth"));
  wires.push(mfWire(sda, bb.hole(SDAc, "a"), C.blue), mfWire(scl, bb.hole(SCLc, "a"), C.purple));
  used.push(v33, gBot, sda, scl);
  // 구멍으로 들어가는 선: 점들을 직각으로 잇되 마지막은 열 사이 빈 길에서 옆으로 꺾어 꽂는다
  const mf = (from, hole, color, pts) => wire(from, hole, color, { via: pts, style: "orth", ends: ["f", "m"] });
  // OLED: 브레드보드 아래 왼쪽, 핀이 위로
  const o = oled(206, bb.y + bb.h + 54, { titleAt: { x: 194, y: bb.y + bb.h + 110, anchor: "end" } });
  parts.push(o.svg);
  const trk = (k) => bb.y + bb.h + 8 + k * 8; // 브레드보드 아래 가로 길
  const mOled = bb.rail("bottom", "-", 2), pOled = bb.rail("bottom", "+", 3);
  wires.push(mf(o.pins.GND, mOled, C.black, [{ x: alley(1), y: o.pins.GND.y - 8 }, { x: alley(1), y: mOled.y }]));
  wires.push(mf(o.pins.VCC, pOled, C.red, [{ x: o.pins.VCC.x, y: trk(4) }, { x: pOled.x, y: trk(4) }]));
  wires.push(mf(o.pins.SCL, bb.hole(SCLc, "c"), C.purple, [{ x: o.pins.SCL.x, y: trk(2) }, { x: alley(SCLc - 1), y: trk(2) }, { x: alley(SCLc - 1), y: bb.hole(SCLc, "c").y }]));
  wires.push(mf(o.pins.SDA, bb.hole(SDAc, "c"), C.blue, [{ x: o.pins.SDA.x, y: trk(3) }, { x: alley(SDAc - 1), y: trk(3) }, { x: alley(SDAc - 1), y: bb.hole(SDAc, "c").y }]));
  // RFID: 브레드보드 오른쪽, 핀이 아래로. GND · VCC 는 + − 줄 오른쪽 끝, SDA · SCL 은 아래로 돌아 SDA 줄 · SCL 줄 e 칸
  const r = rfid(504, mIn.y - 30 - 122, { side: "bottom", titleAt: { x: 569, y: mIn.y - 30 - 136 } });
  parts.push(r.svg);
  const mR = bb.rail("bottom", "-", 16), pR = bb.rail("bottom", "+", 16);
  wires.push(mf(r.pins.GND, mR, C.black, [{ x: r.pins.GND.x, y: mR.y }]));
  wires.push(mf(r.pins.VCC, pR, C.red, [{ x: r.pins.VCC.x, y: pR.y }]));
  wires.push(mf(r.pins.SDA, bb.hole(SDAc, "e"), C.blue, [{ x: r.pins.SDA.x, y: trk(0) }, { x: alley(SDAc), y: trk(0) }, { x: alley(SDAc), y: bb.hole(SDAc, "e").y }]));
  wires.push(mf(r.pins.SCL, bb.hole(SCLc, "e"), C.purple, [{ x: r.pins.SCL.x, y: trk(1) }, { x: alley(SCLc), y: trk(1) }, { x: alley(SCLc), y: bb.hole(SCLc, "e").y }]));
  const rows = [
    { color: C.red, part: "3V3 · OLED VCC · RFID VCC", to: "+ 줄" },
    { color: C.black, part: "GND · OLED GND · RFID GND", to: "− 줄" },
    { color: C.blue, part: "D21 · OLED SDA · RFID SDA", to: `${SDAc}번 줄(SDA 줄)` },
    { color: C.purple, part: "D22 · OLED SCL · RFID SCL", to: `${SCLc}번 줄(SCL 줄)` },
    { colors: [C.red, C.black], part: "서보 빨강 · 갈색", to: "VIN · GND" },
    { color: C.yellow, part: "서보 주황(신호)", to: d4.label },
  ];
  const table = connectionTable(o.pins.GND.y + 150, "이렇게 꽂아요 — 같은 세로줄 다섯 칸은 서로 이어져요", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 확장 보드(38핀 확장 보드 + DevKit) ───── */
function expansion() {
  const b = makeExpansion({ x: 22, y: 50, jumper: "5V" }); // 오른쪽 위(x>560, y<44)는 비워 둔다
  const Y = b.bounds.y;
  const parts = [], wires = [], used = [];
  // OLED: I2C 헤더 안쪽 줄 (10장과 같은 자리). 선은 바깥 줄(UART) 핀 사이 틈으로 올라가 옆에서 꽂는다
  const bus = b.i2c(0);
  const o = oled(110, Y + 388, { titleAt: { x: 98, y: Y + 444, anchor: "end" } });
  parts.push(o.svg);
  const lanes = { GND: Y + 362, VCC: Y + 354, SDA: Y + 338, SCL: Y + 346 };
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
  // RFID: 두 번째 I2C 자리. 핀이 위로, SCL 핀이 P22 칸 바로 아래. GND · VCC · SDA 는 P21 칸 기둥에 모아 꽂는다
  const bus2 = b.i2c(1);
  const r = rfid(bus2.SCL.x - 95, Y + 392);
  parts.push(r.svg);
  wires.push(
    columnRun(r.pins.GND, bus2.GND, C.black, { lane: Y + 346, x: bus2.GND.x - 4 }),
    columnRun(r.pins.VCC, bus2.VCC, C.red, { lane: Y + 336, x: bus2.VCC.x }),
    columnRun(r.pins.SDA, bus2.SDA, C.blue, { lane: Y + 326, x: bus2.SDA.x + 4 }),
    ffWire(r.pins.SCL, bus2.SCL, C.purple),
  );
  used.push(bus2.GND, bus2.VCC, bus2.SDA, bus2.SCL);
  const rows = [
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C 헤더 GND · VCC" },
    { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C 헤더 D21 · D22" },
    { colors: [C.black, C.red, C.blue], part: "RFID GND · VCC · SDA", to: "아래 줄 P21 칸 G · V · S" },
    { color: C.purple, part: "RFID SCL", to: "아래 줄 P22 칸 S" },
    { colors: [C.brown, C.red, C.orange], part: "서보 플러그", to: "아래 줄 P4 칸 G · V · S (V 는 점퍼 5V)" },
  ];
  const table = connectionTable(Y + 548, "이렇게 꽂아요 — 브레드보드 없이 보드에 바로", rows, b.legend, { columns: 1 });
  // 점퍼 메모: 보드 아래 오른쪽(기본 자리)은 RFID 선이 지나가므로 보드 위 왼쪽에
  const jumperNote = note(b.bounds.x, Y - 18, "JUMP 점퍼를 5V 쪽으로 (V 줄 = 5V, 끝나면 3.3V 로)", "start", 12);
  return { body: compose(b.draw(used, { note: false }), parts, wires, [table.svg, jumperNote]), height: table.bottom };
}

const T = {
  expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) OLED 화면과 RFID 배선도(브레드보드 없이 보드에 바로): 이번 수업은 JUMP 점퍼를 5V 쪽으로. OLED GND · VCC · SDA · SCL 은 F-F 듀폰선으로 I2C 헤더의 GND · VCC · D21 · D22 에. RFID GND · VCC · SDA 는 아래 줄 P21 칸의 G · V · S 핀에, SCL 은 아래 줄 P22 칸 S 핀에 — P21 · P22 도 I2C 헤더와 같은 21 · 22번 선이에요. 서보 모터 플러그는 아래 줄 P4 칸에 갈색 G, 빨강 V, 주황 S 가 맞도록 그대로",
  plus: "OLED 화면과 RFID 배선도(ESP32 Plus 확장 보드, 브레드보드 없이 보드에 바로): RFID GND · VCC · SDA · SCL 은 8장처럼 F-F 듀폰선으로 보드 I2C 묶음 첫 줄의 GND · 5V · SDA · SCL 에. OLED GND · VCC · SDA · SCL 은 보드 위쪽 한 줄의 GND · 5V · SDA · SCL 에 — 위쪽 SDA · SCL 도 I2C 묶음과 같은 21 · 22번 선이에요. 서보 모터 플러그는 ANALOG 묶음 io4 줄에 갈색 G, 빨강 V, 주황 S 가 맞도록 그대로",
  devkit: "기본 보드(ESP32 DevKit 38핀) OLED 화면과 RFID 배선도: 보드 아래 브레드보드. 보드 3V3 은 + 줄, GND 는 − 줄, D21 은 14번 줄(SDA 줄), D22 는 9번 줄(SCL 줄). OLED 와 RFID 의 VCC 는 + 줄, GND 는 − 줄, SDA 는 14번 줄, SCL 은 9번 줄. 서보 빨강은 VIN, 갈색은 GND, 주황(신호)은 D4 에 M-F 듀폰선으로 바로",
};

export default {
  "wiring-oled-rfid.svg": {
    plus: () => { const r = plus(); return svgDoc("wo", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wok", T.devkit, r.body, r.height); },
    expansion: () => { const r = expansion(); return svgDoc("wox", T.expansion, r.body, r.height); },
  },
};
