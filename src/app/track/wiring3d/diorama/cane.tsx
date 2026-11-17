import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PersonFigure, WallFigure } from "../figures";
import { Ball, Box, Cyl, onPlane, useDrag } from "../kit";
import type { Layout } from "../layout";
import { noOutline, toon, toonOwn } from "../materials";
import { useViewerApi } from "../store";
import { buzzing, deviceKind, pinLevel } from "./common";

/*
 * 32장 스마트 지팡이 현장 모형: 점자 블록 길 끝에 벽돌 담, 사람이 흰 지팡이를 짚고 걷는다.
 * 지팡이 아래쪽에 초음파 센서(HC-SR04)가 앞(벽 쪽)을 보고 달려 있고, 손잡이에 부저와 LED 가 있다.
 * 지팡이(사람)를 벽 쪽으로 끌면 센서와 벽 사이 거리가 회로의 초음파 거리로 들어가고,
 * 30cm 안이면 가까울수록 빠르게 삐 — 부저에서 소리 고리가 퍼지고 실제 소리도 난다.
 */

export const CANE_ROOM = { w: 320, d: 200 };

/** 1cm = 3 단위 (모형 축소) */
const PER_CM = 3;
/** 담 앞면 x · 지팡이가 오갈 수 있는 x (모형 안 좌표) */
const WALL_X = 128;
/** 지팡이 자리(x)에서 센서 앞면까지 */
const AHEAD = 4;
const MIN_X = -110, MAX_X = WALL_X - 2 * PER_CM - AHEAD;

export function SmartCane({ L }: { L: Layout }) {
  const api = useViewerApi();
  const walker = useRef<THREE.Group>(null);
  const x = useRef(-80);
  const grab = useRef<number | null>(null);
  const rings = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Group>(null);
  const clock = useRef(0);
  const tip = useMemo(() => toonOwn({ color: "#ffe3e3", emissive: "#ff6b6b", emissiveIntensity: 0 }), []);
  const ringMat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: "#f59f00", transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })), []);
  const beamMat = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: "#2f9e44", transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide })), []);
  const tag = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 220; cv.height = 76;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { cv, tex, mat: noOutline(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })), text: "" };
  }, []);
  useEffect(() => () => { tip.dispose(); ringMat.dispose(); beamMat.dispose(); tag.tex.dispose(); tag.mat.dispose(); }, [tip, ringMat, beamMat, tag]);

  // 울릴 때 손잡이 위에 「삐!」 말풍선
  const beep = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 160; cv.height = 96;
    const g = cv.getContext("2d")!;
    g.fillStyle = "#fff4e6"; g.strokeStyle = "#e8590c"; g.lineWidth = 6;
    g.beginPath(); g.roundRect(6, 6, 148, 64, 22); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(54, 68); g.lineTo(44, 92); g.lineTo(78, 68); g.fill(); g.stroke();
    g.fillStyle = "#e8590c"; g.font = "800 40px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("삐!", 80, 40);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { tex, mat: noOutline(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })) };
  }, []);
  useEffect(() => () => { beep.tex.dispose(); beep.mat.dispose(); }, [beep]);
  const bubble = useRef<THREE.Sprite>(null);
  const origin = L.diorama?.at ?? new THREE.Vector3();
  const drag = useDrag((e) => {
    const q = onPlane(e, 40);
    if (!q) return;
    const local = q.x - origin.x;
    if (grab.current === null) grab.current = x.current - local;
    x.current = THREE.MathUtils.clamp(local + grab.current, MIN_X, MAX_X);
    // 끄는 손짓이 곧 소리를 켜도 되는 사용자 동작이다 (브라우저는 손짓 없이 소리를 막는다)
    const s = api.getState();
    if (s.running && !s.sound) s.set({ sound: true });
  }, () => { grab.current = null; });

  const cm = () => Math.max(2, (WALL_X - (x.current + AHEAD)) / PER_CM);
  const paint = (text: string) => {
    if (tag.text === text) return;
    tag.text = text;
    const g = tag.cv.getContext("2d");
    if (!g) return;
    const { width: w, height: h } = tag.cv;
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#ffffff"; g.strokeStyle = "rgba(15,34,57,0.8)"; g.lineWidth = 4;
    g.beginPath(); g.roundRect(4, 4, w - 8, h - 14, 16); g.fill(); g.stroke();
    g.fillStyle = "#0f2239"; g.font = "700 34px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, (h - 10) / 2 + 2);
    tag.tex.needsUpdate = true;
  };

  useFrame((_, dt) => {
    const s = api.getState();
    const d = cm();
    // 회로의 초음파 센서 거리 = 지팡이 센서와 벽 사이
    const sonar = deviceKind(s, "ultrasonic");
    if (s.sim && sonar) s.sim.inputs.distance[sonar.part] = Math.round(d * 10) / 10;
    if (walker.current) walker.current.position.x = x.current;
    paint(`${d.toFixed(1)} cm`);
    clock.current += dt;
    // 부저: 손잡이에서 소리 고리 · 끝의 LED
    const on = buzzing(s);
    rings.current?.children.forEach((m, k) => {
      const ph = (clock.current * 1.8 + k / 3) % 1;
      m.visible = on;
      m.scale.setScalar(6 + ph * 26);
    });
    ringMat.opacity = 0.75;
    if (bubble.current) bubble.current.visible = on;
    const led = deviceKind(s, "led");
    tip.emissiveIntensity = pinLevel(s, led?.pin) * 2.2;
    // 실행 중: 센서에서 벽까지 초록 소리 고리가 오간다
    const gap = WALL_X - (x.current + AHEAD);
    beam.current?.children.forEach((m, k) => {
      const ph = (clock.current * 1.3 + k / 3) % 1;
      m.visible = s.running;
      m.position.x = x.current + AHEAD + ph * gap;
      m.scale.setScalar(5 + ph * 10);
      ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - ph);
    });
    if (s.running) s.invalidate();
  });

  const white = toon("#f8f9fa"), red = toon("#e03131");
  return (
    <group>
      {/* 보도 · 점자 블록 길 */}
      <Box size={[320, 6, 200]} at={[0, 3, 0]} mat={toon("#d8d1c5")} />
      <Box size={[300, 1.4, 44]} at={[-10, 6.7, 10]} mat={toon("#fcc419")} />
      {Array.from({ length: 12 }, (_, k) => <Box key={k} size={[2, 1, 34]} at={[-150 + k * 24, 7.6, 10]} mat={toon("#f59f00", { outline: false })} cast={false} />)}
      {/* 길 끝 벽돌 담 (앞면이 지팡이 쪽) */}
      <group position={[WALL_X + 8, 6, 10]} rotation={[0, -Math.PI / 2, 0]} scale={[1.6, 1.3, 1]}><WallFigure /></group>

      {/* 걷는 사람 + 지팡이 (끌어서 벽에 다가간다) */}
      <group ref={walker} position={[x.current, 6, 10]} {...drag}>
        <group rotation={[0, Math.PI / 2, 0]} position={[-34, 0, -13]}><PersonFigure shirt="#5c7cfa" bag={false} /></group>
        {/* 지팡이: 손잡이(검정) · 흰 막대 · 빨간 띠 · 끝 바퀴. 손잡이는 사람 쪽, 끝은 벽 쪽으로 기운다 */}
        <group position={[0, 0, 4]} rotation={[0, 0, 0.32]}>
          <Cyl r={2.3} h={112} at={[0, 58, 0]} mat={white} seg={14} />
          {[22, 34].map((y) => <Cyl key={y} r={2.5} h={7} at={[0, y, 0]} mat={red} seg={14} />)}
          <mesh position={[0, 116, 0]} rotation={[Math.PI / 2, 0, 0]} material={toon("#212529")} castShadow><capsuleGeometry args={[3.2, 12, 4, 10]} /></mesh>
          <Ball r={3.6} at={[0, 3, 0]} mat={toon("#343a40")} />
          {/* 손잡이 아래 부저(검정 원통) · 경고 LED */}
          <Cyl r={4.2} h={6} at={[5.5, 100, 0]} rot={[0, 0, Math.PI / 2]} mat={toon("#212529")} seg={16} />
          <Ball r={2.6} at={[3, 92, 0]} mat={tip} />
          <group ref={rings} position={[9, 100, 0]} rotation={[0, Math.PI / 2, 0]}>
            {[0, 1, 2].map((k) => <mesh key={k} material={ringMat} visible={false} raycast={() => null}><ringGeometry args={[0.85, 1, 32]} /></mesh>)}
          </group>
          {/* 초음파 센서: 파란 판에 은색 눈 둘, 벽 쪽(+x)을 본다. 기울어진 막대에 바로 서도록 되돌려 단다 */}
          <group position={[0, 30, 0]} rotation={[0, 0, -0.32]}>
            <Box size={[3, 20, 42]} at={[4, 0, 0]} mat={toon("#1c5fa8")} />
            {[-10, 10].map((z) => (
              <group key={z}>
                <Cyl r={7} h={7} at={[9, 0, z]} rot={[0, 0, Math.PI / 2]} mat={toon("#d9dde3")} seg={18} />
                <Cyl r={4} h={1} at={[12.8, 0, z]} rot={[0, 0, Math.PI / 2]} mat={toon("#495057", { outline: false })} seg={14} />
              </group>
            ))}
            <Box size={[5, 8, 14]} at={[0, -12, 0]} mat={toon("#212529")} />
          </group>
        </group>
        <sprite ref={bubble} material={beep.mat} position={[-20, 132, 12]} scale={[40, 24, 1]} renderOrder={8} visible={false} raycast={() => null} />
        <sprite material={tag.mat} position={[0, 150, 0]} scale={[66, 22.8, 1]} renderOrder={7} raycast={() => null} />
      </group>
      {/* 센서 → 벽 소리 고리 (실행 중) */}
      <group ref={beam}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[0, 40, 10]} rotation={[0, Math.PI / 2, 0]} material={beamMat.clone()} visible={false} raycast={() => null}>
            <ringGeometry args={[0.85, 1, 32]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
