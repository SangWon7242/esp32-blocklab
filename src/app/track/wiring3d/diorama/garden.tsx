import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { Ball, Box, Cyl, Part, Tube } from "../kit";
import { noOutline, toon, toonOwn } from "../materials";
import { useViewerApi, type ViewerState } from "../store";
import { deviceKind, ease, pinLevel } from "./common";
import { HideFromBehind, LiveOled, Sign } from "./pieces";

/*
 * 44장 스마트 화분: 베란다 화분대 위의 화분 · 물통 · 펌프 · 화분 지킴이(보드 상자).
 *   흙에 꽂은 토양 수분 센서가 흙이 마른 걸 알아채면 릴레이가 철컥 붙고, 물통 안 펌프가 호스로 물을 보낸다.
 *   흙이 젖으면 잎이 다시 서고, 물통의 물은 줄어든다. 물통 벽의 수위 센서가 물이 바닥나면 알려 준다.
 * 학생이 만지는 것: 해(누르고 있으면 햇볕이 흙을 말린다) · 물통(누르면 비우기 / 채우기).
 * 흙 촉촉함 · 물통 물은 시뮬레이션 입력(inputs.soil · inputs.water, 0~1)이다 — 펌프가 돌면 엔진이 바꾼다(PLANT_RATES).
 */

export const PLANT_ROOM = { w: 260, d: 210 };

const SOIL_DEFAULT = 0.3, WATER_DEFAULT = 0.8;

const soilOf = (s: ViewerState) => s.sim?.inputs.soil ?? SOIL_DEFAULT;
const waterOf = (s: ViewerState) => s.sim?.inputs.water ?? WATER_DEFAULT;
const relayPin = (s: ViewerState) => deviceKind(s, "relay")?.pin;
/** 펌프가 물을 보내는 중인지: 실행 중 · 릴레이 켜짐 · 물통에 물이 있음 */
const pumping = (s: ViewerState) => s.running && pinLevel(s, relayPin(s)) > 0.5 && waterOf(s) > 0.02;

const WOOD = "#c99a6b", WOOD_DARK = "#a77a4f", TILE = "#e7ddd0", WALL = "#f3efe8";
const DRY = new THREE.Color("#c8a27a"), WET = new THREE.Color("#4e3423");
const LEAF_OK = new THREE.Color("#3f9b4f"), LEAF_DRY = new THREE.Color("#a9a63d");

/** 머리 위에 뜨는 작은 글자 판 (값이 바뀔 때만 다시 그린다) */
function useTag(w = 220, h = 64) {
  const tag = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { cv, tex, mat: noOutline(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })), text: "" };
  }, [w, h]);
  useEffect(() => () => { tag.tex.dispose(); tag.mat.dispose(); }, [tag]);
  const draw = (text: string, ink = "#0f2239") => {
    if (tag.text === text) return;
    tag.text = text;
    const c = tag.cv.getContext("2d");
    if (!c) return;
    const { width: cw, height: ch } = tag.cv;
    c.clearRect(0, 0, cw, ch);
    c.fillStyle = "#ffffff"; c.strokeStyle = "rgba(15,34,57,0.75)"; c.lineWidth = 4;
    c.beginPath(); c.roundRect(4, 4, cw - 8, ch - 8, 14); c.fill(); c.stroke();
    c.fillStyle = ink; c.font = `700 ${Math.round(ch * 0.44)}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(text, cw / 2, ch / 2 + 1);
    tag.tex.needsUpdate = true;
  };
  return { mat: tag.mat, draw };
}

/* ── 화분 · 식물 · 토양 센서 ── */

const POT_X = -52, POT_Z = -6, TOP = 40; // 화분대 윗면 높이
const POT_H = 40, POT_R = 30, SOIL_Y = TOP + 3 + POT_H + 0.4; // 흙 윗면 (화분 테두리 바로 아래)

function PotPlant() {
  const api = useViewerApi();
  const soilMat = useMemo(() => toonOwn({ color: DRY.clone(), roughness: 0.95 }), []);
  const leafMat = useMemo(() => toonOwn({ color: LEAF_OK.clone(), roughness: 0.6 }), []);
  useEffect(() => () => { soilMat.dispose(); leafMat.dispose(); }, [soilMat, leafMat]);
  const leaves = useRef<(THREE.Group | null)[]>([]);
  const head = useRef<THREE.Group>(null);
  const shown = useRef(SOIL_DEFAULT);
  const tag = useTag();
  useFrame((_, dt) => {
    const s = api.getState();
    const goal = soilOf(s);
    const before = shown.current;
    shown.current = ease(shown.current, goal, dt, 3);
    const wet = shown.current;
    // 흙 색: 마르면 밝은 흙색, 젖으면 짙은 갈색
    (soilMat.color as THREE.Color).copy(DRY).lerp(WET, THREE.MathUtils.smoothstep(wet, 0.1, 0.75));
    // 잎: 마를수록 아래로 처지고 누렇게
    const thirst = THREE.MathUtils.clamp((0.45 - wet) / 0.35, 0, 1);
    (leafMat.color as THREE.Color).copy(LEAF_OK).lerp(LEAF_DRY, thirst * 0.8);
    leaves.current.forEach((g, k) => { if (g) g.rotation.x = 0.35 + thirst * (1.0 + (k % 2) * 0.15); });
    if (head.current) head.current.rotation.z = thirst * 0.35;
    tag.draw(`흙 촉촉함 ${Math.round(goal * 100)}%`, goal < 0.3 ? "#c2410c" : "#1864ab");
    if (Math.abs(shown.current - before) > 1e-4) s.invalidate();
  });
  const pot = toon("#c4673d"), rim = toon("#b25a33");
  const stem = toon("#3c8a46");
  return (
    <group position={[POT_X, TOP, POT_Z]}>
      {/* 화분 받침 · 화분 · 테두리 · 흙 */}
      <Cyl r={30} r2={30} h={3} at={[0, 1.5, 0]} mat={toon("#9c4f2c")} seg={28} />
      <Cyl r={22} r2={POT_R} h={POT_H} at={[0, 3 + POT_H / 2, 0]} mat={pot} seg={28} />
      <mesh position={[0, 3 + POT_H, 0]} rotation={[Math.PI / 2, 0, 0]} material={rim} castShadow><torusGeometry args={[POT_R, 2.6, 10, 32]} /></mesh>
      <Cyl r={POT_R - 1.5} h={2} at={[0, SOIL_Y - TOP - 1, 0]} mat={soilMat} seg={28} />
      {/* 줄기 · 잎 (처지는 각도는 흙 촉촉함으로) */}
      <group position={[0, SOIL_Y - TOP, -4]} scale={1.45}>
        <Cyl r={2.2} r2={1.6} h={54} at={[0, 27, 0]} mat={stem} seg={10} />
        {[0, 1, 2, 3, 4, 5].map((k) => {
          const y = 14 + k * 7.5, ang = k * 2.2;
          return (
            <group key={k} position={[0, y, 0]} rotation={[0, ang, 0]}>
              <group ref={(g) => { leaves.current[k] = g; }}>
                <mesh position={[0, 0, 12]} scale={[0.55, 0.12, 1]} material={leafMat} castShadow><sphereGeometry args={[12 - k * 0.6, 18, 10]} /></mesh>
              </group>
            </group>
          );
        })}
        {/* 꽃봉오리 */}
        <group ref={head} position={[0, 54, 0]}>
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} position={[Math.cos((k * 2 * Math.PI) / 5) * 4.5, 1, Math.sin((k * 2 * Math.PI) / 5) * 4.5]} scale={[1, 0.35, 1]} material={toon("#f783ac")} castShadow><sphereGeometry args={[4, 12, 8]} /></mesh>
          ))}
          <Ball r={3} at={[0, 2, 0]} mat={toon("#ffd43b")} />
        </group>
      </group>
      {/* 토양 수분 센서: 두 갈래 다리가 흙에 박혀 있고 머리의 하얀 꽂이에서 선이 나간다 */}
      <group position={[-15, SOIL_Y - TOP, 15]} rotation={[0, 0.5, 0]} scale={1.5}>
        <Box size={[16, 16, 1.6]} at={[0, 9, 0]} mat={toon("#1c5fa8")} />
        {[-4.5, 4.5].map((x) => <Box key={x} size={[3.4, 12, 1.7]} at={[x, -2, 0]} mat={toon("#d4a72c", { metal: 0.9, rough: 0.3 })} />)}
        <Box size={[10, 5, 5]} at={[0, 19, 0]} mat={toon("#f1f3f5")} />
        {["#212529", "#e03131", "#f59f00"].map((c, k) => <Box key={c} size={[2, 3, 2]} at={[-3 + k * 3, 22.5, 0]} mat={toon(c)} cast={false} />)}
      </group>
      <sprite material={tag.mat} position={[-34, 150, 0]} scale={[64, 19, 1]} renderOrder={7} raycast={() => null} />
    </group>
  );
}

/* ── 물통 · 수위 센서 · 펌프 · 호스 · 물방울 ── */

const TANK_X = 58, TANK_Z = -14, TANK = { w: 54, h: 58, d: 44 };

function TankPump() {
  const api = useViewerApi();
  const water = useRef<THREE.Mesh>(null);
  const pump = useRef<THREE.Group>(null);
  const drops = useRef<THREE.Group>(null);
  const shown = useRef(WATER_DEFAULT);
  const clock = useRef(0);
  const flow = useRef(0);
  const tag = useTag();
  const glass = useMemo(() => noOutline(toonOwn({ color: "#e7f5ff", transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0, depthWrite: false })), []);
  const waterMat = useMemo(() => noOutline(toonOwn({ color: "#4dabf7", transparent: true, opacity: 0.55, roughness: 0.2, depthWrite: false })), []);
  const dropMat = useMemo(() => noOutline(toonOwn({ color: "#74c0fc", transparent: true, opacity: 0.85, roughness: 0.1 })), []);
  useEffect(() => () => { glass.dispose(); waterMat.dispose(); dropMat.dispose(); }, [glass, waterMat, dropMat]);
  // 호스 끝(모형 좌표): 화분 위
  const NOZZLE = useMemo(() => new THREE.Vector3(POT_X + 12, SOIL_Y + 30, POT_Z + 2), []);
  const hose = useMemo(() => [
    new THREE.Vector3(TANK_X - 10, TOP + 10, TANK_Z),
    new THREE.Vector3(TANK_X - 10, TOP + TANK.h - 4, TANK_Z),
    new THREE.Vector3(TANK_X - 14, TOP + TANK.h + 16, TANK_Z + 2),
    new THREE.Vector3(TANK_X - 40, TOP + TANK.h + 34, TANK_Z + 4),
    new THREE.Vector3(POT_X + 30, SOIL_Y + 44, POT_Z + 4),
    new THREE.Vector3(NOZZLE.x + 4, NOZZLE.y + 6, NOZZLE.z),
    NOZZLE.clone(),
  ], [NOZZLE]);
  const toggle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    const s = api.getState();
    if (!s.sim) return;
    s.sim.inputs.water = waterOf(s) > 0.5 ? 0 : 1;
    s.invalidate();
  };
  useFrame((_, dt) => {
    const s = api.getState();
    const goal = waterOf(s);
    const before = shown.current;
    shown.current = ease(shown.current, goal, dt, 4);
    const lv = Math.max(0.001, shown.current);
    if (water.current) {
      water.current.scale.y = lv;
      water.current.position.y = TOP + 2 + ((TANK.h - 6) * lv) / 2;
    }
    const on = pumping(s);
    flow.current = ease(flow.current, on ? 1 : 0, dt, 5);
    clock.current += dt;
    if (pump.current) pump.current.position.x = on ? Math.sin(clock.current * 90) * 0.35 : 0;
    drops.current?.children.forEach((m, k) => {
      const ph = (clock.current * 1.6 + k / 4) % 1;
      m.visible = flow.current > 0.1;
      m.position.set(NOZZLE.x + Math.sin(k * 7) * 1.5, NOZZLE.y - 2 - ph * (NOZZLE.y - SOIL_Y - 2), NOZZLE.z);
      m.scale.setScalar(0.6 + 0.4 * flow.current);
    });
    tag.draw(goal < 0.05 ? "물통이 비었어요" : `물통 물 ${Math.round(goal * 100)}%`, goal < 0.2 ? "#c2410c" : "#1864ab");
    if (s.running || Math.abs(shown.current - before) > 1e-4 || flow.current > 0.002) s.invalidate();
  });
  return (
    <group>
      <Part id="site-tank" label="물통" text="물통을 누르면 물을 비우고, 다시 누르면 가득 채워요. 물이 없으면 펌프가 돌아도 물이 나오지 않아요." card={false} lift={false}>
        <group position={[TANK_X, 0, TANK_Z]} onClick={toggle}>
          {/* 투명한 통 · 바닥 */}
          <Box size={[TANK.w, 3, TANK.d]} at={[0, TOP + 1.5, 0]} mat={toonOwn({ color: "#d0ebff", transparent: true, opacity: 0.5 })} />
          <mesh position={[0, TOP + TANK.h / 2, 0]} material={glass}><boxGeometry args={[TANK.w, TANK.h, TANK.d]} /></mesh>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => <Box key={`${a}${b}`} size={[2, TANK.h, 2]} at={[a * (TANK.w / 2 - 1), TOP + TANK.h / 2, b * (TANK.d / 2 - 1)]} mat={toon("#a5d8ff")} cast={false} />)}
        </group>
        {/* 물 */}
        <mesh ref={water} position={[TANK_X, TOP + 30, TANK_Z]} material={waterMat} raycast={() => null}><boxGeometry args={[TANK.w - 4, TANK.h - 6, TANK.d - 4]} /></mesh>
      </Part>
      {/* 펌프: 물통 바닥의 작은 검은 통 */}
      <Part id="site-pump" label="미니 워터 펌프" text="릴레이가 붙으면 5V 전기를 받아 돌면서 물통의 물을 호스로 밀어 올려요." card={false} lift={false}>
        <group ref={pump}>
          <Cyl r={7} h={14} at={[TANK_X - 10, TOP + 10, TANK_Z]} mat={toon("#2b2b30")} seg={18} />
          <Cyl r={2.4} h={6} at={[TANK_X - 10, TOP + 19, TANK_Z]} mat={toon("#495057")} seg={10} />
        </group>
        <Tube points={hose} radius={1.9} mat={toonOwn({ color: "#f1f3f5", transparent: true, opacity: 0.9, roughness: 0.3 })} />
      </Part>
      <group ref={drops}>
        {[0, 1, 2, 3].map((k) => <mesh key={k} material={dropMat} visible={false} raycast={() => null}><sphereGeometry args={[1.8, 10, 8]} /></mesh>)}
      </group>
      {/* 수위 센서: 물통 앞 벽 안쪽에 세워 꽂은 빨간 줄무늬 판 */}
      <Part id="site-water" label="수위 센서" text="물에 잠긴 줄무늬가 많을수록 값이 커져요. 물이 바닥나면 펌프를 멈추고 알려 줘요." card={false} lift={false}>
        <group position={[TANK_X + 14, TOP + TANK.h - 18, TANK_Z + TANK.d / 2 - 4]}>
          <Box size={[16, 44, 1.6]} at={[0, 0, 0]} mat={toon("#d6336c")} />
          {Array.from({ length: 9 }, (_, k) => <Box key={k} size={[1.1, 30, 0.4]} at={[-6 + k * 1.5, -5, 1]} mat={toon("#dee2e6", { metal: 0.9, rough: 0.3 })} cast={false} />)}
          <Box size={[10, 5, 5]} at={[0, 23, 0]} mat={toon("#f1f3f5")} />
        </group>
      </Part>
      <sprite material={tag.mat} position={[TANK_X, TOP + TANK.h + 50, TANK_Z]} scale={[64, 19, 1]} renderOrder={7} raycast={() => null} />
    </group>
  );
}

/* ── 화분 지킴이 상자: 보드 · OLED · 릴레이 ── */

function Controller() {
  const api = useViewerApi();
  const led = useMemo(() => toonOwn({ color: "#ffe3e3", emissive: "#ff2d2d", emissiveIntensity: 0 }), []);
  useEffect(() => () => led.dispose(), [led]);
  const arm = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = api.getState();
    const on = s.running && pinLevel(s, relayPin(s)) > 0.5;
    led.emissiveIntensity = on ? 2.4 : 0;
    if (arm.current) arm.current.position.x = on ? 2 : -2;
  });
  const X = -2, Z = 38;
  return (
    <group position={[X, TOP, Z]}>
      {/* 보드 상자 (흰 상자, 앞에 OLED) */}
      <Box size={[58, 26, 30]} at={[0, 13, 0]} mat={toon("#f8f9fa")} />
      <LiveOled w={34} h={17} at={[0, 15, 15.4]} />
      {/* 릴레이 모듈: 파란 판 · 파란 릴레이 · 나사 단자 · 빨간 LED */}
      <Part id="site-relay" label="릴레이 모듈" text="보드가 신호를 보내면 안의 스위치가 철컥 붙어서 펌프에 5V 전기가 흘러요. 붙어 있는 동안 빨간 불이 켜져요." card={false} lift={false}>
        <group position={[46, 0, 2]}>
          <Box size={[26, 2, 34]} at={[0, 1, 0]} mat={toon("#1c5fa8")} />
          <Box size={[18, 15, 16]} at={[0, 9.5, -4]} mat={toon("#2f6fdb")} />
          <Box size={[20, 7, 8]} at={[0, 5.5, 11]} mat={toon("#1971c2")} />
          {[-6, 0, 6].map((x) => <Cyl key={x} r={1.8} h={1} at={[x, 9.4, 11]} mat={toon("#ced4da", { metal: 0.8, rough: 0.3 })} seg={10} />)}
          <Ball r={1.6} at={[-9, 2.6, -14]} mat={led} />
          <mesh ref={arm} position={[-2, 17.4, -4]} material={toon("#ffffff", { outline: false })}><boxGeometry args={[6, 0.4, 1.4]} /></mesh>
        </group>
      </Part>
    </group>
  );
}

/* ── 해: 누르고 있으면 햇볕이 흙을 말린다 ── */

function Sun() {
  const api = useViewerApi();
  const held = useRef(false);
  const glow = useMemo(() => toonOwn({ color: "#ffe066", emissive: "#ffd43b", emissiveIntensity: 0.6 }), []);
  useEffect(() => () => glow.dispose(), [glow]);
  const rays = useRef<THREE.Group>(null);
  const set = (on: boolean) => (e?: ThreeEvent<PointerEvent>) => { e?.stopPropagation(); held.current = on; api.getState().invalidate(); };
  useFrame((_, dt) => {
    const s = api.getState();
    glow.emissiveIntensity = held.current ? 2.2 : 0.6;
    if (rays.current) rays.current.rotation.z += held.current ? dt * 2 : 0;
    if (!held.current) return;
    if (s.sim) s.sim.inputs.soil = Math.max(0, soilOf(s) - dt * 0.12);
    s.invalidate();
  });
  return (
    <group position={[POT_X - 14, 150, -96]}>
      <Part id="site-sun" label="햇볕" text="누르고 있으면 햇볕이 쨍쨍 내리쬐어 흙이 빨리 말라요." card={false} lift={false}>
        <group onPointerDown={set(true)} onPointerUp={set(false)} onPointerLeave={set(false)}>
          <Ball r={12} at={[0, 0, 0]} mat={glow} />
          <group ref={rays}>
            {Array.from({ length: 8 }, (_, k) => <Box key={k} size={[3, 7, 2]} at={[Math.cos((k * Math.PI) / 4) * 18, Math.sin((k * Math.PI) / 4) * 18, 0]} rot={[0, 0, (k * Math.PI) / 4 - Math.PI / 2]} mat={glow} cast={false} />)}
          </group>
        </group>
      </Part>
    </group>
  );
}

/* ── 베란다: 바닥 타일 · 창문 벽 · 화분대 ── */

function Veranda() {
  const { w, d } = PLANT_ROOM;
  const frame = toon("#ffffff"), sky = toonOwn({ color: "#bfe3ff", roughness: 0.2 });
  return (
    <group>
      <Box size={[w, 4, d]} at={[0, 2, 0]} mat={toon(TILE)} />
      <HideFromBehind frontZ={-d / 2 + 8}>
        <Box size={[w, 176, 8]} at={[0, 88, -d / 2 + 4]} mat={toon(WALL)} />
      </HideFromBehind>
      {/* 창문 */}
      <Box size={[150, 82, 2]} at={[-20, 128, -d / 2 + 8.6]} mat={sky} cast={false} />
      <Box size={[156, 5, 6]} at={[-20, 169, -d / 2 + 10]} mat={frame} />
      <Box size={[160, 5, 12]} at={[-20, 86, -d / 2 + 12]} mat={frame} />
      {[-98, -20, 58].map((x) => <Box key={x} size={[5, 82, 6]} at={[x, 128, -d / 2 + 10]} mat={frame} />)}
      {/* 화분대 (나무 선반) */}
      <Box size={[210, 6, 120]} at={[0, TOP - 3, -6]} mat={toon(WOOD)} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => <Box key={`${a}${b}`} size={[7, TOP - 6, 7]} at={[a * 96, (TOP - 6) / 2 + 2, -6 + b * 52]} mat={toon(WOOD_DARK)} />)}
      <Box size={[196, 4, 108]} at={[0, 14, -6]} mat={toon(WOOD_DARK)} />
    </group>
  );
}

/** 보드 상자에서 센서 · 펌프로 가는 선 (보기 좋게 화분대 위로 늘어뜨린다) */
function Wires() {
  const red = toon("#e03131"), blk = toon("#343a40"), yel = toon("#f59f00");
  const box = new THREE.Vector3(-2 - 22, TOP + 6, 38 - 14);
  const soil = new THREE.Vector3(POT_X - 15, SOIL_Y + 33, POT_Z + 15);
  const sens = new THREE.Vector3(TANK_X + 14, TOP + TANK.h + 8, TANK_Z + TANK.d / 2 - 4);
  const relay = new THREE.Vector3(-2 + 46, TOP + 8, 38 - 14);
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  return (
    <group>
      <Tube points={[box, v(box.x - 10, TOP + 2, box.z - 2), v(POT_X - 10, TOP + 2, POT_Z + 36), v(POT_X - 22, TOP + 30, POT_Z + 30), soil]} radius={1.1} mat={yel} />
      <Tube points={[v(-2 + 22, TOP + 6, 38 - 14), v(30, TOP + 2, 10), v(TANK_X + 24, TOP + 2, TANK_Z + TANK.d / 2 + 6), v(TANK_X + 20, TOP + TANK.h + 4, TANK_Z + TANK.d / 2 + 2), sens]} radius={1.1} mat={blk} />
      <Tube points={[relay, v(relay.x + 4, TOP + 2, relay.z - 8), v(TANK_X - 4, TOP + 2, TANK_Z + TANK.d / 2 + 4), v(TANK_X - 10, TOP + TANK.h + 6, TANK_Z + 6), v(TANK_X - 10, TOP + 18, TANK_Z + 2)]} radius={1.1} mat={red} />
    </group>
  );
}

export function SmartPlant() {
  return (
    <group>
      <Veranda />
      <PotPlant />
      <TankPump />
      <Controller />
      <Wires />
      <Sun />
      <Sign w={60} h={14} at={[96, 150, -PLANT_ROOM.d / 2 + 9]} paint={(g, cw, ch) => { g.fillStyle = "#ebfbee"; g.fillRect(0, 0, cw, ch); g.fillStyle = "#2b8a3e"; g.font = `700 ${Math.round(ch * 0.58)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("스마트 화분", cw / 2, ch / 2 + 1); }} />
    </group>
  );
}
