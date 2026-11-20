import { useEffect, useMemo, useRef, type RefObject } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Scene3D } from "@/track/wiring3d";
import { Box, Decal, Part, roundedBox } from "./kit";
import { DEVKIT_LIFT, PCB_H, type Layout } from "./layout";
import { COLOR, noOutline, toon, toonOwn } from "./materials";
import { DK38_BOT, DK38_P, DK38_TOP, DK38_X0 } from "./plusLayout";
import { useViewerApi } from "./store";
import { pinText, TEXT } from "./texts";

/*
 * 기본 보드 3D: ESP32-DevKitC 38핀 (흔한 호환 보드). 실물처럼
 *   - 검은 기판이 아래로 난 핀(검은 받침 + 금색 핀) 위에 올라서 있다. 윗면에는 은색 고리 패드 38개
 *   - 왼쪽 끝 USB-C, 그 양옆 BOOT · EN 버튼, 가운데 USB 통역 칩(QFN) · 전원 칩(AMS1117) · 트랜지스터 · 콘덴서 · 빨간 전원 LED
 *   - 오른쪽 끝 ESP32-WROOM-32 모듈 (금색 가장자리 패드, 흰 덮개의 QR · CE · ESPRESSIF), 안테나는 기판 밖으로 나온다
 * 좌표는 보드 왼쪽 위에서 잰 배선도 px (가로 470 × 세로 150, 세로는 3D 에서 L.F 배로 늘어난다).
 */

type BoardData = Extract<Scene3D["boards"][number], { kind: "plus" | "devkit" }>;

/**
 * toWorld: 확장 보드에 꽂힌 DevKit 처럼 줄인 그룹 안에 그릴 때, 핀에 올린 표시(장면 좌표)로 옮기는 함수와 그 배율 (SeatedDevkit)
 */
export function Devkit38({ b, L, index, blueLed, pressEn, releaseEn, enCap, toWorld }: {
  b: BoardData; L: Layout; index: number; blueLed: THREE.MeshStandardMaterial;
  pressEn: (e: ThreeEvent<PointerEvent>) => void; releaseEn: () => void; enCap: RefObject<THREE.Mesh | null>;
  toWorld?: { at: (v: THREE.Vector3) => THREE.Vector3; scale: number };
}) {
  const api = useViewerApi();
  const F = L.F;
  const lift = DEVKIT_LIFT, top = DEVKIT_LIFT + PCB_H;
  const X = (rx: number) => L.X(b.x + rx), Z = (ry: number) => L.Z(b.y + ry);
  const rows = useMemo(() => [...new Set(b.pins.map((p) => Math.round(p.y - b.y)))].sort((a, c) => a - c), [b]);
  const rowTop = rows[0] ?? 16, rowBot = rows[rows.length - 1] ?? 134;
  /** 38 자리: [이름, 위 줄?, x] */
  const slots = useMemo(() => [
    ...DK38_TOP.map((n, i) => [n, true, DK38_X0 + DK38_P * i] as const),
    ...DK38_BOT.map((n, i) => [n, false, DK38_X0 + DK38_P * i] as const),
  ], []);

  // 기판 바깥선 (둥근 모서리), 기판 끝 x 420
  const W = 420, y0 = 10, y1 = 140;
  const board = useMemo(() => {
    const s = new THREE.Shape();
    const r = 8, x0 = 2, x1 = W, z0 = Z(y0), z1 = Z(y1), cx = L.X(b.x);
    s.moveTo(cx + x0 + r, z0); s.lineTo(cx + x1 - r, z0); s.quadraticCurveTo(cx + x1, z0, cx + x1, z0 + r);
    s.lineTo(cx + x1, z1 - r); s.quadraticCurveTo(cx + x1, z1, cx + x1 - r, z1); s.lineTo(cx + x0 + r, z1);
    s.quadraticCurveTo(cx + x0, z1, cx + x0, z1 - r); s.lineTo(cx + x0, z0 + r); s.quadraticCurveTo(cx + x0, z0, cx + x0 + r, z0);
    const g = new THREE.ExtrudeGeometry(s, { depth: PCB_H, bevelEnabled: false });
    g.rotateX(Math.PI / 2);
    g.translate(0, top, 0);
    return g;
  }, [b, L, top]);
  useEffect(() => () => board.dispose(), [board]);

  // 패드 38개 · 아래 핀 38개 (인스턴스)
  const pads = useRef<THREE.InstancedMesh>(null);
  const holes = useRef<THREE.InstancedMesh>(null);
  const legs = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4();
    slots.forEach(([, up, rx], i) => {
      const ry = up ? rowTop : rowBot;
      pads.current?.setMatrixAt(i, m.makeTranslation(X(rx), top + 0.35, Z(ry)));
      holes.current?.setMatrixAt(i, m.makeTranslation(X(rx), top + 0.75, Z(ry)));
      legs.current?.setMatrixAt(i, m.makeTranslation(X(rx), lift / 2, Z(ry)));
    });
    for (const r of [pads, holes, legs]) if (r.current) r.current.instanceMatrix.needsUpdate = true;
  });

  // 핀에 올리면: 그 핀 이름 · 설명 (배선도에 있는 핀만)
  const grip = useRef<THREE.InstancedMesh>(null);
  const live = b.pins;
  useEffect(() => {
    const m = new THREE.Matrix4();
    live.forEach((p, i) => grip.current?.setMatrixAt(i, m.makeTranslation(L.X(p.x), top + 3, L.Z(p.y))));
    if (grip.current) grip.current.instanceMatrix.needsUpdate = true;
  }, [live, L, top]);
  const hid = (i: number) => `dk${index}:${i}`;
  const move = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const st = api.getState();
    if (st.dragging || e.instanceId === undefined) return;
    const p = live[e.instanceId];
    if (st.hover?.id === hid(e.instanceId)) return;
    const mark = new THREE.Vector3(L.X(p.x), top + 1.2, L.Z(p.y));
    const k = toWorld?.scale ?? 1;
    st.set({ hover: { id: hid(e.instanceId), label: p.label, text: pinText(p.label, p.used), marks: [toWorld ? toWorld.at(mark) : mark], markSize: [9 * k, 2 * k, 9 * F * 0.6 * k] } });
    st.invalidate();
  };
  const out = () => { const st = api.getState(); if (st.hover?.id.startsWith(`dk${index}:`)) { st.set({ hover: null }); st.invalidate(); } };

  // 실크: 핀 이름 (줄 안쪽) · Boot · EN
  const silk = (g: CanvasRenderingContext2D, cw: number) => {
    const S = cw / b.w;
    g.scale(S, S);
    g.fillStyle = "#f8f9fa";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "800 9px system-ui, sans-serif";
    const used = new Set(b.pins.filter((p) => p.used).map((p) => p.x.toFixed(0) + (Math.round(p.y - b.y) === rowTop ? "t" : "b")));
    slots.forEach(([n, up, rx]) => {
      g.globalAlpha = used.has((b.x + rx).toFixed(0) + (up ? "t" : "b")) ? 1 : 0.7;
      g.fillText(n, rx, ((up ? rowTop + 15 : rowBot - 15)) * F);
    });
    g.globalAlpha = 1;
    g.font = "800 8px system-ui, sans-serif";
    g.fillText("Boot", 58, 112 * F);
    g.fillText("EN", 58, 38 * F);
  };

  // 모듈 덮개 그림: QR · CE · ESP32-WROOM-32 · ESPRESSIF
  const can = { x0: 258, x1: 416, y0: 37, y1: 111 };
  const black = toon("#17171a"), silver = toon("#d4d4d8", { metal: 0.8, rough: 0.3 }), chip = toon("#1f1f23");
  const H = (ry: number) => ry * F; // 세로 길이를 3D 로
  return (
    <group>
      {/* 아래: 검은 받침 두 줄 · 금색 핀 (보드가 핀 위에 올라서 있다) */}
      {[rowTop, rowBot].map((ry) => <Box key={ry} size={[DK38_P * 19, lift * 0.55, H(9)]} at={[X(DK38_X0 + DK38_P * 9), lift * 0.725, Z(ry)]} mat={black} />)}
      <instancedMesh ref={legs} args={[undefined, undefined, 38]} material={toon(COLOR.gold)} castShadow raycast={() => null} geometry={useMemo(() => new THREE.BoxGeometry(2.2, lift, 2.2), [lift])} />
      {/* 기판 */}
      <Part id={`board${index}`} label={b.name} text={TEXT.board} lift={false} glow={false} card={false}>
        <mesh geometry={board} material={toon("#151517", { rough: 0.5 })} castShadow receiveShadow />
      </Part>
      <Decal w={b.w} d={b.h * F} at={[L.X(b.x + b.w / 2), top + 0.15, (L.Z(b.y) + L.Z(b.y + b.h)) / 2]} px={1800} paint={silk} />
      {/* 윗면 패드: 은색 고리 · 가운데 구멍 */}
      <instancedMesh ref={pads} args={[undefined, undefined, 38]} material={silver} raycast={() => null} geometry={useMemo(() => new THREE.CylinderGeometry(7, 7, 0.7, 24), [])} />
      <instancedMesh ref={holes} args={[undefined, undefined, 38]} material={toon("#6b7280", { outline: false })} raycast={() => null} geometry={useMemo(() => new THREE.CylinderGeometry(3.4, 3.4, 0.4, 16), [])} />
      <instancedMesh ref={grip} args={[undefined, undefined, Math.max(1, live.length)]} onPointerMove={move} onPointerOut={out} geometry={useMemo(() => roundedBox(16, 6, 16), [])}>
        <meshBasicMaterial visible={false} />
      </instancedMesh>

      {/* USB-C (왼쪽 끝, 기판 밖으로 조금 나온다) */}
      <Part id={`board${index}-usb`} label="USB-C" text={TEXT.usb}>
        <Box size={[40, 9, H(30)]} at={[X(8), top + 4.5, Z(74)]} mat={toon(COLOR.metalLight)} />
        <Box size={[30, 0.6, H(20)]} at={[X(12), top + 9.1, Z(74)]} mat={toon("#cbd5e1", { metal: 0.7, rough: 0.3 })} cast={false} />
        <mesh position={[X(-12) - 0.3, top + 4.5, Z(74)]} rotation={[Math.PI / 2, 0, Math.PI / 2]} material={toon("#1b1b1f", { outline: false })}>
          <capsuleGeometry args={[2.4, H(16), 4, 10]} />
        </mesh>
      </Part>
      {/* BOOT · EN 버튼 (은색 사각 몸통 · 둥근 단추) */}
      {([["Boot", 110, false], ["EN", 38, true]] as const).map(([name, ry, en]) => (
        <Part key={name} id={`board${index}-${name}`} label={`${name.toUpperCase()} 버튼`} text={en ? "누르면 보드가 처음부터 다시 시작해요. 눌러 보세요!" : "새 프로그램을 받을 때 쓰는 버튼이에요. 평소에는 누르지 않아요."} card={false}>
          <Box size={[22, 4, H(15)]} at={[X(36), top + 2, Z(ry)]} mat={silver} />
          <mesh ref={en ? enCap : undefined} position={[X(36), top + 5, Z(ry)]} material={toon("#3f3f46")} castShadow
            onPointerDown={en ? pressEn : undefined} onPointerUp={en ? releaseEn : undefined} onPointerLeave={en ? releaseEn : undefined}>
            <cylinderGeometry args={[6, 6, 3, 20]} />
          </mesh>
        </Part>
      ))}
      {/* USB 통역 칩 (QFN, 둘레에 작은 다리) */}
      <Part id={`board${index}-usbchip`} label="USB 칩" text={TEXT.usbChip}>
        <Box size={[40, 3, H(22)]} at={[X(106), top + 1.5, Z(74)]} mat={chip} />
        {Array.from({ length: 6 }, (_, i) => [-1, 1].map((sgn) => (
          <group key={`${i}${sgn}`}>
            <Box size={[2.4, 0.6, H(2)]} at={[X(93 + i * 5.2), top + 0.3, Z(74 + sgn * 12)]} mat={silver} cast={false} />
            <Box size={[2.4, 0.6, H(1.4)]} at={[X(106 + sgn * 21.5), top + 0.3, Z(66 + i * 3.2)]} mat={silver} cast={false} />
          </group>
        )))}
      </Part>
      {/* 전원 칩 AMS1117 (SOT-223: 큰 은색 탭 · 다리 셋) */}
      <Part id={`board${index}-reg`} label="전원 조절 부품 (AMS1117)" text={TEXT.regulator}>
        <Box size={[38, 4.5, H(16)]} at={[X(183), top + 2.25, Z(74)]} mat={chip} />
        <Box size={[34, 1.2, H(10)]} at={[X(183), top + 0.6, Z(87)]} mat={silver} cast={false} />
        {[-12, 0, 12].map((dx) => <Box key={dx} size={[6, 1.2, H(6)]} at={[X(183 + dx), top + 0.6, Z(62)]} mat={silver} cast={false} />)}
      </Part>
      {/* 트랜지스터 둘 (SOT-23) · 콘덴서 · 작은 저항 */}
      {[103, 169].map((rx) => (
        <group key={rx}>
          <Box size={[13, 2.6, H(8)]} at={[X(rx), top + 1.3, Z(110)]} mat={chip} cast={false} />
          {[-4, 4].map((dx) => <Box key={dx} size={[2.4, 0.8, H(3)]} at={[X(rx + dx), top + 0.4, Z(115)]} mat={silver} cast={false} />)}
          <Box size={[2.4, 0.8, H(3)]} at={[X(rx), top + 0.4, Z(105)]} mat={silver} cast={false} />
        </group>
      ))}
      {[[151, 47], [151, 38], [178, 47], [178, 38]].map(([rx, ry]) => (
        <group key={`${rx}${ry}`}>
          <Box size={[9, 3.4, H(5)]} at={[X(rx), top + 1.7, Z(ry)]} mat={toon("#c9a26b")} cast={false} />
          {[-1, 1].map((k) => <Box key={k} size={[2, 3.6, H(5.2)]} at={[X(rx + k * 4), top + 1.8, Z(ry)]} mat={silver} cast={false} />)}
        </group>
      ))}
      {[[74, 85], [74, 64], [130, 90], [140, 90], [150, 90], [128, 50], [128, 58]].map(([rx, ry]) => <Box key={`${rx}${ry}`} size={[5, 1.8, H(3)]} at={[X(rx), top + 0.9, Z(ry)]} mat={toon("#e9ecef")} cast={false} />)}
      {/* 빨간 전원 LED · 2번 핀 파란 LED */}
      <Part id={`board${index}-pwr`} label="전원 LED" text={TEXT.powerLed}>
        <Box size={[7, 2.4, H(5)]} at={[X(113), top + 1.2, Z(37)]} mat={toon("#ff6b6b", { emissive: "#e03131", emissiveIntensity: 0.9 })} />
      </Part>
      <Part id={`board${index}-led2`} label="내장 LED (2번 핀)" text={TEXT.bootLed}>
        <Box size={[7, 2.4, H(5)]} at={[X(124), top + 1.2, Z(37)]} mat={blueLed} />
      </Part>

      {/* ESP32-WROOM-32 모듈: 짙은 회색 판(안테나가 기판 밖으로) · 금색 가장자리 패드 · 흰 덮개 */}
      <Part id={`board${index}-module`} label="ESP32 모듈" text={TEXT.module}>
        <Box size={[220, 2.4, H(83)]} at={[X(360), top + 1.2, Z(74)]} mat={toon("#3f434a", { rough: 0.55 })} />
        {/* 안테나 무늬 */}
        <Decal w={52} d={H(70)} at={[X(443), top + 2.5, Z(74)]} paint={(g, cw, ch) => {
          g.strokeStyle = "#5c6370"; g.lineWidth = cw * 0.06; g.lineCap = "square";
          g.beginPath(); g.moveTo(cw * 0.12, ch * 0.95); g.lineTo(cw * 0.12, ch * 0.1);
          for (let k = 0; k < 4; k++) { const y = k % 2 ? ch * 0.1 : ch * 0.75; g.lineTo(cw * (0.3 + k * 0.18), k % 2 ? ch * 0.75 : ch * 0.1); g.lineTo(cw * (0.3 + k * 0.18), y); }
          g.stroke();
        }} />
        {/* 가장자리 금색 패드: 위 · 아래 · 덮개 쪽 끝 */}
        {Array.from({ length: 13 }, (_, i) => [y0 + 24.5, y1 - 26.5].map((ry) => <Box key={`${i}${ry}`} size={[5, 1, H(3)]} at={[X(256 + i * 12.6), top + 2.5, Z(ry)]} mat={toon(COLOR.gold)} cast={false} />))}
        {Array.from({ length: 6 }, (_, i) => <Box key={`e${i}`} size={[3, 1, H(5)]} at={[X(252), top + 2.5, Z(42 + i * 12.5)]} mat={toon(COLOR.gold)} cast={false} />)}
        {/* 흰 덮개 */}
        <Box size={[can.x1 - can.x0, 6, H(can.y1 - can.y0)]} at={[X((can.x0 + can.x1) / 2), top + 5.4, Z((can.y0 + can.y1) / 2)]} mat={toon("#e9e9ea", { metal: 0.35, rough: 0.35 })} />
        <Decal w={can.x1 - can.x0 - 6} d={H(can.y1 - can.y0 - 6)} at={[X((can.x0 + can.x1) / 2), top + 8.45, Z((can.y0 + can.y1) / 2)]} px={512} paint={(g, cw, ch) => {
          // QR (보는 쪽 왼쪽 아래 = 사진의 왼쪽 위)
          const q = ch * 0.3, qx = cw * 0.05, qy = ch * 0.62, n = 11, c = q / n;
          let seed = 13;
          g.fillStyle = "#1b1b1f";
          for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
            seed = (seed * 41 + 7) % 97;
            const corner = (xx < 3 && yy < 3) || (xx > n - 4 && yy < 3) || (xx < 3 && yy > n - 4);
            if (corner ? !((xx % (n - 1) === 1 || yy % (n - 1) === 1) && !(xx === 1 && yy === 1)) : seed % 2) g.fillRect(qx + xx * c, qy + yy * c, c, c);
          }
          g.textAlign = "center"; g.textBaseline = "middle";
          // 글자는 덮개 폭에 맞춰 줄인다
          const fit = (t: string, weight: number, size: number, x: number, y: number, maxW: number) => {
            g.font = `${weight} ${size}px system-ui, sans-serif`;
            const w = g.measureText(t).width;
            if (w > maxW) g.font = `${weight} ${Math.floor((size * maxW) / w)}px system-ui, sans-serif`;
            g.fillText(t, x, y);
          };
          fit("CE", 800, Math.round(ch * 0.14), cw * 0.66, ch * 0.22, cw * 0.14);
          fit("ESP32-WROOM-32", 700, Math.round(ch * 0.1), cw * 0.68, ch * 0.5, cw * 0.56);
          fit("ESPRESSIF", 900, Math.round(ch * 0.12), cw * 0.72, ch * 0.76, cw * 0.46);
          g.lineWidth = ch * 0.018; g.strokeStyle = "#1b1b1f";
          for (const r of [0.035, 0.06]) { g.beginPath(); g.arc(cw * 0.43, ch * 0.76, ch * r, 0, Math.PI * 2); g.stroke(); }
        }} />
      </Part>
      <UsedRings b={b} L={L} top={top} />
    </group>
  );
}

/** 이번에 꽂는 핀: 노란 고리 */
function UsedRings({ b, L, top }: { b: BoardData; L: Layout; top: number }) {
  const mat = useMemo(() => noOutline(toonOwn({ color: COLOR.glow, emissive: COLOR.glow, emissiveIntensity: 0.6 })), []);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <>
      {b.pins.filter((p) => p.used).map((p, i) => (
        <mesh key={i} position={[L.X(p.x), top + 0.9, L.Z(p.y)]} rotation={[Math.PI / 2, 0, 0]} material={mat} raycast={() => null}>
          <torusGeometry args={[9, 1.3, 8, 28]} />
        </mesh>
      ))}
    </>
  );
}
