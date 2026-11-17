import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Device } from "@/track/sim/circuit";
import { CARDS } from "@/track/sim/engine";
import { Ball, Box, Cyl, onPlane, Part, useDrag } from "../kit";
import { noOutline, toon } from "../materials";
import { useViewerApi, type ViewerState } from "../store";

/*
 * 현장 보기의 조작 부품: 가전 · 가구에 단 모듈을 학생이 직접 만진다. 회로 보기의 부품과 같은 입력(sim.inputs)을 쓴다.
 *   PressPad   — 버튼 · 터치 패드 (누르는 동안 눌림)
 *   KnobDial   — 가변저항 손잡이 (옆으로 끌어 돌린다)
 *   TiltToggle — 기울기 스위치가 달린 것 (누르면 기울어진다)
 *   CoverToggle— 빛 센서 (누르면 손으로 가린다)
 *   Slider     — 초음파 앞 물체 (사람 · 손을 한 방향으로 끌면 거리)
 *   CardPair   — RFID 카드 둘 (리더기에 대면 읽힌다)
 *   Walker     — PIR 앞 사람 (감지 원 안팎으로)
 *   Lighter    — 불꽃 센서 앞 라이터 (누르면 켜고 끈다)
 *   Clap       — 소리 센서 (누르면 짝!)
 * 좌표는 현장 모형 안 좌표 (모형 가운데 바닥이 0).
 */

type V3 = [number, number, number];

/** 그 종류 · 그 핀(없으면 첫째)의 부품 번호 */
export function partOf(s: ViewerState, kind: Device["kind"], pin?: number): number | undefined {
  const d = s.devices.find((x) => x.kind === kind && (pin === undefined || ("pin" in x && x.pin === pin)));
  return d?.part;
}

/** 버튼 · 터치 패드: 누르는 동안 눌린다 */
export function PressPad({ kind = "button", pin, at, label, color = "#e03131", size = 9, flat = false, rot }: { kind?: "button" | "touch"; pin?: number; at: V3; label: string; color?: string; size?: number; flat?: boolean; rot?: V3 }) {
  const api = useViewerApi();
  const cap = useRef<THREE.Group>(null);
  const press = (on: boolean) => (e?: ThreeEvent<PointerEvent>) => {
    e?.stopPropagation();
    const s = api.getState();
    const part = partOf(s, kind, pin);
    if (s.sim && part !== undefined) s.sim.inputs.pressed[part] = on;
    if (cap.current) cap.current.position.y = on ? -1.6 : 0;
    s.invalidate();
  };
  return (
    <group position={at} rotation={rot}>
      <Part id={`site-${kind}-${pin ?? 0}`} label={label} text={kind === "touch" ? "누르는 동안 손가락이 닿아요." : "누르는 동안 버튼이 눌려요."} card={false} lift={false}>
        {flat ? (
          <group ref={cap} onPointerDown={press(true)} onPointerUp={press(false)} onPointerLeave={press(false)}>
            <Box size={[size * 2, 1.6, size * 1.6]} at={[0, 0.8, 0]} mat={toon(color, { metal: 0.6, rough: 0.35 })} />
          </group>
        ) : (
          <>
            <Box size={[size * 1.6, 3, size * 1.6]} at={[0, 1.5, 0]} mat={toon("#2b2b30")} />
            <group ref={cap} onPointerDown={press(true)} onPointerUp={press(false)} onPointerLeave={press(false)}>
              <Cyl r={size * 0.55} h={4} at={[0, 5, 0]} mat={toon(color)} seg={20} />
            </group>
          </>
        )}
      </Part>
    </group>
  );
}

/** 가변저항 손잡이: 옆으로 끌면 돈다 (0~1) */
export function KnobDial({ pin, at, label = "손잡이(가변저항)" }: { pin?: number; at: V3; label?: string }) {
  const api = useViewerApi();
  const knob = useRef<THREE.Group>(null);
  const start = useRef<{ x: number; v: number } | null>(null);
  const get = () => { const s = api.getState(); const p = partOf(s, "pot", pin); return p !== undefined ? s.sim?.inputs.knob[p] ?? 0.5 : 0.5; };
  const drag = useDrag((e) => {
    const s = api.getState();
    const p = partOf(s, "pot", pin);
    if (!s.sim || p === undefined) return;
    if (!start.current) start.current = { x: e.nativeEvent.clientX, v: get() };
    s.sim.inputs.knob[p] = THREE.MathUtils.clamp(start.current.v + (e.nativeEvent.clientX - start.current.x) / 160, 0, 1);
  }, () => { start.current = null; });
  useFrame(() => { if (knob.current) knob.current.rotation.y = -(get() - 0.5) * Math.PI * 1.5; });
  return (
    <group position={at}>
      <Part id={`site-pot-${pin ?? 0}`} label={label} text="옆으로 끌어서 돌려 보세요." card={false} lift={false}>
        <Cyl r={9} h={3} at={[0, 1.5, 0]} mat={toon("#ced4da")} seg={24} />
        <group ref={knob} {...drag}>
          <Cyl r={6.5} h={9} at={[0, 7, 0]} mat={toon("#343a40")} seg={20} />
          <Box size={[2, 1, 6]} at={[0, 11.6, -2.5]} mat={toon("#ffffff", { outline: false })} cast={false} />
        </group>
      </Part>
    </group>
  );
}

/** 기울기 스위치가 달린 물건: 누르면 기울어지고 다시 누르면 선다 */
export function TiltToggle({ pin, children, label, angle = 0.9, axis = "z" }: { pin?: number; children: ReactNode; label: string; angle?: number; axis?: "x" | "z" }) {
  const api = useViewerApi();
  const g = useRef<THREE.Group>(null);
  const cur = useRef(0);
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    const s = api.getState();
    const p = partOf(s, "tilt", pin);
    if (s.sim && p !== undefined) s.sim.inputs.tilted[p] = !s.sim.inputs.tilted[p];
    s.invalidate();
  };
  useFrame((_, dt) => {
    const s = api.getState();
    const p = partOf(s, "tilt", pin);
    const goal = p !== undefined && s.sim?.inputs.tilted[p] ? angle : 0;
    const before = cur.current;
    cur.current += (goal - cur.current) * Math.min(1, dt * 8);
    if (g.current) g.current.rotation[axis] = cur.current;
    if (Math.abs(cur.current - before) > 1e-4) s.invalidate();
  });
  return (
    <Part id={`site-tilt-${pin ?? 0}`} label={label} text="누르면 기울어져요(기울기 스위치). 다시 누르면 바로 서요." card={false} lift={false}>
      <group ref={g} onClick={click}>{children}</group>
    </Part>
  );
}

/** 빛 센서: 누르면 손으로 가린다 */
export function CoverToggle({ pin, at, label = "빛 센서" }: { pin?: number; at: V3; label?: string }) {
  const api = useViewerApi();
  const hand = useRef<THREE.Group>(null);
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    const s = api.getState();
    const p = partOf(s, "photo", pin);
    if (s.sim && p !== undefined) s.sim.inputs.covered[p] = !s.sim.inputs.covered[p];
    s.invalidate();
  };
  useFrame(() => {
    const s = api.getState();
    const p = partOf(s, "photo", pin);
    if (hand.current) hand.current.visible = Boolean(p !== undefined && s.sim?.inputs.covered[p]);
  });
  return (
    <group position={at}>
      <Part id={`site-photo-${pin ?? 0}`} label={label} text="누르면 손으로 가려 어둡게 해요. 다시 누르면 손을 떼요." card={false} lift={false}>
        <group onClick={click}>
          <Cyl r={5} h={3} at={[0, 1.5, 0]} mat={toon("#f1f3f5")} seg={18} />
          <Ball r={3.6} at={[0, 3, 0]} mat={toon("#e8590c")} half />
        </group>
        <group ref={hand} visible={false}>
          <mesh position={[0, 9, 0]} scale={[1, 0.35, 1.2]} material={toon("#f2c9a0")} castShadow><sphereGeometry args={[9, 18, 12]} /></mesh>
        </group>
      </Part>
    </group>
  );
}

/**
 * 초음파 앞 물체를 한 방향으로 끈다: 물체의 앞면과 센서 앞면 사이가 거리(cm).
 * axis 방향(+x 또는 +z)으로 멀어진다. 1cm = perCm 단위.
 */
export function Slider({ sensor, axis = "z", start, min, max, perCm = 3, trig, label, text, y = 0, children, tagY = 60 }: {
  sensor: number; axis?: "x" | "z"; start: number; min: number; max: number; perCm?: number; trig?: number;
  label: string; text: string; y?: number; children: ReactNode; tagY?: number;
}) {
  const api = useViewerApi();
  const g = useRef<THREE.Group>(null);
  const pos = useRef(start);
  const grab = useRef<number | null>(null);
  const tag = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 220; cv.height = 76;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { cv, tex, mat: noOutline(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })), text: "" };
  }, []);
  useEffect(() => () => { tag.tex.dispose(); tag.mat.dispose(); }, [tag]);
  const drag = useDrag((e) => {
    const q = onPlane(e, y + 20);
    if (!q) return;
    const root = g.current?.parent;
    const local = root ? root.worldToLocal(q.clone()) : q;
    const v = axis === "x" ? local.x : local.z;
    if (grab.current === null) grab.current = pos.current - v;
    pos.current = THREE.MathUtils.clamp(v + grab.current, min, max);
  }, () => { grab.current = null; });
  useFrame(() => {
    const s = api.getState();
    const d = Math.max(2, (pos.current - sensor) / perCm);
    const part = s.devices.find((x) => x.kind === "ultrasonic" && (trig === undefined || x.trig === trig))?.part;
    if (s.sim && part !== undefined) s.sim.inputs.distance[part] = Math.round(d * 10) / 10;
    if (g.current) { if (axis === "x") g.current.position.x = pos.current; else g.current.position.z = pos.current; }
    const text = `${d.toFixed(1)} cm`;
    if (tag.text !== text) {
      tag.text = text;
      const c = tag.cv.getContext("2d");
      if (c) {
        const { width: w, height: h } = tag.cv;
        c.clearRect(0, 0, w, h);
        c.fillStyle = "#ffffff"; c.strokeStyle = "rgba(15,34,57,0.8)"; c.lineWidth = 4;
        c.beginPath(); c.roundRect(4, 4, w - 8, h - 14, 16); c.fill(); c.stroke();
        c.fillStyle = "#0f2239"; c.font = "700 34px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(text, w / 2, (h - 10) / 2 + 2);
        tag.tex.needsUpdate = true;
      }
    }
  });
  return (
    <group ref={g} position={axis === "x" ? [start, y, 0] : [0, y, start]} {...drag}>
      <Part id={`site-slider-${trig ?? 0}`} label={label} text={text} card={false} lift={false}>{children}</Part>
      <sprite material={tag.mat} position={[0, tagY, 0]} scale={[60, 21, 1]} renderOrder={7} raycast={() => null} />
    </group>
  );
}

/** RFID 카드 둘: 끌어서 리더기(reader)에 대면 읽힌다. 놓으면 제자리로 */
export function CardPair({ reader, homes, y = 0 }: { reader: V3; homes: [V3, V3]; y?: number }) {
  const api = useViewerApi();
  const refs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const pos = useRef(homes.map((h) => new THREE.Vector3(...h)));
  const R = new THREE.Vector3(...reader);
  const near = (k: number) => pos.current[k].distanceTo(R) < 30;
  const mk = (k: number) => useDrag((e) => {
    const q = onPlane(e, reader[1]);
    const root = refs[k].current?.parent;
    if (!q || !root) return;
    pos.current[k].copy(root.worldToLocal(q.clone()));
  }, () => {
    const s = api.getState();
    if (s.sim) s.sim.inputs.card = near(k) ? (k === 0 ? CARDS.known : CARDS.unknown) : null;
    if (!near(k)) pos.current[k].set(...homes[k]);
  });
  // 훅은 늘 같은 순서로 둘
  const drags = [mk(0), mk(1)];
  useFrame(() => {
    refs.forEach((r, k) => {
      if (!r.current) return;
      r.current.position.copy(pos.current[k]);
      if (near(k)) r.current.position.y = reader[1] + 3;
    });
  });
  void y;
  return (
    <>
      {[["등록된 카드", "#1c7ed6", "등록"], ["모르는 카드", "#f8f9fa", "모름"]].map(([name, color, word], k) => (
        <group key={name} ref={refs[k]} {...drags[k]}>
          <Part id={`site-card${k}`} label={name} text={k === 0 ? "문을 열 수 있게 등록해 둔 카드예요. 리더기로 끌어다 대 보세요." : "등록하지 않은 카드예요. 대도 문이 열리지 않아야 해요."} card={false} lift={false}>
            <Box size={[34, 2, 22]} at={[0, 1, 0]} mat={toon(color)} />
            <Box size={[10, 0.6, 6]} at={[-8, 2.2, 0]} mat={toon(k === 0 ? "#ffffff" : "#868e96", { outline: false })} cast={false} />
            <Box size={[14, 0.6, 3]} at={[6, 2.2, 5]} mat={toon(k === 0 ? "#a5d8ff" : "#ced4da", { outline: false })} cast={false} />
            {word === "등록" && <Box size={[4, 0.6, 4]} at={[10, 2.2, -5]} mat={toon("#ffd43b", { outline: false })} cast={false} />}
          </Part>
        </group>
      ))}
    </>
  );
}

/** PIR 감지 원: 원 안으로 끌면 사람이 있는 것 */
export function Walker({ center, R, start, children }: { center: V3; R: number; start: V3; children: ReactNode }) {
  const api = useViewerApi();
  const g = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(...start));
  const C = new THREE.Vector3(...center);
  const mat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: "#2f9e44", transparent: true, opacity: 0.1, depthWrite: false })), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const drag = useDrag((e) => {
    const q = onPlane(e, 20);
    const root = g.current?.parent;
    if (!q || !root) return;
    const l = root.worldToLocal(q.clone());
    pos.current.set(l.x, 0, l.z);
  });
  useFrame(() => {
    const s = api.getState();
    const inside = new THREE.Vector2(pos.current.x - C.x, pos.current.z - C.z).length() < R;
    if (s.sim && s.sim.inputs.motion !== inside) { s.sim.inputs.motion = inside; s.invalidate(); }
    mat.color.set(inside ? "#f08c00" : "#2f9e44");
    mat.opacity = inside ? 0.18 : 0.1;
    g.current?.position.copy(pos.current);
  });
  return (
    <>
      <mesh position={[C.x, 6.6, C.z]} rotation={[-Math.PI / 2, 0, 0]} material={mat} raycast={() => null}><circleGeometry args={[R, 48]} /></mesh>
      <group ref={g} {...drag}>
        <Part id="site-walker" label="사람" text="초록 원(움직임 센서가 보는 곳) 안으로 끌어 보세요." card={false} lift={false}>{children}</Part>
      </group>
    </>
  );
}

/** 라이터: 누르면 불꽃을 켜고 끈다 (불꽃 센서) */
export function Lighter({ at }: { at: V3 }) {
  const api = useViewerApi();
  const flame = useRef<THREE.Group>(null);
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    const s = api.getState();
    if (s.sim) s.sim.inputs.flame = !s.sim.inputs.flame;
    s.invalidate();
  };
  useFrame(() => { if (flame.current) flame.current.visible = Boolean(api.getState().sim?.inputs.flame); });
  return (
    <group position={at} onClick={click}>
      <Part id="site-lighter" label="라이터" text="누르면 불꽃을 켜고 꺼요. 불꽃 센서가 알아채요." card={false} lift={false}>
        <Box size={[10, 26, 6]} at={[0, 13, 0]} mat={toon("#e03131")} />
        <Box size={[10, 5, 6]} at={[0, 28, 0]} mat={toon("#ced4da")} />
        <group ref={flame} visible={false}>
          <mesh position={[0, 37, 0]} scale={[1, 1.8, 1]} material={toon("#ffd43b", { emissive: "#ff922b", emissiveIntensity: 2 })}><sphereGeometry args={[3.4, 14, 10]} /></mesh>
        </group>
      </Part>
    </group>
  );
}

/** 소리 센서 앞 손뼉: 누르면 짝! (소리 크기가 잠깐 커진다) */
export function Clap({ at }: { at: V3 }) {
  const api = useViewerApi();
  const rings = useRef<THREE.Group>(null);
  const mat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: "#7048e8", transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide })), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const s = api.getState();
    if (s.sim) s.sim.inputs.sound = 1;
    s.invalidate();
  };
  useFrame((_, dt) => {
    const s = api.getState();
    const v = s.sim?.inputs.sound ?? 0;
    if (s.sim && v > 0) { s.sim.inputs.sound = Math.max(0, v - dt * 2.2); s.invalidate(); }
    rings.current?.children.forEach((m, k) => { m.visible = v > 0.05; m.scale.setScalar(4 + (1 - v) * 20 + k * 6); });
  });
  return (
    <group position={at} onClick={click}>
      <Part id="site-clap" label="손뼉" text="누르면 짝! 하고 손뼉을 쳐요. 소리 센서가 알아채요." card={false} lift={false}>
        {[-6, 6].map((x, k) => <mesh key={x} position={[x * 0.6, 14, 0]} rotation={[0, 0, k ? -0.4 : 0.4]} scale={[0.5, 1.2, 1]} material={toon("#f2c9a0")} castShadow><sphereGeometry args={[8, 16, 12]} /></mesh>)}
      </Part>
      <group ref={rings} position={[0, 14, 0]} rotation={[0, 0, 0]}>
        {[0, 1].map((k) => <mesh key={k} material={mat} visible={false} raycast={() => null}><ringGeometry args={[0.85, 1, 32]} /></mesh>)}
      </group>
    </group>
  );
}
