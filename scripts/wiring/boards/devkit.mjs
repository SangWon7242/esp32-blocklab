/*
 * 기본 보드: ESP32 DevKit V1 (DOIT, 30핀). 가로로 눕혀 그린다 — USB 가 왼쪽, ESP32 모듈(안테나)이 오른쪽.
 * 세로로 세웠을 때(안테나 위) 왼쪽 줄 EN VP VN D34 D35 D32 D33 D25 D26 D27 D14 D12 D13 GND VIN,
 * 오른쪽 줄 D23 D22 TX0 RX0 D21 D19 D18 D5 TX2 RX2 D4 D2 D15 GND 3V3 이 눕히면 위·아래 줄이 된다:
 *   - 위 줄(왼→오): VIN GND D13 D12 D14 D27 D26 D25 D33 D32 D35 D34 VN VP EN
 *   - 아래 줄(왼→오): 3V3 GND D15 D2 D4 RX2 TX2 D5 D18 D19 D21 RX0 TX0 D22 D23
 * VP=GPIO36, VN=GPIO39, RX2=GPIO16, TX2=GPIO17. 5V 전원은 VIN 핀(USB 로 켜면 5V 가 나온다).
 * 핀은 모두 수 핀이라 모듈은 F-F 듀폰선으로 바로, 여러 부품이 전원을 나눠 쓸 때는 브레드보드 + − 줄을 거친다.
 *
 * makeDevkit({ x, y }) 는 보드 왼쪽 위 모서리를 받는다. 보드 크기 470×150.
 */
import { htext, vtext, vtextDown } from "../common.mjs";

const TOP = ["VIN", "GND", "D13", "D12", "D14", "D27", "D26", "D25", "D33", "D32", "D35", "D34", "VN", "VP", "EN"];
const BOT = ["3V3", "GND", "D15", "D2", "D4", "RX2", "TX2", "D5", "D18", "D19", "D21", "RX0", "TX0", "D22", "D23"];
const ALIAS = { 36: "VP", 39: "VN", 16: "RX2", 17: "TX2" };

const P = 22;
const BOX = 14;

export function makeDevkit({ x = 85, y = 260 } = {}) {
  const BOARD = { x, y, w: 470, h: 150 };
  const TOP_Y = y + 16;
  const BOT_Y = y + BOARD.h - 16;
  const X0 = x + 34;
  const MODULE = { x: x + 356, y: y + 30, w: 104, h: 90 };

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
    if (!nm) throw new Error(`DevKit 30핀에는 GPIO${n} 이 없어요`);
    return { ...pin(nm), label: ALIAS[n] ? `${label}(${n})` : label };
  }
  /** 3핀 모듈 묶음은 없다 (기본 보드) */
  const triple = () => null;
  /** 전원: "5V"(VIN) · "3V3" · "GND"(k=0 위 줄, 1 아래 줄) */
  function power(kind, k = 0) {
    if (kind === "5V") return { ...pin("top:VIN"), label: "VIN(5V)" };
    if (kind === "3V3") return { ...pin("bot:3V3"), label: "3V3" };
    if (kind === "GND") return { ...pin(k === 0 ? "top:GND" : "bot:GND"), label: "GND" };
    throw new Error(`모르는 전원: ${kind}`);
  }
  /** I2C: SDA=D21, SCL=D22, 전원은 VIN·GND (모듈이 둘 이상이면 브레드보드로 나눠 쓴다) */
  function i2c() {
    return { GND: power("GND", 1), VCC: power("5V"), SDA: { ...gpio(21), label: "D21(SDA)" }, SCL: { ...gpio(22), label: "D22(SCL)" } };
  }

  const pinBox = (px, py, dim) =>
    `<g opacity="${dim ? 0.4 : 1}"><rect x="${px - BOX / 2}" y="${py - BOX / 2}" width="${BOX}" height="${BOX}" rx="2" fill="#0b0f19" stroke="#868e96" stroke-width="1"/><circle cx="${px}" cy="${py}" r="3.2" fill="#e8c547" stroke="none"/></g>`;

  function draw(used = []) {
    const names = used.map((u) => (typeof u === "string" ? u : u.name));
    const usedSet = new Set(names);
    const any = names.length > 0;
    const dim = (n) => any && !usedSet.has(n);
    const base = [];
    const labels = [];
    const { w, h } = BOARD;
    base.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#1b2b4b" stroke="currentColor"/>`);
    // USB(마이크로) · EN · BOOT 버튼
    base.push(`<rect x="${x - 14}" y="${y + 58}" width="30" height="34" rx="4" fill="#ced4da" stroke="#868e96"/>`);
    labels.push(`<text x="${x - 18}" y="${y + 75}" text-anchor="end" dominant-baseline="central" font-size="13" font-weight="700" fill="currentColor" stroke="none">USB</text>`);
    // ESP32 모듈(금속 덮개 + 안테나)
    const m = MODULE;
    base.push(`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="4" fill="#adb5bd" stroke="#e9ecef"/>`);
    base.push(`<path d="M${m.x + m.w - 18} ${m.y + 12} h-10 v66 h10 M${m.x + m.w - 12} ${m.y + 12} v66" stroke="#868e96" stroke-width="1.5"/>`);
    base.push(`<rect x="${m.x + 10}" y="${m.y + 14}" width="${m.w - 40}" height="${m.h - 28}" rx="3" fill="#ced4da" stroke="#868e96" stroke-width="1"/>`);
    base.push(`<text x="${m.x + 42}" y="${m.y + m.h / 2}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="#343a40" stroke="none">ESP32</text>`);
    labels.push(htext(x + 190, y + h / 2, "ESP32 DevKit V1 (30핀)", 14));

    TOP.forEach((n, i) => {
      const px = X0 + i * P;
      base.push(pinBox(px, TOP_Y, dim(`top:${n}`)));
      labels.push(vtextDown(px, TOP_Y + 13, n, dim(`top:${n}`)));
    });
    BOT.forEach((n, i) => {
      const px = X0 + i * P;
      base.push(pinBox(px, BOT_Y, dim(`bot:${n}`)));
      labels.push(vtext(px, BOT_Y - 13, n, dim(`bot:${n}`)));
    });
    const marks = names.map((n) => {
      const p = pin(n);
      return `<rect x="${p.x - 10}" y="${p.y - 10}" width="20" height="20" rx="4" fill="none" stroke="#ffd43b" stroke-width="3"/>`;
    });
    return { base: base.join("\n  "), labels: labels.join("\n  "), marks: marks.join("\n  ") };
  }

  return {
    id: "devkit",
    title: "기본 보드 (ESP32 DevKit V1 30핀)",
    bounds: BOARD,
    topY: TOP_Y,
    bottomY: BOT_Y,
    pin, gpio, triple, power, i2c, draw,
    legend: "devkit",
  };
}
