import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Scene3D } from "@/track/wiring3d";
import { Box, Cyl, Decal, Part, roundedBox } from "./kit";
import { BB_H, HEADER_H, PCB_H, PIN_LEN, type Layout } from "./layout";
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
          inst.current?.setMatrixAt(i, mx.compose(at.clone().setY(top + 2.1), q, new THREE.Vector3(19.2, 4.2, 17.2)));
          pinsRef.current?.setMatrixAt(i, mx.compose(at.clone().setY(top + 4.2 + (HEADER_H - 3.2) / 2), q, new THREE.Vector3(2.6, HEADER_H - 3.2, 2.6)));
          caps.current?.setMatrixAt(i, mx.compose(at, q, hide));
        } else {
          inst.current?.setMatrixAt(i, mx.compose(at.clone().setY(top + HEADER_H / 2), q, new THREE.Vector3(20, HEADER_H, 17.2)));
          pinsRef.current?.setMatrixAt(i, mx.compose(at, q, hide));
          caps.current?.setMatrixAt(i, mx.compose(at.clone().setY(top + HEADER_H + 0.25), q, new THREE.Vector3(7, 0.6, 7)));
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
    st.set({ hover: { id: hid, label: p.label, text: pinText(p.label, p.used), marks: [new THREE.Vector3(L.X(p.x), top + (devkit ? PIN_LEN : HEADER_H) + 1, L.Z(p.y))], markSize: devkit ? [6, 3, 6] : [12, 2, 12] } });
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
      g.font = "700 8px system-ui, sans-serif";
      const seen = new Set<string>();
      for (const p of b.pins) {
        if (/ [SVG]$/.test(p.label) || /^I2C/.test(p.label)) continue;
        const k = `${p.label}|${Math.round(p.x)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        g.save();
        g.translate(p.x - b.x, p.y - b.y - 13);
        g.rotate(-Math.PI / 2);
        g.textAlign = "left";
        g.globalAlpha = p.used ? 1 : 0.55;
        g.fillText(p.label, 0, 0);
        g.restore();
      }
      // 실물 기판의 무늬: 구리 선(옅게) · 묶음 이름 · 보드 이름
      g.globalAlpha = 1;
      g.strokeStyle = "rgba(210,170,80,0.22)";
      g.lineWidth = 1.4;
      const trace = (pts: [number, number][]) => { g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
      for (let k = 0; k < 6; k++) trace([[74, 110 + k * 3], [96 + k * 3, 110 + k * 3], [96 + k * 3, 70], [100 + k * 20, 66]]);
      for (let k = 0; k < 5; k++) trace([[40, 134 + k * 3], [40, 178 + k * 3], [100 - k * 3, 178 + k * 3]]);
      for (let k = 0; k < 4; k++) trace([[212 + k * 4, 128], [212 + k * 4, 236], [262, 236 + k * 4]]);
      trace([[140, 140], [140, 150], [262, 150]]);
      g.fillStyle = "rgba(255,255,255,0.92)";
      g.textAlign = "center";
      g.font = "700 7px system-ui, sans-serif";
      for (const [x0, n] of [[106, 6], [260, 6]] as const) {
        ["S", "V", "G"].forEach((r, k) => g.fillText(r, x0 - 13, 78 + k * 18));
        void n;
      }
      g.fillText("G", 30, 164); g.fillText("V", 50, 164); g.fillText("S", 70, 164);
      ["GND", "V", "SDA", "SCL"].forEach((t, k) => g.fillText(t, 140 + k * 20, 176));
      g.font = "700 8px system-ui, sans-serif";
      const vert = (t: string, x: number, y: number) => { g.save(); g.translate(x, y); g.rotate(-Math.PI / 2); g.fillText(t, 0, 0); g.restore(); };
      vert("DIGITAL", 236, 96);
      vert("ANALOG", 88, 226);
      vert("BUS I2C", 214, 210);
      g.fillText("RESET", 30, 44);
      g.fillText("DC 7-12V", 118, 244);
      g.font = "700 6px system-ui, sans-serif";
      g.fillText("ON", 226, 252); g.fillText("TX", 192, 236); g.fillText("RX", 192, 244);
      g.font = "italic 700 13px system-ui, sans-serif";
      g.fillText("ESP32 Plus", 344, 136);
      // 묶음 둘레 노란 실크 테두리 (사진처럼)
      g.strokeStyle = "rgba(245,197,24,0.9)";
      g.lineWidth = 1.2;
      g.strokeRect(18, 156, 64, 132);   // ANALOG
      g.strokeRect(128, 168, 84, 72);   // BUS I2C
      g.strokeRect(94, 68, 120, 56);    // DIGITAL 왼쪽
      g.strokeRect(248, 68, 124, 56);   // DIGITAL 오른쪽
      g.font = "700 8px system-ui, sans-serif";
      g.fillStyle = "rgba(255,255,255,0.92)";
      g.fillText("POWER", 230, 248);
      g.fillText("ANALOG IN", 360, 248);
      ["TX", "RX", "G", "V"].forEach((t, k) => g.fillText(t, 394, 79 + k * 16));
    }
  };
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
  const antW = devkit ? 56 : Math.min(26, c.w * 0.24);
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
        <Slab x={cxB} y={czB} w={b.w} d={d} h={PCB_H} radius={devkit ? 8 : 16} top={toon(pcb, { rough: 0.5 })} side={toon(devkit ? "#343946" : "#34343a")} outline={devkit ? undefined : PLUS_OUTLINE(b.w, b.h)} />
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
          // USB-C: 납작하고 둥근 은색 통, 가운데 검은 구멍
          <>
            <mesh position={[L.X(u.x + u.w / 2), top + 4.2, L.Z(u.y + u.h / 2)]} rotation={[Math.PI / 2, 0, Math.PI / 2]} scale={[1, 1, 1]} material={toon(COLOR.metalLight)} castShadow>
              <capsuleGeometry args={[4.2, u.h - 10, 4, 12]} />
            </mesh>
            <mesh position={[L.X(u.x) - 0.2, top + 4.2, L.Z(u.y + u.h / 2)]} rotation={[Math.PI / 2, 0, Math.PI / 2]} material={toon("#1b1b1f", { outline: false })}>
              <capsuleGeometry args={[2.4, u.h - 16, 4, 10]} />
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
        <mesh key={i} position={[L.X(p.x), top + 0.8, L.Z(p.y)]} rotation={[Math.PI / 2, 0, Math.PI / 4]} material={usedRing} raycast={() => null}>
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
  const X = (rx: number) => L.X(b.x + rx), Z = (ry: number) => L.Z(b.y + ry);
  const black = toon("#17171a"), metal = toon(COLOR.metal), tan = toon("#c9a26b", { outline: false }), dark = toon("#2b2b30", { outline: false });
  // 작은 칩 저항 · 콘덴서 (사진의 왼쪽 부품 밭)
  const smd: [number, number, number, number, THREE.Material][] = [
    [96, 150, 7, 4, dark], [96, 160, 7, 4, dark], [110, 150, 7, 4, tan], [84, 172, 4, 7, dark], [20, 150, 7, 4, dark], [20, 160, 7, 4, tan],
    [36, 168, 7, 4, dark], [60, 168, 7, 4, dark], [214, 258, 7, 4, dark], [226, 258, 7, 4, tan], [238, 258, 7, 4, dark], [214, 272, 7, 4, tan],
    [238, 140, 4, 7, tan], [250, 140, 4, 7, dark], [250, 236, 7, 4, dark], [120, 230, 4, 7, tan], [120, 246, 4, 7, dark],
  ];
  return (
    <>
      {/* 고정 구멍 넷 (흰 테두리) */}
      {/* UNO 고정 구멍 자리 (실물 사진처럼 위 왼쪽 · 아래 왼쪽 · 오른쪽 둘) */}
      {([[88, 18], [90, 291], [b.w - 12, 140], [b.w - 12, 258]] as const).map(([hx, hy], i) => (
        <group key={i}>
          <Cyl r={7.5} h={0.6} at={[X(hx), top + 0.2, Z(hy)]} mat={toon("#e9ecef", { outline: false })} seg={20} />
          <Cyl r={5} h={0.8} at={[X(hx), top + 0.3, Z(hy)]} mat={toon("#f8f1e5", { outline: false })} seg={20} />
        </group>
      ))}
      {/* 오른쪽 가장자리 세로 4핀 (TX · RX · G · V, 블루투스 모듈 자리) */}
      <Part id={`board${index}-uart`} label="TX · RX · G · V 핀" text="블루투스 같은 통신 모듈을 꽂는 자리예요. 이 수업에서는 쓰지 않아요.">
        {[0, 1, 2, 3].map((k) => (
          <group key={k}>
            <Box size={[16, 4.2, 15.4]} at={[X(408), top + 2.1, Z(76 + k * 16)]} mat={toon("#eab308")} />
            <Box size={[2.6, HEADER_H - 3.2, 2.6]} at={[X(408), top + 4.2 + (HEADER_H - 3.2) / 2, Z(76 + k * 16)]} mat={toon(COLOR.gold)} />
          </group>
        ))}
      </Part>
      {/* RESET 버튼: 누르면 처음부터 다시 */}
      <Part id={`board${index}-EN`} label="RESET 버튼" text="누르면 보드가 처음부터 다시 시작해요. 눌러 보세요!" card={false}>
        <Box size={[18, 4, 18]} at={[X(30), top + 2, Z(26)]} mat={metal} />
        <mesh ref={enCap} position={[X(30), top + 5, Z(26)]} material={black} castShadow onPointerDown={pressEn} onPointerUp={releaseEn} onPointerLeave={releaseEn}>
          <cylinderGeometry args={[4.6, 4.6, 2.6, 18]} />
        </mesh>
      </Part>
      {/* USB 통역 칩 (CH340, 다리 열여섯) */}
      <Part id={`board${index}-usbchip`} label="USB 칩" text={TEXT.usbChip}>
        <Box size={[36, 3.4, 22]} at={[X(56), top + 1.7, Z(118)]} mat={black} />
        {Array.from({ length: 8 }, (_, k) => [-1, 1].map((sgn) => <Box key={`${k}${sgn}`} size={[2, 1.2, 4]} at={[X(56 - 15.4 + k * 4.4), top + 0.6, Z(118 + sgn * 12.6)]} mat={metal} cast={false} />))}
      </Part>
      {/* 전원 칩 (5V → 3.3V) · 4R7 코일 */}
      <Part id={`board${index}-reg`} label="전원 조절 부품" text={TEXT.regulator}>
        <Box size={[20, 4.5, 14]} at={[X(232), top + 2.25, Z(160)]} mat={black} />
        <Box size={[20, 1.4, 6]} at={[X(232), top + 0.7, Z(150)]} mat={metal} cast={false} />
      </Part>
      <Part id={`board${index}-coil`} label="코일 (4R7)" text="전기를 고르게 다듬어 주는 부품이에요. 전원이 흔들리지 않게 해요.">
        <Box size={[22, 9, 22]} at={[X(234), top + 4.5, Z(204)]} mat={toon("#8a8f98")} />
        <Decal w={16} d={10} at={[X(234), top + 9.15, Z(204)]} paint={(g, cw, ch) => { g.fillStyle = "#1f2328"; g.font = `700 ${Math.round(ch * 0.62)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("4R7", cw / 2, ch / 2); }} />
      </Part>
      {/* DC 7-12V 전원 잭 (노란 몸통) */}
      <Part id={`board${index}-dc`} label="DC 전원 잭" text="USB 대신 7~12V 어댑터나 건전지로 전기를 넣는 곳이에요. 모터처럼 전기를 많이 쓰는 작품에 써요.">
        <Box size={[44, 26, 36]} at={[X(118), top + 13, Z(270)]} mat={toon("#f2b51d")} />
        <Box size={[4, 20, 20]} at={[X(95.5), top + 13, Z(270)]} mat={toon("#d99a0b")} />
        <Cyl r={6} h={3} at={[X(94), top + 13, Z(270)]} rot={[0, 0, Math.PI / 2]} mat={black} seg={16} />
      </Part>
      {/* LED: ON(빨강) · TX · RX · 2번 핀 LED(파랑) */}
      <Part id={`board${index}-pwr`} label="전원 LED (ON)" text={TEXT.powerLed}>
        <Box size={[7, 2.6, 4]} at={[X(226), top + 1.3, Z(244)]} mat={toon("#ff6b6b", { outline: false, emissive: "#e03131", emissiveIntensity: 0.9 })} />
      </Part>
      <Part id={`board${index}-led2`} label="내장 LED (2번 핀)" text={TEXT.bootLed}>
        <Box size={[7, 2.6, 4]} at={[X(246), top + 1.3, Z(272)]} mat={blueLed} />
      </Part>
      {[[202, 236], [202, 244]].map(([rx, ry]) => <Box key={ry} size={[6, 2.2, 3.6]} at={[X(rx), top + 1.1, Z(ry)]} mat={toon("#ffe066", { outline: false })} cast={false} />)}
      {/* 칩 저항 · 콘덴서: 가운데 몸통과 양 끝 은색 단자 */}
      {smd.map(([rx, ry, w, d, m], i) => {
        const long = w >= d;
        return (
          <group key={i}>
            <Box size={[w, 2.2, d]} at={[X(rx), top + 1.1, Z(ry)]} mat={m} cast={false} />
            {[-1, 1].map((k) => <Box key={k} size={long ? [1.6, 2.4, d + 0.2] : [w + 0.2, 2.4, 1.6]} at={[X(rx + (long ? k * (w / 2 - 0.8) : 0)), top + 1.2, Z(ry + (long ? 0 : k * (d / 2 - 0.8)))]} mat={toon("#d4d4d8", { metal: 0.8, rough: 0.3 })} cast={false} />)}
          </group>
        );
      })}
    </>
  );
}

const usedRing = noOutline(toonOwn({ color: COLOR.glow, emissive: COLOR.glow, emissiveIntensity: 0.6 }));
/** Plus 기판 바깥선: 아두이노 UNO 꼴 (오른쪽 위 모서리를 깎고, 오른쪽이 한 번 턱지고, 오른쪽 아래를 깎는다) */
const PLUS_OUTLINE = (w: number, h: number): [number, number][] => [
  [6, 0], [w - 24, 0], [w - 12, 12], [w - 12, 52], [w, 64], [w, h - 14], [w - 14, h], [6, h], [0, h - 6], [0, 6],
];

/** 수핀 묶음(S·V·G 세 줄 · I2C · ANALOG)인지: 핀 이름이 " S|V|G" 로 끝나거나 I2C */
const isMale = (label: string) => / [SVG]$/.test(label) || /^I2C/.test(label);
/** 크기 1 상자 (인스턴스마다 크기를 준다) */
const unitBox = roundedBox(1, 1, 1);
/** Plus 핀 소켓 몸통 (핀마다 색) · 소켓 구멍 */
const headerMat = toonOwn({ color: "#ffffff" });
const holeMat = noOutline(new THREE.MeshBasicMaterial({ color: "#121214" }));
