// 확장 보드(boards/expansion.mjs) 확인용 그림 — 콘텐츠 폴더는 건드리지 않는다.
// 사용: node scripts/wiring/preview-expansion.mjs [출력 폴더]   (기본 .superpowers/sdd/expansion-board)
//   expansion-board.svg            보드만 (DevKit 을 꽂은 모습, 모든 핀 이름)
//   wiring-door.expansion.svg      10장 자동문 본보기 (초음파 + Echo 전압 나누기 + OLED + 서보)
//   wiring-led.expansion.svg       1장 LED 본보기 (맨 부품 + 브레드보드)
//   + 각 .3d.json (build.mjs 와 같은 꼴, board: "expansion")
// 선생님 확인 뒤 챕터 명세(chapters/<id>.mjs)에 expansion: () => svg 판을 더하면 build.mjs 가 <이름>.expansion.svg 로 쓴다.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COLORS as C, compose, connectionTable, ffWire, mfWire, name, svgDoc } from "./common.mjs";
import { columnServo, makeExpansion } from "./boards/expansion.mjs";
import { breadboard, oled, ultrasonic } from "./parts.mjs";
import { dividerWires, echoDivider, echoRows } from "./echo-divider.mjs";
import { ledCircuit } from "./chapters/01-led.mjs";
import { endScene, startScene } from "./record.mjs";

const out = process.argv[2] ?? join(import.meta.dirname, "../../.superpowers/sdd/expansion-board");
mkdirSync(out, { recursive: true });

/** 보드만 */
function boardOnly() {
  const b = makeExpansion({ x: 22, y: 52 });
  const d = b.draw([]);
  const body = [name(22, 20, "확장 보드 (ESP32 38핀 확장 보드 + 기본 보드 DevKit 38핀)", "start", 15), d.base, d.labels, d.marks].join("\n  ");
  return svgDoc("xb", "ESP32 38핀 확장 보드에 기본 보드 DevKit 38핀을 꽂은 모습: 가운데 노란 암 헤더에 DevKit, 그 바깥에 GPIO 마다 S(노랑) V(빨강) G(검정) 3핀. 위 줄 5V CMD SD3 SD2 P13 GND P12 P14 P27 P26 P25 P33 P32 P35 P34 SVN SVP EN, 아래 줄 CLK SD0 SD1 P15 P2 P0 P4 P16 P17 P5 P18 P19 GND P21 RX TX P22 P23. 왼쪽 전원부: USB-C(USB5V), 전원 헤더(GND, 3V, 5V), JUMP(V 줄 전압 5V 또는 3.3V), 마이크로 USB, DC 잭(DC6.5-16V), I2C 헤더(GND VCC D21 D22)와 UART 헤더(GND VCC RX TX)", body, b.bounds.y + b.bounds.h + 8);
}

/** 10장 자동문: 초음파(Trig 13 · Echo 12 → 전압 나누기) · OLED(I2C 헤더) · 서보(4번 기둥) */
function door() {
  const b = makeExpansion({ x: 22, y: 280 });
  const parts = [], wires = [], used = [];
  const u = ultrasonic(150, 20);
  const bb = breadboard({ x: 400, y: 100, cols: 9, half: "bottom" });
  const div = echoDivider(bb, 2, { order: "echo-first", sensorFrom: "above" });
  parts.push(bb.svg, ...div.svg, u.svg, name(bb.x + bb.w / 2, bb.y - 10, "브레드보드", "middle", 13));
  const t = { VCC: b.power("5V"), GND: b.power("GND"), Trig: b.gpio(13), Echo: b.gpio(12) };
  wires.push(ffWire(u.pins.VCC, t.VCC, C.red), ffWire(u.pins.Trig, t.Trig, C.yellow));
  wires.push(...dividerWires(u, div, bb, { pin: t.Echo, gnd: t.GND, boardTop: b.bounds.y, turnX: 352 }));
  used.push(t.VCC, t.GND, t.Trig, t.Echo);

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
  // 서보: 4번 칸(아래 줄)의 G·V·S 에 플러그 그대로
  const sv = b.triple(4);
  parts.push(columnServo(sv, { gap: 84 }).svg);
  used.push(sv.G, sv.V, sv.S);

  const rows = [
    { color: C.red, part: "초음파 VCC", to: "위 줄 5V 칸 S" }, { color: C.yellow, part: "초음파 Trig", to: `${t.Trig.label} S` },
    ...echoRows(div, { echoColor: C.green, pinColor: C.purple, gndColor: C.black, pinLabel: `${t.Echo.label} S`, gndLabel: "위 줄 GND 칸 S" }),
    { colors: [C.black, C.red], part: "OLED GND · VCC", to: "I2C 헤더 GND · VCC" }, { colors: [C.blue, C.purple], part: "OLED SDA · SCL", to: "I2C 헤더 D21 · D22" },
    { colors: [C.brown, C.red, C.orange], part: "서보 플러그", to: "P4 칸 G · V · S (V 는 5V 점퍼)" },
  ];
  const table = connectionTable(806, "이렇게 꽂아요 — Echo 는 저항 둘을 거쳐 보드로", rows, b.legend);
  return svgDoc("wdx", "자동문 배선도(ESP32 38핀 확장 보드 + DevKit): 초음파 센서 VCC 는 위 줄 5V 칸 S 핀, Trig 는 P13 칸 S 핀에 F-F 듀폰선으로 바로. Echo → 작은 브레드보드 2번 줄 → 1kΩ 저항 → 5번 줄 → P12 칸 S 핀, 5번 줄 → 2kΩ 저항 → 8번 줄 ← 초음파 GND · 위 줄 GND 칸 S 핀. OLED 화면 GND·VCC·SDA·SCL 은 I2C 헤더의 GND·VCC·D21·D22 에. 서보 모터 플러그는 아래 줄 P4 칸에 갈색 G, 빨강 V, 주황 S 가 맞도록 그대로 꽂기 (V 줄은 JUMP 점퍼로 5V)", compose(b.draw(used), parts, wires, [table.svg]), table.bottom);
}

/** 1장 LED: 브레드보드를 보드 위에, P26 → 220Ω → LED → − 줄 → GND */
function led() {
  const bb = breadboard({ x: 100, y: 8, cols: 26, rails: { top: false, bottom: true } });
  const b = makeExpansion({ x: 22, y: bb.y + bb.h + 30 });
  const sig = b.gpio(26), gnd = b.power("GND");
  const k = Math.round((sig.x - (bb.x + 28)) / 16) + 1;
  const circ = ledCircuit(bb, k);
  const wires = [mfWire(sig, circ.signalHole, C.yellow), mfWire(gnd, bb.rail("bottom", "-", bb.nearestCol(gnd.x, true)), C.black), circ.jumper];
  const rows = [
    { color: C.yellow, part: `${sig.label} 칸 S 핀`, to: `${circ.cols.sig}번 줄 → 220Ω 저항 → ${circ.cols.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `LED 짧은 다리(−) ${circ.cols.cathode}번 줄`, to: "− 줄 → 위 줄 GND 칸 S 핀" },
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 12, "이렇게 꽂아요 — LED 는 저항과 함께 브레드보드에", rows, b.legend);
  return svgDoc("wlx", `LED 배선도(ESP32 38핀 확장 보드 + DevKit): 위 줄 P26 칸 S 핀 → 브레드보드 ${circ.cols.sig}번 줄 → 220Ω 저항 → ${circ.cols.anode}번 줄의 LED 긴 다리(+). 짧은 다리(−)는 ${circ.cols.cathode}번 줄 → 점퍼선 → 브레드보드 − 줄 → 위 줄 GND 칸 S 핀`, compose(b.draw([sig, gnd]), [bb.svg, ...circ.svg], wires, [table.svg]), table.bottom);
}

for (const [file, fn] of [["expansion-board.svg", boardOnly], ["wiring-door.expansion.svg", door], ["wiring-led.expansion.svg", led]]) {
  startScene();
  const svg = fn();
  const scene = endScene();
  writeFileSync(join(out, file), svg);
  console.log("wrote", join(out, file));
  const out3d = join(out, file.replace(/\.svg$/, ".3d.json"));
  const { composed, unsupported, ...data } = scene;
  if (!(composed && !unsupported && /^wiring-/.test(file))) rmSync(out3d, { force: true });
  else {
    const height = Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)?.[1] ?? 0);
    writeFileSync(out3d, JSON.stringify({ board: "expansion", height, ...data }) + "\n");
    console.log("wrote", out3d);
  }
}
