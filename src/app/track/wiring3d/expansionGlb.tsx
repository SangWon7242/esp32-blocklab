import { useEffect, useMemo, useRef } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ExpansionBoard3D, Scene3D } from "@/track/wiring3d";
import { Part, roundedBox } from "./kit";
import { groupOf as devkitGroupOf, GROUPS as DEVKIT_GROUPS } from "./devkitGlb";
import { EX_PIN, PCB_H, type Layout } from "./layout";
import { COLOR, noOutline, toonOwn } from "./materials";
import { useViewerApi } from "./store";
import { expansionPinText, TEXT } from "./texts";

/*
 * 38핀 확장 보드 + 꽂힌 DevKit — 선생님이 다시 모델링한 실물 조립 모델(public/blocklab/models/esp32_on_expansion_assembly.glb, mm).
 * 시험 중: EXP_GLB_CHAPTERS 의 챕터만. 나머지는 손으로 그린 ExpansionBoard + SeatedDevkit 그대로.
 *
 * 맞추는 법: 모델의 꼭짓점마다 실물 mm 를 배선도 그림 좌표로 옮긴다(조각조각 곧은 맞춤).
 *   - 가로: 기판 왼쪽 끝 → 0, 첫 S/V/G 기둥(-9.23mm) → 200px, 그다음은 2.54mm = 핀 간격(px)
 *   - 세로: 위 S · V · G 줄 · 위 암 헤더 두 줄 · 아래 암 헤더 · 아래 G · V · S 줄을 배선도 기록의 줄 자리에
 *   - 높이: 핀 끝(10.1mm)이 지금 3D 의 핀 끝(PCB_H + EX_PIN)에 오게 — 선이 앉는 높이는 그대로
 * 그래서 S/V/G 핀 · 암 헤더가 배선도 선 끝과 정확히 맞는다. 전원부 부품은 왼쪽 띠에 맞춰 조금 좁아진다.
 * JUMP 점퍼 캡은 b.jumper 에 따라: 3V3(평소) = V–3.3V 두 핀, 5V = 5V–V 두 핀(2.54mm 옮김).
 * 전원 헤더(2×4) · I2C/UART 헤더(2×4)는 선이 꽂히는 핀이라, 헤더와 그 옆 글자를 통째로 배선도의 그 헤더 자리로 옮긴다(실물 간격 그대로).
 * JUMP 는 선을 꽂지 않아 모델 자리 그대로.
 */

/** 확장 보드 장면이면 확장 보드와 거기 꽂힌 DevKit 에 model: "glb" 를 단다(꽂힌 DevKit 은 조립 모델이 함께 그린다) */
export function withGlbExpansion(scene: Scene3D): Scene3D {
  if (!scene.boards.some((b) => b.kind === "expansion")) return scene;
  return { ...scene, boards: scene.boards.map((b) => (b.kind === "expansion" || (b.kind === "devkit" && b.seatedOn === "expansion") ? { ...b, model: "glb" as const } : b)) };
}

const MODEL_URL = `${import.meta.env.BASE_URL ?? "/"}blocklab/models/esp32_on_expansion_assembly.glb`;

/** 모델 세로(mm, 기판 위 끝에서) → 배선도 y(px, 보드 위 끝에서) */
const Y_MAP: [number, number][] = [[0, 0], [10.37, 40], [12.91, 59.8], [15.45, 79.6], [21.8, 103.6], [24.34, 123.4], [47.2, 209.8], [53.55, 233.8], [56.09, 253.6], [58.63, 273.4], [69, 314]];
/** 모델 기판 위 끝 y (mm) — 모델 y 는 위쪽이 + */
const TOP_Y_MM = 34.5;
const COL0_MM = -9.23, COL0_PX = 200, LEFT_MM = -43;
const PIN_TIP_MM = 10.1;

function interp(v: number, pts: [number, number][]) {
  if (v <= pts[0][0]) return pts[0][1] + (v - pts[0][0]);
  for (let i = 1; i < pts.length; i++) {
    const [a0, b0] = pts[i - 1], [a1, b1] = pts[i];
    if (v <= a1) return b0 + ((v - a0) / (a1 - a0)) * (b1 - b0);
  }
  const [aL, bL] = pts[pts.length - 1];
  return bL + (v - aL);
}

/** 확장 보드 부품 이름 → 묶음 */
type ExGroup = "board" | "female" | "svg" | "jumper" | "usb" | "micro" | "dc" | "reg" | "caps" | "pwrhdr" | "uart" | "small";
function exGroupOf(name: string): ExGroup {
  if (/^(ExpPCB|ExpSilk|PinSilk|SilkLine)/.test(name)) return "board";
  if (/^Sock_/.test(name)) return "female";
  if (/^Hdr_/.test(name)) return "svg";
  if (/^Jump/.test(name)) return "jumper";
  if (/^Exp_USB/.test(name)) return "usb";
  if (/^MicroUSB/.test(name)) return "micro";
  if (/^DC_/.test(name)) return "dc";
  if (/^Exp_LDO/.test(name)) return "reg";
  if (/^Cap\d/.test(name)) return "caps";
  if (/^PwrHdr/.test(name)) return "pwrhdr";
  if (/^UartHdr/.test(name)) return "uart";
  return "small";
}

export function ExpansionGlb({ b, L, index }: { b: ExpansionBoard3D; L: Layout; index: number }) {
  const api = useViewerApi();
  const gltf = useGLTF(MODEL_URL);
  const top = PCB_H + EX_PIN;
  const hs = top / PIN_TIP_MM;
  const pxPerMm = b.pitch / 2.54;

  // 꼭짓점마다 mm → 3D 로 옮긴 메시를 묶음별로
  const built = useMemo(() => {
    const ex = new Map<ExGroup, THREE.Mesh[]>(), dk = new Map<string, THREE.Mesh[]>();
    const root = gltf.scene.children[0] ?? gltf.scene;
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const fx = (x: number) => (x <= COL0_MM ? ((x - LEFT_MM) / (COL0_MM - LEFT_MM)) * COL0_PX : COL0_PX + (x - COL0_MM) * pxPerMm);
    const rel = new THREE.Matrix4();

    // 전원 헤더 · I2C/UART 헤더: 모델의 핀 자리(첫 열 x · 먼 줄 y)와 배선도의 핀 자리(첫 열 · 위 줄)를 맞춰 통째로 옮긴다
    type Spot = { box: THREE.Box3; glbX0: number; glbY0: number; px0: number; py0: number };
    const centerOf = (m: THREE.Mesh) => {
      const g = m.geometry.clone();
      g.applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld));
      g.computeBoundingBox();
      const box = g.boundingBox!.clone();
      g.dispose();
      return box;
    };
    const spotFor = (prefix: string, rows: string[]): Spot | null => {
      const scenePins = b.pins.filter((p) => p.row && rows.includes(p.row));
      if (!scenePins.length) return null;
      let box: THREE.Box3 | null = null;
      const pins: THREE.Vector3[] = [];
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.name.startsWith(prefix)) return;
        const bb = centerOf(m);
        box = box ? box.union(bb) : bb;
        if (/_P\d+$/.test(m.name)) pins.push(bb.getCenter(new THREE.Vector3()));
      });
      if (!box || !pins.length) return null;
      return {
        box: (box as THREE.Box3).clone().expandByVector(new THREE.Vector3(1, 2.6, 0)),
        glbX0: Math.min(...pins.map((v) => v.x)), glbY0: Math.max(...pins.map((v) => v.y)),
        px0: Math.min(...scenePins.map((p) => p.x)) - b.x, py0: Math.min(...scenePins.map((p) => p.y)) - b.y,
      };
    };
    const pwrSpot = spotFor("PwrHdr", ["pwr"]), uartSpot = spotFor("UartHdr", ["i2c", "uart"]);
    const spots = [pwrSpot, uartSpot].filter((v): v is Spot => v !== null);
    const spotOf = (m: THREE.Mesh, c: THREE.Vector3) => {
      if (m.name.startsWith("PwrHdr")) return pwrSpot;
      if (m.name.startsWith("UartHdr")) return uartSpot;
      // 헤더 바로 옆 글자(핀 이름)는 헤더와 함께
      if (/^(PinSilk|ExpSilk|SilkLine)/.test(m.name)) return spots.find((sp) => sp.box.containsPoint(c)) ?? null;
      return null;
    };

    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      rel.multiplyMatrices(inv, m.matrixWorld);
      const g = m.geometry.clone();
      g.applyMatrix4(rel);
      const shift = m.name === "Jumper_Cap" && b.jumper === "5V" ? 2.54 : 0;
      // 기판 글자 · 선(1.6~1.63mm)은 높이를 늘리면 기판 윗면과 거의 붙어 돌릴 때 깜빡인다 — 조금 띄운다
      const silk = /^(ExpSilk|PinSilk|SilkLine|Silk|Mark)/.test(m.name) ? 0.35 : 0;
      g.computeBoundingBox();
      const spot = spotOf(m, g.boundingBox!.getCenter(new THREE.Vector3()));
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i) + shift, z = pos.getZ(i);
        const px = spot ? spot.px0 + (x - spot.glbX0) * pxPerMm : fx(x);
        const py = spot ? spot.py0 + (spot.glbY0 - y) * pxPerMm : interp(TOP_Y_MM - y, Y_MAP);
        pos.setXYZ(i, L.X(b.x + px), Math.max(0, z) * hs + silk, L.Z(b.y + py));
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      g.computeBoundingBox();
      g.computeBoundingSphere();
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((mat) => noOutline(mat));
      const mesh = new THREE.Mesh(g, mats.length === 1 ? mats[0] : mats);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // 조립 모델의 DevKit 쪽(부모가 ESP32_DevKit) 은 DevKit 묶음으로
      const onDevkit = (() => { for (let p = m.parent; p && p !== root; p = p.parent) if (/DevKit/i.test(p.name)) return true; return false; })();
      if (onDevkit) {
        const id = devkitGroupOf(m.name);
        dk.set(id, [...(dk.get(id) ?? []), mesh]);
      } else {
        const id = exGroupOf(m.name);
        ex.set(id, [...(ex.get(id) ?? []), mesh]);
      }
    });
    return { ex, dk };
  }, [gltf, b, L, hs, pxPerMm]);
  useEffect(() => () => {
    for (const list of [...built.ex.values(), ...built.dk.values()]) for (const m of list) m.geometry.dispose();
  }, [built]);

  const show = (list: THREE.Mesh[] | undefined) => list?.map((m) => <primitive key={m.uuid} object={m} />) ?? null;
  const jumperLabel = `JUMP 점퍼 (지금 ${b.jumper === "5V" ? "5V" : "3.3V"})`;
  const EX_PARTS: { id: ExGroup; label: string; text: string; lift: boolean; glow?: boolean; card?: boolean }[] = [
    { id: "board", label: b.name, text: TEXT.expansion, lift: false, glow: false, card: false },
    { id: "female", label: "암 헤더 (DevKit 자리)", text: TEXT.female, lift: false },
    { id: "svg", label: "S · V · G 핀 기둥", text: "GPIO 마다 S(신호 · 노랑) · V(전원 · 빨강) · G(GND · 검정) 세 핀이에요. 모듈 선을 그 칸에 바로 꽂아요.", lift: false },
    { id: "jumper", label: jumperLabel, text: TEXT.jumper, lift: true },
    { id: "usb", label: "USB-C (USB5V)", text: TEXT.usbPower, lift: true },
    { id: "micro", label: "마이크로 USB", text: TEXT.microUsb, lift: true },
    { id: "dc", label: "DC 전원 잭 (6.5~16V)", text: TEXT.dcJack, lift: true },
    { id: "reg", label: "전원 조절 부품 (AMS1117)", text: TEXT.regulator, lift: true },
    { id: "caps", label: "콘덴서 (47µF 35V)", text: TEXT.caps, lift: true },
    { id: "pwrhdr", label: "전원 헤더", text: "5V · 3.3V · GND 를 꺼내 쓰는 핀이에요.", lift: false },
    { id: "uart", label: "I2C · UART 헤더", text: "I2C(21 · 22) · UART 선을 꽂는 핀이에요.", lift: false },
    { id: "small", label: "작은 부품들", text: "다이오드 · 저항 · 콘덴서예요. 전기가 알맞게 흐르도록 도와요.", lift: true },
  ];

  // S/V/G · 전원 · I2C/UART 핀에 올리면 그 핀 이름 · 설명 (JUMP 는 점퍼 부품 설명으로)
  const pins = useMemo(() => b.pins.filter((p) => p.row !== "jump"), [b]);
  const grips = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4();
    pins.forEach((p, i) => grips.current?.setMatrixAt(i, m.makeTranslation(L.X(p.x), top - EX_PIN / 2, L.Z(p.y))));
    if (grips.current) grips.current.instanceMatrix.needsUpdate = true;
  }, [pins, L, top]);
  const hid = (i: number) => `xb${index}:${i}`;
  const move = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const st = api.getState();
    if (st.dragging || e.instanceId === undefined) return;
    const p = pins[e.instanceId];
    if (!p || st.hover?.id === hid(e.instanceId)) return;
    const label = p.row === "i2c" || p.row === "uart" ? `${p.row.toUpperCase()} ${p.label}` : p.row === "pwr" ? `전원 헤더 ${p.label}` : p.label.replace(/ ([SVG])$/, " 칸 $1");
    st.set({ hover: { id: hid(e.instanceId), label, text: expansionPinText(p.label, p.used, b.jumper, p.row), marks: [new THREE.Vector3(L.X(p.x), top + 1, L.Z(p.y))], markSize: [8, 3, 8] } });
    st.invalidate();
  };
  const out = () => { const st = api.getState(); if (st.hover?.id.startsWith(`xb${index}:`)) { st.set({ hover: null }); st.invalidate(); } };

  const ring = useMemo(() => noOutline(toonOwn({ color: COLOR.glow, emissive: COLOR.glow, emissiveIntensity: 0.6 })), []);
  useEffect(() => () => ring.dispose(), [ring]);
  const baseTop = 4.1 * hs;

  return (
    <group>
      {EX_PARTS.map((g) => built.ex.get(g.id) && (
        <Part key={g.id} id={`board${index}-xglb-${g.id}`} label={g.label} text={g.text} lift={g.lift} glow={g.glow ?? true} card={g.card ?? true}>
          {show(built.ex.get(g.id))}
        </Part>
      ))}
      {DEVKIT_GROUPS.map((g) => built.dk.get(g.id) && (
        <Part key={`dk-${g.id}`} id={`board${index}-xglb-dk-${g.id}`} label={g.id === "board" ? "ESP32 DevKit (38핀)" : g.label} text={g.text}
          lift={g.lift && g.id !== "header"} glow={g.glow} card={g.card}>
          {show(built.dk.get(g.id))}
        </Part>
      ))}
      <instancedMesh ref={grips} args={[undefined, undefined, Math.max(1, pins.length)]} onPointerMove={move} onPointerOut={out} geometry={useMemo(() => roundedBox(16, EX_PIN, 16), [])}>
        <meshBasicMaterial visible={false} />
      </instancedMesh>
      {pins.filter((p) => p.used).map((p, i) => (
        <mesh key={i} position={[L.X(p.x), baseTop + 0.8, L.Z(p.y)]} rotation={[Math.PI / 2, 0, 0]} material={ring} raycast={() => null}>
          <torusGeometry args={[7, 1.1, 8, 24]} />
        </mesh>
      ))}
    </group>
  );
}
