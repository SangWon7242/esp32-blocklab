/*
 * Keyestudio ESP32 Plus(KS5020) 확장 보드 — 실물 도면(ESP32_D1_R32_SensorShield_Board.svg, 800×500)의 배치 그대로.
 *   - 왼쪽: RESET · USB-C · CH340 · 4R7 코일 · 전원 칩 · DC 7-12V 잭
 *   - 위 한 줄: SCL SDA 5V GND io18 io19 io23 io5 io13 io12 | io14 io27 io16 io17 io25 io26 TX RX (노란 암핀)
 *   - 그 아래 DIGITAL S·V·G 세 줄: io18~io12 · io14~io26 (색 받침 수핀)
 *   - 가운데 BUS I2C: 열 GND V SDA SCL, 세 줄 / 그 아래 ANALOG: 열 G V S, 행 io35 io34 io33 io32 io4 io2
 *   - 오른쪽: ESP-WROOM-32 모듈(안테나 오른쪽 끝) · TX RX G V 세로 4핀
 *   - 아래 한 줄: POWER io0 5V RST 3V3 5V GND GND VIN | ANALOG IN io32 io33 io34 io35 io36 io39
 * io15 는 이 보드에 나와 있지 않다 (gpio(15) 는 오류).
 *
 * makePlus({ x, y }) 는 그림 자리(428×300)의 왼쪽 위를 받는다. 보드는 그 안에 가로 428 × 세로 250 (위아래 25 여백).
 * 도면 좌표(800×500)를 배율 K 로 옮긴다 — 3D(src/app/track/wiring3d/plusLayout.ts)와 같은 배율.
 */
import { PIN_FILL as FILL } from "../common.mjs";
import { rec } from "../record.mjs";

const TOP_LEFT = ["SCL", "SDA", "5V", "GND", "io18", "io19", "io23", "io5", "io13", "io12"];
const TOP_RIGHT = ["io14", "io27", "io16", "io17", "io25", "io26", "TX", "RX"];
const ANALOG_ROWS = ["io35", "io34", "io33", "io32", "io4", "io2"];
const I2C_COLS = ["GND", "5V", "SDA", "SCL"];
const BOTTOM = ["io0", "5V", "RST", "3V3", "5V", "GND", "VIN", "io32", "io33", "io34", "io35", "io36", "io39"];

/** 도면 px → 그림 px */
const K = 428 / 740;
const BOX = 11.4; // 핀 칸 크기 (핀 간격 22 × K ≈ 12.7)
const BOTTOM_X = [336, 358, 380, 402, 424, 446, 490, 580, 602, 624, 646, 668, 690];

export function makePlus({ x = 96, y = 150 } = {}) {
  const BOARD = { x, y, w: 428, h: 300 };
  /** 도면 좌표 → 그림 좌표 */
  const r1 = (v) => Math.round(v * 10) / 10;
  const S = (sx, sy) => ({ x: r1(x + (sx - 35) * K), y: r1(y + 25 + (sy - 12) * K) });
  const TOP_Y = S(0, 28).y;
  const ROWS = { S: S(0, 82).y, V: S(0, 104).y, G: S(0, 126).y };
  const BOTTOM_Y = S(0, 423).y;
  const MODULE = (() => { const a = S(504, 176), c = S(790, 336); return { x: a.x, y: a.y, w: c.x - a.x, h: c.y - a.y }; })();
  const USB = (() => { const a = S(18, 80), c = S(102, 152); return { x: a.x, y: a.y, w: c.x - a.x, h: c.y - a.y }; })();

  /** 핀 이름 → 좌표: "top:5V" "top:io13" · "io13:S|V|G" · "an:io4:G|V|S" · "i2c:GND|5V|SDA|SCL:0..2" · "bot:3V3" "bot:io36" */
  function pin(name) {
    const [a, b, c] = name.split(":");
    const at = (sx, sy) => ({ ...S(sx, sy), name });
    if (a === "top") {
      const i = TOP_LEFT.indexOf(b);
      if (i >= 0) return at(232 + 22 * i, 28);
      const j = TOP_RIGHT.indexOf(b);
      if (j >= 0) return at(526 + 22 * j, 28);
    }
    if (a.startsWith("io") && (b === "S" || b === "V" || b === "G")) {
      const i = TOP_LEFT.indexOf(a);
      const j = TOP_RIGHT.indexOf(a);
      const row = ["S", "V", "G"].indexOf(b);
      if (i >= 4) return at(340 + 22 * (i - 4), 82 + 22 * row);
      if (j >= 0 && j < 6) return at(524 + 22 * j, 82 + 22 * row);
    }
    if (a === "an") {
      const r = ANALOG_ROWS.indexOf(b);
      const k = ["G", "V", "S"].indexOf(c);
      if (r >= 0 && k >= 0) return at(353 + 22 * k, 260 + 22 * r);
    }
    if (a === "i2c") {
      const k = I2C_COLS.indexOf(b);
      const r = Number(c ?? 0);
      if (k >= 0 && r >= 0 && r < 3) return at(353 + 22 * k, 170 + 22 * r);
    }
    if (a === "bot") {
      // 5V 는 둘: "bot:5V" (앞) · "bot:5V2" (뒤)
      const key = b === "5V2" ? "5V" : b;
      const i = b === "5V2" ? BOTTOM.lastIndexOf("5V") : BOTTOM.indexOf(key);
      if (i >= 0) return at(BOTTOM_X[i], 423);
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

  /** 핀 칸: 수핀(S·V·G · I2C · ANALOG)은 색 받침 위 금색 핀, 위 · 아래 줄은 노란 암핀 칸에 검은 구멍 */
  const pinBox = (px, py, fill, dim, male = false) =>
    `<g opacity="${dim ? 0.38 : 1}"><rect x="${px - BOX / 2}" y="${py - BOX / 2}" width="${BOX}" height="${BOX}" rx="2" fill="${fill}" stroke="${male ? "#1d1d1f" : "#a16207"}" stroke-width="0.8"/><rect x="${px - 2.2}" y="${py - 2.2}" width="4.4" height="4.4" rx="0.8" fill="${male ? "#e8b93c" : "#1d1d1f"}" stroke="none"/></g>`;
  /** 노란 실크 글자 (도면 좌표) */
  const silk = (sx, sy, t, size = 7, anchor = "middle", rot = 0, dim = false) => {
    const q = S(sx, sy);
    return `<text x="${q.x}" y="${q.y}" text-anchor="${anchor}" dominant-baseline="central" font-size="${size}" font-weight="800" fill="#facc15" stroke="none" opacity="${dim ? 0.55 : 1}"${rot ? ` transform="rotate(${rot} ${q.x} ${q.y})"` : ""}>${t}</text>`;
  };
  const rect = (x0, y0, x1, y1, attrs) => { const a = S(x0, y0), c = S(x1, y1); return `<rect x="${a.x}" y="${a.y}" width="${c.x - a.x}" height="${c.y - a.y}" ${attrs}/>`; };

  /** used 에 든 핀 이름(좌표의 name)만 또렷하게, 나머지는 흐리게. 반환 { base, labels, marks } */
  function draw(used = []) {
    const names = used.map((u) => (typeof u === "string" ? u : u.name));
    const usedSet = new Set(names);
    const any = names.length > 0;
    const dimPin = (n) => any && !usedSet.has(n);
    const dimLabel = (ns) => any && !ns.some((n) => usedSet.has(n));
    const base = [];
    const labels = [];

    // 기판 (UNO 꼴) · 고정 구멍
    const outline = [[35, 12], [735, 12], [755, 32], [755, 125], [775, 145], [775, 415], [745, 445], [35, 445]].map(([a, b]) => { const q = S(a, b); return `${q.x},${q.y}`; }).join(" ");
    base.push(`<polygon points="${outline}" fill="#141619" stroke="currentColor" stroke-width="1"/>`);
    for (const [hx, hy] of [[195, 36], [185, 424], [752, 150], [752, 382]]) { const q = S(hx, hy); base.push(`<circle cx="${q.x}" cy="${q.y}" r="${13 * K}" fill="#090d16" stroke="#e2e8f0" stroke-width="1.6"/>`); }
    // RESET · USB-C · CH340 · LED · 칩 저항
    base.push(rect(64, 14, 122, 58, 'rx="2" fill="#d4d4d8"'), `<circle cx="${S(93, 36).x}" cy="${S(93, 36).y}" r="${14 * K}" fill="#27272a"/>`);
    base.push(`<rect x="${USB.x}" y="${USB.y}" width="${USB.w}" height="${USB.h}" rx="4" fill="#cbd5e1" stroke="#64748b"/>`, rect(35, 92, 93, 140, 'rx="2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.6"'));
    labels.push(`<text x="${USB.x - 4}" y="${USB.y + USB.h / 2}" text-anchor="end" dominant-baseline="central" font-size="13" font-weight="700" fill="currentColor" stroke="none">USB-C</text>`);
    base.push(rect(146, 78, 194, 156, 'rx="2" fill="#27272a"'));
    for (let i = 0; i < 8; i++) base.push(rect(136, 84 + i * 9, 146, 88 + i * 9, 'fill="#cbd5e1"'), rect(194, 84 + i * 9, 204, 88 + i * 9, 'fill="#cbd5e1"'));
    base.push(rect(242, 160, 268, 170, 'rx="1" fill="#fef08a"'), rect(242, 206, 268, 216, 'rx="1" fill="#4ade80"'));
    for (const yy of [90, 108, 126, 144, 162, 180]) base.push(rect(262, yy, 286, yy + 11, 'fill="#d6d3d1"'), rect(267, yy + 1, 281, yy + 10, 'fill="#27272a"'));
    for (const yy of [190, 208, 226, 244, 262]) base.push(rect(52, yy, 76, yy + 11, 'fill="#d6d3d1"'), rect(57, yy + 1, 71, yy + 10, 'fill="#44403c"'));
    // 4R7 코일 · 콘덴서 · 전원 칩 · DC 잭
    base.push(rect(164, 220, 224, 268, 'rx="4" fill="#a8a29e"'), silk(194, 244, "4R7", 8));
    base.push(rect(220, 282, 264, 302, 'rx="1" fill="#e7e5e4"'), rect(220, 310, 264, 330, 'rx="1" fill="#e7e5e4"'));
    base.push(rect(234, 354, 254, 386, 'fill="#e2e8f0"'), rect(196, 340, 238, 398, 'rx="1" fill="#27272a"'));
    base.push(rect(10, 312, 155, 396, 'rx="3" fill="#facc15" stroke="#ca8a04"'), rect(140, 314, 162, 394, 'rx="2" fill="#18181b"'));
    // ESP32-WROOM-32 모듈 · 안테나 · 덮개
    const m = MODULE;
    base.push(`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="2" fill="#18181b" stroke="#3f3f46"/>`);
    for (let i = 0; i < 10; i++) base.push(rect(522 + i * 15.5, 170, 530 + i * 15.5, 182, 'fill="#e8b93c"'), rect(522 + i * 15.5, 330, 530 + i * 15.5, 342, 'fill="#e8b93c"'), rect(498, 198 + i * 13, 510, 205 + i * 13, 'fill="#e8b93c"'));
    base.push(`<path d="M${S(718, 320).x} ${S(718, 320).y} V${S(0, 190).y} H${S(732, 0).x} V${S(0, 290).y} H${S(745, 0).x} V${S(0, 190).y} H${S(758, 0).x} V${S(0, 290).y} H${S(772, 0).x} V${S(0, 190).y} H${S(782, 0).x} V${S(0, 320).y}" fill="none" stroke="#3f3f46" stroke-width="2.4"/>`);
    base.push(rect(514, 186, 708, 326, 'rx="3" fill="#d4d4d8" stroke="#e4e4e7"'));
    base.push(silk(611, 240, "ESPRESSIF", 10).replace('fill="#facc15"', 'fill="#27272a"'), silk(611, 262, "ESP32-WROOM-32", 7).replace('fill="#facc15"', 'fill="#27272a"'));
    // 암핀 띠 (위 · 아래)
    base.push(rect(218, 17, 444, 39, 'rx="1.5" fill="#eab308" stroke="#a16207" stroke-width="0.8"'), rect(512, 17, 694, 39, 'rx="1.5" fill="#eab308" stroke="#a16207" stroke-width="0.8"'));
    base.push(rect(322, 412, 504, 434, 'rx="1.5" fill="#eab308" stroke="#a16207" stroke-width="0.8"'), rect(566, 412, 704, 434, 'rx="1.5" fill="#eab308" stroke="#a16207" stroke-width="0.8"'));
    base.push(`<rect x="${S(468, 423).x - 2.2}" y="${S(468, 423).y - 2.2}" width="4.4" height="4.4" fill="#1d1d1f"/>`);
    // 오른쪽 TX RX G V 세로 4핀 (장식)
    base.push(rect(706, 64, 730, 150, 'rx="2" fill="#eab308" stroke="#a16207" stroke-width="0.8"'));
    for (const yy of [76, 97, 118, 139]) base.push(`<rect x="${S(718, yy).x - 2.2}" y="${S(718, yy).y - 2.2}" width="4.4" height="4.4" fill="#e8b93c"/>`);
    // 묶음 테두리 (노란 실크)
    const frame = (x0, y0, x1, y1) => rect(x0, y0, x1, y1, 'rx="2" fill="none" stroke="#facc15" stroke-width="0.9"');
    base.push(frame(328, 70, 462, 138), frame(512, 70, 646, 138), frame(338, 156, 434, 228), frame(338, 246, 436, 382));
    for (const [x0, x1] of [[322, 544], [566, 738]]) { const a = S(x0, 378), c = S(x1, 378); base.push(`<line x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="#facc15" stroke-width="0.9"/>`); }

    // 핀 칸
    const top = (list, xs, svgFrom, svgCount, right) => list.forEach((n, i) => {
      const p = pin(`top:${n}`);
      const hasSvg = i >= svgFrom && i < svgFrom + svgCount;
      const col = [`top:${n}`, ...(hasSvg ? ["S", "V", "G"].map((r) => `${n}:${r}`) : [])];
      labels.push(silk(xs + 22 * i, 59, n, 7, "middle", -90, dimLabel(col)));
      base.push(pinBox(p.x, p.y, FILL.one, dimPin(`top:${n}`)));
      if (hasSvg) for (const r of ["S", "V", "G"]) { const q = pin(`${n}:${r}`); base.push(pinBox(q.x, q.y, FILL[r], dimPin(`${n}:${r}`), true)); }
      void right;
    });
    top(TOP_LEFT, 232, 4, 6, false);
    top(TOP_RIGHT, 526, 0, 6, true);
    ["S", "V", "G"].forEach((r, k) => labels.push(silk(318, 82 + 22 * k, r, 8.5)));
    labels.push(silk(488, 104, "DIGITAL", 7.5, "middle", -90));

    ["G", "V", "S"].forEach((c, k) => labels.push(silk(353 + 22 * k, 238, c, 8)));
    ANALOG_ROWS.forEach((n, r) => {
      const ns = ["G", "V", "S"].map((c) => `an:${n}:${c}`);
      ["G", "V", "S"].forEach((c) => { const q = pin(`an:${n}:${c}`); base.push(pinBox(q.x, q.y, FILL[c], dimPin(`an:${n}:${c}`), true)); });
      labels.push(silk(410, 260 + 22 * r, n, 7.5, "start", 0, dimLabel(ns)));
    });
    labels.push(silk(449, 314, "ANALOG", 7.5, "middle", -90));

    I2C_COLS.forEach((c, k) => {
      const ns = [0, 1, 2].map((r) => `i2c:${c}:${r}`);
      labels.push(silk(353 + 22 * k, 147, c === "5V" ? "V" : c, 7, "middle", 0, dimLabel(ns)));
      for (let r = 0; r < 3; r++) { const q = pin(`i2c:${c}:${r}`); base.push(pinBox(q.x, q.y, c === "GND" ? FILL.G : c === "5V" ? FILL.V : c === "SDA" ? FILL.S : FILL.SCL, dimPin(`i2c:${c}:${r}`), true)); }
    });
    labels.push(silk(448, 192, "BUS I2C", 7.5, "middle", -90));

    BOTTOM.forEach((n, i) => {
      const nm = n === "5V" && i === BOTTOM.lastIndexOf("5V") ? "bot:5V2" : `bot:${n}`;
      const p = pin(nm);
      labels.push(silk(BOTTOM_X[i], 396, n, 7, "middle", -90, dimLabel([nm])));
      base.push(pinBox(p.x, p.y, FILL.one, dimPin(nm)));
    });
    labels.push(silk(468, 396, "GND", 7, "middle", -90, any));
    labels.push(silk(510, 369, "POWER", 7.5), silk(615, 369, "ANALOG IN", 7.5));
    labels.push(silk(93, 70, "RESET", 7), silk(88, 432, "DC 7-12V", 7.5), silk(275, 165, "TX", 6.5, "start"), silk(275, 211, "ON", 6.5, "start"));
    ["TX", "RX", "G", "V"].forEach((t, k) => labels.push(silk(698, 76 + 21 * k, t, 7, "end")));
    labels.push(silk(611, 352, "ESP32 Plus", 9).replace('fill="#facc15"', 'fill="#ffffff"'));

    {
      // 3D 장면: 모든 핀(이름·색·쓰는지)
      const pins = [];
      const add = (nm, label, fill) => { const p = pin(nm); pins.push({ x: p.x, y: p.y, label, fill, used: usedSet.has(nm) }); };
      const tops = (list, from, count) => list.forEach((n, i) => {
        add(`top:${n}`, n, FILL.one);
        if (i >= from && i < from + count) for (const r of ["S", "V", "G"]) add(`${n}:${r}`, `${n} ${r}`, FILL[r]);
      });
      tops(TOP_LEFT, 4, 6);
      tops(TOP_RIGHT, 0, 6);
      ANALOG_ROWS.forEach((n) => ["G", "V", "S"].forEach((c) => add(`an:${n}:${c}`, `${n} ${c}`, FILL[c])));
      I2C_COLS.forEach((c) => { for (let r = 0; r < 3; r++) add(`i2c:${c}:${r}`, `I2C ${c}`, c === "GND" ? FILL.G : c === "5V" ? FILL.V : c === "SDA" ? FILL.S : FILL.SCL); });
      BOTTOM.forEach((n, i) => add(n === "5V" && i === BOTTOM.lastIndexOf("5V") ? "bot:5V2" : `bot:${n}`, n, FILL.one));
      rec("boards", { kind: "plus", name: "ESP32 Plus", x, y: y + 25, w: 428, h: Math.round(433 * K), color: "#141619", chip: MODULE, usb: USB, pins });
    }
    const marks = names.map((n) => {
      const p = pin(n);
      return `<rect x="${p.x - 8}" y="${p.y - 8}" width="16" height="16" rx="3" fill="none" stroke="#ffd43b" stroke-width="2.4"/>`;
    });
    return { base: base.join("\n  "), labels: labels.join("\n  "), marks: marks.join("\n  ") };
  }

  return {
    id: "plus",
    title: "ESP32 Plus 확장 보드",
    bounds: BOARD,
    /** 위 G 줄 아래 ~ ESP32 모듈 위: 선이 가로로 지나가는 빈 띠 */
    lane: { top: ROWS.G + 8, bottom: S(0, 152).y },
    /** 위 한 줄 핀의 높이 (모듈 선이 위에서 내려와 꽂힌다) */
    topY: TOP_Y,
    bottomY: BOTTOM_Y,
    pin, gpio, triple, power, i2c, draw,
    legend: "plus",
  };
}
