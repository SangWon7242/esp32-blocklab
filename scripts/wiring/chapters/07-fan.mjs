// 센서 S7 "작은 선풍기" — 130 모터(팬) 모듈 G · V · IN+(13) · IN−(12). 브레드보드 없이 F-F 듀폰선 4가닥으로 보드에 바로.
// ESP32 Plus 는 AA 6개 배터리 홀더를 보드의 외부 전원 단자에 꽂는다(그림에 메모). 기본 보드(DevKit)는 그런 단자가 없어 USB 전원만.
import { COLORS as C, compose, connectionTable, ffWire, name, note, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { fan } from "../parts.mjs";

/** 배터리 홀더(AA 6개) 그림 — 세로로 세운 상자, 위에서 빨강·검정 선이 나온다. 반환 { svg, plus, minus } (선이 나오는 점) */
function batteryHolder(x, y) {
  const w = 58, h = 128;
  const out = [`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#343a40" stroke="currentColor"/>`];
  for (let i = 0; i < 6; i++) {
    const cy = y + 10 + i * 19.5;
    out.push(`<rect x="${x + 8}" y="${cy}" width="${w - 16}" height="15" rx="7" fill="#868e96" stroke="none"/><rect x="${x + w - 12}" y="${cy + 4}" width="4" height="7" rx="1" fill="#ced4da" stroke="none"/>`);
  }
  return { svg: out.join(""), plus: { x: x + 20, y }, minus: { x: x + 38, y } };
}

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
  parts.push(`<rect x="${jack.x}" y="${jack.y}" width="${jack.w}" height="${jack.h}" rx="5" fill="#212529" stroke="#868e96" stroke-width="2"/><circle cx="${jack.x + 9}" cy="${jack.y + jack.h / 2}" r="5" fill="#495057" stroke="none"/>`);
  const bh = batteryHolder(24, 340);
  parts.push(bh.svg);
  const plug = { x: jack.x - 2, y: jack.y + jack.h / 2 };
  const cable = (d, color) => `<path d="${d}" stroke="#ffffff" stroke-width="6.5" stroke-opacity="0.9"/><path d="${d}" stroke="${color}" stroke-width="3.5"/>`;
  parts.push(cable(`M${bh.plus.x} ${bh.plus.y} C${bh.plus.x} ${plug.y - 4} ${plug.x - 40} ${plug.y - 4} ${plug.x} ${plug.y - 3}`, C.red), cable(`M${bh.minus.x} ${bh.minus.y} C${bh.minus.x} ${plug.y + 4} ${plug.x - 30} ${plug.y + 4} ${plug.x} ${plug.y + 3}`, C.black));
  parts.push(note(12, 288, "외부 전원 단자", "start", 13), name(53, 484, "배터리 홀더", "middle", 14), note(53, 502, "AA 6개", "middle", 13));
  const rows = [
    { color: C.black, part: "팬 G", to: "GND" }, { color: C.red, part: "팬 V", to: "5V" },
    { color: C.yellow, part: "팬 IN+", to: t.INp.label }, { color: C.green, part: "팬 IN−", to: t.INm.label },
  ];
  const table = connectionTable(516, "이렇게 꽂아요 — F-F 듀폰선 4가닥, 배터리는 외부 전원 단자에", rows, "plus");
  return { body: compose(b.draw(used), parts, wires, [table.svg]), height: table.bottom };
}

/* ───── 기본 보드(DevKit V1 30핀): 팬 모듈을 위 줄 VIN · GND · D13 · D12 에 바로. 외부 전원 단자는 없다 ───── */
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

const T = {
  plus: "작은 선풍기 배선도(ESP32 Plus 확장 보드, 브레드보드 없이 보드에 바로): 130 모터(팬) 모듈의 G 는 보드 위쪽 GND, V 는 5V, IN+ 는 io13(motor1a), IN− 는 io12(motor1b) 에 F-F 듀폰선으로. AA 건전지 6개 배터리 홀더는 보드의 외부 전원 단자에 꽂아요. 팬 날개는 배선이 모두 끝난 뒤에 끼워요",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 작은 선풍기 배선도: 130 모터(팬) 모듈의 G 는 GND, V 는 VIN(5V), IN+ 는 D13(motor1a), IN− 는 D12(motor1b) 에 F-F 듀폰선 네 가닥으로. 기본 보드에는 외부 전원 단자가 없어 USB 전원으로 돌려요. 팬 날개는 배선이 모두 끝난 뒤에 끼워요",
};

export default {
  "wiring-motor.svg": {
    plus: () => { const r = plus(); return svgDoc("fw", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("fwk", T.devkit, r.body, r.height); },
  },
};
