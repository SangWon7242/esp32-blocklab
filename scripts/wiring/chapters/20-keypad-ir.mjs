// 센서 S17 "키패드와 IR 리모컨" — 키패드 행 26 · 25 · 17 · 16, 열 27 · 14 · 12 · 13 (M-F 8가닥, 브레드보드 없이 보드에 바로),
// IR 수신기 VS1838B(OUT 5, V 3V3, G GND) · 설계 단계 LED(2) + 220Ω — 브레드보드.
// 키패드 커넥터 1~8번 칸 순서와 보드 핀 순서가 서로 반대라, 키패드 선은 보드 위 빈 곳에서 계단처럼 엇갈린다(어떻게 놓아도 생긴다).
// 엇갈림은 키패드 쪽에만 모으고, 보드 핀으로 내려가는 끝은 곧게 둔다.
import { COLORS as C, compose, connectionTable, mfWire, note, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard, keypad, led, resistor } from "../parts.mjs";

const KEY_PINS = ["R1", "R2", "R3", "R4", "C1", "C2", "C3", "C4"];
const KEY_GPIO = { R1: 26, R2: 25, R3: 17, R4: 16, C1: 27, C2: 14, C3: 12, C4: 13 };
const KEY_COLOR = { R1: C.orange, R2: C.yellow, R3: C.brown, R4: C.pink, C1: C.blue, C2: C.teal, C3: C.purple, C4: C.green };
const OLIVE = "#5c940d";

/**
 * 키패드 선: 보드 핀(위에서) ← 각자 높이가 다른 가로 길 ← 키패드 핀. names 순서대로 길이 높아진다(첫 선이 가장 낮다).
 * 엇갈림은 키패드 핀에서 내려오는 세로 선 위에서만 생긴다.
 */
function keypadWires(kp, names, target, lowY, step = 14) {
  return names.map((n, i) => {
    const t = target(n), p = kp.pins[n], y = lowY - i * step;
    return mfWire(t, p, KEY_COLOR[n], [{ x: t.x, y }, { x: p.x, y }], "orth");
  });
}

/**
 * IR 수신기 VS1838B (다리 셋: OUT · G · V). parts.irReceiver 와 같은 모양에 다리 이름만 몸통 아래 한 줄로
 * (다리 간격 16 에 "OUT" 이 옆 "G" 와 겹치지 않게). holes 는 [OUT, G, V] 구멍, 몸통은 구멍 아래.
 */
function irRx(holes, names = "OUT G V") {
  const cx = holes[1].x, cy = holes[1].y + 34;
  const out = holes.map((p) => `<path d="M${p.x} ${p.y} L${p.x} ${cy - 10}" stroke="#868e96" stroke-width="2.5"/>`);
  out.push(`<rect x="${cx - 18}" y="${cy - 12}" width="36" height="26" rx="4" fill="#212529" stroke="#343a40" stroke-width="2"/><circle cx="${cx}" cy="${cy + 1}" r="8" fill="#343a40" stroke="#868e96"/>`);
  const w = names.length * 7 + 12;
  out.push(`<rect x="${cx - w / 2}" y="${cy + 18}" width="${w}" height="18" rx="4" fill="#ffffff" stroke="#adb5bd" stroke-width="1"/><text x="${cx}" y="${cy + 27}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="700" fill="#343a40" stroke="none">${names}</text>`);
  return out.join("");
}

/** 브레드보드 위 칸: IR 수신기 다리 · LED(e 칸), 저항(d 칸). 보드에서 오는 선은 모두 a 칸에 위에서 꽂힌다 */
function parts(bb, { ir, ledAnode, ledCathode, sig }) {
  [ir.OUT, ir.G, ir.V, ledAnode, ledCathode, sig].forEach((col) => bb.tint(col, "top"));
  const order = ["OUT", "G", "V"].sort((a, b) => ir[a] - ir[b]);
  return [
    irRx(order.map((k) => bb.hole(ir[k], "e")), order.join(" ")),
    resistor(bb.hole(sig, "d"), bb.hole(ledAnode, "d"), { label: "220Ω" }).svg,
    led(bb.hole(ledAnode, "e"), bb.hole(ledCathode, "e"), "#e03131", { up: false, lift: 30, label: false }).svg,
  ];
}

function plus() {
  const b = makePlus({ x: 96, y: 344 });
  const kp = keypad(460, 50, { titleAt: { x: 448, y: 80, anchor: "end" } });
  const wires = keypadWires(kp, KEY_PINS, (n) => b.gpio(KEY_GPIO[n]), b.bounds.y - 20);
  // 브레드보드: 보드 아래. IR OUT ← io5 (보드 왼쪽 바깥 길), IR G ← io2 줄 G, IR V ← 3V3, LED ← io2 · GND
  const bb = breadboard({ x: 60, y: b.bounds.y + b.bounds.h + 30, cols: 14, rails: { top: false, bottom: false } });
  const ir = { OUT: 2, G: 3, V: 4 }, led = { sig: 6, anode: 11, cathode: 12 };
  const ps = parts(bb, { ir, ledAnode: led.anode, ledCathode: led.cathode, sig: led.sig });
  const io5 = b.gpio(5), irG = b.triple(2).G, v33 = b.power("3V3"), io2 = b.gpio(2), gnd = b.power("GND", 1);
  const gapY = bb.y - 14;
  wires.push(
    mfWire(io5, bb.hole(ir.OUT, "a"), C.white, [{ x: io5.x, y: b.bounds.y - 10 }, { x: 30, y: b.bounds.y - 10 }, { x: 30, y: gapY }, { x: bb.hole(ir.OUT, "a").x, y: gapY }], "orth"),
    mfWire(irG, bb.hole(ir.G, "a"), C.black),
    mfWire(v33, bb.hole(ir.V, "a"), C.red),
    mfWire(io2, bb.hole(led.sig, "a"), OLIVE),
    mfWire(gnd, bb.hole(led.cathode, "a"), C.black),
  );
  const rows = [
    { colors: [C.orange, C.yellow, C.brown, C.pink], part: "키패드 1~4번 칸 (행)", to: "io26 · io25 · io17 · io16" },
    { colors: [C.blue, C.teal, C.purple, C.green], part: "키패드 5~8번 칸 (열)", to: "io27 · io14 · io12 · io13" },
    { color: C.white, part: `IR 수신기 OUT ${ir.OUT}번 줄`, to: "io5 (보드 왼쪽 바깥으로 돌아서)" },
    { color: C.black, part: `IR 수신기 G ${ir.G}번 줄`, to: "io2 줄 G (ANALOG 묶음 맨 아래)" },
    { color: C.red, part: `IR 수신기 V ${ir.V}번 줄`, to: "3V3 (아래 줄)" },
    { color: OLIVE, part: "(설계) io2 (ANALOG S)", to: `${led.sig}번 줄 → 220Ω 저항 → ${led.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `(설계) LED 짧은 다리(−) ${led.cathode}번 줄`, to: "GND (아래 줄)" },
  ];
  const table = connectionTable(bb.y + bb.h + 16, "이렇게 꽂아요 — 키패드는 M-F 선 8가닥으로 보드에 바로", rows, "plus");
  const used = [...KEY_PINS.map((n) => b.gpio(KEY_GPIO[n])), io5, irG, v33, io2, gnd];
  const extra = [note(448, 104, "커넥터 1~8번 칸", "end"), note(448, 122, "(왼쪽부터)", "end"), table.svg];
  return svgDoc("wbk", T.plus, compose(b.draw(used), [kp.svg, bb.svg, ...ps], wires, extra), table.bottom);
}

function devkit() {
  const b = makeDevkit({ x: 110, y: 348 });
  const kp = keypad(440, 50, { titleAt: { x: 428, y: 80, anchor: "end" } });
  const wires = keypadWires(kp, ["R2", "R1", "C1", "C2", "C3", "C4"], (n) => b.gpio(KEY_GPIO[n]), b.bounds.y - 30);
  // 행 3 · 4 (17 · 16 = TX2 · RX2)는 아래 줄: 키패드 바로 아래 길 → 오른쪽 바깥 → 보드 아래 → 아래에서
  const yp = kp.pins.R3.y, bot = b.bounds.y + b.bounds.h;
  const route = { R3: { lane: yp + 28, x: 616, under: bot + 12 }, R4: { lane: yp + 14, x: 628, under: bot + 24 } };
  for (const n of ["R3", "R4"]) {
    const t = b.gpio(KEY_GPIO[n]), p = kp.pins[n], r = route[n];
    wires.push(mfWire(t, p, KEY_COLOR[n], [{ x: t.x, y: r.under }, { x: r.x, y: r.under }, { x: r.x, y: r.lane }, { x: p.x, y: r.lane }], "orth"));
  }
  // 브레드보드: 보드 아래. LED 짧은 다리 ← 위 줄 GND (보드 왼쪽 바깥 길), IR V · G · OUT ← 3V3 · GND · D5, LED ← D2
  const bb = breadboard({ x: 52, y: bot + 60, cols: 16, rails: { top: false, bottom: false } });
  const ir = { V: 5, G: 6, OUT: 7 }, led = { sig: 9, anode: 3, cathode: 2 };
  const ps = parts(bb, { ir, ledAnode: led.anode, ledCathode: led.cathode, sig: led.sig });
  const d5 = b.gpio(5), gndB = b.power("GND", 1), gndT = b.power("GND", 0), v33 = b.power("3V3"), d2 = b.gpio(2);
  const gapY = bb.y - 14;
  wires.push(
    mfWire(gndT, bb.hole(led.cathode, "a"), C.black, [{ x: gndT.x, y: b.bounds.y - 12 }, { x: 30, y: b.bounds.y - 12 }, { x: 30, y: gapY }, { x: bb.hole(led.cathode, "a").x, y: gapY }], "orth"),
    mfWire(v33, bb.hole(ir.V, "a"), C.red),
    mfWire(gndB, bb.hole(ir.G, "a"), C.black),
    mfWire(d5, bb.hole(ir.OUT, "a"), C.white),
    mfWire(d2, bb.hole(led.sig, "a"), OLIVE),
  );
  const rows = [
    { colors: [C.orange, C.yellow, C.brown, C.pink], part: "키패드 1~4번 칸 (행)", to: "D26 · D25 · TX2(17) · RX2(16)" },
    { colors: [C.blue, C.teal, C.purple, C.green], part: "키패드 5~8번 칸 (열)", to: "D27 · D14 · D12 · D13" },
    { color: C.red, part: `IR 수신기 V ${ir.V}번 줄`, to: "3V3" },
    { color: C.black, part: `IR 수신기 G ${ir.G}번 줄`, to: "GND (아래 줄)" },
    { color: C.white, part: `IR 수신기 OUT ${ir.OUT}번 줄`, to: "D5" },
    { color: OLIVE, part: "(설계) D2", to: `${led.sig}번 줄 → 220Ω 저항 → ${led.anode}번 줄 LED 긴 다리(+)` },
    { color: C.black, part: `(설계) LED 짧은 다리(−) ${led.cathode}번 줄`, to: "GND (위 줄, 보드 왼쪽 바깥으로 돌아서)" },
  ];
  const table = connectionTable(bb.y + bb.h + 16, "이렇게 꽂아요 — 키패드는 M-F 선 8가닥으로 보드에 바로", rows, "devkit");
  const used = [...KEY_PINS.map((n) => b.gpio(KEY_GPIO[n])), d5, gndB, gndT, v33, d2];
  const extra = [note(428, 104, "커넥터 1~8번 칸", "end"), note(428, 122, "(왼쪽부터)", "end"), table.svg];
  return svgDoc("wbkk", T.devkit, compose(b.draw(used), [kp.svg, bb.svg, ...ps], wires, extra), table.bottom);
}

const T = {
  plus: "키패드와 IR 배선도(ESP32 Plus 확장 보드): 키패드 커넥터 1~8번 칸을 M-F 듀폰선으로 보드 위쪽 한 줄 io26 · io25 · io17 · io16(행) · io27 · io14 · io12 · io13(열)에 바로. 보드 아래 브레드보드: IR 수신기 OUT · G · V 는 2 · 3 · 4번 줄 — OUT 은 io5(보드 왼쪽 바깥으로 돌아서), G 는 ANALOG io2 줄 G, V 는 아래 줄 3V3. 설계 단계 LED: io2 → 6번 줄 → 220Ω 저항 → 11번 줄 긴 다리(+), 짧은 다리(−) 12번 줄 → 아래 줄 GND",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 키패드와 IR 배선도: 키패드 커넥터 1~8번 칸을 M-F 듀폰선으로 D26 · D25 · TX2(17) · RX2(16)(행) · D27 · D14 · D12 · D13(열)에 바로. 보드 아래 브레드보드: IR 수신기 V · G · OUT 은 5 · 6 · 7번 줄 — V 는 3V3, G 는 아래 줄 GND, OUT 은 D5. 설계 단계 LED: D2 → 9번 줄 → 220Ω 저항 → 3번 줄 긴 다리(+), 짧은 다리(−) 2번 줄 → 위 줄 GND(보드 왼쪽 바깥으로 돌아서)",
};

export default {
  "wiring-breadboard.svg": { plus, devkit },
};
