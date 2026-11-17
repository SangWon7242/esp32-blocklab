import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Pt, Scene3D } from "@/track/wiring3d";
import { Box, Tube } from "./kit";
import { BB_H, inRect, type Layout } from "./layout";
import { COLOR, noOutline, toon, toonOwn } from "./materials";
import { useViewerApi } from "./store";
import { TEXT } from "./texts";

/*
 * 듀폰선: 양 끝에서 곧게 올라와 둥글게 넘어간다. 길수록, 뒤에 그린 선일수록 조금 더 높이(겹치지 않게).
 * 전기 흐름: 실행 중에 LED 를 켠 핀에서 출발해 선 → 저항 → LED → GND 로 빛 알갱이가 달린다.
 */

type Wire = Scene3D["wires"][number];
const plug = (end: "f" | "m") => (end === "f" ? 14 : 10);

/** 선 한 가닥의 길 (전기가 GND 쪽으로 가도록 방향을 맞춘 것은 chains 가 정한다) */
export function wirePoints(w: Wire, i: number, L: Layout): THREE.Vector3[] {
  const y0 = L.topAt(w.from), y1 = L.topAt(w.to);
  const dist = Math.hypot(w.to.x - w.from.x, w.to.y - w.from.y);
  const lift = 22 + Math.min(70, dist * 0.28) + (i % 3) * 5;
  const a0 = L.v(w.from, y0 + plug(w.ends[0])), b0 = L.v(w.to, y1 + plug(w.ends[1]));
  const peak = Math.max(a0.y, b0.y) + lift;
  const a1 = a0.clone().setY(a0.y + lift * 0.45), b1 = b0.clone().setY(b0.y + lift * 0.45);
  const mid = a0.clone().add(b0).multiplyScalar(0.5).setY(peak);
  const qa = a0.clone().lerp(b0, 0.22).setY(peak - lift * 0.12), qb = a0.clone().lerp(b0, 0.78).setY(peak - lift * 0.12);
  return [a0, a1, qa, mid, qb, b1, b0];
}

export function WireView({ w, i, L, scene }: { w: Wire; i: number; L: Layout; scene: Scene3D }) {
  const api = useViewerApi();
  const pts = useMemo(() => wirePoints(w, i, L), [w, i, L]);
  const mat = useMemo(() => toonOwn({ color: w.color, transparent: true }), [w.color]);
  const head = useMemo(() => toonOwn({ color: COLOR.plastic, transparent: true }), []);
  useEffect(() => () => { mat.dispose(); head.dispose(); }, [mat, head]);
  const row = scene.rows.find((r) => r.colors.includes(w.color));
  useFrame(() => {
    const s = api.getState();
    const color = s.preview ?? s.hover?.wire ?? s.picked;
    // 조립 순서: 지금 잇는 선은 또렷하게, 앞 단계에서 이은 선은 옅게
    const now = s.step !== null && s.assembly ? s.assembly.wireStep[i] === s.step : null;
    const on = now ?? (color === null || color === w.color);
    for (const m of [mat, head]) {
      const op = on ? 1 : now === false ? 0.28 : 0.12;
      if (m.opacity !== op) { m.opacity = op; m.depthWrite = on; m.userData.outlineParameters = { visible: on }; s.invalidate(); }
    }
  });
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const s = api.getState();
    if (s.dragging) return;
    s.set({ hover: { id: `wire${i}`, label: row ? row.part : "선", text: row ? `→ ${row.to}` : TEXT.wire, wire: w.color } });
    s.invalidate();
  };
  const out = () => {
    const s = api.getState();
    if (s.hover?.id === `wire${i}`) { s.set({ hover: null }); s.invalidate(); }
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    const s = api.getState();
    s.set({ picked: s.picked === w.color ? null : w.color, selected: null });
    s.invalidate();
  };
  const ends = ([[w.from, w.ends[0]], [w.to, w.ends[1]]] as const).map(([p, end]) => ({ p, end, y: L.topAt(p) }));
  return (
    <group onPointerOver={over} onPointerOut={out} onClick={click}>
      <Tube points={pts} radius={3} mat={mat} />
      {ends.map(({ p, end, y }, k) => {
        const h = plug(end);
        return (
          <group key={k}>
            <Box size={end === "f" ? [10, h, 10] : [6, h, 6]} at={[L.X(p.x), y + h / 2 + 0.5, L.Zp(p)]} mat={head} />
            {end === "m" && <Box size={[1.6, 5, 1.6]} at={[L.X(p.x), y - 1.5, L.Zp(p)]} mat={toon(COLOR.leg, { outline: false })} />}
          </group>
        );
      })}
    </group>
  );
}

/* ───────────── 전기 흐름 ───────────── */

export type Chain = { part: number; curves: THREE.Curve<THREE.Vector3>[]; pin: THREE.Vector3; pinNumber?: number; toLed: number; total: number };

/** LED 회로마다: 핀 → 선 → 저항 → LED → (점퍼 → − 줄) → GND. 길을 다 찾지 못한 LED 는 빠진다 */
export function ledChains(scene: Scene3D, L: Layout): Chain[] {
  const mids = scene.breadboards.map((bb) => ({ bb, mid: (bb.gap[0] + bb.gap[1]) / 2 }));
  const sameStrip = (a: Pt, b: Pt) => {
    if (Math.abs(a.x - b.x) >= 1) return false;
    const m = mids.find(({ bb }) => inRect(a, bb) && inRect(b, bb));
    return Boolean(m) && (m!.bb.gap[1] <= m!.bb.gap[0] || (a.y < m!.mid) === (b.y < m!.mid));
  };
  const near = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;
  const pinAt = (p: Pt) => scene.boards.flatMap((b) => b.pins).find((q) => near(p, q));
  const isGnd = (p: Pt) => Boolean(pinAt(p) && /GND|\bG$/.test(pinAt(p)!.label));
  const isMinusRail = (p: Pt) => scene.breadboards.some((bb) => bb.rails.some((r) => !r.plus && Math.abs(r.y - p.y) < 1));
  const sameRail = (a: Pt, b: Pt) => isMinusRail(a) && isMinusRail(b) && Math.abs(a.y - b.y) < 1;
  const curveOf = (pts: THREE.Vector3[], t = 0.5) => new THREE.CatmullRomCurve3(pts, false, "catmullrom", t);
  const wireCurve = (k: number, fromEnd: Pt) => {
    const pts = wirePoints(scene.wires[k], k, L);
    return curveOf(near(scene.wires[k].from, fromEnd) || sameStrip(scene.wires[k].from, fromEnd) ? pts : [...pts].reverse());
  };
  const resistors = scene.parts.flatMap((p, i) => (p.type === "resistor" ? [{ p, i }] : []));
  const out: Chain[] = [];
  scene.parts.forEach((led, part) => {
    if (led.type !== "led") return;
    const r = resistors.find(({ p }) => sameStrip(p.a, led.a) || sameStrip(p.b, led.a))?.p;
    const entry = r ? (sameStrip(r.a, led.a) ? r.b : r.a) : led.a;
    const wi = scene.wires.findIndex((w) => (sameStrip(w.to, entry) && pinAt(w.from) && !isGnd(w.from)) || (sameStrip(w.from, entry) && pinAt(w.to) && !isGnd(w.to)));
    if (wi < 0) return;
    const w = scene.wires[wi];
    const pinPt = pinAt(w.from) && !isGnd(w.from) ? w.from : w.to;
    const curves: THREE.Curve<THREE.Vector3>[] = [wireCurve(wi, pinPt)];
    if (r) {
      const y = BB_H + 7;
      const [s, e] = sameStrip(r.b, led.a) ? [r.a, r.b] : [r.b, r.a];
      curves.push(curveOf([L.v(s, BB_H), L.v(s, y), L.v(e, y), L.v(e, BB_H)], 0.05));
    }
    const headY = BB_H + 28;
    const mid = { x: (led.a.x + led.c.x) / 2, y: (led.a.y + led.c.y) / 2 };
    const topOf = (p: Pt) => new THREE.Vector3(L.X(mid.x + (p.x - mid.x) * 0.45), headY, L.Zp(mid));
    const toLed = curves.reduce((n, c) => n + c.getLength(), 0);
    curves.push(curveOf([L.v(led.a, BB_H), L.v(led.a, BB_H + 12), topOf(led.a), topOf(led.c), L.v(led.c, BB_H + 12), L.v(led.c, BB_H)], 0.2));
    const oi = scene.wires.findIndex((x) => sameStrip(x.from, led.c) || sameStrip(x.to, led.c));
    if (oi >= 0) {
      const o = scene.wires[oi];
      const startEnd = sameStrip(o.from, led.c) ? o.from : o.to;
      curves.push(wireCurve(oi, startEnd));
      const far = startEnd === o.from ? o.to : o.from;
      if (!isGnd(far)) {
        const gi = scene.wires.findIndex((x, k) => k !== oi && ((sameRail(x.from, far) && isGnd(x.to)) || (sameRail(x.to, far) && isGnd(x.from))));
        if (gi >= 0) {
          const g = scene.wires[gi];
          curves.push(wireCurve(gi, isGnd(g.from) ? g.to : g.from));
        }
      }
    }
    out.push({ part, curves, pin: L.v(pinPt, L.topAt(pinPt) + 2), toLed, total: curves.reduce((n, c) => n + c.getLength(), 0) });
  });
  return out;
}

/** 실행 중: 켜진 LED 마다 핀에서 알갱이가 출발해 흐르고, 핀이 켜지는 순간 핀 둘레에 파란 고리가 퍼진다 */
export function Flow({ chains, ledPins }: { chains: Chain[]; ledPins: Record<number, number> }) {
  const api = useViewerApi();
  const dots = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.Group>(null);
  const PER = 24;
  const mat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: "#ffe066", depthTest: false })), []);
  const ringMat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: COLOR.signal, transparent: true, depthTest: false, depthWrite: false })), []);
  useEffect(() => () => { mat.dispose(); ringMat.dispose(); }, [mat, ringMat]);
  // 회로마다: 켜진 뒤 지난 시간 (꺼지면 -1)
  const since = useRef<number[]>(chains.map(() => -1));
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const s = api.getState();
    const m = dots.current;
    if (!m) return;
    const out = s.running && s.sim ? s.sim.outputs.pins : null;
    let k = 0;
    const mx = new THREE.Matrix4();
    chains.forEach((c, ci) => {
      const pin = ledPins[c.part];
      const lit = out !== null && pin !== undefined && (out[pin] ?? 0) > 0.02;
      since.current[ci] = lit ? Math.max(0, since.current[ci]) + dt : -1;
      const ring = rings.current?.children[ci] as THREE.Mesh | undefined;
      if (ring) {
        const t = since.current[ci];
        ring.visible = t >= 0 && t < 0.6;
        if (ring.visible) {
          ring.position.copy(c.pin);
          ring.scale.setScalar(8 + 30 * (t / 0.6));
          (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t / 0.6);
        }
      }
      if (!lit) return;
      const speed = 420 * (0.35 + 0.65 * s.dim);
      const head = since.current[ci] * speed;
      for (let i = 0; i < PER && k < m.count; i++) {
        const d = head - i * 26;
        if (d <= 0) break;
        const dd = d <= c.total ? d : (((d % c.total) + c.total) % c.total);
        let rest = dd;
        for (let j = 0; j < c.curves.length; j++) {
          const len = c.curves[j].getLength();
          if (rest <= len || j === c.curves.length - 1) { c.curves[j].getPointAt(Math.min(1, Math.max(0, rest / len)), tmp); break; }
          rest -= len;
        }
        m.setMatrixAt(k++, mx.makeTranslation(tmp.x, tmp.y, tmp.z));
      }
    });
    for (let i = k; i < m.count; i++) m.setMatrixAt(i, mx.makeScale(0, 0, 0));
    m.instanceMatrix.needsUpdate = true;
    if (out) s.invalidate();
  });
  return (
    <>
      <instancedMesh ref={dots} args={[undefined, undefined, Math.max(1, chains.length * PER)]} material={mat} renderOrder={5} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[2.8, 12, 8]} />
      </instancedMesh>
      <group ref={rings}>
        {chains.map((_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} material={ringMat.clone()} visible={false} renderOrder={6} raycast={() => null}>
            <ringGeometry args={[0.72, 1, 40]} />
          </mesh>
        ))}
      </group>
    </>
  );
}
