import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Ball, Box, Cyl } from "../kit";
import { glowTexture, noOutline, toon, toonOwn } from "../materials";
import { useViewerApi } from "../store";
import { buzzing, deviceKind, ease, pinLevel, rgbOf, servoAngle } from "./common";
import { Bench, Paving, Sign, Tree } from "./pieces";
import { PersonFigure } from "../figures";

/* 길거리 현장 모형: 밝기 단계 가로등 (34장) · 보행자 신호등과 차단기 (40장) */

const ASPHALT = "#4a4f57", LANE = "#f1f3f5";

/** 차도 (가로 w, 세로 d), 가운데 점선 */
function Road({ w, d, at, dashes = true, mat }: { w: number; d: number; at: [number, number, number]; dashes?: boolean; mat?: THREE.Material }) {
  return (
    <group position={at}>
      <Box size={[w, 4, d]} at={[0, 2, 0]} mat={mat ?? toon(ASPHALT)} />
      {dashes && Array.from({ length: Math.floor(w / 40) }, (_, k) => (
        <Box key={k} size={[20, 0.6, 3]} at={[-w / 2 + 20 + k * 40, 4.3, 0]} mat={toon("#ffd43b", { outline: false })} cast={false} />
      ))}
      {[-1, 1].map((s) => <Box key={s} size={[w, 0.6, 2]} at={[0, 4.3, s * (d / 2 - 5)]} mat={toon(LANE, { outline: false })} cast={false} />)}
    </group>
  );
}

/* ── 34장: 어두워질수록 밝아지는 가로등 ── */

export const LAMP_ROOM = { w: 240, d: 240 };

export function StreetLamp() {
  const api = useViewerApi();
  const head = useMemo(() => toonOwn({ color: "#fff9db", emissive: "#ffd43b", emissiveIntensity: 0 }), []);
  const cone = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: "#ffe066", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })), []);
  const pool = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#ffd43b", transparent: true, opacity: 0, depthWrite: false })), []);
  // 주변이 어두우면(빛 조절판) 길도 어둑해진다
  const road = useMemo(() => toonOwn({ color: ASPHALT }), []);
  const walk = useMemo(() => toonOwn({ color: "#d8d1c5" }), []);
  useEffect(() => () => { head.dispose(); cone.dispose(); pool.dispose(); road.dispose(); walk.dispose(); }, [head, cone, pool, road, walk]);
  const level = useRef(0);
  useFrame((_, dt) => {
    const s = api.getState();
    const led = deviceKind(s, "led");
    const before = level.current;
    level.current = ease(level.current, pinLevel(s, led?.pin), dt, 5);
    const k = level.current;
    head.emissiveIntensity = 0.15 + k * 2.2;
    cone.opacity = k * 0.22;
    pool.opacity = k * 0.85;
    const day = s.sim?.inputs.light ?? 0.75;
    road.color.set(ASPHALT).multiplyScalar(0.55 + 0.45 * day);
    walk.color.set("#d8d1c5").multiplyScalar(0.55 + 0.45 * day);
    if (Math.abs(k - before) > 1e-4) s.invalidate();
  });
  const px = -40, pz = -30, top = 196;
  return (
    <group>
      {/* 보도 (뒤) · 차도 (앞) */}
      <Box size={[240, 6, 110]} at={[0, 3, -65]} mat={walk} />
      <Box size={[240, 9, 6]} at={[0, 4.5, -7]} mat={toon("#adb5bd")} />
      <Road w={240} d={120} at={[0, 0, 60]} mat={road} />
      {/* 가로등: 기둥 · 팔 · 등갓 */}
      <Cyl r={9} r2={7} h={12} at={[px, 12, pz]} mat={toon("#495057")} seg={16} />
      <Cyl r={3.6} r2={4.6} h={top - 12} at={[px, 6 + (top - 12) / 2 + 12, pz]} mat={toon("#5c6670")} seg={14} />
      <Box size={[6, 5, 64]} at={[px, top + 4, pz + 30]} mat={toon("#5c6670")} />
      <Box size={[30, 9, 36]} at={[px, top - 2, pz + 60]} mat={toon("#3d454d")} />
      <Box size={[26, 2, 30]} at={[px, top - 7.2, pz + 60]} mat={head} cast={false} />
      {/* 빛 기둥 · 바닥 빛 */}
      <mesh position={[px, (top - 8) / 2 + 3, pz + 60]} material={cone} renderOrder={2} raycast={() => null}>
        <cylinderGeometry args={[14, 62, top - 14, 32, 1, true]} />
      </mesh>
      <mesh position={[px, 6.4, pz + 60]} rotation={[-Math.PI / 2, 0, 0]} material={pool} renderOrder={2} raycast={() => null}>
        <planeGeometry args={[170, 170]} />
      </mesh>
      {/* 빛 센서 상자 (기둥에 달린 포토레지스터) */}
      <Box size={[12, 10, 10]} at={[px, 150, pz + 6]} mat={toon("#e9ecef")} />
      <Ball r={4} at={[px, 156, pz + 6]} mat={toon("#f59f00")} half />
      <Bench at={[40, 6, -70]} />
      <Tree at={[100, 6, -78]} s={0.9} />
      <Tree at={[-100, 6, -82]} s={0.75} />
    </group>
  );
}

/* ── 40장: 사람이 오면 초록불 · 차단기가 올라가는 횡단보도 ── */

export const CROSSWALK_ROOM = { w: 300, d: 260 };

export function Crosswalk() {
  const api = useViewerApi();
  const red = useMemo(() => toonOwn({ color: "#5c1a1a", emissive: "#ff3b30", emissiveIntensity: 0 }), []);
  const green = useMemo(() => toonOwn({ color: "#13361f", emissive: "#2fd158", emissiveIntensity: 0 }), []);
  const ring = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: "#f59f00", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })), []);
  useEffect(() => () => { red.dispose(); green.dispose(); ring.dispose(); }, [red, green, ring]);
  const arm = useRef<THREE.Group>(null);
  const lift = useRef(0);
  const clock = useRef(0);
  const rings = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const s = api.getState();
    const [r, g] = rgbOf(s);
    red.emissiveIntensity = r * 2.2;
    green.emissiveIntensity = g * 2.2;
    const before = lift.current;
    lift.current = ease(lift.current, (servoAngle(s, 0) / 90) * (Math.PI / 2) * 0.95, dt, 4);
    if (arm.current) arm.current.rotation.z = -lift.current;
    // 부저: 스피커에서 소리 고리
    clock.current += dt;
    const on = buzzing(s);
    rings.current?.children.forEach((m, k) => {
      const ph = (clock.current * 1.6 + k / 3) % 1;
      m.visible = on;
      m.scale.setScalar(6 + ph * 18);
      ring.opacity = 0.6;
    });
    if (on || Math.abs(lift.current - before) > 1e-4) s.invalidate();
  });
  return (
    <group>
      {/* 차도와 흰 줄무늬 횡단보도 · 양쪽 보도 */}
      <Road w={300} d={130} at={[0, 0, 10]} dashes={false} />
      {Array.from({ length: 7 }, (_, k) => <Box key={k} size={[60, 0.8, 9]} at={[-10, 4.4, -44 + k * 18]} mat={toon(LANE, { outline: false })} cast={false} />)}
      <Paving w={300} d={60} at={[0, 0, -100]} />
      <Paving w={300} d={60} at={[0, 0, 105]} />
      {/* 보행자 신호등: 위 빨간 사람 · 아래 초록 사람 (RGB LED 와 같은 색) */}
      <Cyl r={3.4} h={120} at={[-70, 66, -95]} mat={toon("#3d454d")} seg={12} />
      <Box size={[26, 54, 16]} at={[-70, 120, -88]} mat={toon("#2b3036")} />
      {[[red, 133, "#ff3b30"], [green, 107, "#2fd158"]].map(([m, y, c], k) => (
        <group key={k}>
          <Box size={[20, 20, 2]} at={[-70, y as number, -79.4]} mat={m as THREE.Material} cast={false} />
          <Sign w={16} h={16} at={[-70, y as number, -78.2]} px={96} paint={(g2, cw, ch) => {
            g2.fillStyle = c as string; g2.globalAlpha = 0.95;
            const x = cw / 2;
            g2.beginPath(); g2.arc(x, ch * 0.2, ch * 0.1, 0, Math.PI * 2); g2.fill();
            g2.lineWidth = cw * 0.1; g2.strokeStyle = c as string; g2.lineCap = "round";
            g2.beginPath(); g2.moveTo(x, ch * 0.34); g2.lineTo(x, ch * 0.62);
            if (k === 0) { g2.moveTo(x, ch * 0.62); g2.lineTo(x - cw * 0.1, ch * 0.88); g2.moveTo(x, ch * 0.62); g2.lineTo(x + cw * 0.1, ch * 0.88); g2.moveTo(x - cw * 0.16, ch * 0.42); g2.lineTo(x + cw * 0.16, ch * 0.42); }
            else { g2.moveTo(x, ch * 0.62); g2.lineTo(x - cw * 0.2, ch * 0.88); g2.moveTo(x, ch * 0.62); g2.lineTo(x + cw * 0.18, ch * 0.86); g2.moveTo(x - cw * 0.18, ch * 0.5); g2.lineTo(x, ch * 0.38); g2.lineTo(x + cw * 0.2, ch * 0.46); }
            g2.stroke();
          }} />
        </group>
      ))}
      {/* 차단기: 기둥 위 경첩에서 막대가 올라간다 (서보 0도 내림 → 90도 올림) */}
      <Box size={[14, 40, 14]} at={[36, 26, -82]} mat={toon("#f1f3f5")} />
      <group ref={arm} position={[36, 42, -73]}>
        {Array.from({ length: 6 }, (_, k) => <Box key={k} size={[14, 5, 4]} at={[-10 - k * 14, 0, 0]} mat={toon(k % 2 ? "#f1f3f5" : "#e03131")} />)}
      </group>
      {/* 스피커 (부저) */}
      <Box size={[14, 18, 10]} at={[-70, 82, -85]} mat={toon("#495057")} />
      <group ref={rings} position={[-70, 82, -79]}>
        {[0, 1, 2].map((k) => <mesh key={k} material={ring} visible={false} raycast={() => null}><ringGeometry args={[0.85, 1, 32]} /></mesh>)}
      </group>
      {/* 길 건너편에서 기다리는 사람 (눈에 보이는 장식, 끄는 사람은 회로의 초음파 앞에 있다) */}
      <group position={[110, 6, 112]} rotation={[0, Math.PI, 0]} scale={0.8}><PersonFigure shirt="#e8590c" /></group>
      <Tree at={[125, 6, -105]} s={0.8} />
    </group>
  );
}
