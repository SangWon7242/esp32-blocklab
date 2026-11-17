import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Ball, Box, Cyl } from "../kit";
import { canvasTexture, glowTexture, noOutline, toon } from "../materials";
import { paintOled } from "../oled";
import { useViewerApi } from "../store";
import { simOut } from "./common";

/* 현장 모형의 작은 조각: 세운 글자 판 · 살아 있는 OLED 판 · 화분 · 나무 · 벤치 · 바닥 타일 */

type V3 = [number, number, number];

/** 세운 글자 판 (앞이 +z). 처음 한 번 그린다 */
export function Sign({ w, h, at, rotY = 0, px = 256, paint }: { w: number; h: number; at: V3; rotY?: number; px?: number; paint: (g: CanvasRenderingContext2D, cw: number, ch: number) => void }) {
  const { tex, mat } = useMemo(() => {
    const t = canvasTexture(px, Math.max(16, (px * h) / w), paint);
    return { tex: t, mat: noOutline(new THREE.MeshBasicMaterial({ map: t, transparent: true })) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, px]);
  useEffect(() => () => { tex.dispose(); mat.dispose(); }, [tex, mat]);
  return <mesh position={at} rotation={[0, rotY, 0]} material={mat} raycast={() => null}><planeGeometry args={[w, h]} /></mesh>;
}

/** 시뮬레이션 OLED 글자를 그대로 비추는 세운 화면 (앞이 +z) */
export function LiveOled({ w, h, at, rotY = 0 }: { w: number; h: number; at: V3; rotY?: number }) {
  const api = useViewerApi();
  const tex = useMemo(() => canvasTexture(256, 128, (g, cw, ch) => paintOled(g, cw, ch, null)), []);
  const mat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ map: tex })), [tex]);
  useEffect(() => () => { tex.dispose(); mat.dispose(); }, [tex, mat]);
  const last = useRef("\u0000");
  useFrame(() => {
    const s = api.getState();
    const lines = simOut(s)?.oled ?? null;
    const k = lines?.join("\n") ?? "";
    if (k === last.current) return;
    last.current = k;
    const cv = tex.image as HTMLCanvasElement;
    paintOled(cv.getContext("2d")!, cv.width, cv.height, lines);
    tex.needsUpdate = true;
    s.invalidate();
  });
  return (
    <group position={at} rotation={[0, rotY, 0]}>
      <Box size={[w + 8, h + 8, 4]} at={[0, 0, -2]} mat={toon("#1f2937")} />
      <mesh position={[0, 0, 0.3]} material={mat} raycast={() => null}><planeGeometry args={[w, h]} /></mesh>
    </group>
  );
}

/** 바닥 판: 타일 줄무늬가 있는 보도 */
export function Paving({ w, d, at = [0, 0, 0], color = "#ddd6cb", line = "#c9c0b2" }: { w: number; d: number; at?: V3; color?: string; line?: string }) {
  const { tex, mat } = useMemo(() => {
    const t = canvasTexture(256, Math.round((256 * d) / w), (g, cw, ch) => {
      g.fillStyle = color; g.fillRect(0, 0, cw, ch);
      g.strokeStyle = line; g.lineWidth = 2;
      const step = cw / Math.max(4, Math.round(w / 28));
      for (let x = 0; x <= cw; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, ch); g.stroke(); }
      for (let y = 0; y <= ch; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(cw, y); g.stroke(); }
    });
    return { tex: t, mat: noOutline(new THREE.MeshBasicMaterial({ map: t })) };
  }, [w, d, color, line]);
  useEffect(() => () => { tex.dispose(); mat.dispose(); }, [tex, mat]);
  return (
    <group position={at}>
      <Box size={[w, 6, d]} at={[0, 3, 0]} mat={toon("#bfb6a8")} />
      <mesh position={[0, 6.05, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat} receiveShadow raycast={() => null}><planeGeometry args={[w, d]} /></mesh>
    </group>
  );
}

/** 화분 */
export function Plant({ at, s = 1 }: { at: V3; s?: number }) {
  return (
    <group position={at} scale={s}>
      <Cyl r={9} r2={11} h={16} at={[0, 8, 0]} mat={toon("#b4693e")} seg={16} />
      <Ball r={12} at={[0, 24, 0]} mat={toon("#40a35a")} />
      <Ball r={9} at={[6, 32, 3]} mat={toon("#51b56b")} />
      <Ball r={8} at={[-6, 30, -3]} mat={toon("#37944f")} />
    </group>
  );
}

/** 가로수 */
export function Tree({ at, s = 1 }: { at: V3; s?: number }) {
  return (
    <group position={at} scale={s}>
      <Cyl r={4} r2={3} h={60} at={[0, 30, 0]} mat={toon("#8b5a2b")} seg={10} />
      <Ball r={22} at={[0, 72, 0]} mat={toon("#3f9b56")} />
      <Ball r={16} at={[12, 82, 6]} mat={toon("#4fb066")} />
      <Ball r={15} at={[-12, 80, -5]} mat={toon("#358a4b")} />
    </group>
  );
}

/** 벤치 */
export function Bench({ at, rotY = 0 }: { at: V3; rotY?: number }) {
  const wood = toon("#c08552"), iron = toon("#495057");
  return (
    <group position={at} rotation={[0, rotY, 0]}>
      {[-26, 26].map((x) => <Box key={x} size={[4, 18, 22]} at={[x, 9, 0]} mat={iron} />)}
      {[-6, 0, 6].map((z) => <Box key={z} size={[64, 2.6, 5]} at={[0, 19, z]} mat={wood} />)}
      {[0, 7].map((y) => <Box key={y} size={[64, 4, 2.4]} at={[0, 26 + y, -10]} mat={wood} />)}
    </group>
  );
}

/** 바닥에 퍼지는 둥근 빛 (가로등 · 경광등) */
export function GroundGlow({ at, color, children }: { at: V3; color: string; children?: ReactNode }) {
  const mat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, opacity: 0 })), [color]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh position={at} rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={2} raycast={() => null} userData={{ glow: mat }}>
      <planeGeometry args={[2, 2]} />
      {children}
    </mesh>
  );
}
