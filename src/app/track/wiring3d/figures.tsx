import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Ball, Box, Cyl } from "./kit";
import { toon } from "./materials";

/*
 * 장면 속 사람 · 손 · 장애물 (초음파 센서 앞 물체, PIR 앞 사람, 현장 모형의 사람).
 * 실물보다 작게 줄였지만 비율은 사람답게: 머리 · 몸통 · 팔 · 다리 · 신발. 앞은 +z.
 * 움직이면 걷는다 — 지난 화면보다 자리가 바뀌면 다리 · 팔을 흔든다.
 */

const SKIN = "#f2c9a0", HAIR = "#3b2a20", SHIRT = "#3b82c4", PANTS = "#2b3a55", SHOE = "#f1f3f5", SOLE = "#495057", BAG = "#f59f00";

/** 걷는 사람. 키 약 120 */
export function PersonFigure({ shirt = SHIRT, bag = true }: { shirt?: string; bag?: boolean }) {
  const root = useRef<THREE.Group>(null);
  const legs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const arms = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const last = useRef<THREE.Vector3 | null>(null);
  const phase = useRef(0);
  const swing = useRef(0);
  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    const here = g.getWorldPosition(new THREE.Vector3());
    const moved = last.current ? here.distanceTo(last.current) : 0;
    last.current = here;
    // 움직인 만큼 걸음이 나아가고, 멈추면 천천히 차렷
    phase.current += moved * 0.09;
    swing.current += ((moved > 0.05 ? 1 : 0) - swing.current) * Math.min(1, dt * 8);
    const a = Math.sin(phase.current) * 0.55 * swing.current;
    legs[0].current?.rotation.set(a, 0, 0);
    legs[1].current?.rotation.set(-a, 0, 0);
    arms[0].current?.rotation.set(-a * 0.8, 0, 0.08);
    arms[1].current?.rotation.set(a * 0.8, 0, -0.08);
  });
  const skin = toon(SKIN), pants = toon(PANTS), top = toon(shirt);
  return (
    <group ref={root}>
      {/* 다리: 엉덩이에서 흔든다 */}
      {[-7, 7].map((x, k) => (
        <group key={x} ref={legs[k]} position={[x, 52, 0]}>
          <mesh position={[0, -22, 0]} material={pants} castShadow><capsuleGeometry args={[5.2, 34, 4, 12]} /></mesh>
          <Box size={[11, 6, 17]} at={[0, -48, 3]} mat={toon(SHOE)} />
          <Box size={[11.4, 2, 17.4]} at={[0, -51, 3]} mat={toon(SOLE)} />
        </group>
      ))}
      {/* 몸통 · 허리띠 */}
      <mesh position={[0, 70, 0]} scale={[1, 1, 0.68]} material={top} castShadow><capsuleGeometry args={[13, 20, 6, 16]} /></mesh>
      <Cyl r={12.6} h={4} at={[0, 55, 0]} mat={pants} seg={20} />
      {/* 팔: 어깨에서 흔든다 */}
      {[-17, 17].map((x, k) => (
        <group key={x} ref={arms[k]} position={[x, 82, 0]}>
          <mesh position={[0, -8, 0]} material={top} castShadow><capsuleGeometry args={[4.6, 10, 4, 10]} /></mesh>
          <mesh position={[0, -22, 0]} material={skin} castShadow><capsuleGeometry args={[3.8, 12, 4, 10]} /></mesh>
          <Ball r={4.4} at={[0, -31, 0]} mat={skin} />
        </group>
      ))}
      {/* 목 · 머리 · 머리카락 · 눈 */}
      <Cyl r={4.2} h={6} at={[0, 89, 0]} mat={skin} seg={12} />
      <Ball r={11.5} at={[0, 103, 0]} mat={skin} />
      <Ball r={12.2} at={[0, 106, -2.2]} mat={toon(HAIR)} scale={[1, 0.86, 1]} half />
      {[-4.2, 4.2].map((x) => <Ball key={x} r={1.5} at={[x, 104, 10.6]} mat={toon("#1b1b1f", { outline: false })} />)}
      <Box size={[5, 1.2, 1]} at={[0, 98.6, 11.2]} mat={toon("#c2410c", { outline: false })} cast={false} />
      {/* 책가방 */}
      {bag && <Box size={[20, 24, 9]} at={[0, 72, -12.5]} mat={toon(BAG)} />}
    </group>
  );
}

/** 센서 쪽으로 뻗은 손과 팔뚝 (손끝이 +z). 길이 약 90 */
export function HandFigure() {
  const skin = toon(SKIN), sleeve = toon(SHIRT);
  return (
    <group position={[0, 38, 0]}>
      {/* 팔뚝 · 소매 */}
      <mesh position={[0, 0, -48]} rotation={[Math.PI / 2, 0, 0]} material={sleeve} castShadow><capsuleGeometry args={[9, 30, 4, 14]} /></mesh>
      <mesh position={[0, 0, -18]} rotation={[Math.PI / 2, 0, 0]} material={skin} castShadow><capsuleGeometry args={[6.4, 22, 4, 12]} /></mesh>
      {/* 손바닥 (세운 손: 센서를 향한다) */}
      <mesh position={[0, 0, 2]} scale={[1, 1.15, 0.5]} material={skin} castShadow><sphereGeometry args={[10, 20, 14]} /></mesh>
      {/* 손가락 넷 · 엄지 */}
      {[-6.6, -2.2, 2.2, 6.6].map((x, k) => (
        <mesh key={x} position={[x, 13 + (k === 1 || k === 2 ? 2 : 0), 3]} material={skin} castShadow><capsuleGeometry args={[2.1, 9 + (k === 1 || k === 2 ? 2 : 0), 4, 8]} /></mesh>
      ))}
      <mesh position={[-11, 2, 4]} rotation={[0, 0, 0.9]} material={skin} castShadow><capsuleGeometry args={[2.3, 8, 4, 8]} /></mesh>
    </group>
  );
}

/** 벽돌 담 조각 (지팡이 앞 장애물). 앞면이 +z */
export function WallFigure() {
  const brick = toon("#c2553a"), mortar = toon("#e9dccb");
  const rows = 5;
  return (
    <group>
      <Box size={[96, 74, 16]} at={[0, 37, 0]} mat={mortar} />
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: 4 }, (_, c) => {
          const w = 22, x = -48 + (r % 2 ? 0 : 11) + c * 24 + w / 2;
          if (x + w / 2 > 48 || x - w / 2 < -48) return null;
          return <Box key={`${r}-${c}`} size={[w, 12, 17]} at={[x, 8 + r * 14.5, 0]} mat={brick} />;
        }),
      )}
      <Box size={[100, 4, 20]} at={[0, 76, 0]} mat={toon("#adb5bd")} />
    </group>
  );
}
