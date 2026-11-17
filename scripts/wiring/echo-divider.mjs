// 초음파 Echo 전압 나누기: HC-SR04 의 Echo 는 5V 신호인데 ESP32 핀은 3.3V 까지만 받는다.
// Echo → 1kΩ → (가운데 = 보드 핀) → 2kΩ → GND 로 이으면 가운데가 5V × 2/3 ≈ 3.3V 가 된다.
// 브레드보드 아래 칸(f~j) 세 줄을 쓴다: Echo 줄 · 가운데 줄 · GND 줄 (step 칸 간격).
//   Echo 줄 j: 센서 Echo 선      가운데 줄 j: 보드 핀 선      GND 줄 i: 센서 GND 선, j: 보드 GND 선
//   1kΩ: Echo 줄 h ~ 가운데 줄 h      2kΩ: 가운데 줄 g ~ GND 줄 g
import { COLORS as C, mfWire } from "./common.mjs";
import { resistor } from "./parts.mjs";

const ONE_K = ["#8b5a2b", "#212529", "#e03131"];
const TWO_K = ["#e03131", "#212529", "#e03131"];

/**
 * k: 가장 왼쪽 줄. order: "gnd-first"(왼→오 GND · 가운데 · Echo, 기본) 또는 "echo-first".
 * half: "bottom"(f~j, 선이 아래에서) · "top"(a~e, 선이 위에서).
 * sensorFrom: "above" 이면 센서 선(Echo · 초음파 GND)은 맨 위 칸(f)에 — 센서가 브레드보드 위, 보드가 아래일 때.
 * 반환 { svg[], holes: { echo, pin, gndSensor, gndBoard }, cols: { echo, mid, gnd } }
 */
export function echoDivider(bb, k, { step = 3, order = "gnd-first", half = "bottom", sensorFrom } = {}) {
  const [a, mid, c] = [k, k + step, k + 2 * step];
  const cols = order === "gnd-first" ? { gnd: a, mid, echo: c } : { echo: a, mid, gnd: c };
  const R = half === "bottom" ? { r1: "h", r2: "g", near: "i", edge: "j" } : { r1: "c", r2: "d", near: "b", edge: "a" };
  [cols.echo, cols.mid, cols.gnd].forEach((col) => bb.tint(col, half));
  const svg = [
    resistor(bb.hole(cols.echo, R.r1), bb.hole(cols.mid, R.r1), { bands: ONE_K, label: "1kΩ" }).svg,
    resistor(bb.hole(cols.mid, R.r2), bb.hole(cols.gnd, R.r2), { bands: TWO_K, label: "2kΩ" }).svg,
  ];
  return {
    svg,
    cols,
    holes: sensorFrom === "above"
      ? { echo: bb.hole(cols.echo, "f"), pin: bb.hole(cols.mid, "j"), gndSensor: bb.hole(cols.gnd, "f"), gndBoard: bb.hole(cols.gnd, "j") }
      : { echo: bb.hole(cols.echo, R.edge), pin: bb.hole(cols.mid, R.edge), gndSensor: bb.hole(cols.gnd, R.near), gndBoard: bb.hole(cols.gnd, R.edge) },
  };
}

/** 연결 표의 줄 (색은 그림의 선과 같게). pinColor: 가운데 줄 → 보드 핀 선의 색 */
export function echoRows(div, { echoColor, pinColor, gndColor, pinLabel, gndLabel }) {
  return [
    { color: echoColor, part: "초음파 Echo", to: `${div.cols.echo}번 줄 → 1kΩ → ${div.cols.mid}번 줄` },
    { color: pinColor, part: pinLabel, to: `${div.cols.mid}번 줄 (1kΩ 과 2kΩ 사이)` },
    { color: gndColor, part: `초음파 GND · ${gndLabel}`, to: `${div.cols.gnd}번 줄 ← 2kΩ ← ${div.cols.mid}번 줄` },
  ];
}

/**
 * 센서가 브레드보드 위(옆), 보드가 아래일 때의 선 넷 (echoDivider 는 order "echo-first", sensorFrom "above"):
 *   센서 Echo · GND → 센서 아래로 조금 내려와 turnX 에서 올라가 브레드보드 위를 지나 맨 위 칸(f)으로,
 *   가운데 줄 → 보드 핀, GND 줄 → 보드 GND 는 보드 바로 위 가로 길(boardTop − 10 · − 18)로.
 * gnd 를 주지 않으면 GND 줄 선은 부르는 쪽이 잇는다(− 줄 점퍼 등). sensorGnd: false 면 센서 GND 도 부르는 쪽이.
 */
export function dividerWires(u, div, bb, { pin, gnd, boardTop, turnX, sensorGnd = true }) {
  const e = u.pins.Echo, g = u.pins.GND, h = div.holes;
  const wires = [mfWire(e, h.echo, C.green, [{ x: e.x, y: e.y + 16 }, { x: turnX + 8, y: e.y + 16 }, { x: turnX + 8, y: bb.y - 22 }, { x: h.echo.x, y: bb.y - 22 }], "orth")];
  if (sensorGnd) wires.push(mfWire(g, h.gndSensor, C.black, [{ x: g.x, y: g.y + 8 }, { x: turnX, y: g.y + 8 }, { x: turnX, y: bb.y - 30 }, { x: h.gndSensor.x, y: bb.y - 30 }], "orth"));
  wires.push(mfWire(pin, h.pin, C.purple, [{ x: pin.x, y: boardTop - 10 }, { x: h.pin.x, y: boardTop - 10 }], "orth"));
  if (gnd) wires.push(mfWire(gnd, h.gndBoard, C.black, [{ x: gnd.x, y: boardTop - 18 }, { x: h.gndBoard.x, y: boardTop - 18 }], "orth"));
  return wires;
}
