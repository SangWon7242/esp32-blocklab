// 메이커 데이 「색깔 카드 AI 불빛」 — RGB LED 모듈(R G B −)을 Plus 보드 io27 · io25 · io26 기둥 S 와 GND 에 F-F 로 바로.
import { COLORS as C, compose, connectionTable, ffWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { module } from "../parts.mjs";

function rgbModule(x, y) {
  return module({
    kind: "rgb",
    x, y, w: 100, h: 64, color: "#212529", pins: ["R", "G", "B", "-"], side: "bottom", firstPin: 20, title: "RGB LED 모듈",
    decor: (mx, my, w) => `<circle cx="${mx + w / 2}" cy="${my + 30}" r="16" fill="#f8f9fa" stroke="#ced4da"/>`,
  });
}

function plus() {
  const b = makePlus({ x: 96, y: 150 });
  const t27 = b.triple(27), t25 = b.triple(25), t26 = b.triple(26);
  const gnd = t26.G; // 가장 가까운 기둥(io26)의 G 칸이 GND. 맨 왼쪽 위 GND 줄까지 선이 가로지르지 않게
  const m = rgbModule((t27.S.x + t26.S.x) / 2 - 50, 20);
  // 세 신호선(R G B)은 모듈 아래 빈 곳에서 옆으로 한 번 꺾어 기둥 위에서 곧장 S 로 내려온다.
  // 꺾는 높이를 오른쪽 선부터 위에서 아래로 두면 서로 가로지르지 않는다. 기둥은 S 아래에 G 가 있어 S 선이 아래에서 올라오면 G 자리를 지나므로 위에서 내려오게 한다.
  const jog = (from, to, color, y) => ffWire(from, to, color, [{ x: from.x, y }, { x: to.x, y }], "orth");
  // 검정(−)은 기둥 오른쪽 바깥 길로 내려가 위 G 줄 아래 띠에서 io26 기둥 G 로 올라간다
  const laneY = b.lane.top + 4;
  const gx = m.pins["-"].x + 15;
  const black = ffWire(m.pins["-"], gnd, C.black, [{ x: m.pins["-"].x, y: 96 }, { x: gx, y: 96 }, { x: gx, y: laneY }, { x: gnd.x, y: laneY }], "orth");
  const wires = [black, jog(m.pins.B, t26.S, C.blue, 108), jog(m.pins.G, t25.S, C.green, 120), jog(m.pins.R, t27.S, C.red, 132)];
  const rows = [
    { color: C.red, part: "모듈 R", to: "io27 기둥 S" },
    { color: C.green, part: "모듈 G", to: "io25 기둥 S" },
    { color: C.blue, part: "모듈 B", to: "io26 기둥 S" },
    { color: C.black, part: "모듈 −", to: "io26 기둥 G (GND)" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — 같은 색 스티커 자리에", rows, "plus");
  return { body: compose(b.draw([t27.S, t25.S, t26.S, gnd]), [m.svg], wires, [table.svg]), height: table.bottom };
}

export default {
  "wiring.svg": {
    plus: () => { const r = plus(); return svgDoc("mca", "배선도(ESP32 Plus 확장 보드): RGB LED 모듈 R → io27, G → io25, B → io26, − → GND. 모두 F-F 선으로 보드에 바로 꽂아요", r.body, r.height); },
  },
};
