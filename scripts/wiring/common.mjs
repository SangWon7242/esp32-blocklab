/*
 * 배선도 공통 도구: 문서 틀, 글자, 선(F-F · M-F · M-M 듀폰선), 연결 표.
 * 보드 그림은 boards/plus.mjs(ESP32 Plus 확장 보드) · boards/devkit.mjs(기본 보드 DevKit V1 30핀),
 * 부품은 parts.mjs. 챕터 명세는 chapters/<id>.mjs (README.md 참고).
 *
 * 그림 규칙: 폭 640(글자 크기가 다른 그림과 같게), 높이는 내용에 맞춤, role="img" + <title>, 글자 12px 이상, 이모지 없음.
 */

export const W = 640;

export const COLORS = {
  red: "#e03131", black: "#343a40", yellow: "#f59f00", green: "#2f9e44", blue: "#1971c2", purple: "#7048e8",
  orange: "#f76707", brown: "#8b5a2b", white: "#adb5bd", pink: "#d6336c", teal: "#0c8599",
};

export const HALO = `stroke="#1d1d1f" stroke-width="4" paint-order="stroke"`;
export const WHITE_TEXT = `font-weight="700" fill="#ffffff" ${HALO}`;

/** 흰 바탕 위 글자 (모듈 이름 등) */
export const name = (x, y, s, anchor = "middle", size = 15) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-size="${size}" font-weight="700" fill="currentColor" stroke="none">${s}</text>`;
/** 작은 설명 글 (부품 옆 "긴 다리(+)" 등) */
export const note = (x, y, s, anchor = "start", size = 13) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-size="${size}" fill="currentColor" stroke="none">${s}</text>`;
/** 세로 흰 글자 — 아래 끝이 (x, yBottom). dim 이면 흐리게 */
export const vtext = (x, yBottom, s, dim = false, size = 13) =>
  `<text x="${x}" y="${yBottom}" transform="rotate(-90 ${x} ${yBottom})" dominant-baseline="central" font-size="${size}" ${WHITE_TEXT} opacity="${dim ? 0.55 : 1}">${s}</text>`;
/** 세로 흰 글자 — 위 끝이 (x, yTop) */
export const vtextDown = (x, yTop, s, dim = false, size = 13) =>
  `<text x="${x}" y="${yTop}" transform="rotate(-90 ${x} ${yTop})" text-anchor="end" dominant-baseline="central" font-size="${size}" ${WHITE_TEXT} opacity="${dim ? 0.55 : 1}">${s}</text>`;
export const htext = (x, y, s, size = 13, anchor = "middle", dim = false) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-size="${size}" ${WHITE_TEXT} opacity="${dim ? 0.55 : 1}">${s}</text>`;

/** 선 길 만들기. 모양: "vv"(세로로 나가 세로로 들어감) · "hv"(가로로 나가 세로로 들어감) · "orth"(점들을 직각 선으로) · "line" */
export function wirePath(from, to, via = [], style = "vv") {
  const pts = [from, ...via, to];
  let d = `M${from.x} ${from.y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const my = (a.y + b.y) / 2;
    if (style === "orth" || style === "line" || i < pts.length - 1) d += ` L${b.x} ${b.y}`;
    else if (style === "hv") d += ` C${(a.x + b.x) / 2} ${a.y} ${b.x} ${a.y} ${b.x} ${b.y}`;
    else if (style === "vh") d += ` C${a.x} ${(a.y + b.y) / 2} ${(a.x + b.x) / 2} ${b.y} ${b.x} ${b.y}`;
    else d += ` C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
  }
  return d;
}

/** 선 끝 모양: "f" 구멍 머리(핀에 씌움) · "m" 핀 끝(구멍에 꽂음) */
const end = (p, kind, color) =>
  kind === "m"
    ? `<rect x="${p.x - 4}" y="${p.y - 9}" width="8" height="12" rx="1.5" fill="#212529" stroke="${color}" stroke-width="2"/><rect x="${p.x - 1.5}" y="${p.y - 2}" width="3" height="5" fill="#ced4da" stroke="none"/>`
    : `<rect x="${p.x - 6}" y="${p.y - 8}" width="12" height="16" rx="2" fill="#212529" stroke="${color}" stroke-width="2.5"/>`;

/**
 * 듀폰선 하나. ends = [시작 끝, 끝 끝] 각각 "f"(구멍) 또는 "m"(핀).
 * F-F: 모듈 핀 ↔ 보드 핀. M-F: 보드 핀(f) ↔ 브레드보드 구멍(m). M-M: 브레드보드 안.
 * 흰 테두리로 검은 보드 위에서도 보인다.
 */
export function wire(from, to, color, { via = [], style = "vv", ends = ["f", "f"] } = {}) {
  const d = wirePath(from, to, via, style);
  return `<path d="${d}" stroke="#ffffff" stroke-width="7.5" stroke-opacity="0.9"/><path d="${d}" stroke="${color}" stroke-width="4"/>\n  ${end(from, ends[0], color)}${end(to, ends[1], color)}`;
}
export const ffWire = (from, to, color, via = [], style = "vv") => wire(from, to, color, { via, style, ends: ["f", "f"] });
/** 보드 핀(구멍 머리) → 브레드보드 구멍(핀 끝) */
export const mfWire = (boardPin, hole, color, via = [], style = "vv") => wire(boardPin, hole, color, { via, style, ends: ["f", "m"] });
/** 브레드보드 구멍 ↔ 구멍 (점퍼선 M-M) */
export const mmWire = (a, b, color, via = [], style = "vv") => wire(a, b, color, { via, style, ends: ["m", "m"] });

/** 핀 색 (실물 보드와 같다): 신호 노랑, 전원 빨강(+), 접지 검정(−) */
export const PIN_FILL = { one: "#f5c518", S: "#f5c518", V: "#e03131", G: "#495057", SCL: "#f8f9fa" };

/**
 * 아래 연결 표: rows = [{ color | colors, part, to }] 를 두 칸으로, 맨 아래 핀 색 뜻과 노란 테두리 뜻.
 * legend: "plus"(S·V·G 뜻까지) · "devkit"(노란 테두리 뜻만). 반환 { svg, bottom }.
 */
export function connectionTable(y, title, rows, legend = "plus", { columns } = {}) {
  const out = [];
  const colW = 300, rowH = 24, x0 = 20;
  // 글이 길면 한 칸으로 (두 칸이면 한 줄에 약 24자)
  const cols = columns ?? (rows.some((r) => `${r.part} → ${r.to}`.length > 24) ? 1 : 2);
  const half = cols === 1 ? rows.length : Math.ceil(rows.length / 2);
  out.push(`<path d="M${x0} ${y} H${W - x0}" stroke="currentColor" stroke-opacity="0.2" stroke-width="1"/>`);
  out.push(`<text x="${x0}" y="${y + 18}" dominant-baseline="central" font-size="15" font-weight="700" fill="currentColor" stroke="none">${title}</text>`);
  rows.forEach((r, i) => {
    const cx = x0 + (i < half ? 0 : colW + 10);
    const cy = y + 44 + (i % half) * rowH;
    const cs = r.colors ?? [r.color];
    // 견본 뒤에 옅은 회색 테두리: 검은 선 견본도 어두운 화면에서 보이게
    out.push(`<rect x="${cx - 4}" y="${cy - 3 - cs.length * 3}" width="32" height="${cs.length * 6 + 6}" rx="4" fill="#f1f3f5" stroke="#adb5bd" stroke-width="1"/>`);
    cs.forEach((c, k) => out.push(`<path d="M${cx} ${cy - (cs.length - 1) * 3 + k * 6} h24" stroke="${c}" stroke-width="${cs.length > 1 ? 4 : 5}"/>`));
    out.push(`<text x="${cx + 34}" y="${cy}" dominant-baseline="central" font-size="14" fill="currentColor" stroke="none"><tspan font-weight="700">${r.part}</tspan> → ${r.to}</text>`);
  });
  const ly = y + 44 + half * rowH + 6;
  const chip = (cx, fill, label) => `<rect x="${cx}" y="${ly - 7}" width="14" height="14" rx="2.5" fill="${fill}" stroke="none"/><text x="${cx + 20}" y="${ly}" dominant-baseline="central" font-size="13" fill="currentColor" stroke="none">${label}</text>`;
  let mx = x0;
  if (legend === "plus") {
    out.push(chip(x0, PIN_FILL.S, "S 신호"), chip(x0 + 92, PIN_FILL.V, "V 전원(+)"), chip(x0 + 204, PIN_FILL.G, "G 접지(−)"));
    mx = x0 + 316;
  }
  out.push(`<rect x="${mx}" y="${ly - 8}" width="16" height="16" rx="3" fill="none" stroke="#ffd43b" stroke-width="3"/><text x="${mx + 24}" y="${ly}" dominant-baseline="central" font-size="13" fill="currentColor" stroke="none">이번에 꽂는 핀 (흐린 핀은 안 써요)</text>`);
  return { svg: out.join("\n  "), bottom: ly + 16 };
}

export function svgDoc(idPrefix, title, body, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Math.ceil(height)}" role="img" aria-labelledby="${idPrefix}-title" font-family="inherit" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <title id="${idPrefix}-title">${title}</title>
  ${body}
</svg>
`;
}

/** 보드 + 모듈 + 선을 겹 순서대로: 보드 판·핀 → 모듈·부품 → 선 → 보드 글자(선 위에서도 읽히게) → 노란 테두리 → 표 */
export function compose(b, modules, wires, extra = []) {
  return [b.base, ...modules, ...wires, b.labels, b.marks, ...extra].join("\n  ");
}
