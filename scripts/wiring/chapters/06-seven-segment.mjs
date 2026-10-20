// 센서 S6 "7세그먼트" — 74HC595(SI 5 · SCK 18 · RCK 23) + 1자리 디지털 튜브(공통 음극) + 220Ω 저항 8개.
// 칩은 반달 홈이 오른쪽을 보게(1번 핀이 위 칸 오른쪽) 꽂아서 SI · SCK · RCK · VCC · MR · OE 가 모두 아래 칸에 온다 → 보드에서 오는 선이 짧다.
// 칩 Q0~Q7 → 저항 다리(회색 선, 가운데 저항) → 튜브 a~dp. 칩 GND · 튜브 COM 은 위 − 줄, 위 − 줄과 아래 − 줄은 점퍼로.
// 두 보드 모두 브레드보드를 보드 위에(Plus 는 5V · GND · io18 · io23 · io5 가 위 한 줄, 기본 보드는 VIN 이 위 줄이고 D5 · D18 · D23 은 아래 줄이라 보드 아래로 돌아온다).
import { COLORS as C, compose, connectionTable, mfWire, mmWire, svgDoc } from "../common.mjs";
import { makePlus } from "../boards/plus.mjs";
import { makeDevkit } from "../boards/devkit.mjs";
import { breadboard } from "../parts.mjs";
import { railCol, railLink } from "./11-button-touch.mjs";

const CHIP = 4; // 칩 왼쪽 열
const SEG = 17; // 튜브 왼쪽 열

/** 74HC595, 반달 홈 오른쪽(180° 돌림): 위 칸(e) 왼→오 GND Q7 Q6 Q5 Q4 Q3 Q2 Q1, 아래 칸(f) 왼→오 Q7' MR SCK RCK OE SI Q0 VCC */
function chip595(bb, col) {
  const top = ["GND", "Q7", "Q6", "Q5", "Q4", "Q3", "Q2", "Q1"];
  const bot = ["Q7'", "MR", "SCK", "RCK", "OE", "SI", "Q0", "VCC"];
  const at = {};
  top.forEach((n, i) => (at[n] = col + i));
  bot.forEach((n, i) => (at[n] = col + i));
  const l = bb.hole(col, "e"), r = bb.hole(col + 7, "f");
  const out = [`<rect x="${l.x - 9}" y="${l.y + 3}" width="${r.x - l.x + 18}" height="${r.y - l.y - 6}" rx="3" fill="#212529" stroke="currentColor"/>`];
  out.push(`<path d="M${r.x + 9} ${(l.y + r.y) / 2 - 6} a6 6 0 0 0 0 12" stroke="#868e96" stroke-width="2"/>`);
  out.push(`<text x="${(l.x + r.x) / 2}" y="${(l.y + r.y) / 2}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" fill="#ffffff" stroke="none">74HC595</text>`);
  for (let i = 0; i < 8; i++) for (const rw of ["e", "f"]) { const p = bb.hole(col + i, rw); out.push(`<rect x="${p.x - 3}" y="${p.y - 3}" width="6" height="6" fill="#adb5bd" stroke="none"/>`); }
  return { svg: out.join(""), col: (n) => at[n] };
}

/** 1자리 디지털 튜브(공통 음극): 위 핀 (s..s+4, c) = g f COM a b, 아래 핀 (s..s+4, g) = e d COM c dp */
function digit(bb, s) {
  const tl = bb.hole(s, "c"), br = bb.hole(s + 4, "g");
  const x0 = tl.x - 10, y0 = tl.y - 7, w = br.x - tl.x + 20, h = br.y - tl.y + 14;
  const out = [`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="4" fill="#212529" stroke="currentColor"/>`];
  const cx = x0 + w / 2 - 2, cy = y0 + h / 2, sw = 10, sh = 10;
  const seg = (d) => `<path d="${d}" stroke="#e03131" stroke-opacity="0.6" stroke-width="3"/>`;
  out.push(seg(`M${cx - sw / 2} ${cy - sh} h${sw}`), seg(`M${cx - sw / 2} ${cy} h${sw}`), seg(`M${cx - sw / 2} ${cy + sh} h${sw}`));
  out.push(seg(`M${cx - sw / 2 - 2} ${cy - sh + 3} v${sh - 6}`), seg(`M${cx + sw / 2 + 2} ${cy - sh + 3} v${sh - 6}`), seg(`M${cx - sw / 2 - 2} ${cy + 3} v${sh - 6}`), seg(`M${cx + sw / 2 + 2} ${cy + 3} v${sh - 6}`));
  out.push(`<circle cx="${cx + sw / 2 + 7}" cy="${cy + sh}" r="2" fill="#e03131" fill-opacity="0.55" stroke="none"/>`);
  const topN = ["g", "f", "COM", "a", "b"], botN = ["e", "d", "COM", "c", "dp"];
  const lab = (n, p, dy) => `<text x="${p.x}" y="${p.y + dy}" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" fill="#ffffff" stroke="none">${n}</text>`;
  const at = {};
  topN.forEach((n, i) => { const p = bb.hole(s + i, "c"); out.push(`<rect x="${p.x - 3}" y="${p.y - 3}" width="6" height="6" fill="#adb5bd" stroke="none"/>`, lab(n, p, n === "COM" ? 21 : 11)); if (n !== "COM") at[n] = s + i; });
  botN.forEach((n, i) => { const p = bb.hole(s + i, "g"); out.push(`<rect x="${p.x - 3}" y="${p.y - 3}" width="6" height="6" fill="#adb5bd" stroke="none"/>`, lab(n, p, n === "COM" ? -21 : -11)); if (n !== "COM") at[n] = s + i; });
  return { svg: out.join(""), at, com: s + 2 };
}

/** 저항 다리: 회색 꺾은선(흰 테두리로 겹쳐도 구분) + 저항 몸통(pts[k]~pts[k+1] 칸의 가운데, 가로 또는 세로) + 양 끝 꽂힌 점 */
function legResistor(pts, k, frac = 0.5) {
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  const a = pts[k], b = pts[k + 1];
  const cx = a.x + (b.x - a.x) * frac, cy = a.y + (b.y - a.y) * frac;
  const horiz = Math.abs(a.y - b.y) < 1;
  const bands = ["#e03131", "#e03131", "#8b5a2b"];
  const out = [`<path d="${d}" stroke="#ffffff" stroke-width="5" stroke-opacity="0.95"/>`, `<path d="${d}" stroke="#5c636a" stroke-width="2"/>`];
  out.push(horiz
    ? `<rect x="${cx - 12}" y="${cy - 4.5}" width="24" height="9" rx="4" fill="#e9c891" stroke="#a07d4a" stroke-width="1.2"/>`
    : `<rect x="${cx - 4.5}" y="${cy - 12}" width="9" height="24" rx="4" fill="#e9c891" stroke="#a07d4a" stroke-width="1.2"/>`);
  bands.forEach((c, i) => out.push(horiz ? `<rect x="${cx - 7 + i * 4.5}" y="${cy - 4.5}" width="2.2" height="9" fill="${c}" stroke="none"/>` : `<rect x="${cx - 4.5}" y="${cy - 7 + i * 4.5}" width="9" height="2.2" fill="${c}" stroke="none"/>`));
  for (const p of [pts[0], pts[pts.length - 1]]) out.push(`<circle cx="${p.x}" cy="${p.y}" r="3" fill="#343a40" stroke="#ffffff" stroke-width="1"/>`);
  return out.join("");
}

/** 브레드보드 위 회로 전체 (bb 의 제 좌표). 반환: parts · 안쪽 점퍼 · 보드에서 올 구멍들 */
function circuit(bb) {
  const ch = chip595(bb, CHIP), dg = digit(bb, SEG);
  const X = (c) => bb.hole(c, "a").x, Y = (r) => bb.hole(1, r).y;
  const Xm = (c) => X(c) + 8, Ym = (r) => Y(r) + 8;
  const H = (c, r) => bb.hole(c, r);
  const P = (x, y) => ({ x, y });
  const t0 = Y("a") - 8, deep = Y("j") + 8, numBot = Y("j") + 18;
  const q = (n) => ch.col(n);
  const R = SEG + 4; // 튜브 오른쪽 끝 열 (b · dp)
  // 아래 칸 맨 아래 길(Q1)이 아래쪽 열 번호 줄을 지나므로 그 구간의 번호는 가린다 (위쪽 번호는 그대로)
  const cover = `<rect x="${X(10) - 9}" y="${numBot - 8}" width="${X(R + 3) - X(10) + 18}" height="16" fill="#f1f3f5" stroke="none"/>`;
  const legs = [
    // Q6 → g (위 칸 a 줄을 따라)
    legResistor([H(q("Q6"), "d"), P(X(q("Q6")), Y("a")), H(dg.at.g, "a")], 1, 0.3),
    // Q5 → f
    legResistor([H(q("Q5"), "d"), P(X(q("Q5")), Ym("a")), P(X(dg.at.f), Ym("a")), H(dg.at.f, "b")], 1, 0.58),
    // Q4 → e: 칩 바로 옆에서 홈을 건너
    legResistor([H(q("Q4"), "d"), P(X(q("Q4")), Y("b")), P(Xm(15), Y("b")), P(Xm(15), Ym("g")), P(X(dg.at.e), Ym("g")), H(dg.at.e, "h")], 2, 0.28),
    // Q3 → d
    legResistor([H(q("Q3"), "d"), P(X(q("Q3")), Ym("b")), P(Xm(14), Ym("b")), P(Xm(14), Ym("h")), P(X(dg.at.d), Ym("h")), H(dg.at.d, "h")], 2, 0.78),
    // Q2 → c
    legResistor([H(q("Q2"), "d"), P(X(q("Q2")), Y("c")), P(Xm(13), Y("c")), P(Xm(13), Ym("i")), P(X(dg.at.c), Ym("i")), H(dg.at.c, "i")], 3, 0.42),
    // Q1 → b: 바로 홈을 건너 아래 칸 맨 아래 길로, 튜브 오른쪽에서 다시 위 칸으로
    legResistor([H(q("Q1"), "d"), P(X(q("Q1")), Ym("c")), P(Xm(12), Ym("c")), P(Xm(12), numBot), P(Xm(R + 2), numBot), P(Xm(R + 2), Ym("a")), P(X(dg.at.b), Ym("a")), H(dg.at.b, "b")], 4, 0.84),
    // Q7 → dp: 맨 위로 넘어가 튜브 오른쪽에서 내려온다
    legResistor([H(q("Q7"), "d"), P(X(q("Q7")), t0), P(Xm(R), t0), P(Xm(R), Ym("h")), P(X(dg.at.dp), Ym("h")), H(dg.at.dp, "h")], 2, 0.5),
    // Q0 → a: 아래 칸 맨 아래 길로 튜브 오른쪽까지, 위 칸으로 올라와 a
    legResistor([H(q("Q0"), "h"), P(X(q("Q0")), deep), P(Xm(R + 1), deep), P(Xm(R + 1), Ym("b")), P(X(dg.at.a), Ym("b")), H(dg.at.a, "b")], 1, 0.62),
  ];
  const parts = [cover, ch.svg, dg.svg, ...legs];
  // 칩 전원: VCC · MR → 아래 + 줄, OE → 아래 − 줄, GND → 위 − 줄. 튜브 COM → 위 − 줄
  const jumpers = [
    mmWire(H(q("VCC"), "j"), bb.rail("bottom", "+", railCol(q("VCC"))), C.red),
    mmWire(H(q("MR"), "j"), bb.rail("bottom", "+", railCol(q("MR"))), C.red),
    mmWire(H(q("OE"), "j"), bb.rail("bottom", "-", railCol(q("OE"))), C.black),
    mmWire(H(q("GND"), "a"), bb.rail("top", "-", railCol(q("GND"))), C.black),
    mmWire(H(dg.com, "a"), bb.rail("top", "-", railCol(dg.com)), C.black),
    railLink(bb),
  ];
  [q("SI"), q("SCK"), q("RCK")].forEach((c) => bb.tint(c, "bottom"));
  return { parts, jumpers, hole: { SI: H(q("SI"), "j"), SCK: H(q("SCK"), "j"), RCK: H(q("RCK"), "j") }, cols: { SI: q("SI"), SCK: q("SCK"), RCK: q("RCK"), chip: [CHIP, CHIP + 7], seg: [SEG, SEG + 4] } };
}

/** 브레드보드를 S 배로 키워 (tx, ty) 에 둔다. 반환: 그룹 svg, 브레드보드 구멍 → 그림 좌표 변환, 아래 + − 줄 좌표 */
const S = 1.25;
function placed(tx, ty) {
  const bb = breadboard({ x: 0, y: 0, cols: 24, rails: { top: true, bottom: true } });
  const c = circuit(bb);
  const T = (p) => ({ x: tx + S * p.x, y: ty + S * p.y });
  const g = `<g transform="translate(${tx} ${ty}) scale(${S})">${[bb.svg, ...c.parts, ...c.jumpers].join("\n  ")}</g>`;
  return { g, T, bb, c, bottom: ty + S * bb.h, right: tx + S * bb.w };
}

function rowsFor(b, sig, cols, pw) {
  const pin = (p) => `${p.label}${b.id === "plus" ? "" : " 핀"}`;
  return [
    { color: C.yellow, part: pin(sig.SI), to: `칩 SI (${cols.SI}번 줄)` },
    { color: C.green, part: pin(sig.SCK), to: `칩 SCK (${cols.SCK}번 줄)` },
    { color: C.blue, part: pin(sig.RCK), to: `칩 RCK (${cols.RCK}번 줄)` },
    { color: C.red, part: `${pw.label} · 칩 VCC · MR`, to: "아래 + 줄" },
    { color: C.black, part: "GND · 칩 OE", to: "아래 − 줄 (위 − 줄과 점퍼로)" },
    { color: C.black, part: "칩 GND · 튜브 COM", to: "위 − 줄" },
    { color: "#5c636a", part: `칩 Q0~Q7 (${cols.chip[0]}~${cols.chip[1]}번 줄)`, to: `220Ω 하나씩 → 튜브 a~g · dp (${cols.seg[0]}~${cols.seg[1]}번 줄)` },
  ];
}

function plus() {
  const pl = placed(20, 8);
  const b = makePlus({ x: 49, y: pl.bottom + 24 });
  const { T, bb, c } = pl;
  const sig = { SI: b.gpio(5), SCK: b.gpio(18), RCK: b.gpio(23) };
  const v5 = b.power("5V"), gnd = b.power("GND");
  const wires = [
    mfWire(sig.SI, T(c.hole.SI), C.yellow), mfWire(sig.SCK, T(c.hole.SCK), C.green), mfWire(sig.RCK, T(c.hole.RCK), C.blue),
    mfWire(v5, T(bb.rail("bottom", "+", 2)), C.red), mfWire(gnd, T(bb.rail("bottom", "-", 3)), C.black),
  ];
  const table = connectionTable(b.bounds.y + b.bounds.h + 16, "이렇게 꽂아요 — 칩은 반달 홈이 그림과 같은 쪽", rowsFor(b, sig, c.cols, v5), b.legend);
  return { body: compose(b.draw([sig.SI, sig.SCK, sig.RCK, v5, gnd]), [pl.g], wires, [table.svg]), height: table.bottom };
}

function devkit() {
  const pl = placed(20, 8);
  const b = makeDevkit({ x: 130, y: pl.bottom + 30 });
  const { T, bb, c } = pl;
  const sig = { SI: b.gpio(5), SCK: b.gpio(18), RCK: b.gpio(23) };
  const vin = b.power("5V"), gnd = b.power("GND", 0);
  const { y, h } = b.bounds;
  // 아래 줄 D5 · D18 · D23 → 보드 아래로 나가 보드 왼쪽 바깥으로 돌아 올라온다 (보드에서 가까운 D5 가 안쪽 고리)
  const route = (p, hole, k, color) => {
    const yb = y + h + 12 + k * 10, xo = 44 - k * 10, yt = y - 18 - k * 6;
    return mfWire(p, hole, color, [{ x: p.x, y: yb }, { x: xo, y: yb }, { x: xo, y: yt }, { x: hole.x, y: yt }], "orth");
  };
  // VIN · GND 는 신호 고리보다 보드 가까이에서 오른쪽으로 가 + − 줄 13 · 14번 칸에 (고리와 겹치지 않게)
  const pw = (p, rail, ly, color) => mfWire(p, rail, color, [{ x: p.x, y: ly }, { x: rail.x, y: ly }], "orth");
  const wires = [
    route(sig.SI, T(c.hole.SI), 0, C.yellow), route(sig.SCK, T(c.hole.SCK), 1, C.green), route(sig.RCK, T(c.hole.RCK), 2, C.blue),
    pw(vin, T(bb.rail("bottom", "+", 13)), y - 10, C.red), pw(gnd, T(bb.rail("bottom", "-", 14)), y - 4, C.black),
  ];
  const table = connectionTable(y + h + 48, "이렇게 꽂아요 — 칩은 반달 홈이 그림과 같은 쪽", rowsFor(b, sig, c.cols, vin), b.legend);
  return { body: compose(b.draw([sig.SI, sig.SCK, sig.RCK, vin, gnd]), [pl.g], wires, [table.svg]), height: table.bottom };
}

const T = {
  plus: "7세그먼트 배선도(ESP32 Plus 확장 보드): 74HC595 칩은 브레드보드 4~11번 줄에서 가운데 홈을 건너 꽂고 반달 홈은 튜브 쪽. 보드 위쪽 io5 → 칩 SI(9번 줄), io18 → SCK(6번 줄), io23 → RCK(7번 줄). 보드 5V → 아래 + 줄, GND → 아래 − 줄. 칩 VCC · MR → + 줄, OE → − 줄, 칩 GND → 위 − 줄. 칩 Q0~Q7 은 220Ω 저항을 하나씩 거쳐 17~21번 줄의 디지털 튜브 a~g · dp 로(Q0→a, Q1→b, Q2→c, Q3→d, Q4→e, Q5→f, Q6→g, Q7→dp). 튜브 COM → 위 − 줄, 위 − 줄과 아래 − 줄은 점퍼로",
  devkit: "기본 보드(ESP32 DevKit V1 30핀) 7세그먼트 배선도: 74HC595 칩은 브레드보드 4~11번 줄에서 가운데 홈을 건너 꽂고 반달 홈은 튜브 쪽. 아래 줄 D5 → 칩 SI(9번 줄), D18 → SCK(6번 줄), D23 → RCK(7번 줄) — 세 선은 보드 아래로 돌아와요. 보드 VIN(5V) → 아래 + 줄, GND → 아래 − 줄. 칩 VCC · MR → + 줄, OE → − 줄, 칩 GND → 위 − 줄. 칩 Q0~Q7 은 220Ω 저항을 하나씩 거쳐 17~21번 줄의 디지털 튜브 a~g · dp 로(Q0→a, Q1→b, Q2→c, Q3→d, Q4→e, Q5→f, Q6→g, Q7→dp). 튜브 COM → 위 − 줄, 위 − 줄과 아래 − 줄은 점퍼로",
};

export default {
  "wiring-breadboard.svg": {
    plus: () => { const r = plus(); return svgDoc("wsg", T.plus, r.body, r.height); },
    devkit: () => { const r = devkit(); return svgDoc("wsgk", T.devkit, r.body, r.height); },
  },
};
