/*
 * Keyestudio ESP32 Plus(KS5020) 확장 보드. 핀 배치는 실물 사진과 같은 순서다:
 *   - 위 왼쪽 한 줄: SCL SDA 5V GND io18 io19 io23 io5 io13 io12, io18~io12 아래에 S·V·G 세 줄
 *   - 위 오른쪽 한 줄: io14 io27 io16 io17 io25 io26 TX RX, io14~io26 아래에 S·V·G 세 줄
 *   - 가운데 왼쪽 ANALOG 묶음: 열 G V S, 행 io35 io34 io33 io32 io4 io2 (서보 플러그가 한 행에 그대로 꽂힌다)
 *   - I2C 묶음: 열 GND 5V SDA SCL, 세 줄 (I2C 모듈 셋까지)
 *   - 아래 한 줄: io0 5V RST 3V3 5V GND VIN io32 io33 io34 io35 io36 io39
 * io15 는 이 보드에 나와 있지 않다 (gpio(15) 는 오류).
 *
 * makePlus({ x, y }) 는 보드 왼쪽 위 모서리를 받아 핀 좌표·그림을 돌려준다. 보드 크기 428×300.
 */
import { PIN_FILL as FILL, htext, vtext } from "../common.mjs";

const TOP_LEFT = ["SCL", "SDA", "5V", "GND", "io18", "io19", "io23", "io5", "io13", "io12"];
const TOP_RIGHT = ["io14", "io27", "io16", "io17", "io25", "io26", "TX", "RX"];
const ANALOG_ROWS = ["io35", "io34", "io33", "io32", "io4", "io2"];
const I2C_COLS = ["GND", "5V", "SDA", "SCL"];
const BOTTOM = ["io0", "5V", "RST", "3V3", "5V", "GND", "VIN", "io32", "io33", "io34", "io35", "io36", "io39"];

const P = 20; // 핀 간격
const BOX = 14; // 핀 칸 크기

export function makePlus({ x = 96, y = 150 } = {}) {
  const BOARD = { x, y, w: 428, h: 300 };
  const TOP_Y = y + 58;
  const ROWS = { S: TOP_Y + 20, V: TOP_Y + 38, G: TOP_Y + 56 };
  const LEFT_X0 = x + 26;
  const RIGHT_X0 = x + 260;
  const ANALOG = { x0: x + 30, y0: y + 138 };
  const I2C = { x0: x + 140, y0: y + 138 };
  const MODULE = { x: x + 268, y: y + 150, w: 150, h: 84 };
  const BOTTOM_Y = y + BOARD.h - 18;
  const BOTTOM_X0 = x + 160;

  /** 핀 이름 → 좌표: "top:5V" "top:io13" · "io13:S|V|G" · "an:io4:G|V|S" · "i2c:GND|5V|SDA|SCL:0..2" · "bot:3V3" "bot:io36" */
  function pin(name) {
    const [a, b, c] = name.split(":");
    if (a === "top") {
      const i = TOP_LEFT.indexOf(b);
      if (i >= 0) return { x: LEFT_X0 + i * P, y: TOP_Y, name };
      const j = TOP_RIGHT.indexOf(b);
      if (j >= 0) return { x: RIGHT_X0 + j * P, y: TOP_Y, name };
    }
    if (a.startsWith("io") && (b === "S" || b === "V" || b === "G")) {
      const i = TOP_LEFT.indexOf(a);
      const j = TOP_RIGHT.indexOf(a);
      if (i >= 4) return { x: LEFT_X0 + i * P, y: ROWS[b], name };
      if (j >= 0 && j < 6) return { x: RIGHT_X0 + j * P, y: ROWS[b], name };
    }
    if (a === "an") {
      const r = ANALOG_ROWS.indexOf(b);
      const k = ["G", "V", "S"].indexOf(c);
      if (r >= 0 && k >= 0) return { x: ANALOG.x0 + k * P, y: ANALOG.y0 + 38 + r * P, name };
    }
    if (a === "i2c") {
      const k = I2C_COLS.indexOf(b);
      const r = Number(c ?? 0);
      if (k >= 0 && r >= 0 && r < 3) return { x: I2C.x0 + k * P, y: I2C.y0 + 52 + r * P, name };
    }
    if (a === "bot") {
      // 5V 는 둘: "bot:5V" (앞) · "bot:5V2" (뒤)
      const key = b === "5V2" ? "5V" : b;
      const i = b === "5V2" ? BOTTOM.lastIndexOf("5V") : BOTTOM.indexOf(key);
      if (i >= 0) return { x: BOTTOM_X0 + i * P, y: BOTTOM_Y, name };
    }
    throw new Error(`ESP32 Plus 에 없는 핀: ${name}`);
  }

  const TOP_GPIOS = [18, 19, 23, 5, 13, 12, 14, 27, 16, 17, 25, 26];
  const ANALOG_GPIOS = [35, 34, 33, 32, 4, 2];
  /** GPIO 번호의 신호 핀 (한 줄 핀 또는 ANALOG 묶음 S). 21·22 는 위 한 줄 SDA·SCL. { at: "bottom" } 이면 아래 줄(io0·32~39) */
  function gpio(n, { at } = {}) {
    if (at === "bottom" && [0, 32, 33, 34, 35, 36, 39].includes(n)) return { ...pin(`bot:io${n}`), label: `io${n}` };
    if (TOP_GPIOS.includes(n)) return { ...pin(`top:io${n}`), label: `io${n}` };
    if (ANALOG_GPIOS.includes(n)) return { ...pin(`an:io${n}:S`), label: `io${n} (ANALOG S)` };
    if ([36, 39, 0].includes(n)) return { ...pin(`bot:io${n}`), label: `io${n}` };
    if (n === 21) return { ...pin("top:SDA"), label: "SDA(21)" };
    if (n === 22) return { ...pin("top:SCL"), label: "SCL(22)" };
    throw new Error(`ESP32 Plus 에는 io${n} 핀이 없어요 (io15 등). 다른 핀으로 바꿔 주세요`);
  }
  /** 3핀 모듈을 꽂을 S·V·G 세 핀 (위 디지털 줄 또는 ANALOG 묶음). 없으면 null */
  function triple(n) {
    if (TOP_GPIOS.includes(n)) {
      const at = (r) => ({ ...pin(`io${n}:${r}`), label: `io${n} ${r}` });
      return { S: at("S"), V: at("V"), G: at("G"), kind: "column" };
    }
    if (ANALOG_GPIOS.includes(n)) {
      const at = (r) => ({ ...pin(`an:io${n}:${r}`), label: `io${n} 줄 ${r}` });
      return { S: at("S"), V: at("V"), G: at("G"), kind: "row" };
    }
    return null;
  }
  /** 전원: "5V" (k=0 위 줄, 1·2 아래 줄) · "3V3" · "GND" (k=0 위 줄, 1 아래 줄) */
  function power(kind, k = 0) {
    if (kind === "5V") return { ...pin(k === 0 ? "top:5V" : k === 1 ? "bot:5V" : "bot:5V2"), label: "5V" };
    if (kind === "3V3") return { ...pin("bot:3V3"), label: "3V3" };
    if (kind === "GND") return { ...pin(k === 0 ? "top:GND" : "bot:GND"), label: "GND" };
    throw new Error(`모르는 전원: ${kind}`);
  }
  /** I2C 묶음 한 줄 (모듈 하나) */
  function i2c(row = 0) {
    const at = (c, label) => ({ ...pin(`i2c:${c}:${row}`), label });
    return { GND: at("GND", "I2C GND"), VCC: at("5V", "I2C 5V"), SDA: at("SDA", "I2C SDA"), SCL: at("SCL", "I2C SCL") };
  }

  const pinBox = (px, py, fill, dim) =>
    `<g opacity="${dim ? 0.38 : 1}"><rect x="${px - BOX / 2}" y="${py - BOX / 2}" width="${BOX}" height="${BOX}" rx="2.5" fill="${fill}" stroke="none"/><rect x="${px - 3}" y="${py - 3}" width="6" height="6" rx="1" fill="#1d1d1f" stroke="none"/></g>`;

  /** used 에 든 핀 이름(좌표의 name)만 또렷하게, 나머지는 흐리게. 반환 { base, labels, marks } */
  function draw(used = []) {
    const names = used.map((u) => (typeof u === "string" ? u : u.name));
    const usedSet = new Set(names);
    const any = names.length > 0;
    const dimPin = (n) => any && !usedSet.has(n);
    const dimLabel = (ns) => any && !ns.some((n) => usedSet.has(n));
    const base = [];
    const labels = [];
    const { w, h } = BOARD;

    base.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#1d1d1f" stroke="currentColor"/>`);
    for (const [cx, cy] of [[x + 14, y + 14], [x + w - 14, y + 14], [x + 14, y + h - 14], [x + w - 14, y + h - 14]]) base.push(`<circle cx="${cx}" cy="${cy}" r="5" fill="#495057" stroke="none"/>`);
    base.push(`<rect x="${x - 12}" y="${y + 92}" width="28" height="40" rx="6" fill="#ced4da" stroke="#868e96"/>`);
    labels.push(`<text x="${x - 16}" y="${y + 112}" text-anchor="end" dominant-baseline="central" font-size="13" font-weight="700" fill="currentColor" stroke="none">USB</text>`);
    const m = MODULE;
    base.push(`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="5" fill="#adb5bd" stroke="#e9ecef"/>`);
    base.push(`<path d="M${m.x + 14} ${m.y + 22} v-10 h14 v10 h14 v-10 h14 v10 h14 v-10 h14 v10 h14 v-10 h14 v10" stroke="#868e96" stroke-width="1.5"/>`);
    base.push(`<rect x="${m.x + 14}" y="${m.y + 32}" width="${m.w - 28}" height="${m.h - 42}" rx="3" fill="#ced4da" stroke="#868e96" stroke-width="1"/>`);
    base.push(`<text x="${m.x + m.w / 2}" y="${m.y + 58}" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="700" fill="#343a40" stroke="none">ESP32 Plus</text>`);

    const top = (list, x0, svgFrom, svgCount) => list.forEach((n, i) => {
      const px = x0 + i * P;
      const hasSvg = i >= svgFrom && i < svgFrom + svgCount;
      const col = [`top:${n}`, ...(hasSvg ? ["S", "V", "G"].map((r) => `${n}:${r}`) : [])];
      labels.push(vtext(px, TOP_Y - 13, n, dimLabel(col)));
      base.push(pinBox(px, TOP_Y, FILL.one, dimPin(`top:${n}`)));
      if (hasSvg) for (const r of ["S", "V", "G"]) base.push(pinBox(px, ROWS[r], FILL[r], dimPin(`${n}:${r}`)));
    });
    top(TOP_LEFT, LEFT_X0, 4, 6);
    top(TOP_RIGHT, RIGHT_X0, 0, 6);
    for (const r of ["S", "V", "G"]) {
      labels.push(htext(LEFT_X0 + 3 * P, ROWS[r], r));
      labels.push(htext(RIGHT_X0 + 6 * P + 4, ROWS[r], r));
    }

    labels.push(htext(ANALOG.x0 - 8, ANALOG.y0, "ANALOG", 13, "start"));
    ["G", "V", "S"].forEach((c, k) => labels.push(htext(ANALOG.x0 + k * P, ANALOG.y0 + 18, c)));
    ANALOG_ROWS.forEach((n, r) => {
      const py = ANALOG.y0 + 38 + r * P;
      const ns = ["G", "V", "S"].map((c) => `an:${n}:${c}`);
      ["G", "V", "S"].forEach((c, k) => base.push(pinBox(ANALOG.x0 + k * P, py, FILL[c], dimPin(`an:${n}:${c}`))));
      labels.push(htext(ANALOG.x0 + 3 * P - 4, py, n, 13, "start", dimLabel(ns)));
    });

    I2C_COLS.forEach((c, k) => {
      const px = I2C.x0 + k * P;
      const ns = [0, 1, 2].map((r) => `i2c:${c}:${r}`);
      labels.push(vtext(px, I2C.y0 + 40, c, dimLabel(ns)));
      for (let r = 0; r < 3; r++) base.push(pinBox(px, I2C.y0 + 52 + r * P, c === "GND" ? FILL.G : c === "5V" ? FILL.V : c === "SDA" ? FILL.S : FILL.SCL, dimPin(`i2c:${c}:${r}`)));
    });
    labels.push(htext(I2C.x0 + 3 * P + 10, I2C.y0 + 52 + P, "I2C", 13, "start"));

    BOTTOM.forEach((n, i) => {
      const px = BOTTOM_X0 + i * P;
      const nm = n === "5V" && i === BOTTOM.lastIndexOf("5V") ? "bot:5V2" : `bot:${n}`;
      labels.push(vtext(px, BOTTOM_Y - 13, n, dimLabel([nm])));
      base.push(pinBox(px, BOTTOM_Y, FILL.one, dimPin(nm)));
    });

    const marks = names.map((n) => {
      const p = pin(n);
      return `<rect x="${p.x - 10}" y="${p.y - 10}" width="20" height="20" rx="4" fill="none" stroke="#ffd43b" stroke-width="3"/>`;
    });
    return { base: base.join("\n  "), labels: labels.join("\n  "), marks: marks.join("\n  ") };
  }

  return {
    id: "plus",
    title: "ESP32 Plus 확장 보드",
    bounds: BOARD,
    /** 위 G 줄 아래 ~ ESP32 모듈 위: 선이 가로로 지나가는 빈 띠 */
    lane: { top: ROWS.G + 11, bottom: MODULE.y - 6 },
    /** 위 한 줄 핀의 높이 (모듈 선이 위에서 내려와 꽂힌다) */
    topY: TOP_Y,
    bottomY: BOTTOM_Y,
    pin, gpio, triple, power, i2c, draw,
    legend: "plus",
  };
}
