// 센서 S7 "작은 선풍기" — 130 모터(팬) 모듈 G · V · IN+(13) · IN−(12). 브레드보드 없이 F-F 듀폰선 4가닥으로 보드에 바로.
// ESP32 Plus 는 AA 6개 배터리 홀더를 보드의 외부 전원 단자에 꽂는다(그림에 메모). 기본 보드(DevKit)는 그런 단자가 없어 USB 전원만.
// 확장 보드: 팬 V → 위 줄 5V 칸 S 핀(점퍼와 상관없이 늘 5V), G → 전원 헤더 GND, IN+ → P13 칸 S, IN− → P12 칸 S. F-F 로 바로.
// 팬이 V 줄을 쓰지 않으므로 점퍼는 평소 자리(3.3V). 전원은 USB.
import { COLORS as C, compose, connectionTable, ffWire, name, note, svgDoc } from "../common.mjs";
import { mark, pt, rec } from "../record.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { makeExpansion } from "../boards/expansion.mjs";
import { batteryHolder, fan, powerJack } from "../parts.mjs";

/* ───── ESP32 Plus: 팬 모듈은 보드 위쪽 한 줄에 바로, 배터리 홀더는 외부 전원 단자 ───── */
function plus() {
  const b = makePlus({ x: 110, y: 150 });
  const parts = [], wires = [], used = [];
  const f = fan(196, 20, { titleAt: { x: 184, y: 52, anchor: "end" } });
  parts.push(f.svg);
  const t = { G: b.power("GND"), V: b.power("5V"), INp: b.gpio(13), INm: b.gpio(12) };
  wires.push(ffWire(f.pins.G, t.G, C.black), ffWire(f.pins.V, t.V, C.red), ffWire(f.pins["IN+"], t.INp, C.yellow), ffWire(f.pins["IN−"], t.INm, C.green));
  used.push(t.G, t.V, t.INp, t.INm);
  // 외부 전원 단자(보드 왼쪽 가장자리, USB 아래)와 배터리 홀더
  const jack = { x: b.bounds.x - 10, y: b.bounds.y + 150, w: 24, h: 30 };
  parts.push(powerJack(jack));
  const bh = batteryHolder(24, 340);
  parts.push(bh.svg);
  const plug = { x: jack.x - 2, y: jack.y + jack.h / 2 };
  // 배터리 선(듀폰선이 아니라 홀더에 달린 전선): 그림은 가는 곡선, 3D 에는 홀더 위 → 단자 플러그까지의 선으로 적는다
  const cable = (from, to, d, color) => {
    rec("wires", { from: pt(from), to: pt(to), color, ends: ["m", "m"] });
    return mark(`<path d="${d}" stroke="#ffffff" stroke-width="6.5" stroke-opacity="0.9"/><path d="${d}" stroke="${color}" stroke-width="3.5"/>`);
  };
  const pp = { x: plug.x, y: plug.y - 3 }, pm = { x: plug.x, y: plug.y + 3 };
  parts.push(cable(bh.plus, pp, `M${bh.plus.x} ${bh.plus.y} C${bh.plus.x} ${plug.y - 4} ${plug.x - 40} ${plug.y - 4} ${plug.x} ${plug.y - 3}`, C.red), cable(bh.minus, pm, `M${bh.minus.x} ${bh.minus.y} C${bh.minus.x} ${plug.y + 4} ${plug.x - 30} ${plug.y + 4} ${plug.x} ${plug.y + 3}`, C.black));
  parts.push(note(12, 288, "외부 전원 단자", "start", 13), name(53, 484, "배터리 홀더", "middle", 14), note(53, 502, "AA 6개", "middle", 13));
  const rows = [
    { color: C.black, part: "팬 G", to: "GND" }, { color: C.red, part: "팬 V", to: "5V" },
    { color: C.yellow, part: "팬 IN+", to: t.INp.label }, { color: C.green, part: "팬 IN−", to: t.INm.label },
  ];
  const table = connectionTable(516, "이렇게 꽂아요 — F-F 듀폰선 4가닥, 배터리는 외부 전원 단자에", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit 38핀): 팬 모듈을 위 줄 VIN · GND · D13 · D12 에 바로. 외부 전원 단자는 없다 ───── */
function devkit() {
  const b = makeDevkit({ x: 110, y: 176 });
  const parts = [], wires = [], used = [];
  const f = fan(150, 22, { titleAt: { x: 138, y: 54, anchor: "end" } });
  parts.push(f.svg);
  const t = { G: b.power("GND", 0), V: b.power("5V"), INp: b.gpio(13), INm: b.gpio(12) };
  wires.push(ffWire(f.pins.G, t.G, C.black), ffWire(f.pins.V, t.V, C.red), ffWire(f.pins["IN+"], t.INp, C.yellow), ffWire(f.pins["IN−"], t.INm, C.green));
  used.push(t.G, t.V, t.INp, t.INm);
  parts.push(note(310, 46, "기본 보드에는 외부 전원 단자가 없어요", "start", 13), note(310, 66, "USB 전원으로 돌려요", "start", 13));
  const rows = [
    { color: C.black, part: "팬 G", to: "GND" }, { color: C.red, part: "팬 V", to: t.V.label },
    { color: C.yellow, part: "팬 IN+", to: t.INp.label }, { color: C.green, part: "팬 IN−", to: t.INm.label },
  ];
  const table = connectionTable(352, "이렇게 꽂아요 — F-F 듀폰선 4가닥", rows, "devkit");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 확장 보드(38핀 확장 보드 + DevKit): 바깥 줄 핀에 바로 — 엇갈리는 선 없이, 점퍼는 평소 자리 ───── */
function expansion() {
  const b = makeExpansion({ x: 22, y: 186, jumper: "3V3" });
  const parts = [], wires = [], used = [];
  const f = fan(180, 30, { titleAt: { x: 168, y: 62, anchor: "end" } });
  parts.push(f.svg);
  // V 는 위 줄 5V 칸 S 핀(점퍼와 상관없이 늘 5V), G 는 전원 헤더 GND(맨 오른쪽) — 둘 다 바깥 줄이라 다른 핀 위를 지나지 않는다
  const t = { G: b.power("GND", 5), V: b.power("5V"), INp: b.gpio(13), INm: b.gpio(12) };
  const py = f.pins.G.y;
  const lane = { G: py + 22, V: py + 22, INm: py + 14, INp: py + 28 };
  const via = (from, to, y) => [{ x: from.x, y }, { x: to.x, y }];
  wires.push(ffWire(f.pins.G, t.G, C.black, via(f.pins.G, t.G, lane.G), "orth"), ffWire(f.pins.V, t.V, C.red, via(f.pins.V, t.V, lane.V), "orth"));
  wires.push(ffWire(f.pins["IN+"], t.INp, C.yellow, via(f.pins["IN+"], t.INp, lane.INp), "orth"), ffWire(f.pins["IN−"], t.INm, C.green, via(f.pins["IN−"], t.INm, lane.INm), "orth"));
  used.push(t.G, t.V, t.INp, t.INm);
  parts.push(note(310, 56, "USB 전원으로 돌려요", "start", 13), note(310, 76, "팬 V 는 늘 5V 인 5V 칸에", "start", 13));
  const rows = [
    { color: C.black, part: "팬 G", to: "전원 헤더 GND" }, { color: C.red, part: "팬 V", to: "위 줄 5V 칸 S 핀" },
    { color: C.yellow, part: "팬 IN+", to: "P13 칸 S 핀" }, { color: C.green, part: "팬 IN−", to: "P12 칸 S 핀" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 12, "이렇게 꽂아요 — F-F 듀폰선 4가닥", rows, b.legend);
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "작은 선풍기 배선도(ESP32 Plus 확장 보드, 브레드보드 없이 보드에 바로): 130 모터(팬) 모듈의 G 는 보드 위쪽 GND, V 는 5V, IN+ 는 io13(motor1a), IN− 는 io12(motor1b) 에 F-F 듀폰선으로. AA 건전지 6개 배터리 홀더는 보드의 외부 전원 단자에 꽂아요. 팬 날개는 배선이 모두 끝난 뒤에 끼워요",
  expansion: "확장 보드(ESP32 38핀 확장 보드 + DevKit) 작은 선풍기 배선도(브레드보드 없이 보드에 바로): 130 모터(팬) 모듈의 G 는 왼쪽 전원 헤더 GND, V 는 위 줄 5V 칸 S 핀(점퍼와 상관없이 늘 5V), IN+ 는 P13 칸 S 핀(motor1a), IN− 는 P12 칸 S 핀(motor1b) 에 F-F 듀폰선 네 가닥으로. JUMP 점퍼는 3.3V 쪽 그대로. USB 전원으로 돌려요. 팬 날개는 배선이 모두 끝난 뒤에 끼워요",
  devkit: "기본 보드(ESP32 DevKit 38핀) 작은 선풍기 배선도: 130 모터(팬) 모듈의 G 는 GND, V 는 VIN(5V), IN+ 는 D13(motor1a), IN− 는 D12(motor1b) 에 F-F 듀폰선 네 가닥으로. 기본 보드에는 외부 전원 단자가 없어 USB 전원으로 돌려요. 팬 날개는 배선이 모두 끝난 뒤에 끼워요",
};

export default {
  "wiring-motor.svg": {
    plus: () => { const r = plus(); return svgDoc("fw", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("fwk", T.devkit, r.body, r.height); },
    expansion: () => { const r = expansion(); return svgDoc("fwx", T.expansion, r.body, r.height); },
  },
};
