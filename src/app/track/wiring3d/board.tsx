import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Scene3D } from "@/track/wiring3d";
import { Box, Cyl, Decal, Part, roundedBox } from "./kit";
import { BB_H, HEADER_H, PCB_H, PIN_LEN, type Layout } from "./layout";
import { K, svgToBoard } from "./plusLayout";
import { COLOR, noOutline, toon, toonOwn } from "./materials";
import { useViewerApi } from "./store";
import { pinText, TEXT } from "./texts";

type BoardData = Scene3D["boards"][number];
type BB = Scene3D["breadboards"][number];

/** 모서리가 둥근 두꺼운 판 (윗면 · 옆면 두 재질) */
export function Slab({ x, y, w, d, h, radius, top, side, y0 = 0, outline, ...events }: {
  x: number; y: number; w: number; d: number; h: number; radius: number; top: THREE.Material; side: THREE.Material; y0?: number;
  /** 둥근 사각형 대신 이 바깥선 (판 왼쪽 위가 0, 0 인 점들) */
  outline?: [number, number][];
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void; onPointerOut?: () => void;
}) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    if (outline) {
      outline.forEach(([px, py], k) => (k ? s.lineTo(px - w / 2, py - d / 2) : s.moveTo(px - w / 2, py - d / 2)));
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
      g.rotateX(Math.PI / 2);
      return g;
    }
    const q = Math.min(radius, w / 2, d / 2);
    s.moveTo(-w / 2 + q, -d / 2);
    s.lineTo(w / 2 - q, -d / 2);
    s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + q);
    s.lineTo(w / 2, d / 2 - q);
    s.quadraticCurveTo(w / 2, d / 2, w / 2 - q, d / 2);
    s.lineTo(-w / 2 + q, d / 2);
    s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - q);
    s.lineTo(-w / 2, -d / 2 + q);
    s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + q, -d / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6 });
    g.rotateX(Math.PI / 2);
    return g;
  }, [w, d, h, radius, outline]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={[top, side]} position={[x, y0 + h, y]} castShadow receiveShadow {...events} />;
}

/* ───────────── 브레드보드 ───────────── */

export function Breadboard({ bb, L, index }: { bb: BB; L: Layout; index: number }) {
  const api = useViewerApi();
  const holes = useRef<THREE.InstancedMesh>(null);
  const all = useMemo(() => [...bb.holes, ...bb.rails.flatMap((r) => r.xs.map((x) => [x, r.y] as [number, number]))], [bb]);
  useEffect(() => {
    const m = holes.current;
    if (!m) return;
    const mx = new THREE.Matrix4();
    all.forEach(([x, y], i) => m.setMatrixAt(i, mx.makeTranslation(L.X(x), BB_H + 0.05, L.Z(y))));
    m.instanceMatrix.needsUpdate = true;
  }, [all, L]);
  const xs = useMemo(() => [...new Set(bb.holes.map(([x]) => x))].sort((a, b) => a - b), [bb]);
  const mid = (bb.gap[0] + bb.gap[1]) / 2;
  const split = bb.gap[1] > bb.gap[0];
  const at = (x: number, y: number) => new THREE.Vector3(L.X(x), BB_H + 0.6, L.Z(y));
  const move = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const st = api.getState();
    if (st.dragging) return;
    const px = e.point.x - L.X(0), py = L.unZ(e.point.z);
    let hover = { id: `bb${index}`, label: "브레드보드", text: TEXT.breadboard, marks: [] as THREE.Vector3[] };
    const rail = bb.rails.find((r) => Math.abs(r.y - py) < 8);
    if (rail) hover = { id: `bb${index}-rail${rail.y}`, label: rail.plus ? "+ 줄" : "− 줄", text: rail.plus ? TEXT.railPlus : TEXT.railMinus, marks: rail.xs.map((x) => at(x, rail.y)) };
    else {
      const col = xs.findIndex((x) => Math.abs(x - px) < 8);
      const inCol = col >= 0 ? bb.holes.filter(([x]) => Math.abs(x - xs[col]) < 0.5) : [];
      if (inCol.some(([, y]) => Math.abs(y - py) < 9)) {
        const upper = py < mid;
        const five = split ? inCol.filter(([, y]) => (y < mid) === upper) : inCol;
        hover = { id: `bb${index}-c${col}-${upper}`, label: `${col + 1}번 줄`, text: TEXT.hole, marks: five.map(([x, y]) => at(x, y)) };
      }
    }
    if (st.hover?.id !== hover.id) { st.set({ hover }); st.invalidate(); }
  };
  const out = () => {
    const st = api.getState();
    if (st.hover?.id.startsWith(`bb${index}`)) { st.set({ hover: null }); st.invalidate(); }
  };
  const d = L.Z(bb.y + bb.h) - L.Z(bb.y);
  return (
    <group>
      <Slab x={L.X(bb.x + bb.w / 2)} y={(L.Z(bb.y) + L.Z(bb.y + bb.h)) / 2} w={bb.w} d={d} h={BB_H} radius={7} top={toon(COLOR.breadboard)} side={toon(COLOR.breadboardSide)} onPointerMove={move} onPointerOut={out} />
      {split && <Box size={[bb.w - 12, 1.2, bb.gap[1] - bb.gap[0]]} at={[L.X(bb.x + bb.w / 2), BB_H + 0.1, L.Z((bb.gap[0] + bb.gap[1]) / 2)]} mat={toon("#d7d2c6", { outline: false })} cast={false} />}
      <instancedMesh ref={holes} args={[undefined, undefined, all.length]} material={toon(COLOR.hole, { outline: false })} raycast={() => null}>
        <boxGeometry args={[5, 1.2, 5]} />
      </instancedMesh>
      {bb.rails.map((r) => {
        const topSide = r.y < bb.y + bb.h / 2;
        const ly = topSide ? (r.plus ? r.y - 8 : r.y + 8) : r.plus ? r.y + 8 : r.y - 8;
        return <Box key={r.y} size={[bb.w - 28, 0.8, 2]} at={[L.X(bb.x + bb.w / 2), BB_H + 0.3, L.Z(ly)]} mat={toon(r.plus ? "#e03131" : "#1971c2", { outline: false })} cast={false} />;
      })}
    </group>
  );
}

/* ───────────── ESP32 보드 ───────────── */

/** 핀 묶음: 서로 붙어 있는 핀끼리 (한 줄 · 한 덩어리) */
function clustersOf(pins: BoardData["pins"]) {
  const parent = pins.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  pins.forEach((p, i) => pins.forEach((q, k) => { if (k > i && Math.hypot(p.x - q.x, p.y - q.y) <= 23) parent[find(k)] = find(i); }));
  const by = new Map<number, BoardData["pins"]>();
  pins.forEach((p, i) => by.set(find(i), [...(by.get(find(i)) ?? []), p]));
  return [...by.values()];
}

/** 핀 묶음 하나: 핀에 올리면 그 핀만 노랗게, 묶음은 통째로 살짝 들린다 */
function PinCluster({ id, pins, L, devkit, pcb }: { id: string; pins: BoardData["pins"]; L: Layout; devkit: boolean; pcb: string }) {
  const api = useViewerApi();
  const group = useRef<THREE.Group>(null);
  const inst = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const grip = useRef<THREE.InstancedMesh>(null);
  const pinsRef = useRef<THREE.InstancedMesh>(null);
  const top = PCB_H;
  useEffect(() => {
    const mx = new THREE.Matrix4();
    const c = new THREE.Color();
    pins.forEach((p, i) => {
      if (devkit) {
        mx.makeTranslation(L.X(p.x), top + PIN_LEN / 2, L.Z(p.y));
        inst.current?.setMatrixAt(i, mx);
        grip.current?.setMatrixAt(i, mx);
      } else {
        // 실물처럼: 위 · 아래 한 줄은 노란 암핀 띠(검은 구멍), S·V·G · I2C · ANALOG 묶음은 색 받침 위로 금색 수핀이 솟는다
        const male = isMale(p.label);
        const at = new THREE.Vector3(L.X(p.x), 0, L.Z(p.y));
        const q = new THREE.Quaternion();
        const hide = new THREE.Vector3(0, 0, 0);
        if (male) {
          inst.current?.setMatrixAt(i, mx.compose(at.clone().setY(top + 2.1), q, new THREE.Vector3(11.8, 4.2, 11.8)));
          pinsRef.current?.setMatrixAt(i, mx.compose(at.clone().setY(top + 4.2 + (HEADER_H - 3.2) / 2), q, new THREE.Vector3(1.8, HEADER_H - 3.2, 1.8)));
          caps.current?.setMatrixAt(i, mx.compose(at, q, hide));
        } else {
          inst.current?.setMatrixAt(i, mx.compose(at.clone().setY(top + HEADER_H / 2), q, new THREE.Vector3(12.8, HEADER_H, 12.6)));
          pinsRef.current?.setMatrixAt(i, mx.compose(at, q, hide));
          caps.current?.setMatrixAt(i, mx.compose(at.clone().setY(top + HEADER_H + 0.25), q, new THREE.Vector3(5.4, 0.6, 5.4)));
        }
        c.set(p.fill === "#495057" ? "#2b2b30" : male ? p.fill : "#eab308");
        if (!p.used) c.lerp(new THREE.Color("#3a3a3f"), 0.15);
        inst.current?.setColorAt(i, c);
      }
    });
    for (const m of [inst.current, caps.current, grip.current, pinsRef.current]) if (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    // 핀마다 색을 처음 넣으면 재질을 다시 만들어야 색이 보인다
    if (!devkit) headerMat.needsUpdate = true;
  }, [pins, L, devkit, pcb, top]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const goal = api.getState().hover?.id.startsWith(`${id}:`) ? 6 : 0;
    const d = goal - g.position.y;
    if (Math.abs(d) < 0.05) { if (d) { g.position.y = goal; api.getState().invalidate(); } return; }
    g.position.y += d * 0.22;
    api.getState().invalidate();
  });
  const move = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const st = api.getState();
    if (st.dragging || e.instanceId === undefined) return;
    const p = pins[e.instanceId];
    const hid = `${id}:${e.instanceId}`;
    if (st.hover?.id === hid) return;
    st.set({ hover: { id: hid, label: p.label, text: pinText(p.label, p.used), marks: [new THREE.Vector3(L.X(p.x), top + (devkit ? PIN_LEN : HEADER_H) + 1, L.Z(p.y))], markSize: devkit ? [6, 3, 6] : [9, 2, 9] } });
    st.invalidate();
  };
  const out = () => {
    const st = api.getState();
    if (st.hover?.id.startsWith(`${id}:`)) { st.set({ hover: null }); st.invalidate(); }
  };
  const xs = pins.map((p) => p.x), ys = pins.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return (
    <group ref={group}>
      {devkit ? (
        <>
          <Box size={[x1 - x0 + 18, 5, L.Z(y1) - L.Z(y0) + 12]} at={[L.X((x0 + x1) / 2), top + 2.5, (L.Z(y0) + L.Z(y1)) / 2]} mat={toon(COLOR.plastic)} />
          <instancedMesh ref={inst} args={[undefined, undefined, pins.length]} material={toon(COLOR.gold)} castShadow raycast={() => null}>
            <boxGeometry args={[2.8, PIN_LEN, 2.8]} />
          </instancedMesh>
          <instancedMesh ref={grip} args={[undefined, undefined, pins.length]} onPointerMove={move} onPointerOut={out}>
            <boxGeometry args={[13, PIN_LEN, 11]} />
            <meshBasicMaterial visible={false} />
          </instancedMesh>
        </>
      ) : (
        <>
          <instancedMesh ref={inst} args={[undefined, undefined, pins.length]} material={headerMat} castShadow onPointerMove={move} onPointerOut={out} geometry={unitBox} />
          <instancedMesh ref={pinsRef} args={[undefined, undefined, pins.length]} material={toon(COLOR.gold)} castShadow raycast={() => null} geometry={unitBox} />
          <instancedMesh ref={caps} args={[undefined, undefined, pins.length]} raycast={() => null} material={holeMat} geometry={unitBox} />
        </>
      )}
    </group>
  );
}

/** 보드 위 작은 부품 하나 (들리고 설명이 뜬다) */
function Bit({ id, label, text, children, card = true }: { id: string; label: string; text: string; children: ReactNode; card?: boolean }) {
  return <Part id={id} label={label} text={text} card={card}>{children}</Part>;
}

/** 실크(흰 글자): 핀 이름 · 보드 이름 */
function silkPaint(b: BoardData, devkit: boolean, kz: number) {
  return (g: CanvasRenderingContext2D, cw: number) => {
    const S = cw / b.w;
    g.scale(S, S);
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (devkit) {
      g.font = "700 9px system-ui, sans-serif";
      for (const p of b.pins) {
        const inward = p.y < b.y + b.h / 2 ? 1 : -1;
        g.save();
        g.translate(p.x - b.x, (p.y - b.y) * kz + inward * 22);
        g.rotate(-Math.PI / 2);
        g.globalAlpha = p.used ? 1 : 0.55;
        g.fillText(p.label, 0, 0);
        g.restore();
      }
      g.globalAlpha = 0.9;
      g.font = "700 12px system-ui, sans-serif";
      g.fillText("ESP32 DEVKIT V1", b.w * 0.27, b.h * kz - 34);
    } else {
      paintPlusSilk(g, b);
    }
  };
}

/**
 * Plus 실크(노란 글자 · 테두리 · 구리 선): 실물 도면(800×500) 좌표 그대로 그린다.
 * 도면 기판 왼쪽 위(35, 12)가 보드 왼쪽 위, 배율 K.
 */
function paintPlusSilk(g: CanvasRenderingContext2D, b: BoardData) {
  g.save();
  g.scale(K, K);
  g.translate(-35, -12);
  const used = new Set(b.pins.filter((p) => p.used).map((p) => p.label));
  const Y = "#facc15";
  // 구리 선 (옅게)
  g.strokeStyle = "rgba(120,140,170,0.35)";
  g.lineWidth = 1.5;
  for (const d of [[[210, 155], [320, 155], [335, 170]], [[210, 175], [315, 175]], [[210, 215], [320, 215]], [[435, 190], [495, 190]], [[435, 205], [495, 205]], [[435, 220], [495, 220]], [[96, 150], [96, 300], [150, 300]], [[120, 160], [120, 260], [160, 260]], [[260, 60], [300, 60], [300, 140]]]) {
    g.beginPath(); d.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  }
  g.fillStyle = Y; g.strokeStyle = Y;
  g.textAlign = "center"; g.textBaseline = "middle";
  const mono = (px: number) => `700 ${px}px "JetBrains Mono", ui-monospace, monospace`;
  const vert = (t: string, x: number, y: number, size = 11) => { g.save(); g.translate(x, y); g.rotate(-Math.PI / 2); g.font = mono(size); g.fillText(t, 0, 0); g.restore(); };
  const pinLabel = (t: string, x: number, y: number) => { g.globalAlpha = used.has(t) ? 1 : 0.62; vert(t, x, y); g.globalAlpha = 1; };
  // 위 · 아래 줄 핀 이름
  ["SCL", "SDA", "5V", "GND", "io18", "io19", "io23", "io5", "io13", "io12"].forEach((t, i) => pinLabel(t, 232 + 22 * i, 59));
  ["io14", "io27", "io16", "io17", "io25", "io26", "TX", "RX"].forEach((t, i) => pinLabel(t, 526 + 22 * i, 59));
  ["io0", "5V", "RST", "3V3", "5V", "GND", "GND", "VIN"].forEach((t, i) => pinLabel(t, 336 + 22 * i, 396));
  ["io32", "io33", "io34", "io35", "io36", "io39"].forEach((t, i) => pinLabel(t, 580 + 22 * i, 396));
  // POWER · ANALOG IN
  g.font = mono(11);
  g.fillText("POWER", 510, 369); g.fillText("ANALOG IN", 615, 369);
  g.lineWidth = 1.5;
  for (const [x0, x1] of [[322, 544], [566, 738]]) { g.beginPath(); g.moveTo(x0, 378); g.lineTo(x1, 378); g.stroke(); }
  // DIGITAL 묶음 테두리 · S V G · DIGITAL
  g.lineWidth = 1.2;
  g.strokeRect(328, 70, 134, 68); g.strokeRect(512, 70, 134, 68);
  g.font = mono(12);
  ["S", "V", "G"].forEach((t, k) => g.fillText(t, 318, 82 + 22 * k));
  vert("DIGITAL", 488, 104);
  // BUS I2C
  g.lineWidth = 1.8;
  g.strokeRect(338, 156, 96, 72);
  g.font = mono(10.5);
  ["GND", "V", "SDA", "SCL"].forEach((t, k) => g.fillText(t, 353 + 22 * k, 147));
  vert("BUS I2C", 448, 192);
  // ANALOG
  g.strokeRect(338, 246, 98, 136);
  g.font = mono(11);
  ["G", "V", "S"].forEach((t, k) => g.fillText(t, 353 + 22 * k, 238));
  g.textAlign = "left"; g.font = mono(10);
  ["io35", "io34", "io33", "io32", "io 4", "io 2"].forEach((t, r) => g.fillText(t, 412, 260 + 22 * r));
  g.textAlign = "center";
  vert("ANALOG", 449, 314);
  // 오른쪽 TX RX G V · RESET · DC 7-12V · TX/ON LED
  g.textAlign = "right"; g.font = mono(11);
  ["TX", "RX", "G", "V"].forEach((t, k) => g.fillText(t, 698, 76 + 21 * k));
  g.textAlign = "center";
  g.font = mono(10); g.fillText("RESET", 93, 70);
  g.font = mono(11.5); g.fillText("DC 7-12V", 88, 432);
  g.textAlign = "left"; g.font = mono(10);
  g.fillText("TX", 275, 165); g.fillText("ON", 275, 211);
  // 보드 이름
  g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,0.9)";
  g.font = "italic 700 16px system-ui, sans-serif";
  g.fillText("ESP32 Plus", 600, 156);
  g.restore();
}

export function Board({ b, L, index, blueLed }: { b: BoardData; L: Layout; index: number; blueLed: THREE.MeshStandardMaterial }) {
  const api = useViewerApi();
  const devkit = b.kind === "devkit";
  const kz = devkit ? L.F : 1;
  const pcb = devkit ? COLOR.pcbDevkit : COLOR.pcbPlus;
  const top = PCB_H;
  const clusters = useMemo(() => clustersOf(b.pins), [b]);
  const at = (px: number, py: number) => [L.X(px), L.Z(py)] as const;
  const d = L.Z(b.y + b.h) - L.Z(b.y);
  const cxB = L.X(b.x + b.w / 2), czB = (L.Z(b.y) + L.Z(b.y + b.h)) / 2;

  // WROOM 모듈: DevKit 은 보드 끝에 길게(25.5mm), 폭은 핀 두 줄 사이를 거의 채운다(18mm)
  const c = devkit ? { x: b.x + b.w - 236, y: b.y + 25, w: 232, h: 100 } : b.chip;
  const antW = devkit ? 56 : (790 - 708) * K;
  // 안테나: 두 보드 모두 모듈의 오른쪽 끝 (Plus 사진처럼 기판 가장자리 쪽)
  const antennaRight = true;
  const shield = { x: antennaRight ? c.x + 5 : c.x + antW + 3, y: c.y + 6, w: c.w - antW - 8, h: c.h - 12 };
  const ax = antennaRight ? c.x + c.w - antW + 2 : c.x + 4;
  const steps = 6, sh = (c.h - 16) / steps;
  const u = b.usb;
  const [ux] = at(u.x + u.w, 0);

  // EN 버튼: 누르면 보드가 처음부터 다시 시작한다 (시뮬레이션도)
  const enCap = useRef<THREE.Mesh>(null);
  const pressEn = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    api.getState().sim?.reset();
    if (enCap.current) enCap.current.position.y = top + 3.6;
    api.getState().invalidate();
  };
  const releaseEn = () => {
    if (enCap.current) enCap.current.position.y = top + 5;
    api.getState().invalidate();
  };

  return (
    <group>
      {/* 보드 판: 올리면 설명만 (들리거나 빛나지 않는다 — 판 위 부품에 올릴 때 어지럽지 않게) */}
      <Part id={`board${index}`} label={b.name} text={TEXT.board} lift={false} glow={false} card={false}>
        <Slab x={cxB} y={czB} w={b.w} d={d} h={PCB_H} radius={devkit ? 8 : 16} top={toon(pcb, { rough: 0.5 })} side={toon(devkit ? "#343946" : "#34343a")} outline={devkit ? undefined : PLUS_OUTLINE()} />
      </Part>
      <Decal w={b.w} d={b.h * kz} at={[cxB, top + 0.15, czB]} px={Math.min(2048, b.w * 4)} paint={silkPaint(b, devkit, kz)} />

      {/* ESP32 모듈 · 안테나 */}
      <Bit id={`board${index}-module`} label="ESP32 모듈" text={TEXT.module}>
        <Box size={[c.w, 2, c.h * kz]} at={[L.X(c.x + c.w / 2), top + 1, L.Z(c.y + c.h / 2)]} mat={toon("#2a2d36")} />
        <Box size={[shield.w, 7, shield.h * kz]} at={[L.X(shield.x + shield.w / 2), top + 5.5, L.Z(shield.y + shield.h / 2)]} mat={toon(COLOR.metalLight)} />
        <Decal w={shield.w} d={shield.h * kz} at={[L.X(shield.x + shield.w / 2), top + 9.2, L.Z(shield.y + shield.h / 2)]} paint={(g, w, h) => {
          g.fillStyle = "#3a3f4a";
          g.strokeStyle = "#3a3f4a";
          g.textAlign = "center";
          g.textBaseline = "middle";
          if (devkit) {
            g.font = `700 ${Math.round(w * 0.16)}px system-ui, sans-serif`;
            g.fillText("ESP32", w * 0.58, h / 2 - h * 0.08);
            g.font = `600 ${Math.round(w * 0.07)}px system-ui, sans-serif`;
            g.fillText("WROOM-32", w * 0.58, h / 2 + h * 0.14);
          } else {
            // 실물 덮개처럼: 위에 작은 인증 글자 줄, 와이파이 표시, ESPRESSIF · ESP32-WROOM-32, 아래 QR 무늬
            g.font = `600 ${Math.round(h * 0.07)}px system-ui, sans-serif`;
            ["FCC ID: 2AC7Z-ESPWROOM32", "CMIIT ID: 2016AJ1001", "R 211-161007"].forEach((t, k) => g.fillText(t, w * 0.42, h * (0.12 + k * 0.08)));
            g.font = `800 ${Math.round(h * 0.17)}px system-ui, sans-serif`;
            g.fillText("ESPRESSIF", w * 0.5, h * 0.5);
            g.font = `700 ${Math.round(h * 0.1)}px system-ui, sans-serif`;
            g.fillText("ESP32-WROOM-32", w * 0.5, h * 0.66);
            // QR 무늬 (보기용)
            const q = h * 0.24, qx = w * 0.08, qy = h * 0.72, n = 9, cell = q / n;
            let seed = 7;
            for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
              seed = (seed * 37 + 11) % 101;
              const corner = (xx < 3 && yy < 3) || (xx > n - 4 && yy < 3) || (xx < 3 && yy > n - 4);
              if (corner ? !(xx % (n - 1) === 1 || yy % (n - 1) === 1) || (xx === 1 && yy === 1) : seed % 2) g.fillRect(qx + xx * cell, qy + yy * cell, cell, cell);
            }
            g.font = `700 ${Math.round(h * 0.09)}px system-ui, sans-serif`;
            g.fillText("CE", w * 0.84, h * 0.86);
          }
          g.lineWidth = w * 0.025;
          g.lineCap = "round";
          const wx = devkit ? w * 0.2 : w * 0.86, wy = devkit ? h / 2 + h * 0.12 : h * 0.24, k = devkit ? 1 : 0.6;
          for (const r of [0.055, 0.11, 0.165]) { g.beginPath(); g.arc(wx, wy, w * r * k, -Math.PI * 0.78, -Math.PI * 0.22); g.stroke(); }
          g.beginPath(); g.arc(wx, wy, w * 0.02 * k, 0, Math.PI * 2); g.fill();
        }} />
        {Array.from({ length: steps }, (_, i) => (
          <group key={i}>
            <Box size={[antW - 8, 0.6, 2]} at={[L.X(ax + (antW - 6) / 2), top + 2.3, L.Z(c.y + 8 + i * sh)]} mat={toon(COLOR.gold, { outline: false })} cast={false} />
            <Box size={[2, 0.6, sh * kz]} at={[L.X(ax + (i % 2 ? 1 : antW - 7)), top + 2.3, L.Z(c.y + 8 + i * sh + sh / 2)]} mat={toon(COLOR.gold, { outline: false })} cast={false} />
          </group>
        ))}
        {!devkit && (
          <>
            {/* 모듈 가장자리 금색 납땜 패드 (위 · 아래 줄, 안테나 반대쪽 끝 줄) */}
            {Array.from({ length: 12 }, (_, k) => [c.y + 1.5, c.y + c.h - 1.5].map((py) => (
              <Box key={`${k}-${py}`} size={[4.4, 1.2, 3]} at={[L.X(c.x + 8 + k * ((c.w - antW - 16) / 11)), top + 2.4, L.Z(py)]} mat={toon(COLOR.gold)} cast={false} />
            )))}
            {Array.from({ length: 6 }, (_, k) => (
              <Box key={`l${k}`} size={[3, 1.2, 4.4]} at={[L.X(c.x + 1.5), top + 2.4, L.Z(c.y + 12 + k * ((c.h - 24) / 5))]} mat={toon(COLOR.gold)} cast={false} />
            ))}
            {/* 덮개 모서리의 둥근 표시 */}
            <Cyl r={3} h={0.6} at={[L.X(shield.x + 8), top + 9.2, L.Z(shield.y + 8)]} mat={toon("#71717a", { outline: false })} seg={16} />
          </>
        )}
      </Bit>

      {/* USB */}
      <Bit id={`board${index}-usb`} label="USB" text={TEXT.usb}>
        {devkit ? (
          <>
            <Box size={[u.w, 9, u.h]} at={[L.X(u.x + u.w / 2), top + 3.5, L.Z(u.y + u.h / 2)]} mat={toon(COLOR.metalLight)} />
            <Box size={[3, 4.5, u.h - 10]} at={[L.X(u.x + 1.2), top + 3.5, L.Z(u.y + u.h / 2)]} mat={toon(COLOR.plastic)} />
          </>
        ) : (
          // USB-C (도면처럼 보드 왼쪽 끝): 은색 통 · 윗면 판 · 왼쪽으로 열린 검은 구멍
          <>
            <Box size={[u.w, 8, u.h]} at={[L.X(u.x + u.w / 2), top + 4, L.Z(u.y + u.h / 2)]} mat={toon(COLOR.metalLight)} />
            <Box size={[u.w * 0.69, 0.6, u.h * 0.67]} at={[L.X(u.x + u.w * 0.6), top + 8.2, L.Z(u.y + u.h / 2)]} mat={toon("#cbd5e1", { metal: 0.7, rough: 0.3 })} cast={false} />
            <mesh position={[L.X(u.x) - 0.3, top + 4, L.Z(u.y + u.h / 2)]} rotation={[Math.PI / 2, 0, Math.PI / 2]} material={toon("#1b1b1f", { outline: false })}>
              <capsuleGeometry args={[2.2, u.h * 0.55, 4, 10]} />
            </mesh>
          </>
        )}
      </Bit>

      {devkit ? (
        <>
          {([["EN", -44], ["BOOT", 44]] as const).map(([name, dy]) => {
            const bz = L.Z(b.y + b.h / 2 + dy * 0.82);
            return (
              <Part key={name} id={`board${index}-${name}`} label={`${name} 버튼`} text={name === "EN" ? "누르면 보드가 처음부터 다시 시작해요. 눌러 보세요!" : "새 프로그램을 받을 때 쓰는 버튼이에요. 평소에는 누르지 않아요."} card={false}>
                <Box size={[15, 4, 13]} at={[ux + 4, top + 2, bz]} mat={toon(COLOR.metal)} />
                <mesh ref={name === "EN" ? enCap : undefined} position={[ux + 4, top + 5, bz]} material={toon(COLOR.plastic)} castShadow
                  onPointerDown={name === "EN" ? pressEn : undefined} onPointerUp={name === "EN" ? releaseEn : undefined} onPointerLeave={name === "EN" ? releaseEn : undefined}>
                  <cylinderGeometry args={[3.2, 3.2, 2.4, 16]} />
                </mesh>
              </Part>
            );
          })}
          <Bit id={`board${index}-usbchip`} label="USB 칩" text={TEXT.usbChip}>
            <Box size={[26, 3.2, 26]} at={[at(b.x + 118, 0)[0], top + 1.6, L.Z(b.y + b.h / 2 + 4)]} mat={toon(COLOR.plastic)} />
          </Bit>
          <Bit id={`board${index}-reg`} label="전원 조절 부품" text={TEXT.regulator}>
            <Box size={[15, 4.5, 22]} at={[at(b.x + 78, 0)[0], top + 2.25, L.Z(b.y + b.h / 2 - 2)]} mat={toon(COLOR.plastic)} />
            <Box size={[8, 4.5, 12]} at={[at(b.x + 78, 0)[0] - 11, top + 2.25, L.Z(b.y + b.h / 2 - 2)]} mat={toon(COLOR.metal)} />
          </Bit>
          {([[150, -26, 7, 4, "#c9a26b"], [150, 28, 7, 4, "#c9a26b"], [176, -8, 4, 7, "#3a3a42"], [176, 12, 4, 7, "#c9a26b"], [96, 34, 7, 4, "#3a3a42"], [96, -36, 7, 4, "#c9a26b"]] as const).map(([dx, dz, w, dd, col], i) => (
            <Box key={i} size={[w, 2.4, dd]} at={[L.X(b.x + dx), top + 1.2, L.Z(b.y + b.h / 2 + dz)]} mat={toon(col, { outline: false })} cast={false} />
          ))}
          <Bit id={`board${index}-pwr`} label="전원 LED" text={TEXT.powerLed}>
            <Box size={[7, 2.6, 4]} at={[L.X(b.x + 200), top + 1.3, L.Z(b.y + b.h / 2 - 22)]} mat={toon("#ff6b6b", { outline: false, emissive: "#e03131", emissiveIntensity: 0.9 })} />
          </Bit>
          <Bit id={`board${index}-led2`} label="내장 LED (2번 핀)" text={TEXT.bootLed}>
            <Box size={[7, 2.6, 4]} at={[L.X(b.x + 200), top + 1.3, L.Z(b.y + b.h / 2 + 22)]} mat={blueLed} />
          </Bit>
        </>
      ) : (
        <PlusDetails b={b} L={L} index={index} top={top} pressEn={pressEn} releaseEn={releaseEn} enCap={enCap} blueLed={blueLed} />
      )}

      {clusters.map((pins, k) => <PinCluster key={k} id={`pins${index}-${k}`} pins={pins} L={L} devkit={devkit} pcb={pcb} />)}

      {/* 이번에 꽂는 핀: 노란 테두리 */}
      {b.pins.filter((p) => p.used).map((p, i) => (
        <mesh key={i} position={[L.X(p.x), top + 0.8, L.Z(p.y)]} rotation={[Math.PI / 2, 0, Math.PI / 4]} scale={devkit ? 1 : 0.68} material={usedRing} raycast={() => null}>
          <torusGeometry args={[11, 1.4, 8, 4]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * ESP32 Plus(Keyestudio KS5020) 실물 사진에 있는 것들: RESET 버튼 · USB 통역 칩(CH340) · 전원 칩 · 4R7 코일 ·
 * DC 7-12V 전원 잭 · 작은 칩 저항 · 콘덴서 · ON / TX / RX LED · 고정 구멍. 핀 자리는 배선도와 같아서 빈 곳에 놓는다.
 * 좌표는 보드 왼쪽 위에서 잰 그림 px (보드 428 × 300).
 */
function PlusDetails({ b, L, index, top, pressEn, releaseEn, enCap, blueLed }: {
  b: BoardData; L: Layout; index: number; top: number;
  pressEn: (e: ThreeEvent<PointerEvent>) => void; releaseEn: () => void; enCap: RefObject<THREE.Mesh | null>; blueLed: THREE.MeshStandardMaterial;
}) {
  // 실물 도면(800×500) 좌표 → 3D
  const X = (sx: number) => L.X(b.x + svgToBoard(sx, 0).x), Z = (sy: number) => L.Z(b.y + svgToBoard(0, sy).y);
  const k = (v: number) => v * K;
  const black = toon("#17171a"), silver = toon("#d4d4d8", { metal: 0.8, rough: 0.3 });
  const chipBody = toon("#27272a");
  /** 칩 저항 · 콘덴서: 가운데 몸통과 양 끝 은색 단자 (가로로 긴 것) */
  const Smd = ({ cx, cy, w, d, body }: { cx: number; cy: number; w: number; d: number; body: string }) => (
    <group>
      <Box size={[k(w) * 0.6, 2.2, k(d)]} at={[X(cx), top + 1.1, Z(cy)]} mat={toon(body, { outline: false })} cast={false} />
      {[-1, 1].map((s2) => <Box key={s2} size={[k(w) * 0.2, 2.4, k(d)]} at={[X(cx + s2 * w * 0.4), top + 1.2, Z(cy)]} mat={toon("#d6d3d1")} cast={false} />)}
    </group>
  );
  return (
    <>
      {/* UNO 고정 구멍 넷 (흰 테두리) */}
      {([[195, 36], [185, 424], [752, 150], [752, 382]] as const).map(([hx, hy], i) => (
        <group key={i}>
          <Cyl r={k(14.5)} h={0.6} at={[X(hx), top + 0.2, Z(hy)]} mat={toon("#e2e8f0", { outline: false })} seg={24} />
          <Cyl r={k(11.5)} h={0.8} at={[X(hx), top + 0.3, Z(hy)]} mat={toon("#090d16", { outline: false })} seg={24} />
        </group>
      ))}
      {/* POWER 줄의 두 번째 GND (배선도에는 없는 칸) */}
      <Box size={[12.8, HEADER_H, 12.6]} at={[X(468), top + HEADER_H / 2, Z(423)]} mat={toon("#eab308")} />
      <Box size={[5.4, 0.6, 5.4]} at={[X(468), top + HEADER_H + 0.25, Z(423)]} mat={toon("#121214", { outline: false })} cast={false} />
      {/* 오른쪽 위 세로 4핀 수핀 (TX · RX · G · V) */}
      <Part id={`board${index}-uart`} label="TX · RX · G · V 핀" text="블루투스 같은 통신 모듈을 꽂는 자리예요. 이 수업에서는 쓰지 않아요.">
        <Box size={[k(24), 4.2, k(86)]} at={[X(718), top + 2.1, Z(107)]} mat={toon("#eab308")} />
        {[76, 97, 118, 139].map((y) => <Box key={y} size={[1.8, HEADER_H - 3.2, 1.8]} at={[X(718), top + 4.2 + (HEADER_H - 3.2) / 2, Z(y)]} mat={toon(COLOR.gold)} />)}
      </Part>
      {/* RESET 버튼 (은색 사각 몸통 · 검은 둥근 단추 · 다리 넷) */}
      <Part id={`board${index}-EN`} label="RESET 버튼" text="누르면 보드가 처음부터 다시 시작해요. 눌러 보세요!" card={false}>
        <Box size={[k(58), 3.6, k(44)]} at={[X(93), top + 1.8, Z(36)]} mat={silver} />
        {[[72, 21], [114, 21], [72, 51], [114, 51]].map(([x, y]) => <Cyl key={`${x}${y}`} r={k(3)} h={0.6} at={[X(x), top + 3.7, Z(y)]} mat={black} seg={10} />)}
        <mesh ref={enCap} position={[X(93), top + 5, Z(36)]} material={black} castShadow onPointerDown={pressEn} onPointerUp={releaseEn} onPointerLeave={releaseEn}>
          <cylinderGeometry args={[k(14), k(14), 2.8, 24]} />
        </mesh>
      </Part>
      {/* USB 통역 칩 CH340C (다리 열여섯) */}
      <Part id={`board${index}-usbchip`} label="USB 칩 (CH340C)" text={TEXT.usbChip}>
        <Box size={[k(48), 3.4, k(78)]} at={[X(170), top + 1.7, Z(117)]} mat={chipBody} />
        <Cyl r={k(4)} h={0.4} at={[X(156), top + 3.5, Z(144)]} mat={black} seg={12} />
        {Array.from({ length: 8 }, (_, i) => [142, 198].map((x) => <Box key={`${i}${x}`} size={[k(12), 1.2, k(4)]} at={[X(x), top + 0.6, Z(86 + 9 * i)]} mat={silver} cast={false} />))}
      </Part>
      {/* 칩 저항 줄: CH340 오른쪽 여섯 · 왼쪽 아래 다섯 */}
      {[90, 108, 126, 144, 162, 180].map((y) => <Smd key={`r${y}`} cx={274} cy={y + 5.5} w={24} d={11} body="#27272a" />)}
      {[190, 208, 226, 244, 262].map((y) => <Smd key={`l${y}`} cx={64} cy={y + 5.5} w={24} d={11} body="#44403c" />)}
      {/* TX(노랑) · ON(초록) LED · 2번 핀 LED(파랑) */}
      <Box size={[k(26), 2.2, k(10)]} at={[X(255), top + 1.1, Z(165)]} mat={toon("#fef08a", { emissive: "#facc15", emissiveIntensity: 0.3 })} cast={false} />
      <Part id={`board${index}-pwr`} label="전원 LED (ON)" text={TEXT.powerLed}>
        <Box size={[k(26), 2.2, k(10)]} at={[X(255), top + 1.1, Z(211)]} mat={toon("#4ade80", { emissive: "#16a34a", emissiveIntensity: 0.9 })} />
      </Part>
      <Part id={`board${index}-led2`} label="내장 LED (2번 핀)" text={TEXT.bootLed}>
        <Box size={[k(20), 2.2, k(10)]} at={[X(255), top + 1.1, Z(188)]} mat={blueLed} />
      </Part>
      {/* 4R7 코일 · 콘덴서 둘 · 전원 칩(SOT-223) */}
      <Part id={`board${index}-coil`} label="코일 (4R7)" text="전기를 고르게 다듬어 주는 부품이에요. 전원이 흔들리지 않게 해요.">
        <Box size={[k(60), 8, k(48)]} at={[X(194), top + 4, Z(244)]} mat={toon("#a8a29e")} />
        <Decal w={k(40)} d={k(20)} at={[X(194), top + 8.15, Z(244)]} paint={(g, cw, ch) => { g.fillStyle = "#292524"; g.font = `700 ${Math.round(ch * 0.7)}px "JetBrains Mono", monospace`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("4R7", cw / 2, ch / 2); }} />
      </Part>
      {[292, 320].map((y) => (
        <group key={y}>
          <Box size={[k(44), 3, k(20)]} at={[X(242), top + 1.5, Z(y)]} mat={toon("#e7e5e4")} cast={false} />
          <Box size={[k(28), 3.2, k(16)]} at={[X(242), top + 1.6, Z(y)]} mat={toon("#d6d3d1")} cast={false} />
        </group>
      ))}
      <Part id={`board${index}-reg`} label="전원 조절 부품 (AMS1117)" text={TEXT.regulator}>
        <Box size={[k(42), 4.2, k(58)]} at={[X(217), top + 2.1, Z(369)]} mat={chipBody} />
        <Box size={[k(20), 1.2, k(32)]} at={[X(244), top + 0.6, Z(370)]} mat={silver} cast={false} />
        {[350, 370, 390].map((y) => <Box key={y} size={[k(16), 1.2, k(8)]} at={[X(190), top + 0.6, Z(y)]} mat={silver} cast={false} />)}
      </Part>
      {/* DC 7-12V 전원 잭 (노란 몸통, 왼쪽으로 구멍) */}
      <Part id={`board${index}-dc`} label="DC 전원 잭" text="USB 대신 7~12V 어댑터나 건전지로 전기를 넣는 곳이에요. 모터처럼 전기를 많이 쓰는 작품에 써요.">
        <Box size={[k(145), 24, k(84)]} at={[X(82.5), top + 12, Z(354)]} mat={toon("#facc15")} />
        <Box size={[k(88), 22, k(56)]} at={[X(54), top + 12.6, Z(354)]} mat={toon("#eab308")} />
        <Box size={[k(22), 22, k(80)]} at={[X(151), top + 11, Z(354)]} mat={black} />
        <Cyl r={k(17)} h={2} at={[X(10) - 1, top + 12, Z(354)]} rot={[0, 0, Math.PI / 2]} mat={black} seg={20} />
        <Cyl r={k(5)} h={2.4} at={[X(10) - 1.2, top + 12, Z(354)]} rot={[0, 0, Math.PI / 2]} mat={silver} seg={12} />
      </Part>
    </>
  );
}

const usedRing = noOutline(toonOwn({ color: COLOR.glow, emissive: COLOR.glow, emissiveIntensity: 0.6 }));
/** Plus 기판 바깥선: 아두이노 UNO 꼴 (오른쪽 위 모서리를 깎고, 오른쪽이 한 번 턱지고, 오른쪽 아래를 깎는다) */
const PLUS_OUTLINE = (): [number, number][] =>
  ([[35, 12], [735, 12], [755, 32], [755, 125], [775, 145], [775, 415], [745, 445], [35, 445]] as const).map(([x, y]) => { const q = svgToBoard(x, y); return [q.x, q.y]; });

/** 수핀 묶음(S·V·G 세 줄 · I2C · ANALOG)인지: 핀 이름이 " S|V|G" 로 끝나거나 I2C */
const isMale = (label: string) => / [SVG]$/.test(label) || /^I2C/.test(label);
/** 크기 1 상자 (인스턴스마다 크기를 준다) */
const unitBox = roundedBox(1, 1, 1);
/** Plus 핀 소켓 몸통 (핀마다 색) · 소켓 구멍 */
const headerMat = toonOwn({ color: "#ffffff" });
const holeMat = noOutline(new THREE.MeshBasicMaterial({ color: "#121214" }));
