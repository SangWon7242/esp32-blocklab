/*
 * 배선도 부품: 모듈(핀이 달린 작은 판 — 보드에 듀폰선으로 바로), 브레드보드, 맨 부품(LED·저항·버튼 등 — 브레드보드에 꽂음).
 * 모든 함수는 { svg, pins } 를 돌려준다. pins 의 좌표에 선 끝을 붙인다.
 * 모듈 핀 간격은 20, 브레드보드 구멍 간격은 16.
 */
import { name, note } from "./common.mjs";

const pinName = (x, yBottom, s) =>
  `<text x="${x}" y="${yBottom}" transform="rotate(-90 ${x} ${yBottom})" dominant-baseline="central" font-size="13" font-weight="700" fill="#ffffff" stroke="none">${s}</text>`;
const pinNameDown = (x, yTop, s) =>
  `<text x="${x}" y="${yTop}" transform="rotate(-90 ${x} ${yTop})" text-anchor="end" dominant-baseline="central" font-size="13" font-weight="700" fill="#ffffff" stroke="none">${s}</text>`;

/* ───────────── 모듈 ───────────── */

/**
 * 핀이 한쪽에 달린 모듈 틀. side: "bottom"(핀이 아래로) · "top"(위로).
 * pins: 이름 목록(왼→오). firstPin: 왼쪽 끝에서 첫 핀까지. title: 모듈 이름(판 밖), titleAt: { x, y, anchor }.
 * decor(x, y, w, h): 판 위 그림.
 */
export function module({ x, y, w, h, color, pins, side = "bottom", firstPin, pitch = 20, title, titleAt, decor }) {
  const fp = firstPin ?? (w - (pins.length - 1) * pitch) / 2;
  const out = [`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${color}" stroke="currentColor"/>`];
  if (decor) out.push(decor(x, y, w, h));
  const at = {};
  pins.forEach((n, i) => {
    const px = x + fp + i * pitch;
    if (side === "bottom") {
      at[n] = { x: px, y: y + h + 12 };
      out.push(`<path d="M${px} ${y + h} V${y + h + 12}" stroke="#adb5bd" stroke-width="3"/>${pinName(px, y + h - 6, n)}`);
    } else {
      at[n] = { x: px, y: y - 12 };
      out.push(`<path d="M${px} ${y} V${y - 12}" stroke="#adb5bd" stroke-width="3"/>${pinNameDown(px, y + 6, n)}`);
    }
  });
  if (title) {
    const t = titleAt ?? { x: x + w / 2, y: side === "bottom" ? y - 14 : y + h + 16, anchor: "middle" };
    out.push(name(t.x, t.y, title, t.anchor ?? "middle"));
  }
  return { svg: out.join("\n  "), pins: at };
}

/** HC-SR04 초음파 센서 (핀 VCC Trig Echo GND) */
export const ultrasonic = (x, y, opt = {}) =>
  module({
    x, y, w: 152, h: 98, color: "#2b8a3e", pins: ["VCC", "Trig", "Echo", "GND"], side: opt.side ?? "bottom", firstPin: 46,
    title: opt.title ?? "초음파 센서", titleAt: opt.titleAt ?? { x: x - 12, y: y + 34, anchor: "end" },
    decor: (x, y) => [x + 36, x + 116].map((cx) => `<circle cx="${cx}" cy="${y + 34}" r="25" fill="#ced4da" stroke="#495057"/><circle cx="${cx}" cy="${y + 34}" r="11" fill="#495057" stroke="none"/>`).join(""),
  });

/** SSD1306 OLED (핀 GND VCC SCL SDA, 기본은 위쪽) */
export const oled = (x, y, opt = {}) => {
  const side = opt.side ?? "top";
  return module({
    x, y, w: 108, h: 112, color: "#1c4fd6", pins: ["GND", "VCC", "SCL", "SDA"], side, firstPin: 24,
    title: opt.title ?? "OLED 화면", titleAt: opt.titleAt,
    decor: (x, y) => {
      const sy = side === "top" ? y + 48 : y + 10;
      return `<rect x="${x + 9}" y="${sy}" width="90" height="54" rx="3" fill="#0b1f4d" stroke="none"/><path d="M${x + 20} ${sy + 18} h44 M${x + 20} ${sy + 34} h64" stroke="#74c0fc" stroke-width="3"/>`;
    },
  });
};

/** RFID RC522 (I2C, 핀 GND VCC SDA SCL) */
export const rfid = (x, y, opt = {}) =>
  module({
    x, y, w: 130, h: 110, color: "#1864ab", pins: ["GND", "VCC", "SDA", "SCL"], side: opt.side ?? "top", firstPin: 35,
    title: opt.title ?? "RFID 모듈", titleAt: opt.titleAt,
    decor: (x, y, w, h) => {
      const top = (opt.side ?? "top") === "top" ? y + 36 : y + 10;
      return `<rect x="${x + 14}" y="${top}" width="${w - 28}" height="${h - 48}" rx="6" fill="none" stroke="#a5d8ff" stroke-width="3"/><rect x="${x + 26}" y="${top + 12}" width="${w - 52}" height="${h - 72}" rx="4" fill="none" stroke="#a5d8ff" stroke-width="2"/>`;
    },
  });

/** 3핀 센서 모듈 공통 (핀 G V S). kind: dht · pir · sound · flame · ir · lm35 */
export function sensor3(x, y, kind, opt = {}) {
  const look = {
    dht: { color: "#1971c2", title: "온습도 센서(DHT11)", decor: (x, y) => `<rect x="${x + 16}" y="${y + 10}" width="44" height="48" rx="4" fill="#e7f5ff" stroke="#74c0fc"/>${[0, 1, 2, 3, 4].map((k) => `<path d="M${x + 22} ${y + 18 + k * 8} h32" stroke="#74c0fc" stroke-width="2"/>`).join("")}` },
    pir: { color: "#2f9e44", title: "PIR 센서", decor: (x, y) => `<circle cx="${x + 38}" cy="${y + 32}" r="24" fill="#f8f9fa" stroke="#ced4da"/><path d="M${x + 22} ${y + 32} q16 -16 32 0 M${x + 26} ${y + 40} q12 -10 24 0" stroke="#ced4da" stroke-width="2"/>` },
    sound: { color: "#e8590c", title: "소리 센서", decor: (x, y) => `<circle cx="${x + 38}" cy="${y + 30}" r="16" fill="#343a40" stroke="#adb5bd"/><circle cx="${x + 38}" cy="${y + 30}" r="8" fill="#868e96" stroke="none"/>` },
    flame: { color: "#c92a2a", title: "불꽃 센서", decor: (x, y) => `<ellipse cx="${x + 38}" cy="${y + 26}" rx="10" ry="14" fill="#212529" stroke="#868e96"/><path d="M${x + 38} ${y + 40} v14" stroke="#adb5bd" stroke-width="2"/>` },
    ir: { color: "#495057", title: "IR 수신 모듈", decor: (x, y) => `<rect x="${x + 26}" y="${y + 12}" width="24" height="30" rx="4" fill="#212529" stroke="#868e96"/><circle cx="${x + 38}" cy="${y + 24}" r="7" fill="#343a40" stroke="#adb5bd"/>` },
    lm35: { color: "#5f3dc4", title: "온도 센서(LM35)", decor: (x, y) => `<path d="M${x + 28} ${y + 44} v-26 a10 10 0 0 1 20 0 v26 z" fill="#212529" stroke="#868e96"/>` },
  }[kind];
  if (!look) throw new Error(`모르는 센서 모듈: ${kind}`);
  return module({ x, y, w: 76, h: 70, color: look.color, pins: opt.pins ?? ["G", "V", "S"], side: opt.side ?? "bottom", firstPin: 18, title: opt.title ?? look.title, titleAt: opt.titleAt, decor: look.decor });
}

/** 조이스틱 모듈 (핀 X Y B V G) */
export const joystick = (x, y, opt = {}) =>
  module({
    x, y, w: 120, h: 100, color: "#212529", pins: opt.pins ?? ["X", "Y", "B", "V", "G"], side: opt.side ?? "bottom", firstPin: 20,
    title: opt.title ?? "조이스틱", titleAt: opt.titleAt,
    decor: (x, y) => `<circle cx="${x + 60}" cy="${y + 40}" r="30" fill="#495057" stroke="#adb5bd"/><circle cx="${x + 60}" cy="${y + 40}" r="16" fill="#343a40" stroke="#ced4da" stroke-width="2"/>`,
  });

/** 4×4 박막 키패드 (8핀 R1~R4 C1~C4, 아래쪽) */
export function keypad(x, y, opt = {}) {
  const w = 160, h = 150;
  const keys = ["1", "2", "3", "A", "4", "5", "6", "B", "7", "8", "9", "C", "*", "0", "#", "D"];
  return module({
    x, y, w, h, color: "#343a40", pins: opt.pins ?? ["R1", "R2", "R3", "R4", "C1", "C2", "C3", "C4"], side: "bottom", firstPin: 10, pitch: 20,
    title: opt.title ?? "4×4 키패드", titleAt: opt.titleAt,
    decor: (x, y) => keys.map((k, i) => {
      const kx = x + 12 + (i % 4) * 36, ky = y + 8 + Math.floor(i / 4) * 26;
      return `<rect x="${kx}" y="${ky}" width="30" height="21" rx="4" fill="#f1f3f5" stroke="none"/><text x="${kx + 15}" y="${ky + 11}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="#343a40" stroke="none">${k}</text>`;
    }).join(""),
  });
}

/** 팬(130 모터) 모듈 (핀 G V IN+ IN−) */
export const fan = (x, y, opt = {}) =>
  module({
    x, y, w: 110, h: 92, color: "#1c7ed6", pins: ["G", "V", "IN+", "IN−"], side: opt.side ?? "bottom", firstPin: 25,
    title: opt.title ?? "팬 모듈", titleAt: opt.titleAt,
    decor: (x, y) => `<circle cx="${x + 55}" cy="${y + 34}" r="24" fill="#e9ecef" stroke="#495057"/>${[0, 120, 240].map((a) => `<ellipse cx="${x + 55}" cy="${y + 20}" rx="7" ry="14" fill="#74c0fc" stroke="none" transform="rotate(${a} ${x + 55} ${y + 34})"/>`).join("")}<circle cx="${x + 55}" cy="${y + 34}" r="5" fill="#495057" stroke="none"/>`,
  });

/**
 * 서보 모터 (SG90). 플러그를 보드의 G·V·S 세 핀에 그대로 꽂는다 (ESP32 Plus).
 * plugAt: [G, V, S] 좌표 — 가로 한 줄(ANALOG 묶음 행)이든 세로 한 기둥(위 디지털 S·V·G)이든 된다.
 */
export function servo(x, y, plugAt, opt = {}) {
  const [g, v, s] = plugAt;
  const cols = ["#8b5a2b", "#e03131", "#f76707"];
  const out = servoBody(x, y);
  const vertical = Math.abs(g.x - s.x) < 1;
  const start = { x: x + 66, y: y + 13 };
  if (!vertical) {
    const ex = g.x - 11;
    cols.forEach((c, i) => {
      const sx = start.x, sy = start.y + i * 9, ty = g.y - 6 + i * 6;
      out.push(`<path d="M${sx} ${sy} C${sx + 18} ${sy} ${ex - 18} ${ty} ${ex} ${ty}" stroke="${c}" stroke-width="4"/>`);
    });
    out.push(`<rect x="${g.x - 12}" y="${g.y - 11}" width="${s.x - g.x + 24}" height="22" rx="3" fill="#212529" stroke="#ffd43b" stroke-width="3"/>`);
  } else {
    const top = Math.min(g.y, s.y), bot = Math.max(g.y, s.y);
    const ex = g.x - 11;
    [g, v, s].forEach((p, i) => out.push(`<path d="M${start.x} ${start.y + i * 9} C${start.x + 18} ${start.y + i * 9} ${ex - 18} ${p.y} ${ex} ${p.y}" stroke="${cols[i]}" stroke-width="4"/>`));
    out.push(`<rect x="${g.x - 11}" y="${top - 12}" width="22" height="${bot - top + 24}" rx="3" fill="#212529" stroke="#ffd43b" stroke-width="3"/>`);
  }
  [g, v, s].forEach((p, i) => out.push(`<rect x="${p.x - 4}" y="${p.y - 4}" width="8" height="8" rx="1" fill="${cols[i]}" stroke="none"/>`));
  if (opt.title !== false) out.push(name(opt.titleAt?.x ?? x + 34, opt.titleAt?.y ?? y + 62, opt.title ?? "서보 모터", opt.titleAt?.anchor ?? "middle"));
  return { svg: out.join("\n  ") };
}

function servoBody(x, y) {
  return [
    `<rect x="${x - 6}" y="${y + 16}" width="78" height="12" rx="4" fill="#1971c2" stroke="currentColor"/>`,
    `<rect x="${x}" y="${y}" width="66" height="44" rx="7" fill="#1971c2" stroke="currentColor"/>`,
    `<circle cx="${x + 44}" cy="${y + 22}" r="12" fill="#f8f9fa" stroke="#495057"/><path d="M${x + 44} ${y + 5} V${y + 39}" stroke="#f8f9fa" stroke-width="7"/><circle cx="${x + 44}" cy="${y + 22}" r="3" fill="#495057" stroke="none"/>`,
  ];
}

/**
 * 서보 모터 + 3핀 플러그만 (기본 보드용). 플러그 구멍(G·V·S)에 M-F 선의 핀 끝(m)을 꽂고, 다른 끝(f)을 보드 핀에 씌운다.
 * 플러그는 서보 오른쪽(plugSide "right", 기본) 또는 왼쪽("left")에 세로로 놓인다. order: 플러그 위→아래 순서(기본 G V S).
 * 반환 pins: { G, V, S } (플러그 구멍 좌표).
 */
export function servoWithPlug(x, y, opt = {}) {
  const cols = ["#8b5a2b", "#e03131", "#f76707"];
  const out = servoBody(x, y);
  const left = opt.plugSide === "left";
  const px = left ? x - 40 : x + 110, py0 = y + 2;
  const order = opt.order ?? ["G", "V", "S"];
  const pins = {};
  order.forEach((k, i) => (pins[k] = { x: px, y: py0 + 10 + i * 16 }));
  const colOf = { G: cols[0], V: cols[1], S: cols[2] };
  order.forEach((k, i) => {
    const sy = y + 13 + ["G", "V", "S"].indexOf(k) * 9;
    out.push(left
      ? `<path d="M${x} ${sy} C${x - 14} ${sy} ${px + 22} ${pins[k].y} ${px + 10} ${pins[k].y}" stroke="${colOf[k]}" stroke-width="4"/>`
      : `<path d="M${x + 66} ${sy} C${x + 84} ${sy} ${px - 26} ${pins[k].y} ${px - 10} ${pins[k].y}" stroke="${colOf[k]}" stroke-width="4"/>`);
  });
  out.push(`<rect x="${px - 10}" y="${py0}" width="20" height="52" rx="3" fill="#212529" stroke="#495057" stroke-width="2"/>`);
  order.forEach((k) => out.push(`<rect x="${pins[k].x - 3}" y="${pins[k].y - 3}" width="6" height="6" fill="#868e96" stroke="none"/>`));
  if (opt.title !== false) out.push(name(opt.titleAt?.x ?? x + 34, opt.titleAt?.y ?? y + 62, opt.title ?? "서보 모터", opt.titleAt?.anchor ?? "middle"));
  return { svg: out.join("\n  "), pins };
}

/* ───────────── 브레드보드 ───────────── */

const HOLE = 16;
const ROW_LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

/**
 * 브레드보드. cols 칸(1부터), rails: { top, bottom } (+ − 줄 쌍).
 * 세로 다섯 칸(a~e, f~j)은 서로 이어지고 가운데 홈 건너편은 안 이어진다. + − 줄은 가로로 끝까지 이어진다.
 * 반환 { svg, hole(col, row), rail(side, sign, col), tint(col, half), x, y, w, h }.
 *   hole(5, "a") · rail("top", "+", 3) · tint(5, "top"|"bottom") (이어진 다섯 칸을 옅게 칠한다 — svg 보다 먼저 그려야 하므로 tints 로 모아 쓴다)
 */
export function breadboard({ x, y, cols = 24, rails = { top: true, bottom: false }, railsOnly = false }) {
  const x0 = x + 28;
  const w = 56 + (cols - 1) * HOLE;
  if (railsOnly) return railStrip({ x, y, cols, x0, w });
  let cy = y + 12;
  const railY = {};
  if (rails.top) {
    railY["top+"] = cy + 4;
    railY["top-"] = cy + 20;
    cy += 40;
  }
  const numTop = cy + 4;
  const rowY = {};
  const aY = numTop + 18;
  ROW_LETTERS.forEach((r, i) => (rowY[r] = aY + i * HOLE + (i >= 5 ? 14 : 0)));
  cy = rowY.j + 18;
  const numBot = cy;
  cy += 14;
  if (rails.bottom) {
    railY["bottom-"] = cy + 6;
    railY["bottom+"] = cy + 22;
    cy += 36;
  }
  const h = cy - y + 6;
  const colX = (c) => x0 + (c - 1) * HOLE;

  const tints = [];
  const out = [];
  out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#f1f3f5" stroke="#adb5bd"/>`);
  // 가운데 홈
  out.push(`<rect x="${x + 6}" y="${rowY.e + 5}" width="${w - 12}" height="${rowY.f - rowY.e - 10}" rx="2" fill="#dee2e6" stroke="none"/>`);
  const holeSq = (hx, hy) => `<rect x="${hx - 3}" y="${hy - 3}" width="6" height="6" rx="1" fill="#868e96" stroke="none"/>`;
  const holes = [];
  for (let c = 1; c <= cols; c++) for (const r of ROW_LETTERS) holes.push(holeSq(colX(c), rowY[r]));
  out.push(`<g>${holes.join("")}</g>`);
  for (const [key, ry] of Object.entries(railY)) {
    const plus = key.endsWith("+");
    const lineY = key.startsWith("top") ? (plus ? ry - 8 : ry + 8) : plus ? ry + 8 : ry - 8;
    out.push(`<path d="M${x + 14} ${lineY} H${x + w - 14}" stroke="${plus ? "#e03131" : "#1971c2"}" stroke-width="2"/>`);
    const rh = [];
    for (let c = 1; c <= cols; c++) if ((c - 1) % 6 !== 5) rh.push(holeSq(colX(c), ry));
    out.push(`<g>${rh.join("")}</g>`);
    out.push(`<text x="${x + 12}" y="${ry}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="${plus ? "#e03131" : "#1971c2"}" stroke="none">${plus ? "+" : "−"}</text>`);
    out.push(`<text x="${x + w - 12}" y="${ry}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="${plus ? "#e03131" : "#1971c2"}" stroke="none">${plus ? "+" : "−"}</text>`);
  }
  for (const r of ROW_LETTERS) {
    out.push(`<text x="${x + 13}" y="${rowY[r]}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#495057" stroke="none">${r}</text>`);
  }
  for (let c = 1; c <= cols; c++) {
    if (c === 1 || c % 5 === 0) {
      out.push(`<text x="${colX(c)}" y="${numTop}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#495057" stroke="none">${c}</text>`);
      out.push(`<text x="${colX(c)}" y="${numBot}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#495057" stroke="none">${c}</text>`);
    }
  }
  /** 이어진 다섯 칸 옅게 (부품이 꽂힌 줄) */
  function tint(col, half) {
    const [r0, r1] = half === "bottom" ? ["f", "j"] : ["a", "e"];
    tints.push(`<rect x="${colX(col) - 7}" y="${rowY[r0] - 7}" width="14" height="${rowY[r1] - rowY[r0] + 14}" rx="4" fill="#ffd43b" fill-opacity="0.35" stroke="none"/>`);
  }
  /** x 에 가장 가까운 열 (railHole 이면 + − 줄의 빈칸 열(6·12·18…)은 건너뛴다) */
  function nearestCol(px, railHole = false) {
    let best = 1, bd = Infinity;
    for (let c = 1; c <= cols; c++) {
      if (railHole && (c - 1) % 6 === 5) continue;
      const d = Math.abs(colX(c) - px);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  return {
    get svg() { return [out[0], out[1], ...tints, ...out.slice(2)].join("\n  "); },
    hole: (c, r) => ({ x: colX(c), y: rowY[r] }),
    rail: (side, sign, c) => {
      if ((c - 1) % 6 === 5) throw new Error(`+ − 줄 ${c}번 칸은 비어 있어요 (6·12·18… 은 구멍 없음)`);
      return { x: colX(c), y: railY[`${side}${sign === "+" ? "+" : "-"}`] };
    },
    nearestCol, tint, x, y, w, h,
  };
}

/** + − 줄 두 줄만 있는 띠 (전원 나눠 쓰기용 브레드보드 조각) */
function railStrip({ x, y, cols, x0, w }) {
  const colX = (c) => x0 + (c - 1) * HOLE;
  const railY = { "+": y + 14, "-": y + 32 };
  const h = 46;
  const out = [`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#f1f3f5" stroke="#adb5bd"/>`];
  for (const [sign, ry] of Object.entries(railY)) {
    const plus = sign === "+";
    out.push(`<path d="M${x + 22} ${plus ? ry - 8 : ry + 8} H${x + w - 22}" stroke="${plus ? "#e03131" : "#1971c2"}" stroke-width="2"/>`);
    const rh = [];
    for (let c = 1; c <= cols; c++) if ((c - 1) % 6 !== 5) rh.push(`<rect x="${colX(c) - 3}" y="${ry - 3}" width="6" height="6" rx="1" fill="#868e96" stroke="none"/>`);
    out.push(`<g>${rh.join("")}</g>`);
    for (const tx of [x + 12, x + w - 12]) out.push(`<text x="${tx}" y="${ry}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="${plus ? "#e03131" : "#1971c2"}" stroke="none">${plus ? "+" : "−"}</text>`);
  }
  return { svg: out.join("\n  "), hole: () => { throw new Error("+ − 띠에는 a~j 구멍이 없어요"); }, rail: (_side, sign, c) => ({ x: colX(c), y: railY[sign === "+" ? "+" : "-"] }), tint: () => {}, x, y, w, h };
}

/* ───────────── 맨 부품 (브레드보드에 꽂음) ───────────── */

const legs = (pts, from) => pts.map((p) => `<path d="M${from(p).x} ${from(p).y} L${p.x} ${p.y}" stroke="#868e96" stroke-width="2.5"/>`).join("");

/**
 * LED. anode(긴 다리 +), cathode(짧은 다리 −) 구멍 좌표. 몸통은 두 구멍 위쪽(up=true) 또는 아래쪽.
 * label: true 면 "+ 긴 다리" 글자.
 */
export function led(anode, cathode, color = "#e03131", { up = true, label = true, lift = 30 } = {}) {
  const cx = (anode.x + cathode.x) / 2, cy = (up ? Math.min(anode.y, cathode.y) - lift : Math.max(anode.y, cathode.y) + lift);
  const out = [];
  out.push(legs([anode, cathode], (p) => ({ x: p.x, y: cy + (up ? 6 : -6) })));
  out.push(`<path d="M${anode.x} ${cy + (up ? 6 : -6)} H${cathode.x}" stroke="#868e96" stroke-width="2.5"/>`);
  out.push(`<circle cx="${cx}" cy="${cy}" r="14" fill="${color}" stroke="#343a40" stroke-width="2"/><circle cx="${cx - 5}" cy="${cy - 5}" r="4" fill="#ffffff" fill-opacity="0.7" stroke="none"/>`);
  if (label) out.push(`<text x="${anode.x + 9}" y="${up ? anode.y - 10 : anode.y + 10}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="#c92a2a" stroke="#f1f3f5" stroke-width="3" paint-order="stroke">+</text>`);
  return { svg: out.join("") };
}

/** 저항 (두 구멍 사이, 가로 또는 세로). bands: 색 띠 (220Ω: 빨 빨 갈) */
export function resistor(a, b, { bands = ["#e03131", "#e03131", "#8b5a2b"], label } = {}) {
  const horiz = Math.abs(a.y - b.y) < 1;
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  const out = [`<path d="M${a.x} ${a.y} L${b.x} ${b.y}" stroke="#868e96" stroke-width="2.5"/>`];
  const len = 30, th = 12;
  out.push(horiz
    ? `<rect x="${cx - len / 2}" y="${cy - th / 2}" width="${len}" height="${th}" rx="5" fill="#e9c891" stroke="#a07d4a"/>`
    : `<rect x="${cx - th / 2}" y="${cy - len / 2}" width="${th}" height="${len}" rx="5" fill="#e9c891" stroke="#a07d4a"/>`);
  bands.forEach((c, i) => {
    const o = -9 + i * 6;
    out.push(horiz ? `<rect x="${cx + o}" y="${cy - th / 2}" width="3" height="${th}" fill="${c}" stroke="none"/>` : `<rect x="${cx - th / 2}" y="${cy + o}" width="${th}" height="3" fill="${c}" stroke="none"/>`);
  });
  if (label) out.push(`<text x="${horiz ? cx : cx + 12}" y="${horiz ? cy - 15 : cy}" text-anchor="${horiz ? "middle" : "start"}" dominant-baseline="central" font-size="12" font-weight="700" fill="#343a40" stroke="#f1f3f5" stroke-width="3" paint-order="stroke">${label}</text>`);
  return { svg: out.join("") };
}

/** 푸시 버튼 (다리 4개, 홈을 건너 꽂음): bb 와 왼쪽 열 col. 다리 (col,e) (col+2,e) (col,f) (col+2,f) */
export function button(bb, col, { color = "#ced4da", label } = {}) {
  const p = [bb.hole(col, "e"), bb.hole(col + 2, "e"), bb.hole(col, "f"), bb.hole(col + 2, "f")];
  const cx = (p[0].x + p[1].x) / 2, cy = (p[0].y + p[2].y) / 2;
  const out = [p.map((q) => `<rect x="${q.x - 3}" y="${q.y - 3}" width="6" height="6" fill="#868e96" stroke="none"/>`).join("")];
  out.push(`<rect x="${cx - 21}" y="${cy - 21}" width="42" height="42" rx="4" fill="#343a40" stroke="#343a40" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="13" fill="${color}" stroke="#495057"/>`);
  if (label) out.push(`<text x="${cx}" y="${cy + 32}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="700" fill="#343a40" stroke="#f1f3f5" stroke-width="3" paint-order="stroke">${label}</text>`);
  return { svg: out.join(""), legs: { tl: p[0], tr: p[1], bl: p[2], br: p[3] } };
}

/** 부저 (+ 다리, − 다리). active: 능동(위에 스티커) · 수동 */
export function buzzer(plus, minus, { active = false, up = true, lift = 26 } = {}) {
  const cx = (plus.x + minus.x) / 2, cy = (up ? Math.min(plus.y, minus.y) - lift : Math.max(plus.y, minus.y) + lift);
  const out = [legs([plus, minus], (p) => ({ x: p.x, y: cy }))];
  out.push(`<circle cx="${cx}" cy="${cy}" r="17" fill="#212529" stroke="#343a40" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="4" fill="#495057" stroke="none"/>`);
  if (active) out.push(`<circle cx="${cx}" cy="${cy}" r="11" fill="none" stroke="#f8f9fa" stroke-width="2"/>`);
  out.push(`<text x="${plus.x}" y="${up ? plus.y - 10 : plus.y + 10}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="700" fill="#c92a2a" stroke="none">+</text>`);
  return { svg: out.join("") };
}

/** 가변저항 (다리 3개: 왼쪽 끝 · 가운데(와이퍼) · 오른쪽 끝) */
export function potentiometer(l, m, r, { up = true, lift = 30 } = {}) {
  const cx = m.x, cy = up ? m.y - lift : m.y + lift;
  const out = [legs([l, m, r], (p) => ({ x: p.x, y: cy + (up ? 10 : -10) }))];
  out.push(`<rect x="${cx - 24}" y="${cy - 18}" width="48" height="36" rx="4" fill="#1971c2" stroke="#343a40" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="12" fill="#f1f3f5" stroke="#495057"/><path d="M${cx} ${cy - 10} V${cy}" stroke="#495057" stroke-width="3"/>`);
  return { svg: out.join("") };
}

/** 포토레지스터(빛 센서, 다리 2개) */
export function photoresistor(a, b, { up = true, lift = 24 } = {}) {
  const cx = (a.x + b.x) / 2, cy = up ? Math.min(a.y, b.y) - lift : Math.max(a.y, b.y) + lift;
  const out = [legs([a, b], (p) => ({ x: p.x, y: cy }))];
  out.push(`<circle cx="${cx}" cy="${cy}" r="12" fill="#ffe8cc" stroke="#e8590c"/><path d="M${cx - 7} ${cy - 4} h4 v8 h4 v-8 h4 v8" stroke="#c92a2a" stroke-width="1.6"/>`);
  return { svg: out.join("") };
}

/** 틸트 스위치(다리 2개, 안에 쇠구슬) */
export function tiltSwitch(a, b, { up = true, lift = 24 } = {}) {
  const cx = (a.x + b.x) / 2, cy = up ? Math.min(a.y, b.y) - lift : Math.max(a.y, b.y) + lift;
  const out = [legs([a, b], (p) => ({ x: p.x, y: cy }))];
  out.push(`<rect x="${cx - 9}" y="${cy - 16}" width="18" height="30" rx="8" fill="#343a40" stroke="#343a40" stroke-width="2"/><circle cx="${cx}" cy="${cy + 5}" r="4" fill="#ced4da" stroke="none"/>`);
  return { svg: out.join("") };
}

/** RGB LED (다리 4개 왼→오: R · −(가장 긺) · G · B) */
export function rgbLed(holes, { up = true, lift = 28 } = {}) {
  const cx = (holes[0].x + holes[3].x) / 2, cy = up ? holes[0].y - lift : holes[0].y + lift;
  const out = [legs(holes, (p) => ({ x: p.x, y: cy + (up ? 8 : -8) }))];
  out.push(`<circle cx="${cx}" cy="${cy}" r="15" fill="#f8f9fa" stroke="#343a40" stroke-width="2"/><circle cx="${cx - 5}" cy="${cy - 3}" r="4" fill="#e03131" stroke="none"/><circle cx="${cx + 5}" cy="${cy - 3}" r="4" fill="#2f9e44" stroke="none"/><circle cx="${cx}" cy="${cy + 5}" r="4" fill="#1971c2" stroke="none"/>`);
  ["R", "−", "G", "B"].forEach((t, i) => out.push(`<text x="${holes[i].x}" y="${up ? holes[i].y - 10 : holes[i].y + 10}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="700" fill="#495057" stroke="none">${t}</text>`));
  return { svg: out.join("") };
}

/** IR 수신기 VS1838B (다리 3개 왼→오: OUT · GND · VCC) */
export function irReceiver(holes, { up = true, lift = 26 } = {}) {
  const cx = holes[1].x, cy = up ? holes[1].y - lift : holes[1].y + lift;
  const out = [legs(holes, (p) => ({ x: p.x, y: cy + (up ? 10 : -10) }))];
  out.push(`<rect x="${cx - 16}" y="${cy - 14}" width="32" height="26" rx="4" fill="#212529" stroke="#343a40" stroke-width="2"/><circle cx="${cx}" cy="${cy - 2}" r="8" fill="#343a40" stroke="#868e96"/>`);
  ["OUT", "G", "V"].forEach((t, i) => out.push(`<text x="${holes[i].x}" y="${up ? holes[i].y + 12 : holes[i].y - 12}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="700" fill="#495057" stroke="none">${t}</text>`));
  return { svg: out.join("") };
}

/**
 * DIP 칩 (홈을 건너 꽂음). n 핀(짝수), 왼쪽 열 col. 1번 핀은 아래쪽(f) 왼쪽, 아래쪽 왼→오 1..n/2, 위쪽(e) 오→왼 n/2+1..n.
 * 반환 pin(k) → 구멍 좌표.
 */
export function dip(bb, col, n, { label = "", notch = true } = {}) {
  const half = n / 2;
  const pinAt = (k) => (k <= half ? bb.hole(col + k - 1, "f") : bb.hole(col + (n - k), "e"));
  const l = bb.hole(col, "e"), r = bb.hole(col + half - 1, "f");
  const out = [`<rect x="${l.x - 9}" y="${l.y + 3}" width="${r.x - l.x + 18}" height="${r.y - l.y - 6}" rx="3" fill="#212529" stroke="#343a40" stroke-width="2"/>`];
  if (notch) out.push(`<path d="M${l.x - 9} ${(l.y + r.y) / 2 - 6} a6 6 0 0 1 0 12" stroke="#868e96" stroke-width="2"/>`);
  if (label) out.push(`<text x="${(l.x + r.x) / 2}" y="${(l.y + r.y) / 2}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="#ffffff" stroke="none">${label}</text>`);
  return { svg: out.join(""), pin: pinAt };
}
