// 3D 배선 보기용 장면 기록. build.mjs 가 그림 하나를 그리는 동안 켜 두면,
// 보드·브레드보드·부품·선·연결 표가 SVG 와 같은 좌표(px)로 모인다 → <이름>.3d.json
let scene = null;
const r1 = (n) => Math.round(n * 10) / 10;
export const pt = (p) => ({ x: r1(p.x), y: r1(p.y) });
// 부품 함수가 돌려준 SVG 조각들. compose() 가 받은 조각 가운데 여기에 없는 것(챕터가 손으로 그린 그림)이 있으면
// 3D 로는 그 부품이 빠지게 되므로 장면을 내지 않는다(unsupported).
let known = new Set();
export function startScene() {
  scene = { boards: [], breadboards: [], parts: [], wires: [], rows: [], title: "", composed: false, unsupported: false };
  known = new Set();
}
/** 부품 · 선의 SVG 조각을 "3D 로 그릴 줄 아는 것" 으로 적어 두고 그대로 돌려준다 */
export function mark(svg) {
  if (scene) known.add(svg);
  return svg;
}
/** compose() 가 부른다: 조각마다 아는 것인지(또는 글자뿐인지) 본다 */
export function checkPieces(pieces) {
  if (!scene) return;
  scene.composed = true;
  for (const piece of pieces) {
    if (known.has(piece) || /^\s*(<text\b[^>]*>[^<]*<\/text>\s*)*$/.test(piece)) continue;
    scene.unsupported = true;
    if (process.env.WIRING_DEBUG) console.error("UNKNOWN:", piece.replace(/\s+/g, " ").slice(0, 160));
  }
}
export function rec(kind, item) {
  if (scene) scene[kind].push(item);
}
/** 지금까지 기록된 브레드보드 · 부품 · 선의 수 (moveSince 와 함께 쓴다) */
export function recCount() {
  return scene ? { breadboards: scene.breadboards.length, parts: scene.parts.length, wires: scene.wires.length } : null;
}
/**
 * since(recCount 의 값) 뒤로 기록된 것들을 SVG 의 transform="translate(tx ty) scale(s)" 처럼 옮긴다.
 * 그룹을 키워 그린 그림(예: 6장 브레드보드)도 3D 좌표가 그림과 같게.
 */
export function moveSince(since, tx, ty, s) {
  if (!scene || !since) return;
  const X = (x) => r1(tx + s * x), Y = (y) => r1(ty + s * y), L = (n) => r1(s * n);
  const move = (v) => {
    if (Array.isArray(v)) return v.map(move);
    if (!v || typeof v !== "object") return v;
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === "x" && typeof val === "number") o[k] = X(val);
      else if (k === "y" && typeof val === "number") o[k] = Y(val);
      else if ((k === "w" || k === "h") && typeof val === "number") o[k] = L(val);
      else if (k === "holes" && Array.isArray(val) && Array.isArray(val[0])) o[k] = val.map(([hx, hy]) => [X(hx), Y(hy)]);
      else if (k === "xs") o[k] = val.map(X);
      else if (k === "gap") o[k] = val.map(Y);
      else o[k] = move(val);
    }
    return o;
  };
  for (const kind of ["breadboards", "parts", "wires"]) {
    for (let i = since[kind]; i < scene[kind].length; i++) scene[kind][i] = move(scene[kind][i]);
  }
}
export function recTitle(title) {
  if (scene) scene.title = title;
}
export function endScene() {
  const s = scene;
  scene = null;
  return s;
}
