import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Ball, Box, Cyl } from "../kit";
import { glowTexture, noOutline, toon, toonOwn } from "../materials";
import { useViewerApi } from "../store";
import { deviceKind, ease, pinLevel, servoAngle } from "./common";
import { LiveOled, Paving, Plant, Sign } from "./pieces";
import { CardPair, Slider } from "./controls";
import { PersonFigure } from "../figures";

/*
 * 출입구 현장 모형 (8 · 9 · 10장): 건물 앞면 · 문틀 · 경첩으로 도는 문.
 *   card — 문 옆 벽에 카드 리더기와 초록 등 (8장: 26번 LED 가 켜지면 등도 켜진다)
 *   oled — 카드 리더기와 안내 화면 (9장: OLED 글자를 그대로 보여 준다)
 *   auto — 문 위에 초음파 센서 (10장: 사람이 다가오면 열린다)
 * 문은 서보 각도를 따른다: 0도 닫힘 → 180도 활짝(안쪽으로 약 85도).
 */

export const ENTRANCE_ROOM = { w: 300, d: 250 };

const WALL = "#efe4d2", TRIM = "#8a7f72", FRAME = "#4b5563", DOOR = "#c7d2de", GLASS = "#a5d8ff";

export function Entrance({ mode }: { mode: "card" | "oled" | "auto" }) {
  const api = useViewerApi();
  const door = useRef<THREE.Group>(null);
  const open = useRef(0);
  const lamp = useMemo(() => toonOwn({ color: "#b2f2bb", emissive: "#40c057", emissiveIntensity: 0 }), []);
  const halo = useMemo(() => noOutline(new THREE.SpriteMaterial({ map: glowTexture(), color: "#69db7c", transparent: true, depthWrite: false, opacity: 0 })), []);
  useEffect(() => () => { lamp.dispose(); halo.dispose(); }, [lamp, halo]);
  useFrame((_, dt) => {
    const s = api.getState();
    const goal = (servoAngle(s, 0) / 180) * 1.48;
    const before = open.current;
    open.current = ease(open.current, goal, dt, 4);
    if (door.current) door.current.rotation.y = open.current;
    // 8장: 26번 LED (장면의 LED) 가 켜지면 문 옆 등도 켜진다
    const led = deviceKind(s, "led");
    const on = mode === "card" ? pinLevel(s, led?.pin) : 0;
    lamp.emissiveIntensity = on * 1.6;
    halo.opacity = on * 0.9;
    if (Math.abs(open.current - before) > 1e-4) s.invalidate();
  });

  const wallZ = -60, H = 150, gapW = 92;
  const side = (150 - gapW / 2);
  return (
    <group>
      <Paving w={300} d={250} />
      {/* 건물 앞면: 문 양쪽 벽 · 문 위 벽 · 바닥 띠 · 처마 */}
      {[-1, 1].map((k) => (
        <group key={k}>
          <Box size={[side, H, 18]} at={[k * (gapW / 2 + side / 2), 6 + H / 2, wallZ - 9]} mat={toon(WALL)} />
          <Box size={[side, 12, 20]} at={[k * (gapW / 2 + side / 2), 12, wallZ - 9]} mat={toon(TRIM)} />
          {/* 창문 */}
          <Box size={[52, 46, 2]} at={[k * 100, 92, wallZ + 0.6]} mat={toon(GLASS)} />
          <Box size={[56, 4, 4]} at={[k * 100, 67, wallZ + 1.5]} mat={toon(FRAME)} />
          <Box size={[2.4, 46, 2.6]} at={[k * 100, 92, wallZ + 1.4]} mat={toon(FRAME)} />
        </group>
      ))}
      <Box size={[gapW, H - 128, 18]} at={[0, 6 + 128 + (H - 128) / 2, wallZ - 9]} mat={toon(WALL)} />
      <Box size={[310, 8, 34]} at={[0, 6 + H + 4, wallZ - 6]} mat={toon("#6b7280")} />
      {/* 문틀 */}
      <Box size={[gapW + 8, 6, 22]} at={[0, 6 + 128 + 3, wallZ - 9]} mat={toon(FRAME)} />
      {[-1, 1].map((k) => <Box key={k} size={[5, 128, 22]} at={[k * (gapW / 2 + 1.5), 6 + 64, wallZ - 9]} mat={toon(FRAME)} />)}
      {/* 문: 왼쪽 경첩을 축으로 돈다 (안쪽으로 열린다) */}
      <group ref={door} position={[-gapW / 2 + 1, 6, wallZ - 4]}>
        <Box size={[gapW - 4, 124, 5]} at={[(gapW - 4) / 2, 63, 0]} mat={toon(DOOR)} />
        <Box size={[gapW - 22, 70, 5.6]} at={[(gapW - 4) / 2, 78, 0]} mat={toon(GLASS)} />
        <Cyl r={2.2} h={20} at={[gapW - 14, 60, 4.5]} mat={toon("#adb5bd")} seg={10} />
      </group>
      {/* 문 앞 발판 */}
      <Box size={[84, 1.6, 36]} at={[0, 6.8, wallZ + 22]} mat={toon("#4b5563", { outline: false })} cast={false} />
      {/* 간판 */}
      <Box size={[96, 20, 3]} at={[mode === "auto" ? 100 : 0, mode === "auto" ? 132 : 6 + H - 6, wallZ + 2]} mat={toon("#1f2937")} />
      <Sign w={90} h={15} at={[mode === "auto" ? 100 : 0, mode === "auto" ? 132 : 6 + H - 6, wallZ + 4.1]} paint={(g, cw, ch) => {
        g.fillStyle = "#1f2937"; g.fillRect(0, 0, cw, ch);
        g.fillStyle = "#ffffff"; g.font = `700 ${Math.round(ch * 0.62)}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(mode === "auto" ? "자동문" : "출입 통제 구역", cw / 2, ch / 2 + 1);
      }} />

      {mode !== "auto" && (
        <>
          {/* 카드 리더기: 문 오른쪽 벽 */}
          <Box size={[22, 30, 5]} at={[gapW / 2 + 22, 72, wallZ + 2.5]} mat={toon("#111827")} />
          <Sign w={18} h={18} at={[gapW / 2 + 22, 75, wallZ + 5.6]} px={128} paint={(g, cw, ch) => {
            g.fillStyle = "#111827"; g.fillRect(0, 0, cw, ch);
            g.strokeStyle = "#74c0fc"; g.lineWidth = 6;
            for (const r of [14, 28, 42]) { g.beginPath(); g.arc(cw * 0.3, ch * 0.7, r, -Math.PI / 2, 0); g.stroke(); }
          }} />
          <Box size={[16, 3, 2]} at={[gapW / 2 + 22, 62, wallZ + 5.3]} mat={toon("#2f9e44", { outline: false })} cast={false} />
        </>
      )}
      {mode === "card" && (
        <>
          {/* 문이 열리면 켜지는 초록 등 (회로의 LED 와 같은 핀) */}
          <Box size={[16, 8, 6]} at={[0, 6 + 128 + 12, wallZ + 2]} mat={toon("#374151")} />
          <Ball r={6} at={[0, 6 + 128 + 9, wallZ + 6]} mat={lamp} />
          <sprite material={halo} position={[0, 6 + 128 + 9, wallZ + 10]} scale={[40, 40, 1]} raycast={() => null} />
        </>
      )}
      {/* 안내 화면: 창문(아래 끝 65) 밑에 — 창틀과 겹치지 않게 */}
      {mode === "oled" && <LiveOled w={44} h={22} at={[gapW / 2 + 70, 46, wallZ + 3]} />}
      {mode === "auto" && (
        <>
          {/* 문 위 초음파 센서: 사람이 오는 쪽(앞)을 본다 */}
          <Box size={[44, 18, 6]} at={[0, 6 + 128 + 13, wallZ + 3]} mat={toon("#1c5fa8")} />
          {[-11, 11].map((x) => (
            <group key={x}>
              <Cyl r={7} h={7} at={[x, 6 + 128 + 13, wallZ + 9]} rot={[Math.PI / 2, 0, 0]} mat={toon("#d9dde3")} seg={18} />
              <Cyl r={4} h={1} at={[x, 6 + 128 + 13, wallZ + 12.8]} rot={[Math.PI / 2, 0, 0]} mat={toon("#495057", { outline: false })} seg={14} />
            </group>
          ))}
        </>
      )}
      {/* 조작: 카드를 리더기에 대기 (8 · 9장) · 사람이 문으로 걸어오기 (10장) */}
      {mode !== "auto" && <CardPair reader={[gapW / 2 + 22, 72, wallZ + 8]} homes={[[40, 7, 70], [80, 7, 70]]} />}
      {mode === "auto" && (
        <group position={[-8, 6, 0]}>
          <Slider sensor={wallZ + 12 + 12} start={95} min={wallZ + 12 + 12 + 6} max={118} label="사람" text="문 쪽으로 끌어 보세요. 15cm 안에 오면 문 위 센서가 알아채고 문이 열려요." tagY={132}>
            <group rotation={[0, Math.PI, 0]}><PersonFigure /></group>
          </Slider>
        </group>
      )}
      <Plant at={[-128, 6, wallZ + 20]} />
      <Plant at={[128, 6, wallZ + 20]} s={0.9} />
    </group>
  );
}
