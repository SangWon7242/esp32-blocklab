import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Pt, Scene3D } from "@/track/wiring3d";
import { Board, Breadboard } from "./board";
import { HoverMarks, SelectionRing } from "./kit";
import { BB_H, HEADER_H, PCB_H, PIN_SEAT, type Layout } from "./layout";
import { COLOR, toonOwn } from "./materials";
import { Button, Buzzer, Dip, IrRx, Led, Module, Photo, Pot, Prop, Remote, Resistor, Rgb, Seg7, Servo, Tilt, Touch } from "./parts";
import { PanFloor, Rig } from "./rig";
import { useViewerApi } from "./store";
import { MODULE, pinText, TEXT } from "./texts";
import { Flow, ledChains, WireView } from "./wires";

/* 3D 장면 전체 (Canvas 안). 화면 위 글자(설명 카드 · 점선)는 DOM 이고, 여기서 자리만 맞춰 준다. */

export type Anchor = { id: string; label: string; text: string; color: string; position: THREE.Vector3; pin?: boolean };

const mean = (ps: Pt[]) => ({ x: ps.reduce((n, p) => n + p.x, 0) / ps.length, y: ps.reduce((n, p) => n + p.y, 0) / ps.length });

/** 이번 배선에서 볼 것: 꽂는 핀 · 부품마다 설명 카드 자리 (같은 이름은 한 번) */
export function anchorsOf(scene: Scene3D, L: Layout): Anchor[] {
  const out: Anchor[] = [];
  const add = (label: string, text: string, color: string, position: THREE.Vector3, pin = false) => {
    if (!pin && out.some((a) => a.label === label)) return;
    out.push({ id: `${label}-${out.length}`, label, text, color, position, pin });
  };
  for (const b of scene.boards) {
    for (const p of b.pins.filter((q) => q.used)) {
      const gnd = /GND|\bG$/.test(p.label);
      add(p.label.replace(/ \(.*\)$/, ""), pinText(p.label, true), gnd ? "#495057" : "#f08c00", L.v(p, PCB_H + (b.kind === "devkit" ? PIN_SEAT : HEADER_H) + 15), true);
    }
  }
  scene.parts.forEach((p) => {
    switch (p.type) {
      case "led": add("LED", TEXT.led, p.color, L.v(mean([p.a, p.c]), BB_H + 46)); break;
      case "resistor": add(p.label ? `${p.label} 저항` : "저항", TEXT.resistor, "#c08a3e", L.v(mean([p.a, p.b]), BB_H + 15)); break;
      case "button": add("버튼", TEXT.tact, "#868e96", L.v(mean(p.legs), BB_H + 20)); break;
      case "buzzer": add("부저", TEXT.buzzer, "#495057", L.v(mean([p.a, p.b]), BB_H + 24)); break;
      case "pot": add("가변저항", TEXT.pot, "#1971c2", L.v(p.legs[1], BB_H + 32)); break;
      case "photo": add("포토레지스터", TEXT.photo, "#e8590c", L.v(mean([p.a, p.b]), BB_H + 21)); break;
      case "tilt": add("틸트 스위치", TEXT.tilt, "#495057", L.v(mean([p.a, p.b]), BB_H + 31)); break;
      case "rgb": add("RGB LED", TEXT.rgb, "#7048e8", L.v(mean(p.legs), BB_H + 48)); break;
      case "irrx": add("IR 수신기", TEXT.irrx, "#495057", L.v(p.legs[1], BB_H + 33)); break;
      case "dip": add(p.label ? `${p.label} 칩` : "칩", TEXT.dip, "#495057", L.v(mean([p.l, p.r]), BB_H + 12)); break;
      case "servo": add("서보 모터", TEXT.servo, "#1971c2", new THREE.Vector3(L.X(p.x + 44), 48, L.zIn({ y: p.y, h: 44 })(p.y + 22))); break;
      case "touch": add(p.label ?? "호일 터치 패드", "손가락을 대면 보드가 알아채요.", "#868e96", L.v({ x: p.pad.x + p.pad.w / 2, y: p.pad.y + p.pad.h / 2 }, 12)); break;
      case "seg7": add("7세그먼트", "막대 일곱 개를 켜고 꺼서 숫자를 보여 줘요.", "#e03131", L.v({ x: p.x + p.w / 2, y: p.y + p.h / 2 }, BB_H + 20)); break;
      case "prop": break;
      case "module": {
        const info = MODULE[p.kind] ?? MODULE.generic;
        const zz = L.zIn(p);
        add(p.title || info.name, info.text, p.color, new THREE.Vector3(L.X(p.x + p.w / 2), p.kind === "ultrasonic" ? 60 : 12, zz(p.y + p.h / 2)));
        break;
      }
    }
  });
  // 너무 많으면(부품이 많은 작품) 핀 카드는 빼고 부품만 — 핀은 마우스를 올리면 나온다
  return out.length > 9 ? out.filter((a) => !a.pin) : out;
}

const CARD_W = 184, CARD_H = 66;

/** 설명 카드 · 이름표 · 점선 · 부품 카드 점선을 3D 자리에 맞춰 놓는다 (DOM 을 바로 고친다) */
function OverlaySync({ anchors }: { anchors: Anchor[] }) {
  const api = useViewerApi();
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const s = api.getState();
    const { w, h } = { w: size.width, h: size.height };
    const pts = anchors.map((a) => {
      v.copy(a.position).project(camera);
      return { a, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
    });
    const cards = !s.selected && w >= 760 && h >= 420 && anchors.length <= 6;
    if (s.dom.callouts) s.dom.callouts.dataset.mode = cards ? "cards" : "pills";
    const spot = new Map<string, { x: number; y: number }>();
    if (cards) {
      const byX = [...pts].sort((p, q) => p.x - q.x);
      const leftIds = new Set(byX.slice(0, Math.ceil(byX.length / 2)).map((p) => p.a.id));
      for (const side of ["left", "right"] as const) {
        const col = pts.filter((p) => leftIds.has(p.a.id) === (side === "left")).sort((p, q) => p.y - q.y);
        const top = side === "left" ? 52 : 52, bottom = h - 60;
        let y = top;
        const ys = col.map((p) => { const cy = Math.max(y, p.y - CARD_H / 2); y = cy + CARD_H + 10; return cy; });
        let over = (ys[ys.length - 1] ?? 0) + CARD_H - bottom;
        for (let i = ys.length - 1; i >= 0 && over > 0; i--) {
          ys[i] -= over;
          if (i > 0) over = ys[i - 1] + CARD_H + 10 - ys[i];
          if (ys[i] < top) ys[i] = top;
        }
        col.forEach((p, i) => spot.set(p.a.id, { x: side === "left" ? 12 : w - CARD_W - 12, y: ys[i] }));
      }
    }
    for (const p of pts) {
      const node = s.dom.nodes.get(p.a.id);
      if (!node) continue;
      if (node.dot) node.dot.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      const c = spot.get(p.a.id);
      if (c) {
        if (node.card) node.card.style.transform = `translate(${c.x}px, ${c.y}px)`;
        node.line?.setAttribute("x1", String(p.x)); node.line?.setAttribute("y1", String(p.y));
        node.line?.setAttribute("x2", String(c.x < p.x ? c.x + CARD_W : c.x)); node.line?.setAttribute("y2", String(c.y + CARD_H / 2));
      } else {
        if (node.card) node.card.style.transform = `translate(${p.x + 14}px, ${p.y - 30}px)`;
        node.line?.setAttribute("x1", String(p.x)); node.line?.setAttribute("y1", String(p.y));
        node.line?.setAttribute("x2", String(p.x + 16)); node.line?.setAttribute("y2", String(p.y - 16));
      }
    }
    // 누른 부품 ↔ 부품 카드
    const { partCard: card, leader, leaderHalo, leaderDot } = s.dom;
    if (s.selected && card && leader && leaderDot) {
      v.copy(s.selected.center).project(camera);
      const sx = ((v.x + 1) / 2) * w, sy = ((1 - v.y) / 2) * h;
      const cx = card.offsetLeft + card.offsetWidth * 0.82, cy = card.offsetTop + card.offsetHeight;
      const d = `M${cx} ${cy} L${cx} ${cy + 26} L${sx} ${sy}`;
      leader.setAttribute("d", d);
      leaderHalo?.setAttribute("d", d);
      leaderDot.setAttribute("transform", `translate(${sx} ${sy})`);
      leader.style.display = leaderDot.style.display = "";
      if (leaderHalo) leaderHalo.style.display = "";
    } else {
      if (leader) leader.style.display = "none";
      if (leaderDot) leaderDot.style.display = "none";
      if (leaderHalo) leaderHalo.style.display = "none";
    }
  });
  return null;
}

/** 실행 중: 시뮬레이션을 한 걸음씩. 읽은 값 판은 초당 여섯 번만 고친다. 보드의 파란 LED 는 2번 핀 · 핀이 바뀔 때 깜빡 */
function SimDriver({ blueLed }: { blueLed: THREE.MeshToonMaterial }) {
  const api = useViewerApi();
  const acc = useRef(0);
  useFrame((_, dt) => {
    const s = api.getState();
    const sim = s.sim;
    if (!sim) return;
    if (s.running) {
      sim.step(Math.min(dt, 0.05));
      acc.current += dt;
      if (acc.current > 0.16) {
        acc.current = 0;
        s.set({ readings: [...sim.readings.entries()], serial: [...sim.outputs.serial], phone: sim.outputs.phone });
      }
      s.invalidate();
    }
    const o = sim.outputs;
    const flash = s.running && (sim.time - o.activity < 0.12 || (o.pins[2] ?? 0) > 0.5);
    blueLed.emissiveIntensity = flash ? 2 : 0.25;
  });
  return null;
}

export function Scene3DView({ scene, L, anchors, cardsRoom }: { scene: Scene3D; L: Layout; anchors: Anchor[]; cardsRoom: boolean }) {
  const api = useViewerApi();
  const { invalidate } = useThree();
  useEffect(() => {
    api.getState().set({ invalidate });
    // 처음 몇 장은 캔버스 크기가 정해진 뒤에 다시 그린다 (frameloop="demand" 는 저절로 다시 그리지 않는다)
    const ids = [60, 250, 800].map((ms) => window.setTimeout(invalidate, ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [api, invalidate]);
  const r = Math.max(L.size.w, L.size.d);
  const blueLed = useMemo(() => toonOwn({ color: "#74c0fc", emissive: COLOR.signal, emissiveIntensity: 0.25, outline: false }), []);
  useEffect(() => () => blueLed.dispose(), [blueLed]);
  const chains = useMemo(() => ledChains(scene, L), [scene, L]);
  const devices = api.getState().devices;
  const ledPins = useMemo(() => Object.fromEntries(devices.flatMap((d) => (d.kind === "led" ? [[d.part, d.pin]] : []))), [devices]);
  const hasIr = scene.parts.some((p) => p.type === "irrx");
  const irPart = scene.parts.find((p): p is Extract<typeof p, { type: "irrx" }> => p.type === "irrx");
  return (
    <>
      <hemisphereLight args={["#ffffff", "#c9c2b4", 1.7]} />
      <directionalLight position={[-r * 0.5, r * 1.1, r * 0.35]} intensity={2.4} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-r} shadow-camera-right={r} shadow-camera-top={r} shadow-camera-bottom={-r} shadow-camera-near={1} shadow-camera-far={r * 4} />
      <Floor r={r} />
      <PanFloor r={r} />
      <Rig L={L} cardsRoom={cardsRoom && anchors.length <= 6} />
      {scene.breadboards.map((bb, i) => <Breadboard key={i} bb={bb} L={L} index={i} />)}
      {scene.boards.map((b, i) => <Board key={i} b={b} L={L} index={i} blueLed={blueLed} />)}
      {scene.parts.map((p, i) => {
        switch (p.type) {
          case "led": return <Led key={i} p={p} i={i} L={L} />;
          case "resistor": return <Resistor key={i} p={p} i={i} L={L} />;
          case "button": return <Button key={i} p={p} i={i} L={L} />;
          case "buzzer": return <Buzzer key={i} p={p} i={i} L={L} />;
          case "pot": return <Pot key={i} p={p} i={i} L={L} />;
          case "photo": return <Photo key={i} p={p} i={i} L={L} />;
          case "tilt": return <Tilt key={i} p={p} i={i} L={L} />;
          case "rgb": return <Rgb key={i} p={p} i={i} L={L} />;
          case "irrx": return <IrRx key={i} p={p} i={i} L={L} />;
          case "dip": return <Dip key={i} p={p} i={i} L={L} />;
          case "servo": return <Servo key={i} p={p} i={i} L={L} />;
          case "module": return <Module key={i} p={p} i={i} L={L} />;
          case "touch": return <Touch key={i} p={p} i={i} L={L} />;
          case "seg7": return <Seg7 key={i} p={p} i={i} L={L} />;
          case "prop": return <Prop key={i} p={p} i={i} L={L} />;
        }
      })}
      {hasIr && irPart && <Remote at={new THREE.Vector3(L.X(irPart.legs[1].x) + 90, 0, L.Zp(irPart.legs[1]) + 40)} />}
      {scene.wires.map((w, i) => <WireView key={i} w={w} i={i} L={L} scene={scene} />)}
      <Flow chains={chains} ledPins={ledPins} />
      <HoverMarks />
      <SelectionRing />
      <OverlaySync anchors={anchors} />
      <SimDriver blueLed={blueLed} />
    </>
  );
}

/** 바닥 모눈: 장면과 함께 돌아서 방향을 잃지 않는다 */
function Floor({ r }: { r: number }) {
  const cell = 24, cells = Math.ceil((r * 5) / cell / 10) * 10;
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(cell * cells, cells / 5, "#cfc6b4", "#cfc6b4");
    const f = new THREE.GridHelper(cell * cells, cells, "#e2dbcc", "#e2dbcc");
    g.position.y = -0.7;
    f.position.y = -0.8;
    for (const x of [g, f]) (x.material as THREE.Material).userData.outlineParameters = { visible: false };
    return [g, f];
  }, [cells]);
  useEffect(() => () => grid.forEach((g) => g.dispose()), [grid]);
  return <>{grid.map((g, i) => <primitive key={i} object={g} raycast={() => null} />)}</>;
}
