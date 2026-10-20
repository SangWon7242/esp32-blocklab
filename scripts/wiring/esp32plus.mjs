/*
 * Keyestudio ESP32 Plus(KS5020) 보드 배선도 그리기 도구.
 *
 * 모듈(서보·초음파·OLED·센서 모듈)은 브레드보드를 거치지 않고 F-F 듀폰선으로 보드의 핀 묶음에 바로 꽂는다.
 * 보드 그림의 핀 배치는 실제 보드 사진과 같은 순서다:
 *   - 위 왼쪽 한 줄: SCL SDA 5V GND io18 io19 io23 io5 io13 io12, io18~io12 아래에 S·V·G 세 줄
 *   - 위 오른쪽 한 줄: io14 io27 io16 io17 io25 io26 TX RX, io14~io26 아래에 S·V·G 세 줄
 *   - 가운데 왼쪽 ANALOG 묶음: 열 G V S, 행 io35 io34 io33 io32 io4 io2 (서보 플러그가 한 행에 그대로 꽂힌다)
 *   - BUS I2C 묶음: 열 GND 5V SDA SCL, 세 줄 (I2C 모듈 셋까지)
 *   - 아래 한 줄: POWER io0 5V RST 3V3 5V GND VIN, ANALOG io32 io33 io34 io35 io36 io39
 *
 * 쓰는 법: scripts/wiring/build.mjs 가 chapters/<id>.mjs 의 그림 명세를 읽어 content/chapters/<id>/images/ 에 SVG 를 쓴다.
 * 그림 규칙(계획 8): 640×360, role="img" + <title>, 고유 id 접두사, 글자 12px 이상, 오른쪽 위 "크게 보기" 자리(x>560, y<44) 비우기.
 */

export const W = 640;
export const H = 360;

/** 보드 위치 (위쪽 띠 y<104 는 모듈 자리) */
export const BOARD = { x: 172, y: 104, w: 300, h: 252 };

const P = 16; // 핀 간격
const TOP_Y = BOARD.y + 46; // 위 한 줄 핀
const ROWS = { S: TOP_Y + 16, V: TOP_Y + 30, G: TOP_Y + 44 };
const LEFT_X0 = BOARD.x + 22;
const RIGHT_X0 = BOARD.x + 182;
const ANALOG = { x0: BOARD.x + 28, y0: BOARD.y + 106 }; // 열 G V S, 행 35 34 33 32 4 2
const I2C = { x0: BOARD.x + 112, y0: BOARD.y + 106 }; // 열 GND 5V SDA SCL, 줄 3개
const BOTTOM_Y = BOARD.y + BOARD.h - 16;
const BOTTOM_X0 = BOARD.x + 94;

const TOP_LEFT = ["SCL", "SDA", "5V", "GND", "io18", "io19", "io23", "io5", "io13", "io12"];
const TOP_RIGHT = ["io14", "io27", "io16", "io17", "io25", "io26", "TX", "RX"];
const ANALOG_ROWS = ["io35", "io34", "io33", "io32", "io4", "io2"];
const I2C_COLS = ["GND", "5V", "SDA", "SCL"];
const BOTTOM = ["io0", "5V", "RST", "3V3", "5V", "GND", "VIN", "io32", "io33", "io34", "io35", "io36", "io39"];

/**
 * 핀 이름 → 좌표.
 *   "top:5V", "top:GND", "top:SCL" (위 왼쪽 한 줄), "io13:S" "io13:V" "io13:G" (위 줄 디지털 핀의 세 줄),
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
    if (r >= 0 && k >= 0) return { x: ANALOG.x0 + k * P, y: ANALOG.y0 + 30 + r * P };
  }
  if (a === "i2c") {
    const k = I2C_COLS.indexOf(b);
    const r = Number(c ?? 0);
    if (k >= 0 && r >= 0 && r < 3) return { x: I2C.x0 + k * P, y: I2C.y0 + 40 + r * P };
  }
  if (a === "bot") {
    const i = BOTTOM.indexOf(b);
    if (i >= 0) return { x: BOTTOM_X0 + i * P, y: BOTTOM_Y };
  }
  throw new Error(`모르는 핀: ${name}`);
}

const PIN_FILL = { one: "#f5c518", S: "#f5c518", V: "#e03131", G: "#495057" };
const pinBox = (x, y, fill) =>
  `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" rx="2" fill="${fill}" stroke="none"/><rect x="${x - 2.5}" y="${y - 2.5}" width="5" height="5" fill="#1d1d1f" stroke="none"/>`;
/** 세로 글자 (보드 위 핀 이름) — 아래 끝이 (x, yBottom) */
const HALO = `stroke="#1d1d1f" stroke-width="3.5" paint-order="stroke"`;
const vtext = (x, yBottom, s) =>
  `<text x="${x}" y="${yBottom}" transform="rotate(-90 ${x} ${yBottom})" dominant-baseline="central" font-size="12" font-weight="700" fill="#ffffff" ${HALO}>${s}</text>`;
const label = (s) => s.replace(/^io/, "");

/**
 * 보드 그림을 세 겹으로: base(판·핀) → (호스트가 모듈·선을 그림) → labels(핀 이름, 선 위에서도 읽히게) → marks(강조 테두리).
 * highlight 에 든 핀은 노란 테두리로 강조한다.
 */
export function board(highlight = []) {
  const { x, y, w, h } = BOARD;
  const out = [];
  out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#1d1d1f" stroke="currentColor"/>`);
  // USB-C · 전원 잭 · 리셋 버튼
  out.push(`<rect x="${x - 10}" y="${y + 70}" width="24" height="34" rx="5" fill="#ced4da" stroke="#868e96"/>`);
  out.push(`<text x="${x - 14}" y="${y + 87}" text-anchor="end" dominant-baseline="central" font-size="12" font-weight="700" fill="currentColor" stroke="none">USB</text>`);
  // ESP32 모듈
  const mx = x + 186, my = y + 120;
  out.push(`<rect x="${mx}" y="${my}" width="100" height="78" rx="4" fill="#adb5bd" stroke="#e9ecef"/>`);
  out.push(`<path d="M${mx + 10} ${my + 10} h12 v12 h12 v-12 h12 v12 h12 v-12 h12 v12 h12" stroke="#868e96" stroke-width="1.5"/>`);
  out.push(`<rect x="${mx + 10}" y="${my + 30}" width="80" height="42" rx="3" fill="#ced4da" stroke="#868e96" stroke-width="1"/>`);
  out.push(`<text x="${mx + 50}" y="${my + 48}" text-anchor="middle" font-size="13" font-weight="700" fill="#343a40" stroke="none">ESP32</text>`);
  out.push(`<text x="${mx + 50}" y="${my + 64}" text-anchor="middle" font-size="12" font-weight="700" fill="#343a40" stroke="none">Plus</text>`);

  // 위 왼쪽 한 줄 + S/V/G
  TOP_LEFT.forEach((n, i) => {
    const px = LEFT_X0 + i * P;
    out.push(vtext(px, TOP_Y - 10, label(n)));
    out.push(pinBox(px, TOP_Y, PIN_FILL.one));
    if (i >= 4) for (const r of ["S", "V", "G"]) out.push(pinBox(px, ROWS[r], PIN_FILL[r]));
  });
  TOP_RIGHT.forEach((n, i) => {
    const px = RIGHT_X0 + i * P;
    out.push(vtext(px, TOP_Y - 10, label(n)));
    out.push(pinBox(px, TOP_Y, PIN_FILL.one));
    if (i < 6) for (const r of ["S", "V", "G"]) out.push(pinBox(px, ROWS[r], PIN_FILL[r]));
  });
  for (const r of ["S", "V", "G"]) {
    out.push(`<text x="${LEFT_X0 + 3 * P}" y="${ROWS[r]}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="700" fill="#ffffff" ${HALO}>${r}</text>`);
    out.push(`<text x="${RIGHT_X0 + 6 * P + 2}" y="${ROWS[r]}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="700" fill="#ffffff" ${HALO}>${r}</text>`);
  }

  // ANALOG 묶음
  out.push(`<text x="${ANALOG.x0 - 6}" y="${ANALOG.y0}" dominant-baseline="central" font-size="12" font-weight="700" fill="#ffffff" ${HALO}>ANALOG</text>`);
  ["G", "V", "S"].forEach((c, k) => out.push(`<text x="${ANALOG.x0 + k * P}" y="${ANALOG.y0 + 15}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="700" fill="#ffffff" ${HALO}>${c}</text>`));
  ANALOG_ROWS.forEach((n, r) => {
    const py = ANALOG.y0 + 30 + r * P;
    ["G", "V", "S"].forEach((c, k) => out.push(pinBox(ANALOG.x0 + k * P, py, PIN_FILL[c])));
    out.push(`<text x="${ANALOG.x0 + 3 * P - 2}" y="${py}" dominant-baseline="central" font-size="12" font-weight="700" fill="#ffffff" ${HALO}>${label(n)}</text>`);
  });

  // BUS I2C 묶음
  I2C_COLS.forEach((c, k) => {
    const px = I2C.x0 + k * P;
    out.push(vtext(px, I2C.y0 + 30, c));
    for (let r = 0; r < 3; r++) out.push(pinBox(px, I2C.y0 + 40 + r * P, c === "GND" ? PIN_FILL.G : c === "5V" ? PIN_FILL.V : c === "SDA" ? PIN_FILL.S : "#f8f9fa"));
  });
  out.push(vtext(I2C.x0 + 4 * P + 2, I2C.y0 + 86, "I2C"));

  // 아래 한 줄
  BOTTOM.forEach((n, i) => {
    const px = BOTTOM_X0 + i * P;
    out.push(vtext(px, BOTTOM_Y - 10, label(n)));
    out.push(pinBox(px, BOTTOM_Y, PIN_FILL.one));
  });

  const marks = highlight.map((name) => {
    const p = pin(name);
    return `<rect x="${p.x - 8}" y="${p.y - 8}" width="16" height="16" rx="3" fill="none" stroke="#ffd43b" stroke-width="2.5"/>`;
  });
  // 보드 위 글자(흰 글자)는 선보다 위에 그린다
  const isBoardLabel = (e) => e.startsWith("<text") && e.includes('fill="#ffffff"');
  return {
    base: out.filter((e) => !isBoardLabel(e)).join("\n  "),
    labels: out.filter(isBoardLabel).join("\n  "),
    marks: marks.join("\n  "),
  };
}

/** 보드 + 모듈 + 선을 겹 순서대로 묶는다 */
export function compose(b, modules, wires, extra = []) {
  return [b.base, ...modules, ...wires, b.labels, b.marks, ...extra].join("\n  ");
}

/**
 * F-F 듀폰선: 양 끝에 검은 구멍 머리, 가운데는 색 선. via 는 지나가는 점들(곧은 선으로 잇는다).
 * 마지막 구간 모양: "vv"(세로로 나가 세로로 들어감, 기본) · "hv"(가로로 나가 세로로 들어감) · "orth"(via 를 곧은 직각 선으로만)
 */
export function ffWire(from, to, color, via = [], style = "vv") {
  const pts = [from, ...via, to];
  let d = `M${from.x} ${from.y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const my = (a.y + b.y) / 2;
    if (style === "orth") d += ` L${b.x} ${b.y}`;
    else if (i < pts.length - 1) d += ` L${b.x} ${b.y}`;
    else if (style === "hv") d += ` C${(a.x + b.x) / 2} ${a.y} ${b.x} ${a.y} ${b.x} ${b.y}`;
    else d += ` C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
  }
  const head = (p) => `<rect x="${p.x - 5}" y="${p.y - 7}" width="10" height="14" rx="2" fill="#212529" stroke="${color}" stroke-width="2"/>`;
  return `<path d="${d}" stroke="#1d1d1f" stroke-width="6" stroke-opacity="0.25"/><path d="${d}" stroke="${color}" stroke-width="3.5"/>\n  ${head(from)}${head(to)}`;
}

/** HC-SR04 초음파 센서. 핀은 아래쪽 VCC Trig Echo GND. 반환: { svg, pins } */
export function ultrasonic(x, y) {
  const pins = { VCC: { x: x + 40, y: y + 92 }, Trig: { x: x + 58, y: y + 92 }, Echo: { x: x + 76, y: y + 92 }, GND: { x: x + 94, y: y + 92 } };
  const svg = [
    `<rect x="${x}" y="${y}" width="134" height="84" rx="6" fill="#2b8a3e" stroke="currentColor"/>`,
    `<circle cx="${x + 32}" cy="${y + 30}" r="22" fill="#ced4da" stroke="#495057"/><circle cx="${x + 32}" cy="${y + 30}" r="10" fill="#495057" stroke="none"/>`,
    `<circle cx="${x + 102}" cy="${y + 30}" r="22" fill="#ced4da" stroke="#495057"/><circle cx="${x + 102}" cy="${y + 30}" r="10" fill="#495057" stroke="none"/>`,
    ...Object.entries(pins).map(([n, p]) => `<path d="M${p.x} ${y + 84} V${p.y}" stroke="#adb5bd" stroke-width="3"/><text x="${p.x}" y="${y + 78}" transform="rotate(-90 ${p.x} ${y + 78})" dominant-baseline="central" font-size="12" font-weight="700" fill="#ffffff" stroke="none">${n}</text>`),
    `<text x="${x - 10}" y="${y + 30}" text-anchor="end" dominant-baseline="central" font-size="14" font-weight="700" fill="currentColor" stroke="none">초음파 센서</text>`,
  ].join("\n  ");
  return { svg, pins };
}

/** SSD1306 OLED. 핀은 위쪽 GND VCC SCL SDA */
export function oled(x, y) {
  const pins = { GND: { x: x + 30, y: y - 8 }, VCC: { x: x + 48, y: y - 8 }, SCL: { x: x + 66, y: y - 8 }, SDA: { x: x + 84, y: y - 8 } };
  const svg = [
    `<rect x="${x}" y="${y}" width="114" height="100" rx="6" fill="#1c4fd6" stroke="currentColor"/>`,
    `<rect x="${x + 10}" y="${y + 42}" width="94" height="48" rx="2" fill="#0b1f4d" stroke="none"/>`,
    `<path d="M${x + 20} ${y + 58} h40 M${x + 20} ${y + 72} h60" stroke="#74c0fc" stroke-width="3"/>`,
    ...Object.entries(pins).map(([n, p]) => `<path d="M${p.x} ${y} V${p.y}" stroke="#adb5bd" stroke-width="3"/><text x="${p.x}" y="${y + 36}" transform="rotate(-90 ${p.x} ${y + 36})" dominant-baseline="central" font-size="12" font-weight="700" fill="#ffffff" stroke="none">${n}</text>`),
    `<text x="${x + 57}" y="${y + 120}" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor" stroke="none">OLED 화면</text>`,
  ].join("\n  ");
  return { svg, pins };
}

/**
 * 서보 모터(SG90). 갈색·빨강·주황 세 선이 검은 3핀 플러그로 모여, 플러그를 보드의 G·V·S 한 줄(예: ANALOG io4)에 그대로 꽂는다.
 * plugAt: 플러그가 꽂힐 G·V·S 세 핀 좌표 [G, V, S] (가로 한 줄)
 */
export function servo(x, y, plugAt) {
  const [g, v, s] = plugAt;
  const body = [
    `<rect x="${x}" y="${y}" width="96" height="46" rx="6" fill="#1971c2" stroke="currentColor"/>`,
    `<rect x="${x - 10}" y="${y + 16}" width="116" height="12" rx="4" fill="#1971c2" stroke="currentColor"/>`,
    `<circle cx="${x + 72}" cy="${y + 23}" r="12" fill="#f8f9fa" stroke="#495057"/><path d="M${x + 72} ${y + 6} V${y + 40}" stroke="#f8f9fa" stroke-width="7"/><circle cx="${x + 72}" cy="${y + 23}" r="3" fill="#495057" stroke="none"/>`,
    `<text x="${x + 48}" y="${y + 66}" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor" stroke="none">서보 모터</text>`,
  ];
  const start = { x: x + 96, y: y + 14 };
  const cols = ["#8b5a2b", "#e03131", "#f76707"];
  const ex = g.x - 8, ey = g.y;
  const wires = cols.map((c, i) => {
    const sx = start.x, sy = start.y + i * 8, ty = ey - 5 + i * 5;
    return `<path d="M${sx} ${sy} C${sx + 40} ${sy} ${ex - 40} ${ty} ${ex} ${ty}" stroke="${c}" stroke-width="3.5"/>`;
  });
  const plug = `<rect x="${g.x - 9}" y="${g.y - 9}" width="${s.x - g.x + 18}" height="18" rx="2" fill="#212529" stroke="#ffd43b" stroke-width="2"/>` +
    [g, v, s].map((p, i) => `<rect x="${p.x - 3}" y="${p.y - 3}" width="6" height="6" fill="${cols[i]}" stroke="none"/>`).join("");
  return { svg: [...body, ...wires, plug].join("\n  ") };
}

/** 보드 밖 말풍선 글 (흰 바탕 글자) */
export function note(x, y, s, anchor = "start") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="13" font-weight="700" fill="currentColor" stroke="none">${s}</text>`;
}

export function svgDoc(idPrefix, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${idPrefix}-title" font-family="inherit" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <title id="${idPrefix}-title">${title}</title>
  ${body}
</svg>
`;
}
