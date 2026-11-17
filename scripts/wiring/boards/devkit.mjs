/*
 * 기본 보드: ESP32-DevKitC 38핀 (ESP32-WROOM-32, 흔한 호환 보드). 가로로 눕혀 그린다 — USB-C 가 왼쪽, 모듈(안테나)이 오른쪽.
 * 세워 놓았을 때(USB 위) 왼쪽 줄 CLK D0 D1 15 2 0 4 16 17 5 18 19 GND 21 RX TX 22 23 GND,
 * 오른쪽 줄 5V CMD D3 D2 13 GND 12 14 27 26 25 33 32 35 34 VN VP EN 3V3 이 눕히면 아래 · 위 줄이 된다:
 *   - 위 줄(왼→오): 5V(VIN) CMD SD3 SD2 13 GND 12 14 27 26 25 33 32 35 34 VN VP EN 3V3
 *   - 아래 줄(왼→오): CLK SD0 SD1 15 2 0 4 16 17 5 18 19 GND 21 RX TX 22 23 GND
 * 보드의 D0~D3 · CLK · CMD 는 플래시 칩 핀(GPIO6~11)이라 쓰지 않는다. 그래서 이름표 안에서는 SD0 처럼 따로 부르고,
 * 핀 이름은 지금까지처럼 D13 · VIN · RX0 · TX2 로 둔다(연결 표 · 설명 글과 같게). 보드에 찍힌 글자는 실물처럼 13 · 5V · RX.
 * VP=GPIO36, VN=GPIO39, RX2=GPIO16, TX2=GPIO17, RX0=GPIO3, TX0=GPIO1. 5V 전원은 VIN(5V) 핀.
 * 핀은 모두 수 핀이라 모듈은 F-F 듀폰선으로 바로, 여러 부품이 전원을 나눠 쓸 때는 브레드보드 + − 줄을 거친다.
 *
 * makeDevkit({ x, y }) 는 보드 왼쪽 위 모서리를 받는다. 그림 자리 470×150 (안테나가 오른쪽 끝까지).
 * 모양은 실물 보드 그림(espboards.dev 의 38핀 보드 그림)을 보고 다시 그렸다 — 검은 기판 · 은색 둥근 패드 · 흰 글자.
 */
import { vtext, vtextDown } from "../common.mjs";
import { rec } from "../record.mjs";

const TOP = ["VIN", "CMD", "SD3", "SD2", "D13", "GND", "D12", "D14", "D27", "D26", "D25", "D33", "D32", "D35", "D34", "VN", "VP", "EN", "3V3"];
const BOT = ["CLK", "SD0", "SD1", "D15", "D2", "D0", "D4", "RX2", "TX2", "D5", "D18", "D19", "GND", "D21", "RX0", "TX0", "D22", "D23", "GND"];
const ALIAS = { 36: "VP", 39: "VN", 16: "RX2", 17: "TX2", 1: "TX0", 3: "RX0" };
/** 보드에 찍힌 글자 (실물처럼) */
const SILK = { VIN: "5V", SD0: "D0", SD1: "D1", SD2: "D2", SD3: "D3", RX0: "RX", TX0: "TX", RX2: "16", TX2: "17" };
const silk = (n) => SILK[n] ?? (/^D\d+$/.test(n) ? n.slice(1) : n);
/** 쓰지 않는 플래시 핀 */
const FLASH = new Set(["CLK", "CMD", "SD0", "SD1", "SD2", "SD3"]);

const P = 22;

export function makeDevkit({ x = 85, y = 260 } = {}) {
  const BOARD = { x, y, w: 470, h: 150 };
  const TOP_Y = y + 16;
  const BOT_Y = y + BOARD.h - 16;
  const X0 = x + 14;
  const MODULE = { x: x + 248, y: y + 44, w: 224, h: 62 };

  /** "top:VIN" "top:D13" "bot:3V3" "bot:GND" … */
  function pin(name) {
    const [side, n] = name.split(":");
    const list = side === "top" ? TOP : side === "bot" ? BOT : null;
    const i = list ? list.indexOf(n) : -1;
    if (i < 0) throw new Error(`DevKit 에 없는 핀: ${name}`);
    return { x: X0 + i * P, y: side === "top" ? TOP_Y : BOT_Y, name, side };
  }
  const where = (label) => (TOP.includes(label) ? `top:${label}` : BOT.includes(label) ? `bot:${label}` : null);
  /** GPIO 번호의 핀 */
  function gpio(n) {
    const label = ALIAS[n] ?? `D${n}`;
    const nm = where(label);
    if (!nm || FLASH.has(label)) throw new Error(`기본 보드(38핀)에서 GPIO${n} 은 쓸 수 없어요`);
    return { ...pin(nm), label: ALIAS[n] ? `${label}(${n})` : label };
  }
  /** 3핀 모듈 묶음은 없다 (기본 보드) */
  const triple = () => null;
  /** 전원: "5V"(VIN) · "3V3" · "GND"(k=0 위 줄, 1 아래 줄) */
  function power(kind, k = 0) {
    if (kind === "5V") return { ...pin("top:VIN"), label: "VIN(5V)" };
    if (kind === "3V3") return { ...pin("top:3V3"), label: "3V3" };
    if (kind === "GND") return { ...pin(k === 0 ? "top:GND" : "bot:GND"), label: "GND" };
    throw new Error(`모르는 전원: ${kind}`);
  }
  /** I2C: SDA=D21, SCL=D22, 전원은 VIN·GND (모듈이 둘 이상이면 브레드보드로 나눠 쓴다) */
  function i2c() {
    return { GND: power("GND", 1), VCC: power("5V"), SDA: { ...gpio(21), label: "D21(SDA)" }, SCL: { ...gpio(22), label: "D22(SCL)" } };
  }

  /** 은색 둥근 패드 (가운데 구멍) */
  const pad = (px, py, dim, flash) =>
    `<g opacity="${dim ? 0.45 : 1}"><circle cx="${px}" cy="${py}" r="7" fill="${flash ? "#8a8f98" : "#c9cdd2"}" stroke="#6b7280" stroke-width="1"/><circle cx="${px}" cy="${py}" r="3" fill="#3f434a" stroke="none"/></g>`;

  function draw(used = []) {
    const names = used.map((u) => (typeof u === "string" ? u : u.name));
    const usedSet = new Set(names);
    const any = names.length > 0;
    const dim = (n) => any && !usedSet.has(n);
    const base = [];
    const labels = [];
    const R = (rx, ry, w, h, fill, extra = "") => `<rect x="${x + rx}" y="${y + ry}" width="${w}" height="${h}" ${extra} fill="${fill}"/>`;
    // 기판 (검정, 둥근 모서리) — 오른쪽 끝은 모듈 안테나가 조금 나온다
    base.push(`<rect x="${x + 2}" y="${y + 4}" width="418" height="142" rx="9" fill="#161618" stroke="#000000"/>`);
    // USB-C (왼쪽 끝): 은색 통 · 검은 구멍
    base.push(R(-14, 57, 34, 36, "#cfd4da", 'rx="6" stroke="#868e96"'));
    base.push(R(-12, 68, 6, 14, "#1b1b1f", 'rx="3"'));
    labels.push(`<text x="${x - 18}" y="${y + 75}" text-anchor="end" dominant-baseline="central" font-size="13" font-weight="700" fill="currentColor" stroke="none">USB-C</text>`);
    // BOOT · EN 버튼
    for (const [ry, t] of [[103, "Boot"], [33, "EN"]]) {
      base.push(R(26, ry, 20, 15, "#c9cdd2", 'rx="2"'));
      base.push(`<circle cx="${x + 36}" cy="${y + ry + 7.5}" r="5" fill="#3f3f46"/>`);
      labels.push(`<text x="${x + 56}" y="${y + ry + 7.5}" dominant-baseline="central" font-size="10" font-weight="700" fill="#f8f9fa" stroke="none">${t}</text>`);
    }
    // USB 칩(QFN) · 전원 칩(AMS1117) · 트랜지스터 · 콘덴서 · 빨간 전원 LED
    base.push(R(90, 63, 32, 22, "#26262b", 'rx="2"'));
    base.push(R(168, 66, 30, 16, "#26262b", 'rx="1"'), R(170, 84, 26, 9, "#b4bac4"));
    for (const rx of [97, 163]) base.push(R(rx, 106, 12, 8, "#26262b", 'rx="1"'));
    for (const [rx, ry] of [[146, 35], [146, 45], [174, 35], [174, 45]]) base.push(R(rx, ry, 9, 6, "#c9a26b", 'rx="1"'));
    base.push(R(108, 34, 8, 6, "#e03131", 'rx="1"'));
    // ESP32-WROOM-32 모듈: 짙은 회색 판 · 금색 가장자리 패드 · 흰 덮개(QR · CE · 글자) · 안테나
    const m = MODULE;
    base.push(`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="3" fill="#3f434a"/>`);
    for (let i = 0; i < 13; i++) for (const ry of [m.y + 1, m.y + m.h - 4]) base.push(`<rect x="${m.x + 6 + i * 12.6}" y="${ry}" width="5" height="3" fill="#e8b93c"/>`);
    base.push(`<rect x="${m.x + 10}" y="${m.y + 6}" width="158" height="${m.h - 12}" rx="3" fill="#ececec" stroke="#c9cdd2"/>`);
    const qx = m.x + 16, qy = m.y + 12;
    let seed = 13;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      seed = (seed * 41 + 7) % 97;
      const corner = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
      if (corner ? !(r % 8 === 1 || c % 8 === 1) || (r === 1 && c === 1) || (r === 1 && c === 7) || (r === 7 && c === 1) : seed % 2) base.push(`<rect x="${qx + c * 3}" y="${qy + r * 3}" width="3" height="3" fill="#1b1b1f"/>`);
    }
    base.push(`<text x="${m.x + 150}" y="${m.y + 18}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="800" fill="#1b1b1f" stroke="none">CE</text>`);
    base.push(`<text x="${m.x + 98}" y="${m.y + 22}" text-anchor="middle" dominant-baseline="central" font-size="9.5" font-weight="700" fill="#1b1b1f" stroke="none">ESP32-WROOM-32</text>`);
    base.push(`<text x="${m.x + 104}" y="${m.y + 41}" text-anchor="middle" dominant-baseline="central" font-size="12.5" font-weight="900" fill="#1b1b1f" stroke="none">ESPRESSIF</text>`);
    base.push(`<path d="M${m.x + 178} ${m.y + m.h - 6} V${m.y + 6} H${m.x + 190} V${m.y + m.h - 14} H${m.x + 202} V${m.y + 6} H${m.x + 214} V${m.y + m.h - 6}" fill="none" stroke="#5c6370" stroke-width="3"/>`);

    TOP.forEach((n, i) => {
      const px = X0 + i * P;
      base.push(pad(px, TOP_Y, dim(`top:${n}`), FLASH.has(n)));
      labels.push(vtextDown(px, TOP_Y + 12, silk(n), dim(`top:${n}`), 11));
    });
    BOT.forEach((n, i) => {
      const px = X0 + i * P;
      base.push(pad(px, BOT_Y, dim(`bot:${n}`), FLASH.has(n)));
      labels.push(vtext(px, BOT_Y - 12, silk(n), dim(`bot:${n}`), 11));
    });
    {
      const pins = [...TOP.map((n) => `top:${n}`), ...BOT.map((n) => `bot:${n}`)].map((nm) => {
        const p = pin(nm);
        return { x: p.x, y: p.y, label: nm.split(":")[1], fill: "#e8c547", used: usedSet.has(nm) };
      });
      rec("boards", { kind: "devkit", name: "ESP32 DevKit (38핀)", ...BOARD, color: "#161618", chip: MODULE, usb: { x: x - 14, y: y + 57, w: 34, h: 36 }, pins });
    }
    const marks = names.map((n) => {
      const p = pin(n);
      return `<rect x="${p.x - 10}" y="${p.y - 10}" width="20" height="20" rx="4" fill="none" stroke="#ffd43b" stroke-width="3"/>`;
    });
    return { base: base.join("\n  "), labels: labels.join("\n  "), marks: marks.join("\n  ") };
  }

  return {
    id: "devkit",
    title: "기본 보드 (ESP32 DevKit 38핀)",
    bounds: BOARD,
    topY: TOP_Y,
    bottomY: BOT_Y,
    pin, gpio, triple, power, i2c, draw,
    legend: "devkit",
  };
}
