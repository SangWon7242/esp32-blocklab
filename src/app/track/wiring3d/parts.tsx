import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Device } from "@/track/sim/circuit";
import { CARDS } from "@/track/sim/engine";
import type { Part3D, Pt } from "@/track/wiring3d";
import { Ball, Box, Cyl, Decal, onPlane, Part, Tube, useDrag } from "./kit";
import { BB_H, type Layout } from "./layout";
import { canvasTexture, COLOR, glowTexture, noOutline, toon, toonOwn } from "./materials";
import { HandFigure, PersonFigure, WallFigure } from "./figures";
import { paintOled } from "./oled";
import { sonarTargetFor } from "./diorama";
import { useViewer, useViewerApi, type ViewerState } from "./store";
import { MODULE, TEXT } from "./texts";

/*
 * 부품 3D 모델과 그 움직임.
 *   - 출력 부품(LED · 부저 · 서보 · 팬 · OLED …)은 시뮬레이션 출력(sim.outputs)을 매 화면 읽어 움직인다
 *   - 입력 부품(버튼 · 가변저항 · 조이스틱 · 센서 …)은 손으로 조작하면 sim.inputs 를 바꾼다
 * 좌표: 그림 px. L.v(점, 높이) 로 3D 자리를 얻는다.
 */

type P<T extends Part3D["type"]> = { p: Extract<Part3D, { type: T }>; i: number; L: Layout };

const outputs = (s: ViewerState) => (s.running && s.sim ? s.sim.outputs : null);
const deviceOf = <K extends Device["kind"]>(s: ViewerState, i: number, kind: K) => s.devices.find((d): d is Extract<Device, { kind: K }> => d.part === i && d.kind === kind);
const mean = (ps: Pt[]) => ({ x: ps.reduce((n, p) => n + p.x, 0) / ps.length, y: ps.reduce((n, p) => n + p.y, 0) / ps.length });
const leg = () => toon(COLOR.leg, { outline: false });
/** 구멍에서 곧게 올라오는 다리 */
const LegUp = ({ p, h, L }: { p: Pt; h: number; L: Layout }) => <Cyl r={1} h={h + 2} at={[L.X(p.x), BB_H + h / 2 - 1, L.Zp(p)]} mat={leg()} seg={8} />;

/** 빛 번짐 (켜진 LED 둘레) */
function useHalo(color: string) {
  const mat = useMemo(() => noOutline(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, depthTest: false })), [color]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

/* ───────────── LED ───────────── */

export function Led({ p, i, L }: P<"led">) {
  const api = useViewerApi();
  const glass = useMemo(() => toonOwn({ color: p.color, emissive: p.color, emissiveIntensity: 0.1, transparent: true, opacity: 0.92 }), [p.color]);
  const halo = useHalo(p.color);
  const haloRef = useRef<THREE.Sprite>(null);
  useEffect(() => () => glass.dispose(), [glass]);
  const headY = BB_H + 28;
  const mid = mean([p.a, p.c]);
  const topOf = (q: Pt) => new THREE.Vector3(L.X(mid.x + (q.x - mid.x) * 0.45), headY, L.Zp(mid));
  const x = L.X(mid.x), z = L.Zp(mid);
  useFrame(() => {
    const s = api.getState();
    const color = s.ledColor[i] ?? p.color;
    const d = deviceOf(s, i, "led");
    const v = d ? outputs(s)?.pins[d.pin] ?? 0 : 0;
    const lit = v * s.dim;
    glass.color.set(color);
    glass.emissive.set(color);
    halo.color.set(color);
    const e = lit > 0.01 ? 0.35 + 1.5 * lit : 0.1;
    if (Math.abs(glass.emissiveIntensity - e) > 0.01) { glass.emissiveIntensity = e; s.invalidate(); }
    if (haloRef.current) {
      haloRef.current.visible = lit > 0.01;
      haloRef.current.scale.setScalar(40 + 60 * lit);
      halo.opacity = 0.25 + 0.6 * lit;
    }
  });
  return (
    <Part id={`part${i}`} label="LED" text={TEXT.led} control={{ type: "led", part: i }}>
      {[p.a, p.c].map((q, k) => <Tube key={k} points={[L.v(q, BB_H - 2), L.v(q, BB_H + 12), topOf(q).setY(headY - 8), topOf(q)]} radius={1} mat={leg()} />)}
      <Cyl r={11} h={2.6} at={[x, headY + 1.3, z]} mat={glass} seg={28} />
      <Cyl r={9.2} h={13} at={[x, headY + 9, z]} mat={glass} seg={28} />
      <Ball r={9.2} at={[x, headY + 15.5, z]} mat={glass} half />
      <Ball r={2.4} at={[x - 5.2, headY + 14, z + 6.4]} mat={toon("#ffffff", { outline: false })} scale={[1, 1.7, 1]} />
      <sprite ref={haloRef} material={halo} position={[x, headY + 10, z]} visible={false} renderOrder={1} raycast={() => null} />
    </Part>
  );
}

/* ───────────── 저항 ───────────── */

export function Resistor({ p, i, L }: P<"resistor">) {
  const y = BB_H + 7;
  const a = L.v(p.a, y), b = L.v(p.b, y);
  const dir = b.clone().sub(a).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const center = a.clone().add(b).multiplyScalar(0.5);
  const euler = new THREE.Euler().setFromQuaternion(quat);
  const rot: [number, number, number] = [euler.x, euler.y, euler.z];
  return (
    <Part id={`part${i}`} label={p.label ? `${p.label} 저항` : "저항"} text={TEXT.resistor} control={/220/.test(p.label ?? "") ? { type: "resistor" } : undefined}>
      <Tube points={[L.v(p.a, BB_H - 2), a.clone().setY(y - 1), a, b, b.clone().setY(y - 1), L.v(p.b, BB_H - 2)]} radius={1} mat={leg()} tension={0.05} />
      <mesh position={center} rotation={rot} material={toon("#e3c08a")} castShadow>
        <capsuleGeometry args={[5, 20, 6, 16]} />
      </mesh>
      {p.bands.map((color, k) => {
        const c = center.clone().add(dir.clone().multiplyScalar(-7 + k * 6));
        return <Cyl key={k} r={5.3} h={2.6} at={[c.x, c.y, c.z]} rot={rot} mat={toon(color, { outline: false })} seg={16} />;
      })}
    </Part>
  );
}

/* ───────────── 버튼 (누르는 동안 눌린다) ───────────── */

export function Button({ p, i, L }: P<"button">) {
  const api = useViewerApi();
  const cap = useRef<THREE.Mesh>(null);
  const c = mean(p.legs);
  const [down, setDown] = useState(false);
  const press = (on: boolean) => {
    const s = api.getState();
    if (s.sim) s.sim.inputs.pressed[i] = on;
    setDown(on);
    s.invalidate();
  };
  useEffect(() => {
    if (!down) return;
    const up = () => press(false);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  });
  return (
    <Part id={`part${i}`} label="버튼" text={`${TEXT.tact} 눌러 보세요.`} card={false}>
      {p.legs.map((q, k) => <LegUp key={k} p={q} h={3} L={L} />)}
      <group onPointerDown={(e) => { e.stopPropagation(); press(true); }}>
        <Box size={[36, 9, 36]} at={[L.X(c.x), BB_H + 5.5, L.Zp(c)]} mat={toon(COLOR.plastic)} />
        <mesh ref={cap} position={[L.X(c.x), BB_H + (down ? 10.5 : 12.5), L.Zp(c)]} material={toon(p.color)} castShadow>
          <cylinderGeometry args={[11, 11, 7, 24]} />
        </mesh>
      </group>
    </Part>
  );
}

/* ───────────── 부저 (울리면 떨고 소리 고리가 퍼진다) ───────────── */

export function Buzzer({ p, i, L }: P<"buzzer">) {
  const api = useViewerApi();
  const body = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const c = mean([p.a, p.b]);
  const x = L.X(c.x), z = L.Zp(c);
  const ringMat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: "#495057", transparent: true, depthWrite: false })), []);
  const t = useRef(0);
  useFrame((_, dt) => {
    const s = api.getState();
    const d = deviceOf(s, i, "buzzer");
    const hz = d ? outputs(s)?.tone[d.pin] ?? 0 : 0;
    const on = hz > 0 || (d && p.active && (outputs(s)?.pins[d.pin] ?? 0) > 0.5);
    t.current += dt;
    if (body.current) body.current.position.x = on ? Math.sin(t.current * 90) * 0.5 : 0;
    rings.current?.children.forEach((r, k) => {
      const ph = (t.current * 1.6 + k / 3) % 1;
      r.visible = Boolean(on);
      r.scale.setScalar(18 + ph * 40);
      ((r as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - ph);
    });
    if (on) s.invalidate();
  });
  return (
    <Part id={`part${i}`} label="부저" text={TEXT.buzzer}>
      {[p.a, p.b].map((q, k) => <LegUp key={k} p={q} h={5} L={L} />)}
      <group ref={body}>
        <Cyl r={17} h={18} at={[x, BB_H + 13, z]} mat={toon(COLOR.plastic)} seg={28} />
        <Cyl r={3.5} h={1} at={[x, BB_H + 22.2, z]} mat={toon("#0d0d10", { outline: false })} seg={16} />
        {p.active && <Cyl r={12} h={0.8} at={[x, BB_H + 22.3, z]} mat={toon(COLOR.white, { outline: false })} seg={24} />}
      </group>
      <group ref={rings} position={[x, BB_H + 22.5, z]} rotation={[-Math.PI / 2, 0, 0]}>
        {[0, 1, 2].map((k) => <mesh key={k} material={ringMat.clone()} visible={false} raycast={() => null}><ringGeometry args={[0.92, 1, 40]} /></mesh>)}
      </group>
    </Part>
  );
}

/* ───────────── 가변저항 (손잡이를 끌어 돌린다) ───────────── */

export function Pot({ p, i, L }: P<"pot">) {
  const api = useViewerApi();
  const knob = useRef<THREE.Group>(null);
  const m = p.legs[1];
  const x = L.X(m.x), z = L.Zp(m);
  const get = () => api.getState().sim?.inputs.knob[i] ?? 0.5;
  const drag = useDrag((e) => {
    const s = api.getState();
    if (!s.sim) return;
    const v = Math.max(0, Math.min(1, get() + (e.nativeEvent.movementX - e.nativeEvent.movementY) / 220));
    s.sim.inputs.knob[i] = v;
  });
  useFrame(() => {
    if (knob.current) knob.current.rotation.y = -(get() - 0.5) * (Math.PI * 1.5);
  });
  return (
    <Part id={`part${i}`} label="가변저항" text={`${TEXT.pot} 손잡이를 잡고 끌어 돌려 보세요.`} card={false}>
      {p.legs.map((q, k) => <LegUp key={k} p={q} h={4} L={L} />)}
      <Box size={[46, 16, 30]} at={[x, BB_H + 11, z]} mat={toon("#1971c2")} />
      <group ref={knob} position={[x, BB_H + 25, z]} {...drag}>
        <Cyl r={11} h={12} at={[0, 0, 0]} mat={toon(COLOR.white)} seg={24} />
        <Box size={[2.6, 1.2, 10]} at={[0, 6.3, -4.5]} mat={toon(COLOR.plastic, { outline: false })} />
      </group>
    </Part>
  );
}

/* ───────────── 포토레지스터 (누르면 손으로 가린다) ───────────── */

export function Photo({ p, i, L }: P<"photo">) {
  const api = useViewerApi();
  const [covered, setCovered] = useState(false);
  const c = mean([p.a, p.b]);
  const x = L.X(c.x), z = L.Zp(c);
  const toggle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    const s = api.getState();
    if (s.sim) s.sim.inputs.covered[i] = !covered;
    setCovered(!covered);
    s.invalidate();
  };
  const skin = toon("#f1c27d");
  return (
    <Part id={`part${i}`} label="포토레지스터 (빛 센서)" text={`${TEXT.photo} 누르면 손으로 가려요.`} card={false}>
      <group onClick={toggle}>
        {[p.a, p.b].map((q, k) => <LegUp key={k} p={q} h={14} L={L} />)}
        <Cyl r={11} h={5} at={[x, BB_H + 17, z]} mat={toon("#ffe8cc")} seg={24} />
        <Decal w={18} d={18} at={[x, BB_H + 19.7, z]} px={128} paint={(g, w, h) => {
          g.strokeStyle = "#c92a2a"; g.lineWidth = 11; g.lineJoin = "round"; g.beginPath();
          [[0.15, 0.25], [0.35, 0.25], [0.35, 0.75], [0.6, 0.75], [0.6, 0.25], [0.85, 0.25], [0.85, 0.75]].forEach(([px, py], k) => (k ? g.lineTo(px * w, py * h) : g.moveTo(px * w, py * h)));
          g.stroke();
        }} />
      </group>
      {covered && (
        // 손: 손바닥 + 손가락 넷 (센서 위를 덮는다)
        <group position={[x + 6, BB_H + 34, z + 4]} rotation={[0, 0.5, 0]}>
          <Box size={[34, 9, 30]} at={[0, 0, 0]} mat={skin} />
          {[-12, -4, 4, 12].map((dx) => <mesh key={dx} position={[dx, 0, -24]} rotation={[Math.PI / 2, 0, 0]} material={skin} castShadow><capsuleGeometry args={[3.6, 14, 4, 10]} /></mesh>)}
          <mesh position={[19, 0, 4]} rotation={[0, 0, Math.PI / 2.4]} material={skin} castShadow><capsuleGeometry args={[3.8, 12, 4, 10]} /></mesh>
        </group>
      )}
    </Part>
  );
}

/* ───────────── 틸트 스위치 (누르면 기운다, 안의 구슬이 구른다) ───────────── */

export function Tilt({ p, i, L }: P<"tilt">) {
  const api = useViewerApi();
  const body = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  const c = mean([p.a, p.b]);
  const x = L.X(c.x), z = L.Zp(c);
  const tilted = () => api.getState().sim?.inputs.tilted[i] ?? false;
  const toggle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    const s = api.getState();
    if (s.sim) s.sim.inputs.tilted[i] = !tilted();
    s.invalidate();
  };
  useFrame(() => {
    const goal = tilted() ? 1.1 : 0;
    const g = body.current;
    if (!g) return;
    const d = goal - g.rotation.z;
    if (Math.abs(d) > 0.005) { g.rotation.z += d * 0.18; api.getState().invalidate(); }
    if (ball.current) ball.current.position.y = 6 + 16 * (g.rotation.z / 1.1);
  });
  return (
    <Part id={`part${i}`} label="틸트 스위치" text={`${TEXT.tilt} 누르면 기울어요.`} card={false}>
      {[p.a, p.b].map((q, k) => <LegUp key={k} p={q} h={6} L={L} />)}
      <group ref={body} position={[x, BB_H + 6, z]} onClick={toggle}>
        <Cyl r={8} h={24} at={[0, 12, 0]} mat={toonOwn({ color: "#3a3d45", transparent: true, opacity: 0.55 })} seg={20} />
        <Cyl r={8.2} h={3} at={[0, 1.5, 0]} mat={toon("#adb5bd", { outline: false })} seg={20} />
        <mesh ref={ball} position={[0, 6, 0]} material={toon("#dee2e6")} castShadow><sphereGeometry args={[5, 16, 12]} /></mesh>
      </group>
    </Part>
  );
}

/* ───────────── RGB LED (세 색을 섞는다) ───────────── */

export function Rgb({ p, i, L }: P<"rgb">) {
  const api = useViewerApi();
  const c = mean(p.legs);
  const x = L.X(c.x), z = L.Zp(c);
  const glass = useMemo(() => toonOwn({ color: "#f8f9fa", transparent: true, opacity: 0.9, emissive: "#ffffff", emissiveIntensity: 0.05 }), []);
  const halo = useHalo("#ffffff");
  const haloRef = useRef<THREE.Sprite>(null);
  useEffect(() => () => glass.dispose(), [glass]);
  useFrame(() => {
    const s = api.getState();
    const d = deviceOf(s, i, "rgb");
    const o = outputs(s);
    const ch = (pin?: number) => (o && pin !== undefined ? o.pins[pin] ?? 0 : 0);
    const r = ch(d?.r), g = ch(d?.g), b = ch(d?.b);
    const lit = Math.max(r, g, b);
    const col = new THREE.Color(r, g, b);
    glass.emissive.copy(lit > 0.01 ? col : new THREE.Color("#ffffff"));
    glass.emissiveIntensity = lit > 0.01 ? 0.5 + 1.2 * lit : 0.05;
    halo.color.copy(col);
    if (haloRef.current) { haloRef.current.visible = lit > 0.01; haloRef.current.scale.setScalar(40 + 60 * lit); }
    if (o) s.invalidate();
  });
  return (
    <Part id={`part${i}`} label="RGB LED" text={TEXT.rgb}>
      {p.legs.map((q, k) => <Tube key={k} points={[L.v(q, BB_H - 2), L.v(q, BB_H + 10), new THREE.Vector3(L.X(c.x + (q.x - c.x) * 0.3), BB_H + 22, z), new THREE.Vector3(L.X(c.x + (q.x - c.x) * 0.3), BB_H + 28, z)]} radius={1} mat={leg()} />)}
      <Cyl r={11} h={2.6} at={[x, BB_H + 29.3, z]} mat={glass} seg={28} />
      <Cyl r={9.2} h={13} at={[x, BB_H + 37, z]} mat={glass} seg={28} />
      <Ball r={9.2} at={[x, BB_H + 43.5, z]} mat={glass} half />
      <sprite ref={haloRef} material={halo} position={[x, BB_H + 38, z]} visible={false} raycast={() => null} />
    </Part>
  );
}

/* ───────────── IR 수신기 + 리모컨 ───────────── */

export function IrRx({ p, i, L }: P<"irrx">) {
  const m = p.legs[1];
  const x = L.X(m.x), z = L.Zp(m);
  return (
    <Part id={`part${i}`} label="IR 수신기" text={TEXT.irrx}>
      {p.legs.map((q, k) => <LegUp key={k} p={q} h={8} L={L} />)}
      <Box size={[30, 24, 12]} at={[x, BB_H + 20, z]} mat={toon(COLOR.plastic)} />
      <Ball r={7} at={[x, BB_H + 22, z + 6]} mat={toon("#3a3a42")} />
    </Part>
  );
}

/** 리모컨: 단추를 누르면 그 코드가 수신기로 간다 */
export function Remote({ at }: { at: THREE.Vector3 }) {
  const api = useViewerApi();
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#", "OK"];
  const send = (k: string) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    api.getState().sim?.inputs.ir.push(k);
    api.getState().invalidate();
  };
  return (
    <Part id="remote" label="리모컨" text="단추를 누르면 눈에 보이지 않는 빛 신호를 쏴요. 수신기 쪽을 보고 눌러 보세요." card={false} position={[at.x, 0, at.z]}>
      <Box size={[52, 10, 120]} at={[0, 5, 0]} mat={toon("#343a40")} />
      <Box size={[8, 4, 6]} at={[0, 6, -62]} mat={toon("#c92a2a", { outline: false })} />
      {keys.map((k, n) => {
        const kx = ((n % 3) - 1) * 14, kz = -36 + Math.floor(n / 3) * 16;
        return (
          <group key={k} onPointerDown={send(k)}>
            <Box size={[11, 3, 11]} at={[kx, 11.5, kz]} mat={toon(k === "OK" ? "#f08c00" : "#ced4da")} />
          </group>
        );
      })}
      <Decal w={44} d={76} at={[0, 13.2, 0]} px={176} paint={(g, w, h) => {
        g.fillStyle = "#212529"; g.font = `700 ${Math.round(w * 0.13)}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        keys.forEach((k, n) => g.fillText(k, w / 2 + ((n % 3) - 1) * 14 * (w / 44), (h / 76) * (38 - 36 + Math.floor(n / 3) * 16)));
      }} />
    </Part>
  );
}

/* ───────────── 칩 (74HC595 등) ───────────── */

export function Dip({ p, i, L }: P<"dip">) {
  const w = p.r.x - p.l.x + 18, d = p.r.y - p.l.y - 6;
  const cx = L.X((p.l.x + p.r.x) / 2), cz = L.Zp(mean([p.l, p.r]));
  const legs: Pt[] = [];
  for (let x = p.l.x; x <= p.r.x + 0.5; x += 16) legs.push({ x, y: p.l.y }, { x, y: p.r.y });
  return (
    <Part id={`part${i}`} label={p.label ? `${p.label} 칩` : "칩"} text={TEXT.dip}>
      <Box size={[w, 9, d]} at={[cx, BB_H + 6.5, cz]} mat={toon(COLOR.plastic)} />
      {legs.map((q, k) => <Box key={k} size={[3, 7, 3]} at={[L.X(q.x), BB_H + 3, L.Zp(q)]} mat={leg()} />)}
      <Decal w={w - 6} d={d - 4} at={[cx, BB_H + 11.2, cz]} paint={(g, cw, ch) => {
        g.fillStyle = "#f1f3f5"; g.font = `700 ${Math.round(ch * 0.5)}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(p.label, cw / 2, ch / 2);
        g.strokeStyle = "#868e96"; g.lineWidth = 6; g.beginPath(); g.arc(0, ch / 2, ch * 0.2, -Math.PI / 2, Math.PI / 2); g.stroke();
      }} />
    </Part>
  );
}

/* ───────────── 서보 (팔이 각도만큼 돈다) ───────────── */

export function Servo({ p, i, L }: P<"servo">) {
  const api = useViewerApi();
  const horn = useRef<THREE.Group>(null);
  const zz = L.zIn({ y: p.y, h: 44 });
  const { x, y } = p;
  const blue = toon("#1971c2");
  const plugTop = p.onBoard ? L.topAt(p.plug[0]) + 14 : 8;
  const left = !p.onBoard && p.plugBox !== undefined && p.plugBox.x < x;
  useFrame(() => {
    const s = api.getState();
    const d = deviceOf(s, i, "servo");
    const a = d ? outputs(s)?.servo[d.pin] : undefined;
    const goal = THREE.MathUtils.degToRad((a ?? 90) - 90);
    const g = horn.current;
    if (!g) return;
    const diff = goal - g.rotation.y;
    if (Math.abs(diff) > 0.002) { g.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), 0.09); s.invalidate(); }
  });
  const xs = p.plug.map((q) => q.x), ys = p.plug.map((q) => q.y);
  return (
    <Part id={`part${i}`} label="서보 모터" text={TEXT.servo}>
      <Box size={[66, 36, 44]} at={[L.X(x + 33), 18, zz(y + 22)]} mat={blue} />
      <Box size={[82, 4, 14]} at={[L.X(x + 33), 26, zz(y + 22)]} mat={blue} />
      <Cyl r={13} h={5} at={[L.X(x + 44), 38.5, zz(y + 22)]} mat={blue} seg={24} />
      <group ref={horn} position={[L.X(x + 44), 43, zz(y + 22)]}>
        <Cyl r={5} h={6} at={[0, 0, 0]} mat={toon(COLOR.white)} seg={16} />
        {/* 한쪽 팔: 각도를 읽기 쉽게 (문 · 차단기 막대) */}
        <Box size={[8, 2.6, 44]} at={[0, 3, -18]} mat={toon(COLOR.white)} />
        <Cyl r={4} h={2.6} at={[0, 3, -40]} mat={toon(COLOR.white)} seg={16} />
      </group>
      {["#8b5a2b", "#e03131", "#f76707"].map((color, k) => {
        const end = p.plug[k];
        const from = new THREE.Vector3(L.X(left ? x : x + 66), 12, zz(y + 13 + k * 9));
        const out = from.clone().add(new THREE.Vector3(left ? -16 : 16, 0, 0));
        const to = L.v(end, plugTop);
        return <Tube key={k} points={[from, out, out.clone().lerp(to, 0.5).setY(Math.max(18, plugTop + 16)), to.clone().setY(plugTop + 8), to]} radius={1.8} mat={toon(color, { outline: false })} />;
      })}
      {p.onBoard ? (
        <Box size={[Math.max(...xs) - Math.min(...xs) + 14, 14, L.Zp({ x: 0, y: Math.max(...ys) }) - L.Zp({ x: 0, y: Math.min(...ys) }) + 14]} at={[L.X((Math.min(...xs) + Math.max(...xs)) / 2), L.topAt(p.plug[0]) + 7.5, (L.Zp(p.plug[0]) + L.Zp(p.plug[2])) / 2]} mat={toon(COLOR.plastic)} />
      ) : p.plugBox ? (
        <Box size={[p.plugBox.w, 8, p.plugBox.h]} at={[L.X(p.plugBox.x + p.plugBox.w / 2), 4, zz(p.plugBox.y + p.plugBox.h / 2)]} mat={toon(COLOR.plastic)} />
      ) : null}
    </Part>
  );
}

/* ───────────── 모듈 ───────────── */

type Mod = Extract<Part3D, { type: "module" }>;

/** 모듈 판 · 핀 받침 · 핀 · 핀 이름 (모든 모듈 공통) */
function ModuleBase({ p, L, zz }: { p: Mod; L: Layout; zz: (y: number) => number }) {
  const edge = p.side === "bottom" ? p.y + p.h : p.y;
  const dir = p.side === "bottom" ? 1 : -1;
  const xs = p.pins.map((q) => q.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  return (
    <>
      <Box size={[x1 - x0 + 14, 6, 7]} at={[L.X((x0 + x1) / 2), 5, zz(edge - dir * 4)]} mat={toon(COLOR.plastic)} />
      {p.pins.map((q) => <Box key={q.name} size={[2.6, 2.6, 16]} at={[L.X(q.x), 5, zz(edge + dir * 6)]} mat={toon(COLOR.gold)} />)}
    </>
  );
}

function PinNames({ p, L, zz, y }: { p: Mod; L: Layout; zz: (y: number) => number; y: number }) {
  const edge = p.side === "bottom" ? p.y + p.h : p.y;
  const dir = p.side === "bottom" ? 1 : -1;
  const xs = p.pins.map((q) => q.x);
  const x0 = Math.min(...xs), span = Math.max(...xs) - x0 + 24;
  return (
    <Decal w={span} d={12} at={[L.X(x0 - 12 + span / 2), y, zz(edge - dir * 14)]} px={Math.round(span * 4)} paint={(g, cw, ch) => {
      g.fillStyle = "#ffffff"; g.font = `700 ${Math.round(ch * 0.62)}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
      p.pins.forEach((q) => g.fillText(q.name, ((q.x - x0 + 12) / span) * cw, ch / 2));
    }} />
  );
}

export function Module({ p, i, L }: P<"module">) {
  const api = useViewerApi();
  const info = MODULE[p.kind] ?? MODULE.generic;
  const name = p.title || info.name;
  const zz = L.zIn(p);
  if (p.kind === "ultrasonic") return <Ultrasonic p={p} i={i} L={L} zz={zz} name={name} text={info.text} />;
  const cx = L.X(p.x + p.w / 2), cz = zz(p.y + p.h / 2);
  return (
    <>
      <Part id={`part${i}`} label={name} text={p.kind === "oled" ? `${info.text} 누르면 화면을 세워서 크게 볼 수 있어요.` : info.text} card={!["joystick", "keypad", "sound", "flame"].includes(p.kind)}
        onPick={p.kind === "oled" ? () => { const s = api.getState(); s.set({ oledZoom: i, selected: null, hover: null }); s.invalidate(); } : undefined}>
        <Box size={[p.w, 4, p.h]} at={[cx, 2, cz]} mat={toon(p.color)} />
        <ModuleBase p={p} L={L} zz={zz} />
        <PinNames p={p} L={L} zz={zz} y={4.2} />
        <ModuleTop p={p} i={i} L={L} zz={zz} />
      </Part>
      {p.kind === "rfid" && <Cards p={p} L={L} zz={zz} />}
      {p.kind === "pir" && <Person p={p} L={L} zz={zz} />}
      {p.kind === "ir" && <Remote at={new THREE.Vector3(L.X(p.x + p.w + 60), 0, zz(p.y + p.h / 2))} />}
    </>
  );
}

/** 모듈마다 위에 올라간 것 */
function ModuleTop({ p, i, L, zz }: { p: Mod; i: number; L: Layout; zz: (y: number) => number }) {
  const api = useViewerApi();
  const { x, y, w, h } = p;
  switch (p.kind) {
    case "oled": return <OledScreen p={p} L={L} zz={zz} />;
    case "rfid": {
      const top = p.side === "top" ? y + 36 : y + 10;
      return <Decal w={w - 24} d={h - 44} at={[L.X(x + w / 2), 4.2, zz(top + (h - 48) / 2)]} paint={(g, cw, ch) => {
        g.strokeStyle = "#a5d8ff"; g.lineWidth = 9; g.strokeRect(8, 8, cw - 16, ch - 16); g.lineWidth = 6; g.strokeRect(34, 34, cw - 68, ch - 68);
      }} />;
    }
    case "dht": return (
      <>
        <Box size={[40, 20, 34]} at={[L.X(x + 38), 14, zz(y + 25)]} mat={toon("#d0ebff")} />
        {[0, 1, 2, 3].map((k) => <Box key={k} size={[28, 0.8, 2.4]} at={[L.X(x + 38), 24.3, zz(y + 15 + k * 7)]} mat={toon("#74c0fc", { outline: false })} cast={false} />)}
      </>
    );
    case "pir": return <Ball r={23} at={[L.X(x + 38), 4, zz(y + 32)]} mat={toonOwn({ color: "#f8f9fa", transparent: true, opacity: 0.95 })} half />;
    case "sound": return <SoundMic p={p} i={i} L={L} zz={zz} />;
    case "flame": return <FlameEye p={p} L={L} zz={zz} />;
    case "ir": case "lm35": return (
      <>
        <Box size={[22, 16, 12]} at={[L.X(x + 38), 12, zz(y + 28)]} mat={toon(COLOR.plastic)} />
        <Ball r={6} at={[L.X(x + 38), 20, zz(y + 28)]} mat={toon("#3a3a42")} />
      </>
    );
    case "joystick": return <Joystick p={p} i={i} L={L} zz={zz} />;
    case "keypad": return <Keypad p={p} L={L} zz={zz} />;
    case "fan": return <Fan p={p} i={i} L={L} zz={zz} />;
    case "soil": {
      // 두 갈래 금빛 다리 (흙에 꽂는 쪽) · 비교 칩
      const cx = L.X(x + w / 2), legY = p.side === "top" ? y + h - 4 : y + 4;
      const span = h * 0.62, mid = p.side === "top" ? legY - span / 2 : legY + span / 2;
      return (
        <>
          {[-0.2, 0.2].map((k) => <Box key={k} size={[w * 0.16, 1, span]} at={[cx + k * w, 4.6, zz(mid)]} mat={toon("#d4a72c", { metal: 0.9, rough: 0.3 })} cast={false} />)}
          <Box size={[10, 2.4, 8]} at={[cx, 5.4, zz(p.side === "top" ? y + 26 : y + h - 26)]} mat={toon("#212529")} />
        </>
      );
    }
    case "water": {
      // 물에 잠그는 은빛 줄무늬
      const cx = L.X(x + w / 2), mid = p.side === "top" ? y + h * 0.62 : y + h * 0.38;
      return <>{Array.from({ length: 9 }, (_, k) => <Box key={k} size={[1.6, 0.6, h * 0.5]} at={[cx - w * 0.32 + (k * w * 0.64) / 8, 4.4, zz(mid)]} mat={toon("#dee2e6", { metal: 0.9, rough: 0.3 })} cast={false} />)}</>;
    }
    case "relay": {
      // 파란 릴레이 통 · 빨간 불(신호가 오면 켜진다)
      const cx = L.X(x + w / 2), mid = y + h / 2;
      return (
        <>
          <Box size={[w * 0.5, 15, h * 0.42]} at={[cx, 11.5, zz(mid)]} mat={toon("#2f6fdb")} />
          <Decal w={w * 0.44} d={h * 0.3} at={[cx, 19.1, zz(mid)]} px={160} paint={(g, cw, ch) => { g.fillStyle = "#ffffff"; g.font = `700 ${Math.round(ch * 0.28)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("SRD-05VDC", cw / 2, ch * 0.35); g.fillText("10A 250VAC", cw / 2, ch * 0.7); }} />
          <RelayLamp p={p} i={i} L={L} zz={zz} />
        </>
      );
    }
    default: void api; return null;
  }
}

/* ── 초음파: 세워 둔 판, 눈이 앞을 본다. 앞의 자동차를 끌어 거리를 바꾼다 ── */

function Ultrasonic({ p, i, L, zz, name, text }: { p: Mod; i: number; L: Layout; zz: (y: number) => number; name: string; text: string }) {
  const api = useViewerApi();
  const track = L.sonars.find((t) => t.part === i)!;
  const face = track.face;
  const edge = face < 0 ? p.y + p.h : p.y;
  const car = useRef<THREE.Group>(null);
  const pings = useRef<THREE.Group>(null);
  const clock = useRef(0);
  const cm = () => api.getState().sim?.inputs.distance[i] ?? 30;
  // 자동차 위 거리 글자: 3D 안의 그림판(스프라이트) — 숫자가 바뀔 때만 다시 그린다
  const tag = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 200; cv.height = 76;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = noOutline(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    return { cv, tex, mat, text: "" };
  }, []);
  useEffect(() => () => { tag.tex.dispose(); tag.mat.dispose(); }, [tag]);
  const paintTag = (text: string) => {
    if (tag.text === text) return;
    tag.text = text;
    const g = tag.cv.getContext("2d");
    if (!g) return;
    const { width: w, height: h } = tag.cv;
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(15,34,57,0.22)";
    g.beginPath(); g.roundRect(4, 10, w - 8, h - 14, 16); g.fill();
    g.fillStyle = "#ffffff"; g.strokeStyle = "rgba(15,34,57,0.8)"; g.lineWidth = 4;
    g.beginPath(); g.roundRect(4, 4, w - 8, h - 14, 16); g.fill(); g.stroke();
    g.fillStyle = "#0f2239"; g.font = "700 36px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, (h - 10) / 2 + 2);
    tag.tex.needsUpdate = true;
  };
  const chapterId = useViewer((s) => s.chapterId);
  const target = sonarTargetFor(chapterId);
  const what = { car: "자동차", person: "사람", hand: "손", wall: "벽", none: "" }[target];
  // 물체 앞면까지의 거리: 자동차는 길이의 반, 사람 · 손 · 벽은 몸 앞쪽
  const half = { car: 50, person: 12, hand: 6, wall: 9, none: 0 }[target];
  const tagY = { car: 72, person: 136, hand: 70, wall: 98, none: 0 }[target];
  const carZ = (d: number) => track.origin.z + face * d * track.perCm;
  const drag = useDrag((e) => {
    const s = api.getState();
    const q = onPlane(e, 10);
    if (!q || !s.sim) return;
    const d = Math.max(2, Math.min(36, (q.z - track.origin.z) * face / track.perCm));
    s.sim.inputs.distance[i] = Math.round(d * 10) / 10;
  });
  useFrame((_, dt) => {
    const s = api.getState();
    if (s.sim && s.sim.inputs.distance[i] === undefined) s.sim.inputs.distance[i] = 30;
    const d = cm();
    if (car.current) car.current.position.z = carZ(d) + face * half;
    paintTag(`${d.toFixed(1)} cm`);
    // 실행 중: 소리 고리가 센서에서 물체까지 갔다 돌아온다
    clock.current += dt;
    const run = s.running;
    pings.current?.children.forEach((r, k) => {
      const ph = (clock.current * 1.4 + k / 3) % 1;
      r.visible = run && target !== "none";
      r.position.z = track.origin.z + face * ph * d * track.perCm;
      r.scale.setScalar(10 + ph * 16);
      ((r as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - ph);
    });
    if (run) s.invalidate();
  });
  // 판을 핀 쪽 가장자리를 축으로 세운다. 세운 뒤 판의 아랫면(local −y)이 물체 쪽을 본다 → 눈은 아랫면에 단다
  const tilt = face < 0 ? Math.PI / 2 : -Math.PI / 2;
  const ringMat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: "#2f9e44", transparent: true, depthWrite: false, side: THREE.DoubleSide })), []);
  return (
    <>
      <Part id={`part${i}`} label={name} text={target === "none" ? `${text} 오른쪽 지팡이 모형을 벽 쪽으로 끌어 거리를 바꿔 보세요.` : `${text} 앞의 ${what}${what === "자동차" ? "를" : "을"} 끌어 거리를 바꿔 보세요.`}>
        <ModuleBase p={p} L={L} zz={zz} />
        <group position={[0, 4, zz(edge)]} rotation={[tilt, 0, 0]}>
          {/* 세운 판 안의 좌표: z 는 핀 쪽 가장자리에서 위로 */}
          <group position={[0, 0, -zz(edge)]}>
            <Box size={[p.w, 4, p.h]} at={[L.X(p.x + p.w / 2), 0, zz(p.y + p.h / 2)]} mat={toon(p.color)} />
            {[p.x + 36, p.x + 116].map((ex) => (
              <group key={ex}>
                <Cyl r={24} h={22} at={[L.X(ex), -13, zz(p.y + 34)]} mat={toon(COLOR.metalLight)} seg={28} />
                <Cyl r={13} h={1} at={[L.X(ex), -24.3, zz(p.y + 34)]} mat={toon("#495057", { outline: false })} seg={24} />
              </group>
            ))}
            <Decal under w={44} d={12} at={[L.X(p.x + p.w / 2), -2.2, zz(p.y + 34)]} paint={(g, cw, ch) => { g.fillStyle = "#fff"; g.font = `700 ${Math.round(ch * 0.6)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("HC-SR04", cw / 2, ch / 2); }} />
          </group>
        </group>
        <PinNames p={p} L={L} zz={zz} y={4.2} />
      </Part>
      <group ref={pings}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[track.origin.x, track.origin.y, track.origin.z]} material={ringMat.clone()} visible={false} raycast={() => null}>
            <ringGeometry args={[0.85, 1, 40]} />
          </mesh>
        ))}
      </group>
      {/* 장난감 자동차: 끌어서 센서 앞을 오간다 */}
      {target !== "none" && <group ref={car} position={[track.origin.x, 0, carZ(cm()) + face * half]} rotation={[0, target === "car" ? (face > 0 ? -Math.PI / 2 : Math.PI / 2) : face > 0 ? Math.PI : 0, 0]} {...drag}>
        {target === "car" ? <ToyCar /> : target === "person" ? <PersonFigure /> : target === "hand" ? <HandFigure /> : <WallFigure />}
        <sprite material={tag.mat} position={[0, tagY, 0]} scale={[60, 22.8, 1]} renderOrder={7} raycast={() => null} />
      </group>}
    </>
  );
}

function ToyCar() {
  return (
    <group>
      <Box size={[96, 22, 58]} at={[0, 21, 0]} mat={toon("#e03131")} />
      <Box size={[60, 20, 50]} at={[0, 42, 4]} mat={toon("#e03131")} />
      <Box size={[52, 14, 2]} at={[0, 44, -21.2]} mat={toon("#a5d8ff")} />
      {[[-30, -28], [30, -28], [-30, 28], [30, 28]].map(([x, z]) => <Cyl key={`${x}${z}`} r={11} h={8} at={[x, 11, z]} rot={[Math.PI / 2, 0, 0]} mat={toon(COLOR.plastic)} seg={20} />)}
      <Box size={[10, 6, 2]} at={[-30, 24, -29.2]} mat={toon("#fff3bf", { emissive: "#ffd43b", emissiveIntensity: 0.6 })} />
      <Box size={[10, 6, 2]} at={[30, 24, -29.2]} mat={toon("#fff3bf", { emissive: "#ffd43b", emissiveIntensity: 0.6 })} />
    </group>
  );
}

/* ── OLED: 시뮬레이션이 쓴 글자를 그대로 보여 준다 ── */

function OledScreen({ p, L, zz }: { p: Mod; L: Layout; zz: (y: number) => number }) {
  const api = useViewerApi();
  const sy = p.side === "top" ? p.y + 48 : p.y + 10;
  const tex = useMemo(() => canvasTexture(256, 128, (g, w, h) => paintOled(g, w, h, null)), []);
  const mat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ map: tex })), [tex]);
  useEffect(() => () => { tex.dispose(); mat.dispose(); }, [tex, mat]);
  const last = useRef("");
  useFrame(() => {
    const s = api.getState();
    const lines = (s.running && s.sim?.outputs.oled) || [];
    const k = lines.join("\n");
    if (k === last.current) return;
    last.current = k;
    const cv = tex.image as HTMLCanvasElement;
    paintOled(cv.getContext("2d")!, cv.width, cv.height, lines);
    tex.needsUpdate = true;
    s.invalidate();
  });
  return (
    <>
      <Box size={[90, 3, 54]} at={[L.X(p.x + 54), 5.5, zz(sy + 27)]} mat={toon("#0b1f4d")} />
      <mesh position={[L.X(p.x + 54), 7.1, zz(sy + 27)]} rotation={[-Math.PI / 2, 0, 0]} material={mat}><planeGeometry args={[84, 46]} /></mesh>
    </>
  );
}

/* ── RFID 카드 둘: 끌어서 리더에 대면 그 카드를 읽는다 ── */

function Cards({ p, L, zz }: { p: Mod; L: Layout; zz: (y: number) => number }) {
  const api = useViewerApi();
  const reader = new THREE.Vector3(L.X(p.x + p.w / 2), 0, zz(p.y + p.h / 2));
  // 카드 둘은 리더기 앞(핀 반대쪽) 빈 곳에 나란히 놓는다
  const front = p.side === "top" ? p.y + p.h + 70 : p.y - 70;
  const home = (k: number) => new THREE.Vector3(L.X(p.x + p.w / 2 + (k - 0.5) * 72), 0, zz(front));
  const refs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const pos = useRef([home(0), home(1)]);
  const which = useRef(-1);
  const card = (k: number) => {
    const d = useDrag((e) => {
      const q = onPlane(e, 12);
      if (!q) return;
      which.current = k;
      pos.current[k].set(q.x, 0, q.z);
    }, () => {
      const s = api.getState();
      const near = pos.current[k].distanceTo(reader) < Math.max(p.w, p.h) * 0.45;
      if (s.sim) s.sim.inputs.card = near ? (k === 0 ? CARDS.known : CARDS.unknown) : null;
      if (!near) pos.current[k].copy(home(k));
    });
    return d;
  };
  const drags = [card(0), card(1)];
  useFrame(() => {
    refs.forEach((r, k) => {
      if (!r.current) return;
      const y = pos.current[k].distanceTo(reader) < Math.max(p.w, p.h) * 0.45 ? 14 : 2;
      r.current.position.set(pos.current[k].x, y, pos.current[k].z);
    });
  });
  return (
    <>
      {[["등록된 카드", "#1c7ed6"], ["모르는 카드", "#f8f9fa"]].map(([name, color], k) => (
        <group key={name} ref={refs[k]} {...drags[k]}>
          <Part id={`card${k}`} label={name} text={k === 0 ? "문을 열 수 있게 등록해 둔 카드예요. 리더기 위로 끌어다 대 보세요." : "등록하지 않은 카드예요. 대면 문이 열리지 않아야 해요."} card={false} lift={false}>
            <Box size={[54, 2, 86]} at={[0, 1, 0]} mat={toon(color)} />
            <Decal w={46} d={20} at={[0, 2.2, 26]} paint={(g, cw, ch) => { g.fillStyle = k === 0 ? "#fff" : "#343a40"; g.font = `700 ${Math.round(ch * 0.55)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(k === 0 ? "등록" : "모름", cw / 2, ch / 2); }} />
          </Part>
        </group>
      ))}
    </>
  );
}

/* ── PIR: 사람 인형을 끌어 감지 범위 안팎으로 ── */

function Person({ p, L, zz }: { p: Mod; L: Layout; zz: (y: number) => number }) {
  const api = useViewerApi();
  const center = new THREE.Vector3(L.X(p.x + 38), 0, zz(p.y + 32));
  const R = 170;
  const pos = useRef(center.clone().add(new THREE.Vector3(260, 0, 0)));
  const ref = useRef<THREE.Group>(null);
  const cone = useRef<THREE.Mesh>(null);
  const drag = useDrag((e) => {
    const q = onPlane(e, 20);
    if (!q) return;
    pos.current.set(q.x, 0, q.z);
  });
  const coneMat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: "#2f9e44", transparent: true, opacity: 0.08, depthWrite: false })), []);
  useFrame(() => {
    const s = api.getState();
    const inside = pos.current.distanceTo(center) < R;
    if (s.sim && s.sim.inputs.motion !== inside) { s.sim.inputs.motion = inside; s.invalidate(); }
    ref.current?.position.copy(pos.current);
    coneMat.color.set(inside ? "#f08c00" : "#2f9e44");
    coneMat.opacity = inside ? 0.16 : 0.08;
  });
  return (
    <>
      <mesh ref={cone} position={[center.x, 0.6, center.z]} rotation={[-Math.PI / 2, 0, 0]} material={coneMat} raycast={() => null}>
        <circleGeometry args={[R, 48]} />
      </mesh>
      <group ref={ref} {...drag}>
        <Part id="person" label="사람" text="PIR 센서 둘레(초록 원) 안으로 끌어 보세요. 사람이 움직이면 센서가 알아채요." card={false} lift={false}>
          <group rotation={[0, -Math.PI / 2, 0]} scale={0.85}><PersonFigure /></group>
        </Part>
      </group>
    </>
  );
}

/* ── 소리 센서: 마이크를 누르면 박수 ── */

function SoundMic({ p, L, zz }: { p: Mod; i: number; L: Layout; zz: (y: number) => number }) {
  const api = useViewerApi();
  const waves = useRef<THREE.Group>(null);
  const x = L.X(p.x + 38), z = zz(p.y + 30);
  const clap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const s = api.getState();
    if (s.sim) s.sim.inputs.sound = 1;
    s.invalidate();
  };
  const mat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: "#e8590c", transparent: true, depthWrite: false })), []);
  useFrame((_, dt) => {
    const s = api.getState();
    if (!s.sim) return;
    const v = s.sim.inputs.sound;
    if (v > 0) { s.sim.inputs.sound = Math.max(0, v - dt * 2.2); s.invalidate(); }
    waves.current?.children.forEach((w, k) => {
      w.visible = v > 0.05;
      w.scale.setScalar(18 + (1 - v) * 50 + k * 10);
      ((w as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = v * 0.6;
    });
  });
  return (
    <group onPointerDown={clap}>
      <Cyl r={15} h={14} at={[x, 11, z]} mat={toon(COLOR.plastic)} seg={24} />
      <Cyl r={8} h={1} at={[x, 18.3, z]} mat={toon("#868e96", { outline: false })} seg={20} />
      <group ref={waves} position={[x, 19, z]} rotation={[-Math.PI / 2, 0, 0]}>
        {[0, 1].map((k) => <mesh key={k} material={mat} visible={false} raycast={() => null}><ringGeometry args={[0.9, 1, 40]} /></mesh>)}
      </group>
    </group>
  );
}

/* ── 불꽃 센서: 누르면 라이터 불꽃 ── */

function FlameEye({ p, L, zz }: { p: Mod; L: Layout; zz: (y: number) => number }) {
  const api = useViewerApi();
  const [on, setOn] = useState(false);
  const flame = useRef<THREE.Mesh>(null);
  const x = L.X(p.x + 38), z = zz(p.y + 28);
  const toggle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    const s = api.getState();
    if (s.sim) s.sim.inputs.flame = !on;
    setOn(!on);
    s.invalidate();
  };
  useFrame(({ clock }) => {
    if (!flame.current || !on) return;
    flame.current.scale.set(1, 1 + Math.sin(clock.elapsedTime * 18) * 0.12, 1);
    api.getState().invalidate();
  });
  return (
    <group onClick={toggle}>
      <Box size={[22, 16, 12]} at={[x, 12, z]} mat={toon(COLOR.plastic)} />
      <Ball r={6} at={[x, 20, z]} mat={toon("#3a3a42")} />
      {on && (
        <group position={[x + 46, 0, z]}>
          <Box size={[16, 40, 10]} at={[0, 20, 0]} mat={toon("#c92a2a")} />
          <Box size={[10, 6, 8]} at={[0, 43, 0]} mat={toon(COLOR.metal)} />
          <mesh ref={flame} position={[0, 56, 0]} material={toon("#ffa94d", { outline: false, emissive: "#ff922b", emissiveIntensity: 1.2 })}>
            <coneGeometry args={[5, 18, 14]} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/* ── 조이스틱: 막대 머리를 잡고 끌면 기울고, 놓으면 가운데로 ── */

function Joystick({ p, i, L, zz }: { p: Mod; i: number; L: Layout; zz: (y: number) => number }) {
  const api = useViewerApi();
  const stick = useRef<THREE.Group>(null);
  const x = L.X(p.x + 60), z = zz(p.y + 40);
  const held = useRef(false);
  const drag = useDrag((e) => {
    const s = api.getState();
    const q = onPlane(e, 32);
    if (!q || !s.sim) return;
    held.current = true;
    const dx = THREE.MathUtils.clamp((q.x - x) / 30, -1, 1), dz = THREE.MathUtils.clamp((q.z - z) / 30, -1, 1);
    const j = s.sim.inputs.joy[i] ?? { x: 0, y: 0, pressed: false };
    s.sim.inputs.joy[i] = { ...j, x: dx, y: dz };
  }, () => { held.current = false; });
  useFrame(() => {
    const s = api.getState();
    const j = s.sim?.inputs.joy[i];
    if (!j) return;
    if (!held.current && (Math.abs(j.x) > 0.001 || Math.abs(j.y) > 0.001)) {
      j.x *= 0.75; j.y *= 0.75;
      if (Math.abs(j.x) < 0.01) j.x = 0;
      if (Math.abs(j.y) < 0.01) j.y = 0;
      s.invalidate();
    }
    if (stick.current) { stick.current.rotation.z = -j.x * 0.45; stick.current.rotation.x = j.y * 0.45; }
  });
  const press = (on: boolean) => {
    const s = api.getState();
    if (!s.sim) return;
    const j = s.sim.inputs.joy[i] ?? { x: 0, y: 0, pressed: false };
    s.sim.inputs.joy[i] = { ...j, pressed: on };
    s.invalidate();
  };
  return (
    <>
      <Cyl r={29} h={8} at={[x, 8, z]} mat={toon("#495057")} seg={28} />
      <group ref={stick} position={[x, 12, z]}>
        <Cyl r={6} h={22} at={[0, 11, 0]} mat={toon(COLOR.plastic)} seg={16} />
        <group {...drag} onDoubleClick={(e) => { e.stopPropagation(); press(true); setTimeout(() => press(false), 250); }}>
          <Ball r={15} at={[0, 20, 0]} mat={toon(COLOR.plastic)} half />
        </group>
      </group>
    </>
  );
}

/* ── 키패드: 키를 누르면 그 글자가 보드로 간다 ── */

function Keypad({ p, L, zz }: { p: Mod; L: Layout; zz: (y: number) => number }) {
  const api = useViewerApi();
  const keys = ["1", "2", "3", "A", "4", "5", "6", "B", "7", "8", "9", "C", "*", "0", "#", "D"];
  const [down, setDown] = useState<string | null>(null);
  const press = (k: string) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    api.getState().sim?.inputs.keys.push(k);
    setDown(k);
    setTimeout(() => setDown(null), 160);
    api.getState().invalidate();
  };
  return (
    <>
      {keys.map((k, n) => (
        <group key={k} onPointerDown={press(k)}>
          <Box size={[30, 3, 21]} at={[L.X(p.x + 12 + (n % 4) * 36 + 15), down === k ? 4 : 5.5, zz(p.y + 8 + Math.floor(n / 4) * 26 + 10.5)]} mat={toon(COLOR.white)} />
        </group>
      ))}
      <Decal w={138} d={99} at={[L.X(p.x + 81), 7.3, zz(p.y + 57.5)]} paint={(g, cw, ch) => {
        g.fillStyle = "#343a40"; g.font = `700 ${Math.round(ch * 0.15)}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        keys.forEach((t, n) => g.fillText(t, ((15 + (n % 4) * 36) / 138) * cw, ((10.5 + Math.floor(n / 4) * 26) / 99) * ch));
      }} />
    </>
  );
}

/* ── 릴레이: 신호 핀이 켜지면 빨간 불이 켜진다 ── */

function RelayLamp({ p, i, L, zz }: { p: Mod; i: number; L: Layout; zz: (y: number) => number }) {
  const api = useViewerApi();
  const m = useMemo(() => toonOwn({ color: "#ffe3e3", emissive: "#ff2d2d", emissiveIntensity: 0 }), []);
  useEffect(() => () => m.dispose(), [m]);
  useFrame(() => {
    const s = api.getState();
    const o = outputs(s);
    const d = deviceOf(s, i, "relay");
    const on = Boolean(o && d && (o.pins[d.pin] ?? 0) > 0.5);
    m.emissiveIntensity = on ? 2.6 : 0;
  });
  const lx = L.X(p.x + p.w * 0.85), ly = p.side === "top" ? p.y + 22 : p.y + p.h - 22;
  return <Ball r={2.4} at={[lx, 5, zz(ly)]} mat={m} />;
}

/* ── 팬: IN+ · IN− 핀의 차이만큼 날개가 돈다 ── */

function Fan({ p, i, L, zz }: { p: Mod; i: number; L: Layout; zz: (y: number) => number }) {
  const api = useViewerApi();
  const blades = useRef<THREE.Group>(null);
  const speed = useRef(0);
  const x = L.X(p.x + 55), z = zz(p.y + 34);
  useFrame((_, dt) => {
    const s = api.getState();
    const d = deviceOf(s, i, "fan");
    const o = outputs(s);
    const goal = d && o ? (d.inP !== undefined ? o.pins[d.inP] ?? 0 : 0) - (d.inM !== undefined ? o.pins[d.inM] ?? 0 : 0) : 0;
    speed.current += (goal - speed.current) * Math.min(1, dt * 2.5);
    if (blades.current) blades.current.rotation.y += speed.current * dt * 26;
    if (Math.abs(speed.current) > 0.002) s.invalidate();
  });
  return (
    <>
      <Cyl r={12} h={20} at={[x, 14, z]} mat={toon(COLOR.metalLight)} seg={20} />
      <group ref={blades} position={[x, 29, z]}>
        <Cyl r={4} h={6} at={[0, -2, 0]} mat={toon(COLOR.plastic)} seg={12} />
        {[0, 120, 240].map((a) => {
          const rad = (a * Math.PI) / 180;
          return (
            <mesh key={a} position={[Math.sin(rad) * 16, 0, Math.cos(rad) * 16]} rotation={[0.35, rad, 0]} scale={[0.8, 1, 1.7]} material={toon("#74c0fc")} castShadow>
              <cylinderGeometry args={[9, 9, 1.4, 20]} />
            </mesh>
          );
        })}
      </group>
    </>
  );
}

/* ───────────── 호일 터치 패드 (누르는 동안 손가락이 닿는다) ───────────── */

export function Touch({ p, i, L }: P<"touch">) {
  const api = useViewerApi();
  const [down, setDown] = useState(false);
  const { x, y, w, h } = p.pad;
  const cx = L.X(x + w / 2), cz = L.Zp({ x: x + w / 2, y: y + h / 2 });
  const press = (on: boolean) => {
    const s = api.getState();
    if (s.sim) s.sim.inputs.pressed[i] = on;
    setDown(on);
    s.invalidate();
  };
  useEffect(() => {
    if (!down) return;
    const up = () => press(false);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  });
  // 구겨진 호일: 판을 잘게 나눠 높이를 조금씩 흔든다
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h, 10, 8);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) pos.setZ(k, Math.sin(k * 12.9898) * 1.1);
    g.computeVertexNormals();
    g.rotateX(-Math.PI / 2);
    return g;
  }, [w, h]);
  useEffect(() => () => geo.dispose(), [geo]);
  const clip = L.v(p.clip, 4);
  const skin = toon("#f1c27d");
  return (
    <Part id={`part${i}`} label={p.label ?? "호일 터치 패드"} text="손가락을 대면 몸으로 전기가 조금 흘러 보드가 알아채요. 눌러 보세요." card={false}>
      <mesh geometry={geo} position={[cx, 1.2, cz]} material={toon("#ced4da")} receiveShadow onPointerDown={(e) => { e.stopPropagation(); press(true); }} />
      {/* 빨간 악어 클립: 호일 끝을 문다 */}
      <group position={[clip.x, 0, clip.z]}>
        <Box size={[12, 7, 24]} at={[0, 4, 0]} mat={toon("#e03131")} />
        <Box size={[10, 2, 8]} at={[0, 8, -10]} mat={toon(COLOR.metal)} />
      </group>
      {down && (
        <group position={[cx, 0, cz]}>
          <mesh position={[0, 26, 10]} rotation={[0.9, 0, 0]} material={skin} castShadow><capsuleGeometry args={[6, 34, 4, 12]} /></mesh>
          <Box size={[30, 14, 34]} at={[0, 44, 34]} mat={skin} />
        </group>
      )}
    </Part>
  );
}

/* ───────────── 7세그먼트 (출력 글자대로 획이 켜진다) ───────────── */

/** 획 a~g 가 켜지는 글자 */
const SEG: Record<string, string> = {
  "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg", "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg",
  A: "abcefg", b: "cdefg", C: "adef", d: "bcdeg", E: "adefg", F: "aefg", "-": "g", " ": "",
};

export function Seg7({ p, i, L }: P<"seg7">) {
  const api = useViewerApi();
  const { x, y, w, h } = p;
  const cx = L.X(x + w / 2), cz = L.Zp({ x: x + w / 2, y: y + h / 2 });
  const d = h * L.F;
  const on = useMemo(() => toonOwn({ color: "#ff6b6b", emissive: "#ff2d2d", emissiveIntensity: 1.6, outline: false }), []);
  const off = toon("#4a2626", { outline: false });
  const segs = useRef<Record<string, THREE.Mesh | null>>({});
  useEffect(() => () => on.dispose(), [on]);
  // 획 자리 (몸통 가운데 기준, 몸통 폭 w · 깊이 d 에 맞춰): [가로?, x, z]
  const sw = w * 0.42, sd = d * 0.34;
  const layout: Record<string, [boolean, number, number]> = {
    a: [true, 0, -sd], g: [true, 0, 0], d: [true, 0, sd],
    f: [false, -sw / 2, -sd / 2], b: [false, sw / 2, -sd / 2], e: [false, -sw / 2, sd / 2], c: [false, sw / 2, sd / 2],
  };
  useFrame(() => {
    const s = api.getState();
    // 마지막 글자 하나 (+ 뒤에 점이 붙으면 소수점 dp 도 켠다)
    const text = (s.running && s.sim?.outputs.seg7) || "";
    const dp = text.endsWith(".");
    const ch = dp ? text.slice(-2, -1) : text.slice(-1);
    const lit = (SEG[ch] ?? "") + (dp ? "p" : "");
    for (const k of [...Object.keys(layout), "p"]) {
      const m = segs.current[k];
      if (m) m.material = lit.includes(k) ? on : off;
    }
  });
  return (
    <Part id={`part${i}`} label="7세그먼트" text="막대 일곱 개(a~g)를 켜고 꺼서 숫자를 보여 줘요. 칩이 보드 대신 막대를 켜 줘요.">
      {p.legs.map((q, k) => <LegUp key={k} p={q} h={4} L={L} />)}
      <Box size={[w, 14, d]} at={[cx, BB_H + 9, cz]} mat={toon("#212529")} />
      <mesh ref={(m) => { segs.current.p = m; }} position={[cx + sw / 2 + 7, BB_H + 16.3, cz + sd + 2]} material={off}>
        <cylinderGeometry args={[2.6, 2.6, 0.8, 12]} />
      </mesh>
      {Object.entries(layout).map(([k, [horiz, dx, dz]]) => (
        <mesh key={k} ref={(m) => { segs.current[k] = m; }} position={[cx + dx, BB_H + 16.3, cz + dz]} material={off}>
          <boxGeometry args={horiz ? [sw * 0.8, 0.8, 5] : [5, 0.8, sd * 0.8]} />
        </mesh>
      ))}
    </Part>
  );
}

/* ───────────── 책상 위 소품: 건전지 상자 · 전원 플러그 · 물통과 펌프 ───────────── */

/** 물통 안의 미니 워터 펌프: 릴레이가 붙으면 떨리며 호스로 물을 밀어 올린다 */
function PumpProp({ p, i, L }: P<"prop">) {
  const api = useViewerApi();
  const { x, y, w, h } = p;
  const cx = L.X(x + w / 2), cz = L.Zp({ x: x + w / 2, y: y + h / 2 });
  const body = useRef<THREE.Group>(null);
  const water = useRef<THREE.Mesh>(null);
  const clock = useRef(0);
  const glass = useMemo(() => noOutline(toonOwn({ color: "#e7f5ff", transparent: true, opacity: 0.25, roughness: 0.1, depthWrite: false })), []);
  const wet = useMemo(() => noOutline(toonOwn({ color: "#4dabf7", transparent: true, opacity: 0.5, roughness: 0.2, depthWrite: false })), []);
  useEffect(() => () => { glass.dispose(); wet.dispose(); }, [glass, wet]);
  const H = 34;
  useFrame((_, dt) => {
    const s = api.getState();
    const o = outputs(s);
    const relay = s.devices.find((d): d is Extract<Device, { kind: "relay" }> => d.kind === "relay");
    const level = s.sim?.inputs.water ?? 0.8;
    const on = Boolean(o && relay && (o.pins[relay.pin] ?? 0) > 0.5 && level > 0.02);
    clock.current += dt;
    if (body.current) body.current.position.x = on ? Math.sin(clock.current * 90) * 0.4 : 0;
    if (water.current) { water.current.scale.y = Math.max(0.001, level); water.current.position.y = 2 + ((H - 4) * level) / 2; }
    if (on) s.invalidate();
  });
  return (
    <Part id={`part${i}`} label={p.label ?? "물통 · 미니 워터 펌프"} text="물통 안에 넣은 5V 펌프예요. 릴레이가 붙으면 돌아서 호스로 물을 화분에 보내요. 물 밖에서 돌리면 고장 나요.">
      <group position={[cx, 0, cz]}>
        <mesh position={[0, H / 2, 0]} material={glass}><boxGeometry args={[w, H, h]} /></mesh>
        <mesh ref={water} position={[0, H / 2, 0]} material={wet} raycast={() => null}><boxGeometry args={[w - 3, H - 4, h - 3]} /></mesh>
        <group ref={body}>
          <Cyl r={Math.min(9, w * 0.18)} h={18} at={[0, 10, 0]} mat={toon("#2b2b30")} seg={18} />
          <Cyl r={2.6} h={8} at={[0, 22, 0]} mat={toon("#495057")} seg={10} />
        </group>
        <Tube points={[new THREE.Vector3(0, 25, 0), new THREE.Vector3(0, H + 10, 0), new THREE.Vector3(-w * 0.3, H + 18, 0), new THREE.Vector3(-w * 0.55, H + 8, 0)]} radius={1.8} mat={toonOwn({ color: "#f1f3f5", transparent: true, opacity: 0.9 })} />
      </group>
    </Part>
  );
}

export function Prop({ p, i, L }: P<"prop">) {
  const { x, y, w, h } = p;
  const cx = L.X(x + w / 2), cz = L.Zp({ x: x + w / 2, y: y + h / 2 });
  if (p.kind === "pump") return <PumpProp p={p} i={i} L={L} />;
  if (p.kind === "jack") {
    return (
      <Part id={`part${i}`} label="전원 플러그" text="건전지 상자의 전기를 보드로 보내는 둥근 플러그예요.">
        <Box size={[w, 14, h]} at={[cx, 7, cz]} mat={toon(COLOR.plastic)} />
        <Cyl r={4} h={3} at={[cx, 15, cz]} mat={toon(COLOR.metal)} seg={14} />
      </Part>
    );
  }
  const n = 6;
  return (
    <Part id={`part${i}`} label={p.label ?? "건전지 상자"} text="AA 건전지 여섯 개(9V)로 모터에 힘을 줘요. USB 와 함께 꽂지 않아요.">
      <Box size={[w, 12, h]} at={[cx, 6, cz]} mat={toon("#343a40")} />
      {Array.from({ length: n }, (_, k) => {
        const zz = cz - (h / 2) + (h / n) * (k + 0.5);
        return (
          <group key={k}>
            <Cyl r={Math.min(7, h / n / 2 - 1)} h={w - 12} at={[cx, 12, zz]} rot={[0, 0, Math.PI / 2]} mat={toon(k % 2 ? "#e8590c" : "#212529")} seg={16} />
          </group>
        );
      })}
    </Part>
  );
}
