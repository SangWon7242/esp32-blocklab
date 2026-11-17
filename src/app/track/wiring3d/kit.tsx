import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { canvasTexture, COLOR, glowTexture, noOutline } from "./materials";
import { useViewerApi, type Selected } from "./store";

/*
 * 3D 장면의 기본 조각 (상자 · 원기둥 · 관 · 글자 판) 과 마우스 반응.
 *   <Part> — 부품 하나: 올리면 설명이 뜨고 살짝 들리며, 누르면 원형 빛과 부품 카드가 열린다
 * 장면이 바뀌어 다시 그려야 할 때는 store.invalidate() 를 부른다 (frameloop="demand").
 */

type V3 = [number, number, number];

/*
 * 상자: 실물처럼 모서리를 살짝 둥글게 깎는다 (빛이 모서리에 맺혀 입체감이 산다).
 * 크기마다 모양을 한 번만 만들어 나눠 쓴다. 아주 얇은 판(1.5 아래)은 그냥 상자.
 */
const boxCache = new Map<string, THREE.BufferGeometry>();
export function roundedBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const k = `${w}|${h}|${d}`;
  let g = boxCache.get(k);
  if (!g) {
    const m = Math.min(w, h, d);
    g = m < 1.5 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 2, Math.min(1.6, m * 0.22));
    boxCache.set(k, g);
  }
  return g;
}

export function Box({ size, at, mat, rot, cast = true, children }: { size: V3; at: V3; mat: THREE.Material; rot?: V3; cast?: boolean; children?: ReactNode }) {
  return (
    <mesh position={at} rotation={rot} castShadow={cast} receiveShadow material={mat} geometry={roundedBox(size[0], size[1], size[2])}>
      {children}
    </mesh>
  );
}

export function Cyl({ r, h, at, mat, seg = 20, rot, r2 }: { r: number; h: number; at: V3; mat: THREE.Material; seg?: number; rot?: V3; r2?: number }) {
  return (
    <mesh position={at} rotation={rot} castShadow material={mat}>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
    </mesh>
  );
}

export function Ball({ r, at, mat, half, scale }: { r: number; at: V3; mat: THREE.Material; half?: boolean; scale?: V3 }) {
  return (
    <mesh position={at} scale={scale} castShadow material={mat}>
      <sphereGeometry args={[r, 24, half ? 12 : 16, 0, Math.PI * 2, 0, half ? Math.PI / 2 : Math.PI]} />
    </mesh>
  );
}

export function Tube({ points, radius, mat, tension = 0.5 }: { points: THREE.Vector3[]; radius: number; mat: THREE.Material; tension?: number }) {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", tension);
    return new THREE.TubeGeometry(curve, Math.max(16, points.length * 12), radius, 8);
  }, [points, radius, tension]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={mat} castShadow />;
}

/** 글자 · 무늬를 그린 납작한 판 (바닥과 나란히) */
export function Decal({ w, d, at, paint, px = 256, rotY = 0, under = false }: { w: number; d: number; at: V3; paint: (g: CanvasRenderingContext2D, cw: number, ch: number) => void; px?: number; rotY?: number; under?: boolean }) {
  const { tex, mat } = useMemo(() => {
    const t = canvasTexture(px, Math.max(16, (px * d) / w), paint);
    return { tex: t, mat: noOutline(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })) };
    // paint 는 그 자리에서 만든 함수라 의존성에서 뺀다 (글자 판은 처음 한 번만 그린다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, d, px]);
  useEffect(() => () => { tex.dispose(); mat.dispose(); }, [tex, mat]);
  return (
    <mesh position={at} rotation={[under ? Math.PI / 2 : -Math.PI / 2, 0, rotY]} material={mat}>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

/* ───────────── 부품 하나: 올림 · 들림 · 누름 ───────────── */

const LIFT = 7;

type PartProps = {
  id: string;
  label: string;
  text: string;
  children: ReactNode;
  /** 올렸을 때 들어 올릴지 (보드 판처럼 넓은 것은 false) */
  lift?: boolean;
  /** 올렸을 때 둘레 빛 (보드 판은 false) */
  glow?: boolean;
  /** 눌렀을 때 부품 카드를 열지 (손으로 조작하는 부품은 조작이 먼저라 false) */
  card?: boolean;
  control?: Selected["control"];
  position?: V3;
  rotation?: V3;
  /** 누르면 부품 카드 대신 이것을 한다 (OLED: 크게 보기) */
  onPick?: () => void;
};

export function Part({ id, label, text, children, lift = true, glow = true, card = true, control, position, rotation, onPick }: PartProps) {
  const api = useViewerApi();
  const group = useRef<THREE.Group>(null);
  const rest = useRef<THREE.Box3 | null>(null);
  const base = position?.[1] ?? 0;
  const restBox = () => {
    if (!rest.current && group.current) {
      const g = group.current;
      const y = g.position.y;
      g.position.y = base;
      g.updateWorldMatrix(true, true);
      rest.current = new THREE.Box3().setFromObject(g);
      g.position.y = y;
    }
    return rest.current;
  };
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const goal = base + (lift && api.getState().hover?.id === id ? LIFT : 0);
    const d = goal - g.position.y;
    if (Math.abs(d) < 0.05) { if (d !== 0) { g.position.y = goal; api.getState().invalidate(); } return; }
    g.position.y += d * 0.22;
    api.getState().invalidate();
  });
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (api.getState().dragging) return;
    const box = glow ? restBox() ?? undefined : undefined;
    api.getState().set({ hover: { id, label, text, lift, box } });
    api.getState().invalidate();
  };
  const out = () => {
    if (api.getState().hover?.id === id) api.getState().set({ hover: null });
    api.getState().invalidate();
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    if (onPick) { onPick(); return; }
    if (!card) return;
    const box = restBox();
    if (!box) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    center.y = box.min.y + 0.6;
    const radius = Math.max(16, Math.max(size.x, size.z) / 2 + 12);
    api.getState().set({ selected: { id, label, text, center, radius: Math.min(radius, 90), control }, picked: null });
    api.getState().invalidate();
  };
  return (
    <group ref={group} position={position} rotation={rotation} onPointerOver={over} onPointerOut={out} onClick={click}>
      {children}
    </group>
  );
}

/* ───────────── 올린 것 · 누른 것 표시 ───────────── */

/** 올린 부품 아래의 노란 빛 + 핀 · 구멍 덧칠 */
export function HoverMarks() {
  const api = useViewerApi();
  const glow = useRef<THREE.Mesh>(null);
  const marks = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ map: glowTexture(), color: COLOR.glow, transparent: true, depthWrite: false })), []);
  const markMat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: COLOR.glow, transparent: true, opacity: 0.6, depthTest: false })), []);
  useEffect(() => () => { mat.dispose(); markMat.dispose(); }, [mat, markMat]);
  useFrame(() => {
    const h = api.getState().hover;
    const g = glow.current, m = marks.current;
    if (!g || !m) return;
    if (h?.box && !h.box.isEmpty()) {
      const size = h.box.getSize(new THREE.Vector3());
      g.visible = true;
      g.position.set((h.box.min.x + h.box.max.x) / 2, h.box.min.y + 0.4, (h.box.min.z + h.box.max.z) / 2);
      g.scale.set(size.x + 40, size.z + 40, 1);
    } else g.visible = false;
    const list = h?.marks ?? [];
    m.count = list.length;
    const [sx, sy, sz] = h?.markSize ?? [9, 2, 9];
    const mx = new THREE.Matrix4();
    list.forEach((p, i) => m.setMatrixAt(i, mx.compose(p, new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz))));
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <mesh ref={glow} rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={2} visible={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <instancedMesh ref={marks} args={[undefined, undefined, 64]} material={markMat} renderOrder={4} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </>
  );
}

/** 누른 부품: 바닥에 주황 빛 + 고리 둘 (바깥 고리는 천천히 퍼졌다 돌아온다) */
export function SelectionRing() {
  const api = useViewerApi();
  const group = useRef<THREE.Group>(null);
  const outer = useRef<THREE.Mesh>(null);
  const clock = useRef(0);
  const mats = useMemo(() => ({
    glow: noOutline(new THREE.MeshBasicMaterial({ map: glowTexture(), color: COLOR.select, transparent: true, depthWrite: false, depthTest: false })),
    ring: noOutline(new THREE.MeshBasicMaterial({ color: COLOR.select, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false })),
    ring2: noOutline(new THREE.MeshBasicMaterial({ color: COLOR.select, transparent: true, opacity: 0.6, depthWrite: false, depthTest: false })),
  }), []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useFrame((_, dt) => {
    const s = api.getState().selected, g = group.current;
    if (!g) return;
    g.visible = Boolean(s);
    if (!s) return;
    clock.current += dt;
    const pulse = 0.5 + 0.5 * Math.sin(clock.current * 3.2);
    g.position.copy(s.center);
    g.scale.setScalar(s.radius);
    if (outer.current) {
      outer.current.scale.setScalar(1.22 + 0.1 * pulse);
      mats.ring2.opacity = 0.65 - 0.35 * pulse;
    }
    api.getState().invalidate();
  });
  return (
    <group ref={group} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh material={mats.glow} scale={1.7} renderOrder={3}><planeGeometry args={[2, 2]} /></mesh>
      <mesh material={mats.ring} renderOrder={3}><ringGeometry args={[0.9, 1, 64]} /></mesh>
      <mesh ref={outer} material={mats.ring2} renderOrder={3}><ringGeometry args={[0.955, 1, 64]} /></mesh>
    </group>
  );
}

/** 끌어서 움직이는 것 (조이스틱 · 자동차 · 사람 · 카드): 누른 동안 카메라가 움직이지 않게 하고, 화면에서 움직인 만큼 알려 준다 */
export function useDrag(onMove: (e: ThreeEvent<PointerEvent>) => void, onEnd?: () => void) {
  const api = useViewerApi();
  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      // 오른쪽 버튼은 화면 돌리기 (끌어 옮기는 물건도 그대로 둔다)
      if (e.button !== 0) return;
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      api.getState().set({ dragging: true, hover: null });
      onMove(e);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (!api.getState().dragging || !(e.buttons & 1)) return;
      e.stopPropagation();
      onMove(e);
      api.getState().invalidate();
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      api.getState().set({ dragging: false });
      onEnd?.();
      api.getState().invalidate();
    },
  };
}

/** 화면의 마우스 자리를 높이 y 인 바닥면 위의 점으로 */
export function onPlane(e: ThreeEvent<PointerEvent>, y: number): THREE.Vector3 | null {
  const p = new THREE.Vector3();
  return e.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
}
