import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Scene3D } from "@/track/wiring3d";
import { Box, Cyl, Decal, Part } from "./kit";
import { BB_H, HEADER_H, PCB_H, PIN_LEN, type Layout } from "./layout";
import { COLOR, noOutline, toon, toonOwn } from "./materials";
import { useViewerApi } from "./store";
import { pinText, TEXT } from "./texts";

type BoardData = Scene3D["boards"][number];
type BB = Scene3D["breadboards"][number];

/** 모서리가 둥근 두꺼운 판 (윗면 · 옆면 두 재질) */
export function Slab({ x, y, w, d, h, radius, top, side, y0 = 0, ...events }: {
  x: number; y: number; w: number; d: number; h: number; radius: number; top: THREE.Material; side: THREE.Material; y0?: number;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void; onPointerOut?: () => void;
}) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
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
  }, [w, d, h, radius]);
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
        inst.current?.setMatrixAt(i, mx.makeTranslation(L.X(p.x), top + HEADER_H / 2, L.Z(p.y)));
        caps.current?.setMatrixAt(i, mx.makeTranslation(L.X(p.x), top + HEADER_H + 0.3, L.Z(p.y)));
        c.set(p.fill);
        if (!p.used) c.lerp(new THREE.Color(pcb), 0.55);
        caps.current?.setColorAt(i, c);
      }
    });
    for (const m of [inst.current, caps.current, grip.current]) if (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
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
          <instancedMesh ref={inst} args={[undefined, undefined, pins.length]} material={toon(COLOR.plastic)} castShadow onPointerMove={move} onPointerOut={out}>
            <boxGeometry args={[14, HEADER_H, 14]} />
          </instancedMesh>
          <instancedMesh ref={caps} args={[undefined, undefined, pins.length]} raycast={() => null}>
            <boxGeometry args={[9, 1, 9]} />
            <meshBasicMaterial />
          </instancedMesh>
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
    }
  };
}

export function Board({ b, L, index, blueLed }: { b: BoardData; L: Layout; index: number; blueLed: THREE.MeshToonMaterial }) {
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
  const antennaRight = devkit;
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
        <Slab x={cxB} y={czB} w={b.w} d={d} h={PCB_H} radius={devkit ? 8 : 16} top={toon(pcb)} side={toon(devkit ? "#343946" : "#34343a")} />
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
          g.font = `700 ${Math.round(w * 0.16)}px system-ui, sans-serif`;
          g.fillText("ESP32", w * 0.58, h / 2 - h * 0.08);
          g.font = `600 ${Math.round(w * 0.07)}px system-ui, sans-serif`;
          g.fillText("WROOM-32", w * 0.58, h / 2 + h * 0.14);
          g.lineWidth = w * 0.025;
          g.lineCap = "round";
          for (const r of [0.055, 0.11, 0.165]) { g.beginPath(); g.arc(w * 0.2, h / 2 + h * 0.12, w * r, -Math.PI * 0.78, -Math.PI * 0.22); g.stroke(); }
          g.beginPath(); g.arc(w * 0.2, h / 2 + h * 0.12, w * 0.02, 0, Math.PI * 2); g.fill();
        }} />
        {Array.from({ length: steps }, (_, i) => (
          <group key={i}>
            <Box size={[antW - 8, 0.6, 2]} at={[L.X(ax + (antW - 6) / 2), top + 2.3, L.Z(c.y + 8 + i * sh)]} mat={toon(COLOR.gold, { outline: false })} cast={false} />
            <Box size={[2, 0.6, sh * kz]} at={[L.X(ax + (i % 2 ? 1 : antW - 7)), top + 2.3, L.Z(c.y + 8 + i * sh + sh / 2)]} mat={toon(COLOR.gold, { outline: false })} cast={false} />
          </group>
        ))}
      </Bit>

      {/* USB */}
      <Bit id={`board${index}-usb`} label="USB" text={TEXT.usb}>
        <Box size={[u.w, 9, u.h]} at={[L.X(u.x + u.w / 2), top + 3.5, L.Z(u.y + u.h / 2)]} mat={toon(COLOR.metalLight)} />
        <Box size={[3, 4.5, u.h - 10]} at={[L.X(u.x + 1.2), top + 3.5, L.Z(u.y + u.h / 2)]} mat={toon(COLOR.plastic)} />
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
        ([[b.x + 14, b.y + 14], [b.x + b.w - 14, b.y + 14], [b.x + 14, b.y + b.h - 14], [b.x + b.w - 14, b.y + b.h - 14]] as const).map(([hx, hy], i) => (
          <Cyl key={i} r={5} h={0.8} at={[L.X(hx), top + 0.3, L.Z(hy)]} mat={toon("#6c757d", { outline: false })} />
        ))
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

const usedRing = noOutline(toonOwn({ color: COLOR.glow, emissive: COLOR.glow, emissiveIntensity: 0.6 }));
