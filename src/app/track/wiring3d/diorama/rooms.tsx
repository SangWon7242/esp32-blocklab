import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Ball, Box, Cyl } from "../kit";
import { glowTexture, noOutline, toon, toonOwn } from "../materials";
import { useViewerApi } from "../store";
import { buzzing, deviceKind, ease, pinLevel, rgbOf, servoAngle } from "./common";
import { LiveOled, Plant, Sign } from "./pieces";

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

/** 방 한 귀퉁이: 바닥 · 뒷벽 */
function Corner({ w, d, h = 160 }: { w: number; d: number; h?: number }) {
  return (
    <group>
      <Box size={[w, 4, d]} at={[0, 2, 0]} mat={toon(FLOOR)} />
      <Box size={[w, h, 8]} at={[0, h / 2, -d / 2 + 4]} mat={toon(WALL)} />
      <Box size={[w, 8, 10]} at={[0, 8, -d / 2 + 6]} mat={toon("#ced4da")} />
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
      {/* 침대 끝 · 베개 */}
      <Box size={[110, 30, 80]} at={[60, 19, 40]} mat={toon("#748ffc")} />
      <Box size={[50, 10, 30]} at={[60, 38, 10]} mat={toon("#f8f9fa")} />
      <Plant at={[-80, 4, 40]} s={1.2} />
    </group>
  );
}

/* ── 31장 안전 선풍기 ── */
export const FAN_ROOM = { w: 220, d: 200 };
export function DeskFan() {
  const api = useViewerApi();
  const blades = useRef<THREE.Group>(null);
  const speed = useRef(0);
  useFrame((_, dt) => {
    const s = api.getState();
    const d = deviceKind(s, "fan");
    const goal = d ? pinLevel(s, d.inP) - pinLevel(s, d.inM) : 0;
    speed.current = ease(speed.current, goal, dt, 2.5);
    if (blades.current) blades.current.rotation.z += speed.current * dt * 24;
    if (Math.abs(speed.current) > 0.002) s.invalidate();
  });
  const guard = toon("#dee2e6");
  return (
    <group>
      <Corner w={220} d={200} />
      <Desk w={170} d={110} top={58} />
      {/* 선풍기: 받침 · 목 · 모터 · 날개 · 망 */}
      <group position={[-20, 58, -10]}>
        <Cyl r={24} r2={20} h={8} at={[0, 4, 0]} mat={toon("#f1f3f5")} seg={28} />
        <Cyl r={4} h={50} at={[0, 32, 0]} mat={toon("#ced4da")} seg={12} />
        <Box size={[18, 18, 26]} at={[0, 64, -8]} mat={toon("#f1f3f5")} />
        <group position={[0, 64, 10]}>
          <group ref={blades}>
            <Cyl r={6} h={6} at={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} mat={toon("#74c0fc")} seg={14} />
            {[0, 1, 2, 3].map((k) => (
              <group key={k} rotation={[0, 0, (k * Math.PI) / 2]}>
                <mesh position={[0, 15, 0]} rotation={[0, 0.5, 0]} scale={[0.75, 1.4, 0.12]} material={toon("#74c0fc")} castShadow><sphereGeometry args={[10, 16, 10]} /></mesh>
              </group>
            ))}
          </group>
          {/* 안전망 */}
          <mesh rotation={[0, 0, 0]} position={[0, 0, 5]} material={guard}><torusGeometry args={[32, 1.4, 8, 40]} /></mesh>
          {[0, 1, 2, 3, 4, 5].map((k) => <Box key={k} size={[1.4, 64, 1.4]} at={[0, 0, 5]} rot={[0, 0, (k * Math.PI) / 6]} mat={guard} cast={false} />)}
        </group>
        {/* 버튼 둘 (A · B) */}
        {[-8, 8].map((x, k) => <Cyl key={x} r={3.4} h={3} at={[x, 9, 18]} mat={toon(k ? "#228be6" : "#fa5252")} seg={12} />)}
      </group>
      <Sign w={60} h={14} at={[60, 120, -95.5]} paint={(g, cw, ch) => { g.fillStyle = "#fff3bf"; g.fillRect(0, 0, cw, ch); g.fillStyle = "#e8590c"; g.font = `700 ${Math.round(ch * 0.6)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("손이 가까우면 멈춰요", cw / 2, ch / 2 + 1); }} />
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
      <Sign w={56} h={14} at={[0, 125, -95.5]} paint={(g, cw, ch) => { g.fillStyle = "#e7f5ff"; g.fillRect(0, 0, cw, ch); g.fillStyle = "#1864ab"; g.font = `700 ${Math.round(ch * 0.62)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("3번에 1번 성공!", cw / 2, ch / 2 + 1); }} />
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
      <Box size={[130, 60, 4]} at={[-30, 100, -94]} mat={toon("#2f5d50")} />
      <Box size={[136, 4, 8]} at={[-30, 68, -92]} mat={toon("#b08a5b")} />
      <Box size={[40, 18, 3]} at={[80, 140, -94.5]} mat={toon("#2b8a3e")} />
      <Sign w={38} h={16} at={[80, 140, -92.8]} paint={(g, cw, ch) => { g.fillStyle = "#2b8a3e"; g.fillRect(0, 0, cw, ch); g.fillStyle = "#fff"; g.font = `700 ${Math.round(ch * 0.6)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("비상구", cw / 2, ch / 2 + 1); }} />
      <group position={[80, 100, -88]}>
        <Box size={[18, 6, 12]} at={[0, -3, 0]} mat={toon("#495057")} />
        <group ref={spin}>
          <Cyl r={8} h={14} at={[0, 7, 0]} mat={beacon} seg={20} />
        </group>
        <sprite material={halo} position={[0, 8, 6]} scale={[90, 90, 1]} raycast={() => null} />
      </group>
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
      <Box size={[80, 60, 3]} at={[-60, 110, -94.5]} mat={toon("#a5d8ff")} />
      <Box size={[84, 4, 6]} at={[-60, 78, -92]} mat={toon("#868e96")} />
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
export const CHICK_ROOM = { w: 220, d: 200 };
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
      {/* 모이통 · 물통 */}
      <Cyl r={12} h={6} at={[50, 7, -40]} mat={toon("#adb5bd")} seg={20} />
      <Cyl r={10} h={4} at={[50, 10, -40]} mat={toon("#e9c46a")} seg={20} />
      {/* 병아리 */}
      <group ref={chick} position={[20, 4, 20]}>
        <Ball r={14} at={[0, 14, 0]} mat={yellow} />
        <Ball r={10} at={[0, 32, 6]} mat={yellow} />
        <mesh position={[0, 31, 16]} rotation={[Math.PI / 2, 0, 0]} material={toon("#f76707")}><coneGeometry args={[3, 7, 8]} /></mesh>
        {[-4, 4].map((x) => <Ball key={x} r={1.6} at={[x, 35, 14.5]} mat={toon("#212529", { outline: false })} />)}
        {[-5, 5].map((x) => <Cyl key={x} r={1.2} h={6} at={[x, 2, 2]} mat={toon("#f76707")} seg={6} />)}
      </group>
    </group>
  );
}

/* ── 36 · 41 · 42장 손에 드는 게임기 ── */
export const CONSOLE_ROOM = { w: 200, d: 170 };
export function GameConsole({ pads }: { pads: "touch" | "buttons" }) {
  return (
    <group>
      <Corner w={200} d={170} h={120} />
      <Desk w={170} d={110} top={46} />
      <group position={[0, 46, 0]} rotation={[-0.5, 0, 0]}>
        <Box size={[120, 10, 74]} at={[0, 5, 0]} mat={toon("#5f3dc4")} />
        <LiveOled w={58} h={30} at={[0, 10.4, -10]} rotY={0} />
        {pads === "buttons"
          ? [[-40, "#fa5252"], [40, "#228be6"]].map(([x, c]) => <Cyl key={x as number} r={7} h={5} at={[x as number, 12, 16]} mat={toon(c as string)} seg={16} />)
          : [-26, 0, 26].map((x, k) => <Box key={x} size={[18, 2, 14]} at={[x, 11, 22]} mat={toon(["#ced4da", "#adb5bd", "#dee2e6"][k])} />)}
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
      <Box size={[150, 90, 6]} at={[0, 100, -85]} mat={toon("#c99d66")} />
      <Box size={[140, 80, 2]} at={[0, 100, -81.6]} mat={toon("#e6c9a0")} />
      <LiveOled w={70} h={36} at={[-20, 104, -80]} />
      {[["#ffd8a8", 40, 120], ["#c3fae8", 44, 86], ["#ffc9c9", -60, 78]].map(([c, x, y], k) => <Box key={k} size={[22, 22, 1]} at={[x as number, y as number, -80.2]} mat={toon(c as string)} cast={false} />)}
      {[-50, 30].map((x) => <group key={x} position={[x, 0, 30]}><Desk w={60} d={40} top={40} /></group>)}
    </group>
  );
}

/* ── 32장 스마트 지팡이 ── */
export const CANE_ROOM = { w: 200, d: 180 };
export function SmartCane() {
  const api = useViewerApi();
  const tip = useMemo(() => toonOwn({ color: "#ffe3e3", emissive: "#ff6b6b", emissiveIntensity: 0 }), []);
  useEffect(() => () => tip.dispose(), [tip]);
  useFrame(() => {
    const s = api.getState();
    const led = deviceKind(s, "led");
    tip.emissiveIntensity = (pinLevel(s, led?.pin) + (buzzing(s) ? 0.6 : 0)) * 1.8;
    if (s.running) s.invalidate();
  });
  return (
    <group>
      {/* 점자 블록이 깔린 보도 */}
      <Box size={[200, 6, 180]} at={[0, 3, 0]} mat={toon("#d8d1c5")} />
      <Box size={[40, 1.4, 180]} at={[-30, 6.7, 0]} mat={toon("#fcc419")} />
      {Array.from({ length: 8 }, (_, k) => <Box key={k} size={[30, 1, 2]} at={[-30, 7.6, -80 + k * 22]} mat={toon("#f59f00", { outline: false })} cast={false} />)}
      {/* 지팡이: 손잡이 · 흰 막대 · 아래의 센서 상자 · 끝의 경고등 */}
      <group position={[30, 6, 10]} rotation={[0.18, 0, 0.12]}>
        <Cyl r={2.4} h={150} at={[0, 75, 0]} mat={toon("#f8f9fa")} seg={12} />
        <Cyl r={2.5} h={30} at={[0, 40, 0]} mat={toon("#e03131")} seg={12} />
        <mesh position={[0, 152, 6]} rotation={[Math.PI / 2, 0, 0]} material={toon("#212529")}><torusGeometry args={[7, 2.4, 8, 16, Math.PI]} /></mesh>
        <Box size={[14, 18, 12]} at={[0, 46, 7]} mat={toon("#1c5fa8")} />
        <Ball r={3.4} at={[0, 4, 0]} mat={tip} />
      </group>
      <Sign w={70} h={14} at={[50, 18, 70]} rotY={0} paint={(g, cw, ch) => { g.fillStyle = "#f1f3f5"; g.fillRect(0, 0, cw, ch); g.fillStyle = "#495057"; g.font = `700 ${Math.round(ch * 0.58)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("앞의 벽을 끌어 보세요", cw / 2, ch / 2 + 1); }} />
    </group>
  );
}
