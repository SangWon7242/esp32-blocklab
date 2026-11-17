import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Part3D, Pt, Scene3D } from "@/track/wiring3d";
import { BB_H, type Layout } from "./layout";
import { glowTexture, noOutline } from "./materials";
import { useViewer, useViewerApi } from "./store";

/*
 * 조립 순서 보기 (3D 쪽).
 *   - 아직 차례가 오지 않은 부품 · 선은 숨긴다 (마우스에도 걸리지 않게 layer 0 을 끈다)
 *   - 지금 단계의 부품 둘레에 주황 빛, 지금 잇는 선의 두 끝에 고리가 숨 쉬듯 커졌다 작아진다
 *   - 카메라는 지금 단계 쪽으로 천천히 옮겨 간다
 */

/** 그 부품 · 선의 차례가 왔을 때만 보인다 */
export function StepShow({ part, wire, children }: { part?: number; wire?: number; children: ReactNode }) {
  const api = useViewerApi();
  const g = useRef<THREE.Group>(null);
  const last = useRef<boolean | null>(null);
  useFrame(() => {
    const s = api.getState();
    const a = s.assembly;
    const at = !a ? 0 : part !== undefined ? a.partStep[part] : wire !== undefined ? a.wireStep[wire] : 0;
    const show = s.step === null || at <= s.step;
    if (!g.current || last.current === show) return;
    last.current = show;
    g.current.visible = show;
    g.current.traverse((o) => (show ? o.layers.enable(0) : o.layers.disable(0)));
    s.invalidate();
  });
  return <group ref={g}>{children}</group>;
}

/** 부품의 바닥 가운데 · 반지름 (화면 좌표) */
export function partSpot(p: Part3D, L: Layout): { at: THREE.Vector3; r: number } {
  const box = (x: number, y: number, w: number, h: number, zz: (y: number) => number) => ({
    at: new THREE.Vector3(L.X(x + w / 2), 1, zz(y + h / 2)),
    r: Math.min(110, Math.hypot(w, (zz(y + h) - zz(y))) / 2 + 14),
  });
  const legs = (pts: Pt[], pad: number) => {
    const vs = pts.map((q) => L.v(q, 1));
    const at = vs.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / vs.length);
    at.y = BB_H + 1;
    return { at, r: Math.max(...vs.map((v) => Math.hypot(v.x - at.x, v.z - at.z))) + pad };
  };
  switch (p.type) {
    case "module": return box(p.x, p.y, p.w, p.h, L.zIn(p));
    case "servo": return box(p.x - 6, p.y, 96, 46, L.zIn({ y: p.y, h: 44 }));
    case "prop": return box(p.x, p.y, p.w, p.h, (y) => L.Z(y));
    case "touch": return box(p.pad.x, p.pad.y, p.pad.w, p.pad.h, (y) => L.Z(y));
    case "seg7": return box(p.x, p.y, p.w, p.h, (y) => L.Z(y));
    case "led": return legs([p.a, p.c], 18);
    case "resistor": case "buzzer": case "photo": case "tilt": return legs([p.a, p.b], 14);
    case "dip": return legs([p.l, p.r], 16);
    case "button": case "pot": case "rgb": case "irrx": return legs(p.legs, 16);
  }
}

/** 지금 단계 표시: 부품 둘레 빛 · 선 끝 고리 */
export function StepMarks({ scene, L }: { scene: Scene3D; L: Layout }) {
  const api = useViewerApi();
  const step = useViewer((s) => s.step);
  const assembly = useViewer((s) => s.assembly);
  const cur = step !== null && assembly ? assembly.steps[step] : null;
  const spots = useMemo(() => {
    if (!cur) return [];
    const each = cur.parts.map((i) => partSpot(scene.parts[i], L));
    if (each.length <= 3) return each;
    // 부품이 많은 단계(칩 · 저항 여럿)는 고리 하나로 묶는다
    const at = each.reduce((a, s) => a.add(s.at), new THREE.Vector3()).multiplyScalar(1 / each.length);
    at.y = Math.max(...each.map((s) => s.at.y));
    const r = Math.min(150, Math.max(...each.map((s) => Math.hypot(s.at.x - at.x, s.at.z - at.z) + s.r * 0.6)));
    return [{ at, r }];
  }, [cur, scene, L]);
  const ends = useMemo(() => (cur ? cur.wires.flatMap((k) => [scene.wires[k].from, scene.wires[k].to]).map((p) => L.v(p, L.topAt(p) + 1.5)) : []), [cur, scene, L]);
  const mats = useMemo(() => ({
    // 바닥에 깔리는 빛 · 고리: 부품이 그 위를 가리도록 깊이를 본다
    glow: noOutline(new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#f76707", transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    ring: noOutline(new THREE.MeshBasicMaterial({ color: "#f76707", transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    end: noOutline(new THREE.MeshBasicMaterial({ color: "#f76707", transparent: true, opacity: 0.9, depthWrite: false, depthTest: false })),
  }), []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const pulse = useRef<THREE.Group>(null);
  const clock = useRef(0);

  // 단계가 바뀌면 카메라를 그 단계 쪽으로
  useEffect(() => {
    const cam = api.getState().camera;
    if (!cam || step === null) return;
    const pts = [...spots.map((s) => s.at), ...ends];
    if (!pts.length || !cur?.parts.length) { cam.focus(null); return; }
    const c = pts.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    // 한쪽으로 너무 쏠리지 않게 장면 가운데와 섞는다
    cam.focus(c.lerp(L.focus, 0.35));
  }, [api, step, cur, spots, ends, L]);
  useEffect(() => { if (step === null) api.getState().camera?.focus(null); }, [api, step]);

  useFrame((_, dt) => {
    if (!cur || !pulse.current) return;
    clock.current += dt;
    const k = 0.5 + 0.5 * Math.sin(clock.current * 3.4);
    pulse.current.children.forEach((m) => m.scale.setScalar(1 + 0.18 * k));
    mats.end.opacity = 0.95 - 0.45 * k;
    mats.glow.opacity = 0.55 + 0.35 * k;
    api.getState().invalidate();
  });
  if (!cur) return null;
  return (
    <group>
      {spots.map((s, i) => (
        <group key={`p${i}`} position={s.at} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh material={mats.glow} scale={s.r * 1.6} renderOrder={3} raycast={() => null}><planeGeometry args={[2, 2]} /></mesh>
          <mesh material={mats.ring} scale={s.r} renderOrder={3} raycast={() => null}><ringGeometry args={[0.92, 1, 64]} /></mesh>
        </group>
      ))}
      <group ref={pulse}>
        {ends.map((v, i) => (
          <mesh key={`e${i}`} position={v} rotation={[-Math.PI / 2, 0, 0]} material={mats.end} renderOrder={4} raycast={() => null}>
            <ringGeometry args={[7, 10, 32]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
