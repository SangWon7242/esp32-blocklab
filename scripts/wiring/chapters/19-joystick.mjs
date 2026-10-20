// 센서 S16 "조이스틱 조종기" — 조이스틱(X 36 · Y 39 · B 26, V 3V3 · G GND), 서보(신호 4, 5V).
// 조이스틱 핀 순서(X Y B V G)와 보드 핀 순서가 서로 반대라 선이 몇 번 엇갈린다(어떻게 놓아도 생긴다). 엇갈림은 핀이 없는 빈 곳에서만.
// Plus: 조이스틱은 보드 아래에 핀이 위로 오게 놓고 F-F 로 바로, 서보 플러그는 ANALOG io4 줄에 바로.
// DevKit: 서보는 보드 아래 왼쪽(플러그에 M-F), 조이스틱은 그 아래(F-F) — 위 줄 핀은 보드 바깥 길로 돌아 들어간다.
import { COLORS as C, compose, connectionTable, ffWire, mfWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { joystick, servo, servoWithPlug } from "../parts.mjs";

// 조이스틱을 보드 아래에 놓으면 핀이 위로 오고, 왼→오 순서가 G V B Y X 가 된다 (모듈을 180° 돌린 모습)
const UP_PINS = ["G", "V", "B", "Y", "X"];

function plus() {
  const b = makePlus({ x: 96, y: 62 });
  const sv = b.triple(4);
  const s = servo(14, sv.G.y - 22, [sv.G, sv.V, sv.S]);
  const j = joystick(396, b.bounds.y + b.bounds.h + 74, { side: "top", pins: UP_PINS, titleAt: { x: 380, y: b.bounds.y + b.bounds.h + 124, anchor: "end" } });
  const t = { X: b.gpio(36), Y: b.gpio(39), B: b.gpio(26), V: b.power("3V3"), G: b.power("GND", 1) };
  const lane = b.bounds.y + b.bounds.h + 30;
  const wires = [
    ffWire(j.pins.G, t.G, C.black), ffWire(j.pins.V, t.V, C.pink),
    ffWire(j.pins.X, t.X, C.green), ffWire(j.pins.Y, t.Y, C.blue),
    // B → 보드 오른쪽 바깥 → 보드 위 → io26 (위에서)
    ffWire(j.pins.B, t.B, C.yellow, [{ x: j.pins.B.x, y: lane }, { x: 614, y: lane }, { x: 614, y: b.bounds.y - 14 }, { x: t.B.x, y: b.bounds.y - 14 }], "orth"),
  ];
  const rows = [
    { color: C.green, part: "조이스틱 X", to: "io36 (아래 줄)" }, { color: C.blue, part: "조이스틱 Y", to: "io39 (아래 줄)" },
    { color: C.yellow, part: "조이스틱 B", to: "io26 (위쪽 한 줄)" }, { color: C.pink, part: "조이스틱 V", to: "3V3 (아래 줄)" },
    { color: C.black, part: "조이스틱 G", to: "GND (아래 줄)" },
    { colors: [C.brown, C.red, C.orange], part: "서보 플러그", to: "io4 줄 G·V·S" },
  ];
  const table = connectionTable(j.pins.G.y + 128, "이렇게 꽂아요 — 브레드보드 없이 보드에 바로", rows, "plus");
  const used = [t.X, t.Y, t.B, t.V, t.G, sv.G, sv.V, sv.S];
  return svgDoc("wbj", T.plus, compose(b.draw(used), [s.svg, j.svg], wires, [table.svg]), table.bottom);
}

function devkit() {
  const b = makeDevkit({ x: 110, y: 92 });
  const vin = b.power("5V"), gndTop = b.power("GND", 0), gndBot = b.power("GND", 1), v33 = b.power("3V3"), d4 = b.gpio(4);
  const tx = b.gpio(36), ty = b.gpio(39), tb = b.gpio(26);
  const bot = b.bounds.y + b.bounds.h;
  // 서보: 보드 아래 왼쪽. 플러그(위→아래 S V G)에 M-F 선 — 주황 D4 · 갈색 아래 줄 GND 는 바로, 빨강 VIN 은 왼쪽 바깥 길로
  const s = servoWithPlug(320, bot + 34, { plugSide: "left", order: ["S", "V", "G"], titleAt: { x: 404, y: bot + 56, anchor: "start" } });
  // 조이스틱: 서보 아래, 핀이 위로
  const jy = bot + 196;
  const j = joystick(420, jy, { side: "top", pins: UP_PINS, titleAt: { x: 556, y: jy + 50, anchor: "start" } });
  const top = (k) => b.bounds.y - 12 - k * 9; // 보드 위 바깥 길 (k 가 클수록 높이)
  const left = (k) => 30 + k * 12; // 보드 왼쪽 바깥 길 (k 가 클수록 안쪽)
  const right = (k) => 596 + k * 12; // 보드 오른쪽 바깥 길 (k 가 클수록 바깥)
  const laneV = s.pins.G.y + 30, laneG = laneV + 12; // 서보 아래로 지나가는 길
  const laneR = jy - 30;
  const wires = [
    // 서보
    mfWire(d4, s.pins.S, C.orange, [{ x: d4.x, y: s.pins.S.y }], "orth"),
    mfWire(gndBot, s.pins.G, C.black, [{ x: gndBot.x, y: s.pins.G.y }], "orth"),
    mfWire(vin, s.pins.V, C.red, [{ x: vin.x, y: top(0) }, { x: left(1), y: top(0) }, { x: left(1), y: s.pins.V.y }], "orth"),
    // 조이스틱 V → 3V3 (서보 아래를 지나 아래에서), G → 위 줄 GND (서보 아래 → 왼쪽 바깥 → 위에서)
    ffWire(j.pins.V, v33, C.pink, [{ x: j.pins.V.x, y: laneV }, { x: v33.x, y: laneV }], "orth"),
    ffWire(j.pins.G, gndTop, C.black, [{ x: j.pins.G.x, y: laneG }, { x: left(0), y: laneG }, { x: left(0), y: top(1) }, { x: gndTop.x, y: top(1) }], "orth"),
    // 조이스틱 B · Y · X → 오른쪽 바깥 → 보드 위 → D26 · VN · VP (위에서)
    ffWire(j.pins.B, tb, C.yellow, [{ x: j.pins.B.x, y: laneR - 16 }, { x: right(0), y: laneR - 16 }, { x: right(0), y: top(3) }, { x: tb.x, y: top(3) }], "orth"),
    ffWire(j.pins.Y, ty, C.blue, [{ x: j.pins.Y.x, y: laneR - 8 }, { x: right(1), y: laneR - 8 }, { x: right(1), y: top(2) }, { x: ty.x, y: top(2) }], "orth"),
    ffWire(j.pins.X, tx, C.green, [{ x: j.pins.X.x, y: laneR }, { x: right(2), y: laneR }, { x: right(2), y: top(1) }, { x: tx.x, y: top(1) }], "orth"),
  ];
  const rows = [
    { color: C.green, part: "조이스틱 X", to: tx.label }, { color: C.blue, part: "조이스틱 Y", to: ty.label },
    { color: C.yellow, part: "조이스틱 B", to: tb.label }, { color: C.pink, part: "조이스틱 V", to: "3V3" },
    { color: C.black, part: "조이스틱 G", to: "GND (위 줄)" },
    { color: C.orange, part: "서보 주황(신호)", to: d4.label }, { color: C.red, part: "서보 빨강", to: "VIN(5V)" },
    { color: C.black, part: "서보 갈색", to: "GND (아래 줄)" },
  ];
  const table = connectionTable(jy + 118, "이렇게 꽂아요 — 조이스틱은 F-F, 서보 플러그는 M-F 선으로", rows, "devkit");
  const used = [vin, gndTop, gndBot, v33, d4, tx, ty, tb];
  return svgDoc("wbjk", T.devkit, compose(b.draw(used), [s.svg, j.svg], wires, [table.svg]), table.bottom);
}

const T = {
  plus: "조이스틱 배선도(ESP32 Plus 확장 보드, 브레드보드 없이 보드에 바로): 조이스틱은 보드 아래에 핀이 위로 오게 놓고 F-F 듀폰선으로 X 는 아래 줄 io36, Y 는 io39, V 는 3V3, G 는 GND, B 는 보드 바깥으로 돌아 위쪽 한 줄 io26 에. 서보 플러그는 ANALOG 묶음 io4 줄에 갈색 G, 빨강 V, 주황 S 가 맞도록 그대로",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 조이스틱 배선도: 조이스틱 X 는 VP(36), Y 는 VN(39), B 는 D26, V 는 3V3, G 는 위 줄 GND 에 F-F 듀폰선으로. 서보 플러그 주황은 D4, 빨강은 VIN(5V), 갈색은 아래 줄 GND 에 M-F 듀폰선으로",
};

export default {
  "wiring-breadboard.svg": { plus, devkit },
};
