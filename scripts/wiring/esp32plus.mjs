/*
 * Keyestudio ESP32 Plus(KS5020) 보드 배선도 그리기 도구.
 *
 * 모듈(서보·초음파·OLED·센서 모듈)은 브레드보드를 거치지 않고 F-F 듀폰선으로 보드의 핀 묶음에 바로 꽂는다.
 * 보드 그림의 핀 배치는 실제 보드 사진과 같은 순서다:
 *   - 위 왼쪽 한 줄: SCL SDA 5V GND io18 io19 io23 io5 io13 io12, io18~io12 아래에 S·V·G 세 줄
 *   - 위 오른쪽 한 줄: io14 io27 io16 io17 io25 io26 TX RX, io14~io26 아래에 S·V·G 세 줄
 *   - 가운데 왼쪽 ANALOG 묶음: 열 G V S, 행 io35 io34 io33 io32 io4 io2 (서보 플러그가 한 행에 그대로 꽂힌다)
 *   - I2C 묶음: 열 GND 5V SDA SCL, 세 줄 (I2C 모듈 셋까지)
 *   - 아래 한 줄: POWER io0 5V RST 3V3 5V GND VIN, ANALOG io32 io33 io34 io35 io36 io39
 *
 * 읽기 쉽게: 핀 간격 20, 글자 13px, 쓰지 않는 핀은 흐리게, 쓰는 핀은 노란 테두리, 아래에 연결 표와 S·V·G 뜻.
 * 그림 폭은 640(글자 크기가 다른 그림과 같게), 높이는 내용에 맞춘다(화면은 viewBox 비율로 그린다).
 *
 * 쓰는 법: scripts/wiring/build.mjs 가 chapters/<id>.mjs 의 그림 명세를 읽어 content/chapters/<id>/images/ 에 SVG 를 쓴다.
 */

export const W = 640;

/** 보드 위치 (위쪽 띠 y<BOARD.y 는 모듈 자리) */
export const BOARD = { x: 96, y: 150, w: 428, h: 300 };

const P = 20; // 핀 간격
const BOX = 14; // 핀 칸 크기
const TOP_Y = BOARD.y + 58; // 위 한 줄 핀
const ROWS = { S: TOP_Y + 20, V: TOP_Y + 38, G: TOP_Y + 56 };
const LEFT_X0 = BOARD.x + 26;
const RIGHT_X0 = BOARD.x + 260;
const ANALOG = { x0: BOARD.x + 30, y0: BOARD.y + 138 }; // 제목 줄 y0, 열 이름 y0+18, 첫 행 y0+38
const I2C = { x0: BOARD.x + 140, y0: BOARD.y + 138 }; // 이름(세로) 아래 끝 y0+40, 첫 줄 y0+52
const MODULE = { x: BOARD.x + 268, y: BOARD.y + 150, w: 150, h: 84 };
const BOTTOM_Y = BOARD.y + BOARD.h - 18;
const BOTTOM_X0 = BOARD.x + 160;
/** 보드 위 가로 빈 띠 (위 G 줄 아래 ~ ESP32 모듈 위): 선이 가로로 지나가는 길 */
export const LANE = { top: TOP_Y + 56 + 11, bottom: BOARD.y + 150 - 6 };

const TOP_LEFT = ["SCL", "SDA", "5V", "GND", "io18", "io19", "io23", "io5", "io13", "io12"];
const TOP_RIGHT = ["io14", "io27", "io16", "io17", "io25", "io26", "TX", "RX"];
const ANALOG_ROWS = ["io35", "io34", "io33", "io32", "io4", "io2"];
const I2C_COLS = ["GND", "5V", "SDA", "SCL"];
const BOTTOM = ["io0", "5V", "RST", "3V3", "5V", "GND", "VIN", "io32", "io33", "io34", "io35", "io36", "io39"];

/** 핀 색: 한 줄 핀·S 는 노랑, V 는 빨강(+), G 는 검정(−) — 실물 보드와 같다 */
const FILL = { one: "#f5c518", S: "#f5c518", V: "#e03131", G: "#495057", SCL: "#f8f9fa" };

/**
 * 핀 이름 → 좌표.
 *   "top:5V" "top:GND" "top:SCL" "top:io13" (위 한 줄), "io13:S" "io13:V" "io13:G" (위 디지털 핀의 세 줄),
 *   "an:io4:G|V|S" (ANALOG 묶음), "i2c:GND|5V|SDA|SCL:0..2" (I2C 묶음 줄 번호), "bot:3V3" "bot:5V" "bot:GND" …
 */
export function pin(name) {
  const [a, b, c] = name.split(":");
  if (a === "top") {
    const i = TOP_LEFT.indexOf(b);
    if (i >= 0) return { x: LEFT_X0 + i * P, y: TOP_Y };
    const j = TOP_RIGHT.indexOf(b);
    if (j >= 0) return { x: RIGHT_X0 + j * P, y: TOP_Y };
  }
  if (a.startsWith("io") && (b === "S" || b === "V" || b === "G")) {
    const i = TOP_LEFT.indexOf(a);
    const j = TOP_RIGHT.indexOf(a);
    if (i >= 4) return { x: LEFT_X0 + i * P, y: ROWS[b] };
    if (j >= 0 && j < 6) return { x: RIGHT_X0 + j * P, y: ROWS[b] };
  }
  if (a === "an") {
    const r = ANALOG_ROWS.indexOf(b);
    const k = ["G", "V", "S"].indexOf(c);
    if (r >= 0 && k >= 0) return { x: ANALOG.x0 + k * P, y: ANALOG.y0 + 38 + r * P };
  }
  if (a === "i2c") {
    const k = I2C_COLS.indexOf(b);
    const r = Number(c ?? 0);
    if (k >= 0 && r >= 0 && r < 3) return { x: I2C.x0 + k * P, y: I2C.y0 + 52 + r * P };
  }
  if (a === "bot") {
    const i = BOTTOM.indexOf(b);
    if (i >= 0) return { x: BOTTOM_X0 + i * P, y: BOTTOM_Y };
  }
  throw new Error(`모르는 핀: ${name}`);
}

const HALO = `stroke="#1d1d1f" stroke-width="4" paint-order="stroke"`;
const WHITE = `font-weight="700" fill="#ffffff" ${HALO}`;
/** 핀 칸 하나. dim 이면 흐리게(이 그림에서 안 쓰는 핀) */
const pinBox = (x, y, fill, dim) =>
  `<g opacity="${dim ? 0.38 : 1}"><rect x="${x - BOX / 2}" y="${y - BOX / 2}" width="${BOX}" height="${BOX}" rx="2.5" fill="${fill}" stroke="none"/><rect x="${x - 3}" y="${y - 3}" width="6" height="6" rx="1" fill="#1d1d1f" stroke="none"/></g>`;
/** 세로 글자 — 아래 끝이 (x, yBottom) */
const vtext = (x, yBottom, s, dim) =>
  `<text x="${x}" y="${yBottom}" transform="rotate(-90 ${x} ${yBottom})" dominant-baseline="central" font-size="13" ${WHITE} opacity="${dim ? 0.55 : 1}">${s}</text>`;
const htext = (x, y, s, size = 13, anchor = "middle", dim = false) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-size="${size}" ${WHITE} opacity="${dim ? 0.55 : 1}">${s}</text>`;

/**
 * 보드 그림을 세 겹으로: base(판·핀) → (모듈·선) → labels(핀 이름, 선 위에서도 읽히게) → marks(쓰는 핀 노란 테두리).
 * used 에 든 핀만 또렷하게, 나머지 핀·글자는 흐리게 그린다. used 가 비면 모두 또렷하게.
 */
export function board(used = []) {
  const { x, y, w, h } = BOARD;
  const usedSet = new Set(used);
  const any = used.length > 0;
  const dimPin = (n) => any && !usedSet.has(n);
  const dimLabel = (names) => any && !names.some((n) => usedSet.has(n));
  const base = [];
  const labels = [];

  base.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#1d1d1f" stroke="currentColor"/>`);
  for (const [cx, cy] of [[x + 14, y + 14], [x + w - 14, y + 14], [x + 14, y + h - 14], [x + w - 14, y + h - 14]]) base.push(`<circle cx="${cx}" cy="${cy}" r="5" fill="#495057" stroke="none"/>`);
  // USB-C (왼쪽 가장자리)
  base.push(`<rect x="${x - 12}" y="${y + 92}" width="28" height="40" rx="6" fill="#ced4da" stroke="#868e96"/>`);
  labels.push(`<text x="${x - 16}" y="${y + 112}" text-anchor="end" dominant-baseline="central" font-size="13" font-weight="700" fill="currentColor" stroke="none">USB</text>`);
  // ESP32 모듈
  const m = MODULE;
  base.push(`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="5" fill="#adb5bd" stroke="#e9ecef"/>`);
  base.push(`<path d="M${m.x + 14} ${m.y + 22} v-10 h14 v10 h14 v-10 h14 v10 h14 v-10 h14 v10 h14 v-10 h14 v10" stroke="#868e96" stroke-width="1.5"/>`);
  base.push(`<rect x="${m.x + 14}" y="${m.y + 32}" width="${m.w - 28}" height="${m.h - 42}" rx="3" fill="#ced4da" stroke="#868e96" stroke-width="1"/>`);
  base.push(`<text x="${m.x + m.w / 2}" y="${m.y + 58}" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="700" fill="#343a40" stroke="none">ESP32 Plus</text>`);

  // 위 한 줄 + S/V/G (같은 기둥 핀 하나라도 쓰면 그 글자는 또렷하게)
  const top = (names, x0, svgFrom, svgCount) => names.forEach((n, i) => {
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

  // ANALOG 묶음
  const an = ANALOG;
  labels.push(htext(an.x0 - 8, an.y0, "ANALOG", 13, "start"));
  ["G", "V", "S"].forEach((c, k) => labels.push(htext(an.x0 + k * P, an.y0 + 18, c)));
  ANALOG_ROWS.forEach((n, r) => {
    const py = an.y0 + 38 + r * P;
    const names = ["G", "V", "S"].map((c) => `an:${n}:${c}`);
    ["G", "V", "S"].forEach((c, k) => base.push(pinBox(an.x0 + k * P, py, FILL[c], dimPin(`an:${n}:${c}`))));
    labels.push(htext(an.x0 + 3 * P - 4, py, n, 13, "start", dimLabel(names)));
  });

  // I2C 묶음
  I2C_COLS.forEach((c, k) => {
    const px = I2C.x0 + k * P;
    const names = [0, 1, 2].map((r) => `i2c:${c}:${r}`);
    labels.push(vtext(px, I2C.y0 + 40, c, dimLabel(names)));
    for (let r = 0; r < 3; r++) base.push(pinBox(px, I2C.y0 + 52 + r * P, c === "GND" ? FILL.G : c === "5V" ? FILL.V : c === "SDA" ? FILL.S : FILL.SCL, dimPin(`i2c:${c}:${r}`)));
  });
  labels.push(htext(I2C.x0 + 3 * P + 10, I2C.y0 + 52 + P, "I2C", 13, "start"));

  // 아래 한 줄
  BOTTOM.forEach((n, i) => {
    const px = BOTTOM_X0 + i * P;
    labels.push(vtext(px, BOTTOM_Y - 13, n, dimLabel([`bot:${n}`])));
    base.push(pinBox(px, BOTTOM_Y, FILL.one, dimPin(`bot:${n}`)));
  });

  const marks = used.map((n) => {
    const p = pin(n);
    return `<rect x="${p.x - 10}" y="${p.y - 10}" width="20" height="20" rx="4" fill="none" stroke="#ffd43b" stroke-width="3"/>`;
  });
  return { base: base.join("\n  "), labels: labels.join("\n  "), marks: marks.join("\n  ") };
}

/** 보드 + 모듈 + 선을 겹 순서대로 묶는다 */
export function compose(b, modules, wires, extra = []) {
  return [b.base, ...modules, ...wires, b.labels, b.marks, ...extra].join("\n  ");
}

/**
 * F-F 듀폰선: 양 끝에 검은 구멍 머리, 가운데는 색 선. via 는 지나가는 점들.
 * 모양: "vv"(세로로 나가 세로로 들어감, 기본) · "hv"(가로로 나가 세로로 들어감) · "orth"(점들을 직각 선으로)
 */
export function ffWire(from, to, color, via = [], style = "vv") {
  const pts = [from, ...via, to];
  let d = `M${from.x} ${from.y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const my = (a.y + b.y) / 2;
    if (style === "orth" || i < pts.length - 1) d += ` L${b.x} ${b.y}`;
    else if (style === "hv") d += ` C${(a.x + b.x) / 2} ${a.y} ${b.x} ${a.y} ${b.x} ${b.y}`;
    else d += ` C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
  }
  const head = (p) => `<rect x="${p.x - 6}" y="${p.y - 8}" width="12" height="16" rx="2" fill="#212529" stroke="${color}" stroke-width="2.5"/>`;
  return `<path d="${d}" stroke="#ffffff" stroke-width="7.5" stroke-opacity="0.9"/><path d="${d}" stroke="${color}" stroke-width="4"/>\n  ${head(from)}${head(to)}`;
}

/** 모듈 이름표 */
export const name = (x, y, s, anchor = "middle") =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-size="15" font-weight="700" fill="currentColor" stroke="none">${s}</text>`;
const pinName = (x, yBottom, s) =>
  `<text x="${x}" y="${yBottom}" transform="rotate(-90 ${x} ${yBottom})" dominant-baseline="central" font-size="13" font-weight="700" fill="#ffffff" stroke="none">${s}</text>`;

/** HC-SR04 초음파 센서. 핀은 아래쪽 VCC Trig Echo GND (간격 20). 반환: { svg, pins } */
export function ultrasonic(x, y) {
  const pins = { VCC: { x: x + 46, y: y + 110 }, Trig: { x: x + 66, y: y + 110 }, Echo: { x: x + 86, y: y + 110 }, GND: { x: x + 106, y: y + 110 } };
  const svg = [
    `<rect x="${x}" y="${y}" width="152" height="98" rx="7" fill="#2b8a3e" stroke="currentColor"/>`,
    `<circle cx="${x + 36}" cy="${y + 34}" r="25" fill="#ced4da" stroke="#495057"/><circle cx="${x + 36}" cy="${y + 34}" r="11" fill="#495057" stroke="none"/>`,
    `<circle cx="${x + 116}" cy="${y + 34}" r="25" fill="#ced4da" stroke="#495057"/><circle cx="${x + 116}" cy="${y + 34}" r="11" fill="#495057" stroke="none"/>`,
    ...Object.entries(pins).map(([n, p]) => `<path d="M${p.x} ${y + 98} V${p.y}" stroke="#adb5bd" stroke-width="3"/>${pinName(p.x, y + 92, n)}`),
  ].join("\n  ");
  return { svg, pins };
}

/** SSD1306 OLED. 핀은 위쪽 GND VCC SCL SDA (간격 20) */
export function oled(x, y) {
  const pins = { GND: { x: x + 24, y: y - 10 }, VCC: { x: x + 44, y: y - 10 }, SCL: { x: x + 64, y: y - 10 }, SDA: { x: x + 84, y: y - 10 } };
  const svg = [
    `<rect x="${x}" y="${y}" width="108" height="112" rx="7" fill="#1c4fd6" stroke="currentColor"/>`,
    `<rect x="${x + 9}" y="${y + 48}" width="90" height="54" rx="3" fill="#0b1f4d" stroke="none"/>`,
    `<path d="M${x + 20} ${y + 66} h44 M${x + 20} ${y + 82} h64" stroke="#74c0fc" stroke-width="3"/>`,
    ...Object.entries(pins).map(([n, p]) => `<path d="M${p.x} ${y} V${p.y}" stroke="#adb5bd" stroke-width="3"/>${pinName(p.x, y + 40, n)}`),
  ].join("\n  ");
  return { svg, pins };
}

/**
 * 서보 모터(SG90). 갈색·빨강·주황 세 선이 검은 3핀 플러그로 모여, 플러그를 보드의 G·V·S 한 줄(예: ANALOG io4)에 그대로 꽂는다.
 * plugAt: 플러그가 꽂힐 G·V·S 세 핀 좌표 [G, V, S] (가로 한 줄)
 */
export function servo(x, y, plugAt) {
  const [g, v, s] = plugAt;
  const cols = ["#8b5a2b", "#e03131", "#f76707"];
  const body = [
    `<rect x="${x - 6}" y="${y + 16}" width="78" height="12" rx="4" fill="#1971c2" stroke="currentColor"/>`,
    `<rect x="${x}" y="${y}" width="66" height="44" rx="7" fill="#1971c2" stroke="currentColor"/>`,
    `<circle cx="${x + 44}" cy="${y + 22}" r="12" fill="#f8f9fa" stroke="#495057"/><path d="M${x + 44} ${y + 5} V${y + 39}" stroke="#f8f9fa" stroke-width="7"/><circle cx="${x + 44}" cy="${y + 22}" r="3" fill="#495057" stroke="none"/>`,
  ];
  const start = { x: x + 66, y: y + 13 };
  const ex = g.x - BOX / 2 - 4;
  const wires = cols.map((c, i) => {
    const sx = start.x, sy = start.y + i * 9, ty = g.y - 6 + i * 6;
    return `<path d="M${sx} ${sy} C${sx + 18} ${sy} ${ex - 18} ${ty} ${ex} ${ty}" stroke="${c}" stroke-width="4"/>`;
  });
  const plug = `<rect x="${g.x - 12}" y="${g.y - 11}" width="${s.x - g.x + 24}" height="22" rx="3" fill="#212529" stroke="#ffd43b" stroke-width="3"/>` +
    [g, v, s].map((p, i) => `<rect x="${p.x - 4}" y="${p.y - 4}" width="8" height="8" rx="1" fill="${cols[i]}" stroke="none"/>`).join("");
  return { svg: [...body, ...wires, plug].join("\n  ") };
}

/**
 * 아래 연결 표: rows = [{ color, part, to }] 를 두 칸으로, 맨 아래 S·V·G 뜻과 노란 테두리 뜻.
 * 반환 { svg, bottom } — bottom 은 표가 끝나는 y.
 */
export function connectionTable(y, title, rows) {
  const out = [];
  const colW = 300, rowH = 24, x0 = 20;
  const half = Math.ceil(rows.length / 2);
  out.push(`<path d="M${x0} ${y} H${W - x0}" stroke="currentColor" stroke-opacity="0.2" stroke-width="1"/>`);
  out.push(`<text x="${x0}" y="${y + 18}" dominant-baseline="central" font-size="15" font-weight="700" fill="currentColor" stroke="none">${title}</text>`);
  rows.forEach((r, i) => {
    const cx = x0 + (i < half ? 0 : colW + 10);
    const cy = y + 44 + (i % half) * rowH;
    const cs = r.colors ?? [r.color];
    cs.forEach((c, k) => out.push(`<path d="M${cx} ${cy - (cs.length - 1) * 3 + k * 6} h24" stroke="${c}" stroke-width="${cs.length > 1 ? 4 : 5}"/>`));
    out.push(`<text x="${cx + 34}" y="${cy}" dominant-baseline="central" font-size="14" fill="currentColor" stroke="none"><tspan font-weight="700">${r.part}</tspan> → ${r.to}</text>`);
  });
  const ly = y + 44 + half * rowH + 6;
  const chip = (cx, fill, label) => `<rect x="${cx}" y="${ly - 7}" width="14" height="14" rx="2.5" fill="${fill}" stroke="none"/><text x="${cx + 20}" y="${ly}" dominant-baseline="central" font-size="13" fill="currentColor" stroke="none">${label}</text>`;
  out.push(chip(x0, FILL.S, "S 신호"), chip(x0 + 92, FILL.V, "V 전원(+)"), chip(x0 + 204, FILL.G, "G 접지(−)"));
  out.push(`<rect x="${x0 + 316}" y="${ly - 8}" width="16" height="16" rx="3" fill="none" stroke="#ffd43b" stroke-width="3"/><text x="${x0 + 340}" y="${ly}" dominant-baseline="central" font-size="13" fill="currentColor" stroke="none">이번에 꽂는 핀 (흐린 핀은 안 써요)</text>`);
  return { svg: out.join("\n  "), bottom: ly + 16 };
}

export function svgDoc(idPrefix, title, body, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" role="img" aria-labelledby="${idPrefix}-title" font-family="inherit" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <title id="${idPrefix}-title">${title}</title>
  ${body}
</svg>
`;
}
