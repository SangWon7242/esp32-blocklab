import type { Part3D, Pt, Scene3D } from "@/track/wiring3d";

/*
 * 조립 순서: 복잡한 배선을 실제로 꽂는 차례대로 한 단계씩 보여 준다.
 *   1. 보드와 브레드보드를 놓는다
 *   2. 전원 줄: 보드 전원 핀 ↔ + − 줄, + − 줄끼리 잇는 선 (부품에 닿지 않는 선)
 *   3. 부품 묶음마다: 그 부품을 꽂고, 그 부품에 닿는 선을 잇는다
 * 부품 묶음 = 브레드보드의 같은 다섯 칸 줄을 함께 쓰는 부품들 (예: LED 와 그 앞의 저항). + − 줄은 묶지 않는다.
 * 선은 두 끝이 닿는 묶음 가운데 나중 것에 둔다 (두 부품이 다 놓인 뒤에 잇게).
 */

export type AssemblyStep = {
  title: string;
  /** 이 단계에서 잇는 선마다 한 줄: 색 이름과 두 끝 */
  lines: { color: string; text: string }[];
  /** 이 단계에서 꽂는 부품 (scene.parts 번호) */
  parts: number[];
  /** 이 단계에서 잇는 선 (scene.wires 번호) */
  wires: number[];
};

export type Assembly = {
  steps: AssemblyStep[];
  /** 부품 · 선이 처음 나오는 단계 */
  partStep: number[];
  wireStep: number[];
};

const COLOR_NAME: Record<string, string> = {
  "#e03131": "빨강", "#343a40": "검정", "#f59f00": "노랑", "#2f9e44": "초록", "#1971c2": "파랑", "#7048e8": "보라",
  "#f76707": "주황", "#8b5a2b": "갈색", "#adb5bd": "흰색", "#d6336c": "분홍", "#0c8599": "청록", "#5c940d": "연두",
};
export const colorName = (c: string) => COLOR_NAME[c.toLowerCase()] ?? "";

const near = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 1.5 && Math.abs(a.y - b.y) < 1.5;
const inBox = (p: Pt, r: { x: number; y: number; w: number; h: number }, pad = 0) =>
  p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

/** 부품 이름 (단계 제목) */
export function partName(p: Part3D): string {
  switch (p.type) {
    case "led": return "LED";
    case "resistor": return p.label ? `${p.label} 저항` : "저항";
    case "button": return "버튼";
    case "buzzer": return "부저";
    case "pot": return "가변저항";
    case "photo": return "빛 센서";
    case "tilt": return "기울기 스위치";
    case "rgb": return "RGB LED";
    case "irrx": return "IR 수신기";
    case "dip": return p.label ? `${p.label} 칩` : "칩";
    case "servo": return "서보 모터";
    case "module": return p.title || "모듈";
    case "touch": return p.label && p.label.length > 2 ? p.label : `호일 패드${p.label ? ` ${p.label}` : ""}`;
    case "seg7": return "7세그먼트";
    case "prop": return p.label ?? (p.kind === "battery" ? "건전지 상자" : "전원 플러그");
  }
}

export function buildAssembly(scene: Scene3D): Assembly {
  // 브레드보드 구멍 → 다섯 칸 줄 · 이름
  type Hole = { strip: string; name: string };
  const holes: { p: Pt; h: Hole }[] = [];
  const rails: { p: Pt; name: string }[] = [];
  scene.breadboards.forEach((bb, bi) => {
    const xs = [...new Set(bb.holes.map(([x]) => Math.round(x)))].sort((a, b) => a - b);
    const ys = [...new Set(bb.holes.map(([, y]) => Math.round(y)))].sort((a, b) => a - b);
    const letters = ys.length <= 5 ? "fghij" : "abcdefghij";
    const mid = (bb.gap[0] + bb.gap[1]) / 2;
    const split = bb.gap[1] > bb.gap[0];
    for (const [x, y] of bb.holes) {
      const col = xs.indexOf(Math.round(x)) + 1;
      const letter = letters[ys.indexOf(Math.round(y))] ?? "";
      holes.push({ p: { x, y }, h: { strip: `${bi}:${Math.round(x)}:${split && y > mid ? "lo" : "hi"}`, name: `${col}번 줄 ${letter}칸` } });
    }
    const cy = bb.y + bb.h / 2;
    for (const r of bb.rails) {
      const name = `${r.y < cy ? "위" : "아래"} ${r.plus ? "+" : "−"} 줄`;
      for (const x of r.xs) rails.push({ p: { x, y: r.y }, name });
    }
  });
  const holeAt = (p: Pt) => holes.find((q) => near(q.p, p))?.h;
  const railAt = (p: Pt) => rails.find((q) => near(q.p, p))?.name;
  const pinAt = (p: Pt) => scene.boards.flatMap((b) => b.pins).find((q) => near(q, p));

  // 부품마다 닿는 점
  const pointsOf = (p: Part3D): Pt[] => {
    switch (p.type) {
      case "led": return [p.a, p.c];
      case "resistor": case "buzzer": case "photo": case "tilt": return [p.a, p.b];
      case "button": case "pot": case "rgb": case "irrx": case "seg7": return p.legs;
      case "dip": return holes.filter((q) => q.p.x >= p.l.x - 1 && q.p.x <= p.r.x + 1 && (Math.abs(q.p.y - p.l.y) < 1.5 || Math.abs(q.p.y - p.r.y) < 1.5)).map((q) => q.p);
      case "servo": return p.plug;
      case "module": return p.pins;
      case "touch": return [p.clip];
      case "prop": return [];
    }
  };
  const partPts = scene.parts.map(pointsOf);

  // 같은 다섯 칸 줄을 쓰는 부품끼리 한 묶음
  const parent = scene.parts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  const stripsOf = (i: number) => [...new Set(partPts[i].flatMap((p) => holeAt(p)?.strip ?? []))];
  const isRes = (i: number) => scene.parts[i].type === "resistor";
  // 1) 저항이 아닌 부품끼리
  const owner = new Map<string, number>();
  scene.parts.forEach((_, i) => {
    if (isRes(i)) return;
    for (const s of stripsOf(i)) {
      const o = owner.get(s);
      if (o === undefined) owner.set(s, i);
      else join(i, o);
    }
  });
  // 2) 저항은 닿은 부품 묶음 가운데 나중 것에 (칩 → 저항 → 7세그먼트면 7세그먼트와 함께). 부품에 안 닿은 저항끼리는 서로 묶는다
  const resOwner = new Map<string, number>();
  scene.parts.forEach((_, i) => {
    if (!isRes(i)) return;
    const touched = stripsOf(i).flatMap((s) => (owner.has(s) ? [find(owner.get(s)!)] : []));
    if (touched.length) {
      const later = touched.reduce((a, b) => (a > b ? a : b));
      parent[i] = later;
      return;
    }
    for (const s of stripsOf(i)) {
      const o = resOwner.get(s);
      if (o === undefined) resOwner.set(s, i);
      else join(i, o);
    }
  });
  const roots = [...new Set(scene.parts.map((_, i) => find(i)))].sort((a, b) => a - b);
  const groups = roots.map((r) => scene.parts.flatMap((_, i) => (find(i) === r ? [i] : [])));
  const groupOfPart = (i: number) => groups.findIndex((g) => g.includes(i));

  // 선 끝이 닿는 부품 묶음
  const touch = (p: Pt): number[] => {
    const out = new Set<number>();
    const h = holeAt(p);
    scene.parts.forEach((part, i) => {
      if (part.type === "prop") { if (inBox(p, part, 12)) out.add(groupOfPart(i)); return; }
      for (const q of partPts[i]) {
        if (near(q, p) || (h && holeAt(q)?.strip === h.strip)) { out.add(groupOfPart(i)); return; }
      }
    });
    return [...out];
  };

  // 끝 이름: 보드 핀 · 모듈 핀 · 브레드보드 줄
  const endName = (p: Pt): string => {
    const pin = pinAt(p);
    if (pin) return pin.label.replace(/ \(.*\)$/, "");
    for (const part of scene.parts) {
      if (part.type === "module") { const q = part.pins.find((m) => near(m, p)); if (q) return `${part.title || "모듈"} ${q.name}`; }
      if (part.type === "servo") { const k = part.plug.findIndex((m) => near(m, p)); if (k >= 0) return `서보 ${["G", "V", "S"][k]}`; }
      if (part.type === "touch" && near(part.clip, p)) return partName(part);
      if (part.type === "prop" && inBox(p, part, 12)) return partName(part);
    }
    return railAt(p) ?? holeAt(p)?.name ?? "브레드보드";
  };

  const wireGroup = scene.wires.map((w) => {
    const gs = [...touch(w.from), ...touch(w.to)];
    return gs.length ? Math.max(...gs) : -1;
  });

  const lineOf = (k: number) => {
    const w = scene.wires[k];
    const name = colorName(w.color);
    return { color: w.color, text: `${name ? `${name} 선` : "선"}: ${endName(w.from)} ↔ ${endName(w.to)}` };
  };

  const steps: AssemblyStep[] = [{ title: "보드와 브레드보드를 놓아요", lines: [], parts: [], wires: [] }];
  const power = scene.wires.flatMap((_, k) => (wireGroup[k] < 0 ? [k] : []));
  if (power.length) steps.push({ title: "전원 줄을 이어요", lines: power.map(lineOf), parts: [], wires: power });
  groups.forEach((g, gi) => {
    // 주인공 부품 먼저, 저항은 뒤에 (여럿이면 "저항 3개")
    const count = new Map<string, number>();
    const main = g.filter((i) => !isRes(i)), res = g.filter(isRes);
    for (const i of main) { const n = partName(scene.parts[i]); count.set(n, (count.get(n) ?? 0) + 1); }
    if (res.length === 1) count.set(partName(scene.parts[res[0]]), 1);
    else if (res.length > 1) {
      const vals = new Set(res.map((i) => partName(scene.parts[i])));
      if (vals.size === 1) count.set([...vals][0], res.length);
      else count.set(main.length ? "저항" : [...vals].join(" · "), main.length ? res.length : 1);
    }
    const title = [...count].map(([n, c]) => (c > 1 ? `${n} ${c}개` : n)).join(" · ");
    const wires = scene.wires.flatMap((_, k) => (wireGroup[k] === gi ? [k] : []));
    steps.push({ title, lines: wires.map(lineOf), parts: g, wires });
  });

  const partStep = scene.parts.map((_, i) => steps.findIndex((s) => s.parts.includes(i)));
  const wireStep = scene.wires.map((_, k) => steps.findIndex((s) => s.wires.includes(k)));
  return { steps, partStep, wireStep };
}
