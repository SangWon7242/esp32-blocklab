import { Component, createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import type { Pt, Scene3D } from "@/track/wiring3d";
import { partSpot } from "./assemblyView";
import {
  ALL, BURST, cueDuration, cueIntro, easeInOut, easeOut, endLabel, firstEnd, framePoints, lerpPose, phase, PLACE, stageOf, tubeDrawCount, viewBasis, WIRE,
  type AssemblyCue, type CueIntro, type Pose, type Stage,
} from "./assemblyCue";
import { Board, Breadboard } from "./board";
import { Box, HoverMarks } from "./kit";
import { makeLayout, type Layout } from "./layout";
import { canvasTexture, COLOR, glowTexture, noOutline, toon, toonOwn } from "./materials";
import { AZ0, EL_TILT, PanFloor } from "./rig";
import { Floor, partView, RoomLight } from "./Scene";
import { createViewerStore, useViewerApi, ViewerContext } from "./store";
import { wirePoints } from "./wires";

/*
 * 3D 조립 안내 무대 (lib-v1.6.0). 허브 행사 화면(메이커 데이)이 「보드 놓기 → 모듈 놓기 → 선 하나씩 → 다 보기」를
 * 짧은 영상처럼 보여 준다. 차례(step)는 호스트가 정하고, 이 화면은 그 차례의 움직임만 그린다.
 *   - 놓기: 부품이 위에서 내려앉고(0.8초) 그림자가 따라 붙고, 둘레에 빛 고리가 한 번 퍼진다. 카메라가 그 부품 쪽으로
 *   - 선 잇기(약 3.8초): 모듈 핀 가까이 → 첫 끝이 날아와 꽂힘(고리) → 선이 보드 쪽으로 그려지며 카메라가 따라감
 *     → 다른 끝이 보드 핀에 꽂힘(고리 · 핀 이름) → 두 끝이 다 보이게 물러남. 끝난 뒤에도 두 핀의 고리는 숨 쉬듯 뛴다
 *   - 다 보기: 카메라가 물러나 전체를 담는다
 * 지난 차례는 다 된 모습, 다음 차례의 것은 숨긴다. prefers-reduced-motion 이면 움직임 없이 끝 모습으로 (onMotionEnd 는 부른다).
 * 바탕은 밝은 종이색, 보드는 실제 비율, 부품에 마우스를 올리면 살짝 들린다. 단추 · 설명 판은 없다 (호스트가 그린다).
 */

export type AssemblyStageProps = {
  /** 3D 배선 장면 (scripts/wiring 이 쓴 *.3d.json) */
  scene: Scene3D;
  /** 조립 차례 (호스트가 순서를 정한다). 예: 보드 · 모듈 놓기 → 선 넷 → { kind: "all" } */
  steps: AssemblyCue[];
  /** 지금 차례 번호 (0부터). 범위를 넘으면 가장 가까운 차례 */
  step: number;
  /** 값이 바뀌면 지금 차례의 움직임을 처음부터 다시 보여 준다 (「다시 보기」) */
  replayKey?: number;
  /** 지금 차례의 움직임이 끝나면 한 번 부른다 (차례 · replayKey 가 바뀔 때마다 다시) */
  onMotionEnd?: () => void;
  /** WebGL 을 만들지 못하면 부른다 (호스트가 그림으로 돌아갈 수 있게) */
  onUnsupported?: () => void;
  /** 바깥 상자에 더할 class. 무대는 부모를 꽉 채운다(부모가 높이를 준다) */
  className?: string;
};

export function AssemblyStage(props: AssemblyStageProps) {
  const [store] = useState(createViewerStore);
  return (
    <ViewerContext.Provider value={store}>
      <StageRoot {...props} />
    </ViewerContext.Provider>
  );
}

/** 움직임 시계: 차례가 바뀌거나 다시 보기를 누르면 start 를 새로 잡는다 */
type Clock = { start: number; token: number; fired: boolean; fire?: () => void };

type StageCtx = { scene: Scene3D; L: Layout; steps: AssemblyCue[]; step: number; intro: CueIntro; reduced: boolean; clock: Clock };
const Ctx = createContext<StageCtx | null>(null);
function useStage(): StageCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("AssemblyStage 밖이에요");
  return c;
}
/** 지금 차례가 시작된 뒤 지난 초 (움직임을 줄이면 끝난 것으로) */
const elapsed = (c: StageCtx) => (c.reduced ? Infinity : (performance.now() - c.clock.start) / 1000);

function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [on, setOn] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const m = window.matchMedia(query);
    const change = () => setOn(m.matches);
    m.addEventListener?.("change", change);
    return () => m.removeEventListener?.("change", change);
  }, []);
  return on;
}

function StageRoot({ scene, steps, step, replayKey = 0, onMotionEnd, onUnsupported, className }: AssemblyStageProps) {
  const api = useViewerApi();
  const L = useMemo(() => makeLayout(scene), [scene]);
  const intro = useMemo(() => cueIntro(scene, steps), [scene, steps]);
  const reduced = usePrefersReducedMotion();
  const cur = steps.length ? Math.max(0, Math.min(steps.length - 1, Math.floor(step))) : 0;
  const [clock] = useState<Clock>(() => ({ start: 0, token: 0, fired: false }));
  const endRef = useRef(onMotionEnd);
  useEffect(() => { endRef.current = onMotionEnd; }, [onMotionEnd]);

  // 차례 · 다시 보기: 시계를 새로 잡고, 움직임이 끝나면 onMotionEnd (그림이 멈춰 있어도 타이머로 한 번은 부른다)
  useLayoutEffect(() => {
    clock.start = performance.now();
    clock.token += 1;
    clock.fired = false;
    const token = clock.token;
    api.getState().invalidate();
    const fire = () => {
      if (clock.token !== token || clock.fired) return;
      clock.fired = true;
      endRef.current?.();
    };
    clock.fire = fire;
    const ms = reduced ? 0 : cueDuration(steps[cur]) * 1000 + 400;
    const id = window.setTimeout(fire, ms);
    return () => window.clearTimeout(id);
  }, [api, clock, cur, replayKey, reduced, steps, scene]);

  const ctx = useMemo<StageCtx>(() => ({ scene, L, steps, step: cur, intro, reduced, clock }), [scene, L, steps, cur, intro, reduced, clock]);
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-[#f8f4ec]", className)} data-testid="assembly-stage" data-step={cur}>
      <GlBoundary onError={onUnsupported}>
        <Canvas
          orthographic
          frameloop="demand"
          shadows="variance"
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }}
          camera={{ zoom: 1, position: [0, 600, 600], near: -10000, far: 10000 }}
          style={{ position: "absolute", inset: 0, touchAction: "none" }}
          aria-label="3D 조립 안내"
        >
          <Ctx.Provider value={ctx}>
            <StageScene />
          </Ctx.Provider>
        </Canvas>
      </GlBoundary>
    </div>
  );
}

class GlBoundary extends Component<{ onError?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* ───────────── 장면 ───────────── */

function StageScene() {
  const api = useViewerApi();
  const { scene, L, intro } = useStage();
  const { invalidate } = useThree();
  useEffect(() => {
    api.getState().set({ invalidate });
    const ids = [60, 250, 800].map((ms) => window.setTimeout(invalidate, ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [api, invalidate]);
  const r = Math.max(L.size.w, L.size.d);
  const blueLed = useMemo(() => toonOwn({ color: "#74c0fc", emissive: COLOR.signal, emissiveIntensity: 0.25, outline: false }), []);
  useEffect(() => () => blueLed.dispose(), [blueLed]);
  // 보드의 노란 "꽂을 핀" 고리는 끈다: 핀 표시는 이 무대가 차례마다 한다
  const boards = useMemo(() => scene.boards.map((b) => ({ ...b, pins: b.pins.map((p) => ({ ...p, used: false })) })), [scene]);
  return (
    <>
      <RoomLight />
      <hemisphereLight args={["#ffffff", "#d8cfbf", 0.55]} />
      <directionalLight position={[-r * 0.5, r * 1.1, r * 0.35]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.6} shadow-radius={6}
        shadow-camera-left={-r} shadow-camera-right={r} shadow-camera-top={r} shadow-camera-bottom={-r} shadow-camera-near={1} shadow-camera-far={r * 4} />
      <directionalLight position={[r * 0.8, r * 0.6, -r * 0.4]} intensity={0.45} color="#e7eefc" />
      <Floor r={r} />
      <PanFloor r={r} />
      {scene.breadboards.map((bb, i) => <Breadboard key={i} bb={bb} L={L} index={i} />)}
      {boards.map((b, i) => (
        <Appear key={`b${i}`} intro={intro.boards[i]} spot={boardSpot(b, L)}>
          <Board b={b} L={L} index={i} blueLed={blueLed} />
        </Appear>
      ))}
      {scene.parts.map((p, i) => (
        <Appear key={`p${i}`} intro={intro.parts[i]} spot={partSpot(p, L)}>{partView(p, i, L)}</Appear>
      ))}
      {scene.wires.map((_, i) => <StageWire key={`w${i}`} i={i} />)}
      <HoverMarks />
      <StageCamera />
    </>
  );
}

function boardSpot(b: Scene3D["boards"][number], L: Layout) {
  const z0 = L.Z(b.y), z1 = L.Z(b.y + b.h);
  return { at: new THREE.Vector3(L.X(b.x + b.w / 2), 1, (z0 + z1) / 2), r: Math.hypot(b.w, z1 - z0) / 2 + 14 };
}

/** 숨긴 것은 마우스에도 걸리지 않게 (layer 0 끄기) */
function useHideFromPointer(ref: RefObject<THREE.Object3D | null>, shown: boolean) {
  const api = useViewerApi();
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.visible = shown;
    g.traverse((o) => (shown ? o.layers.enable(0) : o.layers.disable(0)));
    api.getState().invalidate();
  }, [api, ref, shown]);
}

const ORANGE = "#f76707";

/** 놓기: 지금 차례면 위에서 내려앉고 빛 고리가 한 번 퍼진다 */
function Appear({ intro, spot, children }: { intro: number; spot: { at: THREE.Vector3; r: number }; children: ReactNode }) {
  const c = useStage();
  const st: Stage = stageOf(intro, c.step);
  const quiet = st === "active" && c.steps[c.step]?.kind === "all";
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Group>(null);
  useHideFromPointer(root, st !== "hidden");
  const mats = useMemo(() => ({
    glow: noOutline(new THREE.MeshBasicMaterial({ map: glowTexture(), color: ORANGE, transparent: true, opacity: 0, depthWrite: false })),
    ring: noOutline(new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0, depthWrite: false })),
  }), []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useFrame(() => {
    const g = body.current, rg = ring.current;
    if (!g || !rg) return;
    const t = st === "active" && !quiet ? elapsed(c) : Infinity;
    g.position.y = (1 - easeOut(phase(PLACE.drop, t))) * Math.max(120, spot.r * 0.9);
    const k = phase(PLACE.ring, t);
    rg.visible = st === "active" && k > 0 && k < 1;
    if (rg.visible) {
      rg.scale.setScalar(spot.r * (0.75 + 0.45 * easeOut(k)));
      mats.ring.opacity = 0.95 * (1 - k);
      mats.glow.opacity = 0.75 * Math.sin(Math.PI * Math.min(1, k * 1.4));
    }
  });
  return (
    <group ref={root}>
      <group ref={body}>{children}</group>
      <group ref={ring} position={spot.at} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <mesh material={mats.glow} scale={1.5} renderOrder={3} raycast={() => null}><planeGeometry args={[2, 2]} /></mesh>
        <mesh material={mats.ring} renderOrder={3} raycast={() => null}><ringGeometry args={[0.93, 1, 72]} /></mesh>
      </group>
    </group>
  );
}

/* ───────────── 선 ───────────── */

const TUBULAR = 120, RADIAL = 10;
const plugH = (end: "f" | "m") => (end === "f" ? 14 : 10);

/** 선의 길을 먼저 꽂는 끝에서 시작하게 */
function orientedWire(scene: Scene3D, L: Layout, i: number) {
  const w = scene.wires[i];
  const first = firstEnd(scene, i);
  const pts = wirePoints(w, i, L);
  const [A, B] = first === "from" ? [w.from, w.to] : [w.to, w.from];
  const [endA, endB] = first === "from" ? w.ends : [w.ends[1], w.ends[0]];
  const curve = new THREE.CatmullRomCurve3(first === "from" ? pts : [...pts].reverse(), false, "catmullrom", 0.5);
  const seat = (p: Pt) => L.v(p, L.topAt(p) + 1.5);
  return { w, A, B, endA, endB, curve, seatA: seat(A), seatB: seat(B) };
}

function labelTexture(text: string, color: string) {
  return canvasTexture(192, 96, (g, w, h) => {
    const r = h / 2 - 6;
    g.fillStyle = "rgba(15,34,57,0.22)";
    g.beginPath(); g.roundRect(6, 10, w - 12, h - 14, r); g.fill();
    g.fillStyle = "#ffffff"; g.strokeStyle = "#0f2239"; g.lineWidth = 5;
    g.beginPath(); g.roundRect(6, 4, w - 12, h - 14, r); g.fill(); g.stroke();
    g.fillStyle = color;
    g.beginPath(); g.arc(34, 4 + (h - 14) / 2, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#0f2239"; g.font = `800 ${Math.round(h * 0.46)}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2 + 14, 4 + (h - 14) / 2 + 2);
  });
}

function StageWire({ i }: { i: number }) {
  const c = useStage();
  const { scene, L, intro, step, steps } = c;
  const st: Stage = stageOf(intro.wires[i], step);
  const quiet = st === "active" && steps[step]?.kind !== "wire";
  const ow = useMemo(() => orientedWire(scene, L, i), [scene, L, i]);
  const geo = useMemo(() => new THREE.TubeGeometry(ow.curve, TUBULAR, 3, RADIAL), [ow]);
  const mat = useMemo(() => toonOwn({ color: ow.w.color }), [ow]);
  const labels = useMemo(() => {
    const a = endLabel(scene, ow.A), b = endLabel(scene, ow.B);
    const mk = (text: string) => (text ? noOutline(new THREE.SpriteMaterial({ map: labelTexture(text, ow.w.color), transparent: true, depthTest: false, depthWrite: false })) : null);
    return { a: mk(a), b: mk(b) };
  }, [scene, ow]);
  const rings = useMemo(() => ({
    burstA: noOutline(new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, depthTest: false, depthWrite: false })),
    burstB: noOutline(new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, depthTest: false, depthWrite: false })),
    pulse: noOutline(new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, depthTest: false, depthWrite: false })),
  }), []);
  useEffect(() => () => {
    geo.dispose(); mat.dispose();
    for (const m of [labels.a, labels.b]) { m?.map?.dispose(); m?.dispose(); }
    Object.values(rings).forEach((m) => m.dispose());
  }, [geo, mat, labels, rings]);

  const root = useRef<THREE.Group>(null);
  const tube = useRef<THREE.Mesh>(null);
  const tip = useRef<THREE.Mesh>(null);
  const headA = useRef<THREE.Group>(null), headB = useRef<THREE.Group>(null);
  const burstA = useRef<THREE.Mesh>(null), burstB = useRef<THREE.Mesh>(null);
  const pulseA = useRef<THREE.Mesh>(null), pulseB = useRef<THREE.Mesh>(null);
  const labelA = useRef<THREE.Sprite>(null), labelB = useRef<THREE.Sprite>(null);
  useHideFromPointer(root, st !== "hidden");
  const basis = useMemo(() => viewBasis(AZ0, EL_TILT), []);

  useFrame(({ camera }) => {
    if (st === "hidden" || !tube.current) return;
    const live = st === "active" && !quiet;
    const t = live ? elapsed(c) : Infinity;
    const zoom = (camera as THREE.OrthographicCamera).zoom || 1;
    // 1) 첫 끝: 위에서 날아와 모듈 핀에 꽂힌다
    const a = easeOut(phase(WIRE.plugA, t));
    if (headA.current) { headA.current.visible = t >= WIRE.plugA[0]; headA.current.position.y = (1 - a) * 70; }
    // 2) 선이 보드 쪽으로 그려진다
    const k = easeInOut(phase(WIRE.draw, t));
    geo.setDrawRange(0, tubeDrawCount(k, TUBULAR, RADIAL));
    tube.current.visible = k > 0;
    if (tip.current) {
      tip.current.visible = k > 0 && k < 1;
      if (tip.current.visible) ow.curve.getPointAt(k, tip.current.position);
    }
    // 3) 다른 끝이 보드 핀에 내려앉는다
    const b = easeOut(phase(WIRE.plugB, t));
    if (headB.current) { headB.current.visible = t >= WIRE.plugB[0]; headB.current.position.y = (1 - b) * 18; }
    // 꽂히는 순간 퍼지는 고리 · 끝난 뒤에도 숨 쉬는 고리 (지금 차례의 선만)
    const burst = (m: THREE.Mesh | null, mm: THREE.MeshBasicMaterial, at: number) => {
      if (!m) return;
      const u = (t - at) / BURST;
      m.visible = live && u >= 0 && u < 1;
      if (m.visible) { m.scale.setScalar(1 + 2.4 * easeOut(u)); mm.opacity = 0.9 * (1 - u); }
    };
    burst(burstA.current, rings.burstA, WIRE.plugA[1]);
    burst(burstB.current, rings.burstB, WIRE.plugB[1]);
    const breathe = c.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 3.4);
    const cur = st === "active" && !quiet;
    if (pulseA.current) { pulseA.current.visible = cur && t >= WIRE.plugA[1]; pulseA.current.scale.setScalar(1 + 0.2 * breathe); }
    if (pulseB.current) { pulseB.current.visible = cur && t >= WIRE.plugB[1]; pulseB.current.scale.setScalar(1 + 0.2 * breathe); }
    rings.pulse.opacity = 0.95 - 0.4 * breathe;
    // 핀 이름: 꽂히는 순간 톡 튀어나왔다가 사라진다 (화면 크기는 늘 같게)
    const label = (s: THREE.Sprite | null, seg: readonly [number, number], at: THREE.Vector3) => {
      if (!s) return;
      const u = phase(seg, t);
      s.visible = live && t >= seg[0] && u < 1;
      if (!s.visible) return;
      const pop = easeOut(Math.min(1, u * 5));
      const fade = u > 0.7 ? (1 - u) / 0.3 : 1;
      s.material.opacity = fade;
      s.scale.set((84 / zoom) * (0.6 + 0.4 * pop), (42 / zoom) * (0.6 + 0.4 * pop), 1);
      s.position.copy(at).addScaledVector(basis.up, 80 / zoom);
    };
    label(labelA.current, [WIRE.plugA[1], WIRE.plugA[1] + 1.5], ow.seatA);
    label(labelB.current, WIRE.label, ow.seatB);
  });

  const head = (p: Pt, end: "f" | "m") => {
    const h = plugH(end), y = L.topAt(p);
    return (
      <>
        <Box size={end === "f" ? [10, h, 10] : [6, h, 6]} at={[L.X(p.x), y + h / 2 + 0.5, L.Zp(p)]} mat={toon(COLOR.plastic)} />
        {end === "m" && <Box size={[1.6, 5, 1.6]} at={[L.X(p.x), y - 1.5, L.Zp(p)]} mat={toon(COLOR.leg, { outline: false })} />}
      </>
    );
  };
  const flat: [number, number, number] = [-Math.PI / 2, 0, 0];
  return (
    <group ref={root}>
      <mesh ref={tube} geometry={geo} material={mat} castShadow visible={false} raycast={() => null} />
      <mesh ref={tip} material={mat} visible={false} raycast={() => null}><sphereGeometry args={[3.4, 14, 10]} /></mesh>
      <group ref={headA} visible={false}>{head(ow.A, ow.endA)}</group>
      <group ref={headB} visible={false}>{head(ow.B, ow.endB)}</group>
      <mesh ref={burstA} position={ow.seatA} rotation={flat} material={rings.burstA} renderOrder={6} visible={false} raycast={() => null}><ringGeometry args={[8, 10, 40]} /></mesh>
      <mesh ref={burstB} position={ow.seatB} rotation={flat} material={rings.burstB} renderOrder={6} visible={false} raycast={() => null}><ringGeometry args={[8, 10, 40]} /></mesh>
      <mesh ref={pulseA} position={ow.seatA} rotation={flat} material={rings.pulse} renderOrder={5} visible={false} raycast={() => null}><ringGeometry args={[7.5, 10.5, 40]} /></mesh>
      <mesh ref={pulseB} position={ow.seatB} rotation={flat} material={rings.pulse} renderOrder={5} visible={false} raycast={() => null}><ringGeometry args={[7.5, 10.5, 40]} /></mesh>
      {labels.a && <sprite ref={labelA} material={labels.a} renderOrder={8} visible={false} raycast={() => null} />}
      {labels.b && <sprite ref={labelB} material={labels.b} renderOrder={8} visible={false} raycast={() => null} />}
    </group>
  );
}

/* ───────────── 카메라 ───────────── */

/** 차례마다 카메라가 끝에 머무는 자리 (선 잇기는 가까이 · 가운데 배율도) */
type CuePoses = { end: Pose; close?: Pose; midZoom?: number; curve?: THREE.CatmullRomCurve3 };

function StageCamera() {
  const c = useStage();
  const { scene, L, steps, step } = c;
  const { gl, camera, size, invalidate } = useThree();
  const cam = camera as THREE.OrthographicCamera;
  const basis = useMemo(() => viewBasis(AZ0, EL_TILT), []);
  const r = Math.max(L.size.w, L.size.d);

  const poses = useMemo(() => {
    const view = { w: Math.max(10, size.width), h: Math.max(10, size.height) };
    const m = Math.min(view.w, view.h);
    const box = (at: THREE.Vector3, rad: number, hgt: number) => [-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [0, hgt].map((y) => new THREE.Vector3(at.x + sx * rad, y, at.z + sz * rad))));
    // 실제로 놓이는 것들의 바깥 점: 보드(USB 포함) · 부품 둘레 · 선의 길
    const rectPts = (x: number, y: number, w: number, h: number, hgt: number) =>
      [x, x + w].flatMap((px) => [y, y + h].flatMap((py) => [0, hgt].map((yy) => new THREE.Vector3(L.X(px), yy, L.Z(py)))));
    const boardPts = scene.boards.map((b) => [...rectPts(b.x, b.y, b.w, b.h, 30), ...("usb" in b ? rectPts(b.usb.x, b.usb.y, b.usb.w, b.usb.h, 30) : [])]);
    const partPts = scene.parts.map((p) => { const s = partSpot(p, L); return box(s.at, s.r * 0.8, 30); });
    const wirePts = scene.wires.map((_, i) => orientedWire(scene, L, i).curve.getPoints(12));
    const everything = [...boardPts.flat(), ...partPts.flat(), ...wirePts.flat()];
    const all = framePoints(everything.length ? everything : [L.focus], basis, view, Math.max(28, m * 0.08));
    const fit = all.zoom;
    const towards = (at: THREE.Vector3, k: number, zoomK: number): Pose => ({ target: all.target.clone().lerp(at, k), zoom: fit * zoomK });
    const list: CuePoses[] = steps.map((cue) => {
      if (cue.kind === "all") return { end: all };
      if (cue.kind === "place") {
        if (cue.board !== undefined) {
          // 보드만 있을 때: 보드가 화면 가운데에 크게
          const pts = boardPts[cue.board];
          return { end: pts ? framePoints(pts, basis, view, Math.max(28, m * 0.1), fit, fit * 1.6) : all };
        }
        const p = scene.parts[cue.part];
        if (!p) return { end: all };
        const s = partSpot(p, L);
        // 부품 쪽으로 다가가되 보드가 함께 보이게 (어디에 놓는지 알 수 있게)
        return { end: towards(s.at, 0.5, 1.4) };
      }
      if (!scene.wires[cue.wire]) return { end: all };
      const ow = orientedWire(scene, L, cue.wire);
      const peak = ow.curve.getPoints(24).reduce((a, p) => (p.y > a.y ? p : a));
      const close = { target: ow.seatA.clone(), zoom: Math.min(fit * 3, fit * 6) };
      const pair = framePoints([ow.seatA, ow.seatB, peak, ...box(ow.seatA, 24, 10), ...box(ow.seatB, 24, 10)], basis, view, m * 0.16, fit * 1.1, fit * 2.4);
      return { end: pair, close, midZoom: Math.sqrt(close.zoom * pair.zoom), curve: ow.curve };
    });
    return { all, list };
  }, [scene, L, steps, size.width, size.height, basis]);

  useEffect(() => {
    cam.near = -r * 10;
    cam.far = r * 10;
    cam.clearViewOffset();
    cam.updateProjectionMatrix();
    invalidate();
  }, [cam, r, invalidate]);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ scene: s3 }) => {
    const cue = steps[step];
    const here = poses.list[step];
    const start = step > 0 ? poses.list[step - 1]?.end ?? poses.all : poses.all;
    const t = elapsed(c);
    let pose: Pose = poses.all;
    if (cue && here) {
      if (cue.kind === "place") pose = lerpPose(start, here.end, easeInOut(phase(PLACE.cam, t)));
      else if (cue.kind === "all") pose = lerpPose(start, here.end, easeInOut(phase(ALL.cam, t)));
      else if (here.close && here.curve && here.midZoom) {
        const close = here.close, mid = here.midZoom;
        if (t < WIRE.draw[0]) pose = lerpPose(start, close, easeInOut(phase(WIRE.camIn, t)));
        else if (t < WIRE.camOut[0]) {
          // 그려지는 끝을 따라간다
          const k = easeInOut(phase(WIRE.draw, t));
          here.curve.getPointAt(k, tmp);
          pose = { target: close.target.clone().lerp(tmp, Math.min(1, k * 1.15)), zoom: close.zoom * Math.pow(mid / close.zoom, k) };
        } else {
          here.curve.getPointAt(1, tmp);
          pose = lerpPose({ target: tmp.clone(), zoom: mid }, here.end, easeInOut(phase(WIRE.camOut, t)));
        }
      }
    }
    const dist = r * 3;
    cam.position.copy(pose.target).addScaledVector(basis.back, dist);
    cam.up.set(0, 1, 0);
    cam.lookAt(pose.target);
    if (Math.abs(cam.zoom - pose.zoom) > 1e-6) { cam.zoom = pose.zoom; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    gl.render(s3, cam);

    const dur = cueDuration(cue);
    if (t >= dur && !c.clock.fired) c.clock.fire?.();
    // 움직이는 동안 · 꽂힌 고리가 숨 쉬는 동안(선 차례)은 계속 그린다. 끝나면 쉰다
    if (t < dur + BURST + 1.8 || (cue?.kind === "wire" && !c.reduced)) invalidate();
  }, 1);
  return null;
}
