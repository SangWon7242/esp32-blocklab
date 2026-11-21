import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Ball, Box, Cyl } from "../kit";
import { glowTexture, noOutline, toon, toonOwn } from "../materials";
import { useViewerApi } from "../store";
import { buzzing, deviceKind, ease, pinLevel, rgbOf, servoAngle } from "./common";
import { HideFromBehind, LiveOled, Plant, Sign } from "./pieces";
import { Clap, CoverToggle, KnobDial, Lighter, PressPad, Slider, TiltToggle, Walker } from "./controls";
import { HandFigure, PersonFigure } from "../figures";

/* 방 · 책상 위 현장 모형: 무드등 · 선풍기 · 뿅망치 · 재난 알리미 · 교실 기후 · 병아리 집 · 게임기 · 지팡이 */

const DESK = "#d6b48a", DESK_SIDE = "#b48a5f", WALL = "#eef1f4", FLOOR = "#cdb79a";

/** 책상 (위가 y=top) */
function Desk({ w, d, top = 60 }: { w: number; d: number; top?: number }) {
  return (
    <group>
      <Box size={[w, 6, d]} at={[0, top - 3, 0]} mat={toon(DESK)} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => <Box key={`${a}${b}`} size={[6, top - 6, 6]} at={[a * (w / 2 - 8), (top - 6) / 2, b * (d / 2 - 8)]} mat={toon(DESK_SIDE)} />)}
    </group>
  );
}

/**
 * 방 한 귀퉁이: 바닥 · 뒷벽. 뒷벽 앞면은 z = -d / 2 + 8 (wallFront).
 * 벽에 거는 것(칠판 · 표지 · 창문 · 게시판)은 앞면이 벽 앞면보다 0.5 이상 앞에 와야 한다 —
 * 같은 면이면 돌릴 때마다 깜빡이고(z-fighting), 뒤면 벽에 묻혀 안 보인다.
 */
export const wallFront = (d: number) => -d / 2 + 8;
function Corner({ w, d, h = 160 }: { w: number; d: number; h?: number }) {
  return (
    <group>
      <Box size={[w, 4, d]} at={[0, 2, 0]} mat={toon(FLOOR)} />
      {/* 뒤로 돌려 보면 벽을 감춰 벽에 건 칠판 · 게시판이 가려지지 않게 */}
      <HideFromBehind frontZ={wallFront(d)}>
        <Box size={[w, h, 8]} at={[0, h / 2, -d / 2 + 4]} mat={toon(WALL)} />
        <Box size={[w, 8, 10]} at={[0, 8, -d / 2 + 6]} mat={toon("#ced4da")} />
      </HideFromBehind>
    </group>
  );
}

/** 초음파 센서 (파란 판 · 은색 눈 둘). 앞이 +z */
function SonarBox({ at, rotY = 0 }: { at: [number, number, number]; rotY?: number }) {
  return (
    <group position={at} rotation={[0, rotY, 0]}>
      <Box size={[42, 18, 3]} at={[0, 0, 0]} mat={toon("#1c5fa8")} />
      {[-11, 11].map((x) => (
        <group key={x}>
          <Cyl r={7} h={7} at={[x, 0, 4]} rot={[Math.PI / 2, 0, 0]} mat={toon("#d9dde3")} seg={18} />
          <Cyl r={4} h={1} at={[x, 0, 7.8]} rot={[Math.PI / 2, 0, 0]} mat={toon("#495057", { outline: false })} seg={14} />
        </group>
      ))}
    </group>
  );
}

/** 빛 번짐 스프라이트 재질 */
function useHaloMat(color: string) {
  const m = useMemo(() => noOutline(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, opacity: 0 })), [color]);
  useEffect(() => () => m.dispose(), [m]);
  return m;
}

/* ── 37장 무드등 ── */
export const MOOD_ROOM = { w: 220, d: 200 };
export function MoodLamp() {
  const api = useViewerApi();
  const shade = useMemo(() => toonOwn({ color: "#f8f9fa", transparent: true, opacity: 0.92, emissive: "#ffffff", emissiveIntensity: 0.05 }), []);
  const halo = useHaloMat("#ffffff");
  useEffect(() => () => shade.dispose(), [shade]);
  useFrame(() => {
    const s = api.getState();
    const [r, g, b] = rgbOf(s);
    const lit = Math.max(r, g, b);
    const c = new THREE.Color(r, g, b);
    shade.emissive.copy(lit > 0.01 ? c : new THREE.Color("#ffffff"));
    shade.emissiveIntensity = lit > 0.01 ? 0.4 + 1.4 * lit : 0.05;
    halo.color.copy(c);
    halo.opacity = lit * 0.9;
    if (s.running) s.invalidate();
  });
  return (
    <group>
      <Corner w={220} d={200} />
      {/* 침대 머리맡 탁자 · 무드등 */}
      <Box size={[90, 56, 60]} at={[-10, 32, -40]} mat={toon("#a47148")} />
      <Box size={[70, 3, 2]} at={[-10, 40, -9.5]} mat={toon("#7c5232")} />
      <Cyl r={16} r2={12} h={8} at={[-10, 64, -40]} mat={toon("#e9ecef")} seg={24} />
      <Ball r={26} at={[-10, 68, -40]} mat={shade} half />
      <sprite material={halo} position={[-10, 84, -40]} scale={[150, 150, 1]} raycast={() => null} />
      <KnobDial pin={39} at={[-30, 60, -18]} label="색 손잡이 (가변저항)" />
      <PressPad pin={14} at={[12, 60, -18]} label="모드 버튼" color="#ae3ec9" size={7} />
      {/* 침대 끝 · 베개 */}
      <Box size={[110, 30, 80]} at={[60, 19, 40]} mat={toon("#748ffc")} />
      <Box size={[50, 10, 30]} at={[60, 38, 10]} mat={toon("#f8f9fa")} />
      <Plant at={[-80, 4, 40]} s={1.2} />
    </group>
  );
}

/* ── 31장 안전 선풍기: 선풍기 안전망 아래에 초음파 센서, 받침에 A · B 버튼과 단계 LED 셋 ── */
export const FAN_ROOM = { w: 240, d: 220 };

/** 핀이 켜지면 빛나는 작은 등 */
function PinLamp({ pin, at, color }: { pin: number; at: [number, number, number]; color: string }) {
  const api = useViewerApi();
  const m = useMemo(() => toonOwn({ color: "#f1f3f5", emissive: color, emissiveIntensity: 0 }), [color]);
  useEffect(() => () => m.dispose(), [m]);
  useFrame(() => { m.emissiveIntensity = pinLevel(api.getState(), pin) * 2.4; });
  return <Ball r={2.6} at={at} mat={m} />;
}

export function DeskFan() {
  const api = useViewerApi();
  const blades = useRef<THREE.Group>(null);
  const speed = useRef(0);
  const pings = useRef<THREE.Group>(null);
  const clock = useRef(0);
  const ping = useMemo(() => noOutline(new THREE.MeshBasicMaterial({ color: "#2f9e44", transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })), []);
  useEffect(() => () => ping.dispose(), [ping]);
  useFrame((_, dt) => {
    const s = api.getState();
    const d = deviceKind(s, "fan");
    const goal = d ? pinLevel(s, d.inP) - pinLevel(s, d.inM) : 0;
    speed.current = ease(speed.current, goal, dt, 2.5);
    if (blades.current) blades.current.rotation.z += speed.current * dt * 24;
    clock.current += dt;
    pings.current?.children.forEach((m, k) => {
      const ph = (clock.current * 1.4 + k / 3) % 1;
      m.visible = s.running;
      m.position.z = ph * 40;
      m.scale.setScalar(4 + ph * 8);
    });
    if (s.running || Math.abs(speed.current) > 0.002) s.invalidate();
  });
  const guard = toon("#dee2e6", { metal: 0.6, rough: 0.35 });
  const FX = -10, TOP = 58;
  // 센서 앞면 z (모형 좌표) · 손 끝이 손 자리보다 앞(−z)으로 나온 길이
  const SENSOR_Z = 22, TIP = 8;
  return (
    <group>
      <Corner w={240} d={220} />
      <Desk w={180} d={150} top={TOP} />
      <group position={[FX, TOP, -20]}>
        {/* 받침 · 목 · 모터 */}
        <Box size={[70, 10, 46]} at={[0, 5, 6]} mat={toon("#f1f3f5")} />
        <Cyl r={4} h={46} at={[0, 32, 0]} mat={toon("#ced4da", { metal: 0.6, rough: 0.35 })} seg={12} />
        <Box size={[20, 20, 28]} at={[0, 62, -8]} mat={toon("#f1f3f5")} />
        {/* 날개 · 안전망 */}
        <group position={[0, 62, 12]}>
          <group ref={blades}>
            <Cyl r={6} h={6} at={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} mat={toon("#74c0fc")} seg={14} />
            {[0, 1, 2, 3].map((k) => (
              <group key={k} rotation={[0, 0, (k * Math.PI) / 2]}>
                <mesh position={[0, 15, 0]} rotation={[0, 0.5, 0]} scale={[0.75, 1.4, 0.12]} material={toon("#74c0fc")} castShadow><sphereGeometry args={[10, 16, 10]} /></mesh>
              </group>
            ))}
          </group>
          <mesh position={[0, 0, 5]} material={guard}><torusGeometry args={[32, 1.4, 8, 40]} /></mesh>
          <mesh position={[0, 0, -4]} material={guard}><torusGeometry args={[32, 1.4, 8, 40]} /></mesh>
          {[0, 1, 2, 3, 4, 5].map((k) => <Box key={k} size={[1.2, 64, 1.2]} at={[0, 0, 5]} rot={[0, 0, (k * Math.PI) / 6]} mat={guard} cast={false} />)}
        </group>
        {/* 초음파 센서: 안전망 바로 아래, 앞(+z)을 본다 */}
        <group position={[0, 24, SENSOR_Z + 20 - 6]}>
          <Box size={[42, 18, 3]} at={[0, 0, 0]} mat={toon("#1c5fa8")} />
          {[-11, 11].map((x) => (
            <group key={x}>
              <Cyl r={7} h={7} at={[x, 0, 4]} rot={[Math.PI / 2, 0, 0]} mat={toon("#d9dde3")} seg={18} />
              <Cyl r={4} h={1} at={[x, 0, 7.8]} rot={[Math.PI / 2, 0, 0]} mat={toon("#495057", { outline: false })} seg={14} />
            </group>
          ))}
          <group ref={pings} position={[0, 0, 8]}>
            {[0, 1, 2].map((k) => <mesh key={k} material={ping} visible={false} raycast={() => null}><ringGeometry args={[0.85, 1, 32]} /></mesh>)}
          </group>
        </group>
        {/* 받침의 A · B 버튼 · 단계 LED 셋 */}
        <PressPad pin={14} at={[25, 10, -8]} label="A 버튼 (켜기 · 끄기)" color="#fa5252" size={7} />
        <PressPad pin={27} at={[25, 10, 8]} label="B 버튼 (세기)" color="#228be6" size={7} />
        {[[25, "#ffd43b"], [26, "#ffa94d"], [33, "#ff6b6b"]].map(([pin, c], k) => <PinLamp key={pin as number} pin={pin as number} at={[-27, 11, -8 + k * 8]} color={c as string} />)}
      </group>
      {/* 손: 선풍기 앞에서 센서 쪽으로 끌어 대 본다 */}
      <group position={[FX, TOP + 24 - 38, 0]}>
        <Slider sensor={SENSOR_Z + TIP} start={110} min={SENSOR_Z + TIP + 6} max={150} label="손" text="선풍기 쪽으로 끌어 보세요. 손이 2~8cm 안에 들어오면 날개가 멈춰요." tagY={70}>
          <group rotation={[0, Math.PI, 0]}><HandFigure /></group>
        </Slider>
      </group>
      <Sign w={70} h={14} at={[70, 120, wallFront(220) + 0.6]} paint={(g, cw, ch) => { g.fillStyle = "#fff3bf"; g.fillRect(0, 0, cw, ch); g.fillStyle = "#e8590c"; g.font = `700 ${Math.round(ch * 0.6)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("손이 가까우면 멈춰요", cw / 2, ch / 2 + 1); }} />
    </group>
  );
}

/* ── 35장 랜덤 뿅망치 ── */
export const HAMMER_ROOM = { w: 220, d: 200 };
export function HammerGame() {
  const api = useViewerApi();
  const arm = useRef<THREE.Group>(null);
  const a = useRef(Math.PI / 2);
  useFrame((_, dt) => {
    const s = api.getState();
    // 서보 180도 = 들어 올림, 90도 = 내려침(WIN), 50도 = 옆으로 빗나감(FAIL)
    const ang = servoAngle(s, 180);
    const goal = THREE.MathUtils.degToRad(ang - 90);
    const before = a.current;
    a.current = ease(a.current, goal, dt, 10);
    if (arm.current) arm.current.rotation.z = a.current;
    if (Math.abs(a.current - before) > 1e-4) s.invalidate();
  });
  return (
    <group>
      <Corner w={220} d={200} />
      <Desk w={180} d={120} top={56} />
      <group position={[0, 56, -5]}>
        {/* 게임판 · 두더지 구멍 · 가운데 표적 */}
        <Box size={[120, 10, 80]} at={[0, 5, 0]} mat={toon("#ffd43b")} />
        {[-36, 0, 36].map((x, k) => (
          <group key={x}>
            <Cyl r={11} h={1} at={[x, 10.6, 10]} mat={toon("#343a40", { outline: false })} seg={20} />
            {k === 1 && <Ball r={9} at={[x, 12, 10]} mat={toon("#a0522d")} half />}
          </group>
        ))}
        {/* 서보 받침 · 망치 (경첩은 받침 위) */}
        <Box size={[16, 46, 16]} at={[44, 33, -24]} mat={toon("#1971c2")} />
        <group ref={arm} position={[44, 54, -24]}>
          <Box size={[60, 4, 4]} at={[-30, 0, 0]} mat={toon("#f8f9fa")} />
          <Cyl r={8} h={22} at={[-60, 0, 0]} rot={[Math.PI / 2, 0, 0]} mat={toon("#fa5252")} seg={16} />
        </group>
      </group>
      {/* 게임판 앞의 초음파 센서 · 버튼 · 다가오는 손 */}
      <SonarBox at={[-30, 56 + 19, 37]} />
      <PressPad pin={14} at={[40, 56 + 10, 22]} label="버튼 (손을 대고 누르기)" color="#fa5252" size={8} />
      <group position={[-30, 56 + 19 - 38, 0]}>
        <Slider sensor={45 + 8} start={100} min={45 + 8 + 6} max={130} label="손" text="센서 쪽으로 끌어 20cm 안에 두고 빨간 버튼을 눌러 보세요." tagY={70}>
          <group rotation={[0, Math.PI, 0]}><HandFigure /></group>
        </Slider>
      </group>
      <Sign w={56} h={14} at={[0, 125, wallFront(200) + 0.6]} paint={(g, cw, ch) => { g.fillStyle = "#e7f5ff"; g.fillRect(0, 0, cw, ch); g.fillStyle = "#1864ab"; g.font = `700 ${Math.round(ch * 0.62)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("3번에 1번 성공!", cw / 2, ch / 2 + 1); }} />
    </group>
  );
}

/* ── 38장 재난 알리미 ── */
export const ALARM_ROOM = { w: 240, d: 200 };
export function AlarmRoom() {
  const api = useViewerApi();
  const beacon = useMemo(() => toonOwn({ color: "#ffc9c9", transparent: true, opacity: 0.9, emissive: "#ff3b30", emissiveIntensity: 0 }), []);
  const halo = useHaloMat("#ff6b6b");
  const spin = useRef<THREE.Group>(null);
  useEffect(() => () => beacon.dispose(), [beacon]);
  const clock = useRef(0);
  useFrame((_, dt) => {
    const s = api.getState();
    const on = buzzing(s);
    clock.current += dt;
    const blink = on ? 0.5 + 0.5 * Math.sin(clock.current * 12) : 0;
    beacon.emissiveIntensity = blink * 2.2;
    halo.opacity = blink * 0.8;
    if (spin.current && on) spin.current.rotation.y += dt * 6;
    if (on) s.invalidate();
  });
  return (
    <group>
      <Corner w={240} d={200} h={170} />
      {/* 칠판 · 비상구 표시 · 경광등 */}
      <Box size={[130, 60, 4]} at={[-30, 100, wallFront(200) + 2.5]} mat={toon("#2f5d50")} />
      <Box size={[136, 4, 8]} at={[-30, 68, wallFront(200) + 4]} mat={toon("#b08a5b")} />
      <Box size={[40, 18, 3]} at={[80, 140, wallFront(200) + 2]} mat={toon("#2b8a3e")} />
      <Sign w={38} h={16} at={[80, 140, wallFront(200) + 4]} paint={(g, cw, ch) => { g.fillStyle = "#2b8a3e"; g.fillRect(0, 0, cw, ch); g.fillStyle = "#fff"; g.font = `700 ${Math.round(ch * 0.6)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("비상구", cw / 2, ch / 2 + 1); }} />
      <group position={[80, 100, -88]}>
        <Box size={[18, 6, 12]} at={[0, -3, 0]} mat={toon("#495057")} />
        <group ref={spin}>
          <Cyl r={8} h={14} at={[0, 7, 0]} mat={beacon} seg={20} />
        </group>
        <sprite material={halo} position={[0, 8, 6]} scale={[90, 90, 1]} raycast={() => null} />
      </group>
      {/* 벽의 불꽃 센서 · 그 앞 라이터 / 흔들림 상자(기울기 스위치) / 「여기 있어요」 버튼 */}
      <Box size={[22, 14, 4]} at={[-100, 60, wallFront(200) + 2.5]} mat={toon("#1c5fa8")} />
      <Ball r={4} at={[-100, 60, wallFront(200) + 4.5]} mat={toon("#212529")} />
      <Lighter at={[-100, 4, -70]} />
      <group position={[20, 4, -60]}>
        <TiltToggle pin={14} label="흔들림 상자 (기울기 스위치)" axis="x" angle={0.6}>
          <Box size={[30, 22, 22]} at={[0, 11, 0]} mat={toon("#ffd8a8")} />
          <Box size={[10, 4, 6]} at={[0, 23, 0]} mat={toon("#343a40")} />
        </TiltToggle>
      </group>
      <PressPad pin={27} at={[-40, 40, 30]} label="여기 있어요 버튼" color="#40c057" size={8} />
      {/* 책상 둘 · 소화기 */}
      {[-60, 40].map((x) => <group key={x} position={[x, 0, 30]}><Desk w={60} d={40} top={40} /></group>)}
      <Cyl r={7} h={30} at={[105, 19, -70]} mat={toon("#e03131")} seg={16} />
      <Box size={[6, 6, 8]} at={[105, 37, -70]} mat={toon("#212529")} />
    </group>
  );
}

/* ── 33장 교실 온습도 알리미 ── */
export const CLIMATE_ROOM = { w: 240, d: 200 };
export function ClimateRoom() {
  const api = useViewerApi();
  const blades = useRef<THREE.Group>(null);
  const speed = useRef(0);
  const lamp = useMemo(() => toonOwn({ color: "#f1f3f5", emissive: "#ffffff", emissiveIntensity: 0 }), []);
  useEffect(() => () => lamp.dispose(), [lamp]);
  useFrame((_, dt) => {
    const s = api.getState();
    const d = deviceKind(s, "fan");
    speed.current = ease(speed.current, d ? pinLevel(s, d.inP) - pinLevel(s, d.inM) : 0, dt, 2.5);
    if (blades.current) blades.current.rotation.z += speed.current * dt * 24;
    const [r, g, b] = rgbOf(s);
    const lit = Math.max(r, g, b);
    lamp.emissive.setRGB(r, g, b);
    lamp.emissiveIntensity = lit * 2;
    if (s.running || Math.abs(speed.current) > 0.002) s.invalidate();
  });
  return (
    <group>
      <Corner w={240} d={200} h={170} />
      {/* 창문 */}
      <Box size={[80, 60, 3]} at={[-60, 110, wallFront(200) + 2]} mat={toon("#a5d8ff")} />
      <Box size={[84, 4, 6]} at={[-60, 78, wallFront(200) + 3]} mat={toon("#868e96")} />
      {/* 벽걸이 선풍기 */}
      <group position={[70, 130, -84]}>
        <Box size={[16, 16, 12]} at={[0, 0, -2]} mat={toon("#f1f3f5")} />
        <group ref={blades} position={[0, 0, 8]}>
          {[0, 1, 2].map((k) => (
            <group key={k} rotation={[0, 0, (k * Math.PI * 2) / 3]}>
              <mesh position={[0, 13, 0]} scale={[0.7, 1.3, 0.12]} material={toon("#74c0fc")}><sphereGeometry args={[9, 14, 8]} /></mesh>
            </group>
          ))}
        </group>
        <mesh position={[0, 0, 11]} material={toon("#dee2e6")}><torusGeometry args={[26, 1.2, 8, 36]} /></mesh>
      </group>
      {/* 벽의 안내 화면 (OLED) · 상태 등 (RGB) */}
      <LiveOled w={56} h={28} at={[0, 104, -90]} />
      <Box size={[12, 12, 6]} at={[40, 104, -90]} mat={toon("#343a40")} />
      <Ball r={5} at={[40, 104, -86]} mat={lamp} />
      {[-70, 0, 70].map((x) => <group key={x} position={[x, 0, 40]}><Desk w={56} d={36} top={38} /></group>)}
    </group>
  );
}

/* ── 43장 병아리 집 ── */
export const CHICK_ROOM = { w: 300, d: 200 };
export function ChickPen() {
  const api = useViewerApi();
  const chick = useRef<THREE.Group>(null);
  const clock = useRef(0);
  useFrame((_, dt) => {
    const s = api.getState();
    clock.current += dt;
    const happy = (s.running && s.sim?.outputs.oled?.some((l) => l.includes("^_^"))) ?? false;
    if (chick.current) chick.current.position.y = happy ? Math.abs(Math.sin(clock.current * 6)) * 6 : 0;
    if (happy) s.invalidate();
  });
  const yellow = toon("#ffd43b");
  return (
    <group>
      <Box size={[220, 4, 200]} at={[0, 2, 0]} mat={toon("#d9c49a")} />
      {/* 울타리 */}
      {[-1, 1].map((k) => <Box key={k} size={[200, 22, 4]} at={[0, 15, k * 80]} mat={toon("#b07d4f")} />)}
      {[-1, 1].map((k) => <Box key={k} size={[4, 22, 160]} at={[k * 100, 15, 0]} mat={toon("#b07d4f")} />)}
      {/* 집 · 지붕 · 화면 */}
      <Box size={[70, 50, 50]} at={[-50, 29, -40]} mat={toon("#f8f1e5")} />
      <mesh position={[-50, 66, -40]} rotation={[0, Math.PI / 4, 0]} material={toon("#e8590c")} castShadow><coneGeometry args={[52, 30, 4]} /></mesh>
      <LiveOled w={36} h={18} at={[-50, 32, -14.6]} />
      <PressPad pin={27} at={[-26, 6, -14]} label="시작 버튼" color="#40c057" size={7} />
      {/* 움직임 센서(PIR): 집 지붕 아래 흰 반구 · 다가오는 사람 */}
      <Ball r={7} at={[-50, 52, -14]} mat={toon("#f8f9fa")} half />
      <Walker center={[-20, 0, 10]} R={70} start={[150, 0, 70]}>
        <group rotation={[0, -Math.PI / 2, 0]} scale={0.8}><PersonFigure shirt="#20c997" bag={false} /></group>
      </Walker>
      {/* 모이통 · 물통 */}
      <Cyl r={12} h={6} at={[50, 7, -40]} mat={toon("#adb5bd")} seg={20} />
      <Cyl r={10} h={4} at={[50, 10, -40]} mat={toon("#e9c46a")} seg={20} />
      {/* 병아리 (누르면 흔들어 기울기 스위치) */}
      <TiltToggle pin={14} label="병아리 놀아 주기 (기울기 스위치)" angle={0.5}>
      <group ref={chick} position={[20, 4, 20]}>
        <Ball r={14} at={[0, 14, 0]} mat={yellow} />
        <Ball r={10} at={[0, 32, 6]} mat={yellow} />
        <mesh position={[0, 31, 16]} rotation={[Math.PI / 2, 0, 0]} material={toon("#f76707")}><coneGeometry args={[3, 7, 8]} /></mesh>
        {[-4, 4].map((x) => <Ball key={x} r={1.6} at={[x, 35, 14.5]} mat={toon("#212529", { outline: false })} />)}
        {[-5, 5].map((x) => <Cyl key={x} r={1.2} h={6} at={[x, 2, 2]} mat={toon("#f76707")} seg={6} />)}
      </group>
      </TiltToggle>
    </group>
  );
}

/* ── 36 · 41 · 42장 손에 드는 게임기 ── */
export const CONSOLE_ROOM = { w: 200, d: 170 };
export function GameConsole({ pads }: { pads: "touch" | "bomb" | "runner" }) {
  return (
    <group>
      <Corner w={200} d={170} h={120} />
      <Desk w={170} d={110} top={46} />
      {/* 게임기는 책상 위에 반듯하게 놓는다(기울이지 않는다) */}
      <group position={[0, 46, 0]}>
        <Box size={[120, 10, 74]} at={[0, 5, 0]} mat={toon("#5f3dc4")} />
        {/* 화면은 게임기 윗면(y 10) 위에 선다 — LiveOled 의 at 은 화면 가운데라, 틀 높이(h + 8)의 반만큼 올린다(몸통 · 책상 밑으로 박히지 않게) */}
        <LiveOled w={58} h={30} at={[0, 10 + (30 + 8) / 2, -10]} rotY={0} />
        {pads === "touch" && (
          <>
            {/* 호일 터치 패드 A(32) · B(33) · C(27) · 시작 버튼(14) */}
            {([[32, "A"], [33, "B"], [27, "C"]] as const).map(([pin, n], k) => <PressPad key={pin} kind="touch" pin={pin} flat at={[-26 + k * 26, 10, 22]} label={`터치 패드 ${n}`} color="#ced4da" size={9} />)}
            <PressPad pin={14} at={[46, 10, -18]} label="시작 버튼" color="#40c057" size={7} />
          </>
        )}
        {pads === "bomb" && [[14, -40, "#fa5252", "A 버튼 (왼쪽)"], [27, 40, "#228be6", "B 버튼 (오른쪽)"]].map(([pin, x, c, n]) => <PressPad key={pin as number} pin={pin as number} at={[x as number, 10, 16]} label={n as string} color={c as string} size={9} />)}
        {pads === "runner" && (
          <>
            <PressPad pin={14} at={[40, 10, 16]} label="점프 버튼" color="#fa5252" size={9} />
            <KnobDial pin={39} at={[-40, 10, 16]} label="빠르기 손잡이 (가변저항)" />
          </>
        )}
      </group>
    </group>
  );
}

/* ── 39장 교실 센서 상황판 ── */
export const BOARD_ROOM = { w: 220, d: 180 };
export function SensorBoard() {
  return (
    <group>
      <Corner w={220} d={180} h={170} />
      {/* 게시판 판(벽 앞) → 코르크(판 앞) → 화면 · 쪽지(코르크 앞): 앞면끼리 1 씩 떨어뜨려 깜빡이지 않게 */}
      <Box size={[150, 90, 6]} at={[0, 100, wallFront(180) + 3.5]} mat={toon("#c99d66")} />
      <Box size={[140, 80, 2]} at={[0, 100, wallFront(180) + 7.5]} mat={toon("#e6c9a0")} />
      <LiveOled w={70} h={36} at={[-20, 104, wallFront(180) + 10]} />
      {[["#ffd8a8", 40, 120], ["#c3fae8", 44, 86], ["#ffc9c9", -60, 78]].map(([c, x, y], k) => <Box key={k} size={[22, 22, 1]} at={[x as number, y as number, wallFront(180) + 8.5]} mat={toon(c as string)} cast={false} />)}
      {[-50, 30].map((x) => <group key={x} position={[x, 0, 30]}><Desk w={60} d={40} top={40} /></group>)}
      {/* 책상 위 센서들: 빛(누르면 가림) · 손잡이 · 흔들림 상자 · 소리(손뼉) · 움직임(사람) */}
      <CoverToggle pin={34} at={[-64, 40, 30]} label="빛 센서" />
      <KnobDial pin={39} at={[-38, 40, 30]} label="손잡이 (가변저항)" />
      <group position={[20, 40, 30]}>
        <TiltToggle pin={14} label="흔들림 상자 (기울기 스위치)" axis="x" angle={0.6}>
          <Box size={[18, 14, 14]} at={[0, 7, 0]} mat={toon("#ffd8a8")} />
        </TiltToggle>
      </group>
      <Clap at={[44, 40, 30]} />
      <Ball r={6} at={[80, 120, -82]} mat={toon("#f8f9fa")} half />
      <Walker center={[60, 0, 0]} R={50} start={[95, 0, 75]}>
        <group rotation={[0, Math.PI, 0]} scale={0.7}><PersonFigure bag={false} /></group>
      </Walker>
    </group>
  );
}
