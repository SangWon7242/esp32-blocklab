import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { noOutline } from "./materials";

/*
 * 모듈 실물 모델 — 선생님이 다시 모델링한 HC-SR04 초음파 센서 · SG90 서보 (public/blocklab/models/, mm, Z 위).
 * 모델은 한 번 받아 두고 화면마다 메시를 복제한다. 자리 · 세우기 · 움직임(서보 팔)은 부르는 쪽(parts.tsx)이 정한다.
 */
const BASE = `${import.meta.env.BASE_URL ?? "/"}blocklab/models/`;
export const SONAR_URL = `${BASE}hc_sr04.glb`;
export const SERVO_URL = `${BASE}sg90_servo.glb`;

/** HC-SR04 (mm): 기판 45 × 20, 핀 쪽 가장자리 y = -10, 눈(캔) 가운데 y = 0.5, 캔 윗면 z = 13.6 */
export const SONAR_MM = { w: 45, pinEdge: -10, eyeY: 0.5, canTop: 13.6 } as const;
/** SG90 (mm): 몸통 길이 32.2, 축 가운데 x = 5.2, 축 윗면 z = 29.9, 선이 나오는 높이 z = 4 */
export const SERVO_MM = { len: 32.2, shaftX: 5.2, shaftTop: 29.9, wireZ: 4 } as const;

/** 모델의 메시를 이름 조건으로 골라 복제(외곽선 끔) */
function useGlbMeshes(url: string, keep: (name: string) => boolean) {
  const gltf = useGLTF(url);
  const meshes = useMemo(() => {
    const root = gltf.scene.children[0] ?? gltf.scene;
    const out: THREE.Object3D[] = [];
    for (const child of root.children) {
      if (!keep(child.name)) continue;
      const c = child.clone(true);
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => noOutline(mat));
      });
      out.push(c);
    }
    return out;
    // keep 은 부르는 쪽 상수
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf]);
  useEffect(() => () => { /* 지오메트리 · 재질은 모델과 함께 쓴다(복제는 얕다) */ }, [meshes]);
  return meshes;
}

/**
 * 초음파 센서 판 · 눈 · 수정 · 글자(핀 · 헤더는 빼고 — 선이 꽂히는 핀은 parts.tsx 의 ModuleBase 가 그린다).
 * 세운 판 안의 좌표(parts.tsx Ultrasonic 의 안쪽 그룹: 판이 바닥에 누운 꼴, 눈은 −y 쪽)에 둔다.
 * pinEdgeZ: 핀 쪽 가장자리 z, grow: 판이 그 가장자리에서 z 가 커지는 쪽(1)인지 작아지는 쪽(-1)인지, cx: 가운데 x, s: 배율
 */
export function SonarGlbBody({ cx, pinEdgeZ, grow, s }: { cx: number; pinEdgeZ: number; grow: 1 | -1; s: number }) {
  const meshes = useGlbMeshes(SONAR_URL, (n) => !/^SR04_(Pin|Header)/.test(n));
  // 모델 z(위) → 안쪽 −y(눈 쪽), 모델 y → 가장자리에서 grow 쪽. grow = -1 은 거울(음수 배율) — three 가 면 방향을 맞춰 그린다
  const c = pinEdgeZ - grow * SONAR_MM.pinEdge * s;
  return (
    <group position={[cx, 0, c]} rotation={[grow > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0]} scale={[s, s, grow > 0 ? s : -s]}>
      {meshes.map((m) => <primitive key={m.uuid} object={m} />)}
    </group>
  );
}

/** 서보 몸통 · 축 · 글자(선 · 커넥터는 빼고 — 선은 parts.tsx 가 플러그까지 그린다). 바닥 가운데 (x, z), 배율 s */
export function ServoGlbBody({ x, z, s }: { x: number; z: number; s: number }) {
  const meshes = useGlbMeshes(SERVO_URL, (n) => !/^(Wire_|Servo_Connector)/.test(n));
  return (
    <group position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]} scale={s}>
      {meshes.map((m) => <primitive key={m.uuid} object={m} />)}
    </group>
  );
}
