import { useEffect, useMemo, useRef, type RefObject } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Scene3D } from "@/track/wiring3d";
import { Part, roundedBox } from "./kit";
import { DEVKIT_GLB, type Layout } from "./layout";
import { COLOR, noOutline, toonOwn } from "./materials";
import { DK38_P, DK38_X0 } from "./plusLayout";
import { useViewerApi } from "./store";
import { pinText, TEXT } from "./texts";

/*
 * 기본 보드 3D — 선생님이 다시 모델링한 실물 모델(public/models/esp32_devkit_38pin.glb, mm 단위, Z 위)로 그린다.
 * 모든 챕터의 맨 기본 보드가 이 모델을 쓴다. 확장 보드에 꽂힌 DevKit(SeatedDevkit)은 핀이 아래로 가야 해서 손으로 그린 Devkit38 그대로.
 *
 * 맞추는 법: 모델의 핀 간격 2.54mm 를 배선도 핀 간격(DK38_P px)에, 두 줄 사이 25.4mm 를 3D 의 두 줄 사이에 맞춘다
 * (가로 · 세로 배율이 조금 다르다 — 배선도 세로를 DEVKIT_F 배로 늘린 것을 따른다). 모델은 핀이 위로 나 있어
 * 선 머리(F)는 핀 끝을 덮고 앉는다(layout 의 DEVKIT_GLB.seat).
 *
 * 부품은 모델 이름으로 묶어 Part 로 감싼다 → 마우스를 올리면 들리고 설명이 나온다(손으로 그린 보드와 같은 방식).
 */

/** 모델 주소: 앱은 <BASE_URL>blocklab/models/, 라이브러리(허브)는 /blocklab/models/ — 호스트가 dist-lib/models/ 를 그 자리에 둔다 */
const MODEL_URL = `${import.meta.env.BASE_URL ?? "/"}blocklab/models/esp32_devkit_38pin.glb`;

type BoardData = Extract<Scene3D["boards"][number], { kind: "plus" | "devkit" }>;

/** 기본 보드(맨 DevKit)에 model: "glb" 를 단 장면을 돌려준다 */
export function withGlbDevkit(scene: Scene3D): Scene3D {
  if (!scene.boards.some((b) => b.kind === "devkit" && !b.seatedOn)) return scene;
  return { ...scene, boards: scene.boards.map((b) => (b.kind === "devkit" && !b.seatedOn ? { ...b, model: "glb" as const } : b)) };
}

/** 모델 부품 이름 → 묶음 */
export type GroupId = "board" | "header" | "usb" | "en" | "boot" | "usbchip" | "reg" | "pwr" | "module" | "small";
export function groupOf(name: string): GroupId {
  if (/^(PCB|Silk)/.test(name)) return "board";
  if (/^(Header_|Pin)/.test(name)) return "header";
  if (/^USB_(C|Tongue)/.test(name)) return "usb";
  if (/^Btn_EN/.test(name)) return "en";
  if (/^Btn_BOOT/.test(name)) return "boot";
  if (/^USB_UART/.test(name)) return "usbchip";
  if (/^LDO_/.test(name)) return "reg";
  if (/^LED_PWR/.test(name)) return "pwr";
  if (/^(Module_|Antenna|ModPad_|QR|Mark)/.test(name)) return "module";
  return "small";
}

export const GROUPS: readonly { id: GroupId; label: string; text: string; lift: boolean; glow: boolean; card: boolean }[] = [
  { id: "board", label: "ESP32 DevKit 기판", text: TEXT.board, lift: false, glow: false, card: false },
  { id: "header", label: "핀 헤더 (38핀)", text: "선을 꽂는 금색 핀 38개예요. 핀마다 이름(번호)이 있고, 위 줄 · 아래 줄에 19개씩 있어요.", lift: true, glow: true, card: true },
  { id: "usb", label: "USB-C", text: TEXT.usb, lift: true, glow: true, card: true },
  { id: "en", label: "EN 버튼", text: "누르면 보드가 처음부터 다시 시작해요. 눌러 보세요!", lift: true, glow: true, card: false },
  { id: "boot", label: "BOOT 버튼", text: "새 프로그램을 받을 때 쓰는 버튼이에요. 평소에는 누르지 않아요.", lift: true, glow: true, card: false },
  { id: "usbchip", label: "USB 칩", text: TEXT.usbChip, lift: true, glow: true, card: true },
  { id: "reg", label: "전원 조절 부품 (AMS1117)", text: TEXT.regulator, lift: true, glow: true, card: true },
  { id: "pwr", label: "전원 LED", text: TEXT.powerLed, lift: true, glow: true, card: true },
  { id: "module", label: "ESP32 모듈", text: TEXT.module, lift: true, glow: true, card: true },
  { id: "small", label: "작은 부품들", text: "트랜지스터 · 다이오드 · 저항 · 콘덴서예요. 전기가 알맞게 흐르도록 도와요.", lift: true, glow: true, card: true },
];

export function DevkitGlb({ b, L, index, pressEn, releaseEn }: {
  b: BoardData; L: Layout; index: number;
  pressEn: (e: ThreeEvent<PointerEvent>) => void; releaseEn: () => void; enCap?: RefObject<THREE.Mesh | null>;
}) {
  const api = useViewerApi();
  const gltf = useGLTF(MODEL_URL);

  // 배선도 → 3D: 두 핀 줄의 3D 자리
  const rows = useMemo(() => [...new Set(b.pins.map((p) => Math.round(p.y - b.y)))].sort((a, c) => a - c), [b]);
  const rowTop = rows[0] ?? 16, rowBot = rows[rows.length - 1] ?? 134;
  const zTop = L.Z(b.y + rowTop), zBot = L.Z(b.y + rowBot);
  const sx = DK38_P / DEVKIT_GLB.pitchMm; // 가로 · 높이 배율 (3D 단위 / mm)
  const sz = (zBot - zTop) / (DEVKIT_GLB.rowMm * 2); // 세로 배율
  const origin: [number, number, number] = [L.X(b.x + DK38_X0) - DEVKIT_GLB.pin0Mm * sx, 0, (zTop + zBot) / 2];

  // 부품을 묶음마다 나눠 담는다 (모델은 한 번 받아 두고, 화면마다 복제)
  const groups = useMemo(() => {
    const out = new Map<GroupId, THREE.Object3D[]>();
    const root = gltf.scene.children[0] ?? gltf.scene;
    for (const child of root.children) {
      const c = child.clone(true);
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        // 모델 재질은 그대로 쓰되 만화 외곽선은 끈다(작은 부품이 많아 선이 지저분해진다)
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => noOutline(mat));
      });
      const g = groupOf(child.name);
      out.set(g, [...(out.get(g) ?? []), c]);
    }
    return out;
  }, [gltf]);

  // 모델 좌표(mm, Z 위) → 3D: X 는 그대로, 모델 Y 는 -Z, 모델 Z 는 위
  const place = (objs: THREE.Object3D[] | undefined, extra?: { onPointerDown?: (e: ThreeEvent<PointerEvent>) => void; onPointerUp?: () => void; onPointerLeave?: () => void }) =>
    objs ? (
      <group position={origin} rotation={[-Math.PI / 2, 0, 0]} scale={[sx, sz, sx]} {...extra}>
        {objs.map((o) => <primitive key={o.uuid} object={o} />)}
      </group>
    ) : null;

  // 핀에 올리면: 그 핀 이름 · 설명 (배선도에 있는 핀만) — 핀 끝 높이에 보이지 않는 잡이
  const tip = DEVKIT_GLB.pinTipMm * sx, headerTop = DEVKIT_GLB.headerTopMm * sx;
  const grip = useRef<THREE.InstancedMesh>(null);
  const live = b.pins;
  useEffect(() => {
    const m = new THREE.Matrix4();
    live.forEach((p, i) => grip.current?.setMatrixAt(i, m.makeTranslation(L.X(p.x), (headerTop + tip) / 2, L.Z(p.y))));
    if (grip.current) grip.current.instanceMatrix.needsUpdate = true;
  }, [live, L, tip, headerTop]);
  const hid = (i: number) => `dk${index}:${i}`;
  const move = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const st = api.getState();
    if (st.dragging || e.instanceId === undefined) return;
    const p = live[e.instanceId];
    if (st.hover?.id === hid(e.instanceId)) return;
    st.set({ hover: { id: hid(e.instanceId), label: p.label, text: pinText(p.label, p.used), marks: [new THREE.Vector3(L.X(p.x), headerTop + 1, L.Z(p.y))], markSize: [12, 2, 12] } });
    st.invalidate();
  };
  const out = () => { const st = api.getState(); if (st.hover?.id.startsWith(`dk${index}:`)) { st.set({ hover: null }); st.invalidate(); } };

  // 이번에 꽂는 핀: 헤더 위 노란 고리
  const ring = useMemo(() => noOutline(toonOwn({ color: COLOR.glow, emissive: COLOR.glow, emissiveIntensity: 0.6 })), []);
  useEffect(() => () => ring.dispose(), [ring]);

  return (
    <group>
      {GROUPS.map((g) => (
        <Part key={g.id} id={`board${index}-glb-${g.id}`} label={g.id === "board" ? b.name : g.label} text={g.text} lift={g.lift} glow={g.glow} card={g.card}>
          {place(groups.get(g.id), g.id === "en" ? { onPointerDown: pressEn, onPointerUp: releaseEn, onPointerLeave: releaseEn } : undefined)}
        </Part>
      ))}
      <instancedMesh ref={grip} args={[undefined, undefined, Math.max(1, live.length)]} onPointerMove={move} onPointerOut={out} geometry={useMemo(() => roundedBox(14, tip - headerTop, 14), [tip, headerTop])}>
        <meshBasicMaterial visible={false} />
      </instancedMesh>
      {live.filter((p) => p.used).map((p, i) => (
        <mesh key={i} position={[L.X(p.x), headerTop + 0.8, L.Z(p.y)]} rotation={[Math.PI / 2, 0, 0]} material={ring} raycast={() => null}>
          <torusGeometry args={[8, 1.2, 8, 28]} />
        </mesh>
      ))}
    </group>
  );
}

