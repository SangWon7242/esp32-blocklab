import { useEffect, useMemo, useRef, type RefObject } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { ChipBoard3D, ExpansionBoard3D } from "@/track/wiring3d";
import { Box, Cyl, Decal, Part, roundedBox } from "./kit";
import { Devkit38 } from "./devkit38";
import { DEVKIT_LIFT, EX_BASE, EX_FEMALE, EX_PIN, PCB_H, type Layout } from "./layout";
import { COLOR, noOutline, toon, toonOwn } from "./materials";
import { useViewerApi } from "./store";
import { expansionPinText, TEXT } from "./texts";

/*
 * 38핀 확장 보드 3D (보라 기판 "ESP32S 38P/V4/Goouuu Expansion board", 77.8 × 53.3mm) — 사진 3.png · 8.png 방향.
 *   - 가운데 노란 암 헤더: 위 두 줄(25.5mm · 24mm 폭 겸용) · 아래 한 줄. 위에 기본 보드 DevKit 38핀(devkit38.tsx 그대로)이 꽂힌다
 *   - GPIO 마다 S(노랑) · V(빨강) · G(검정) 수 헤더 기둥 (핀 끝은 기판 위 11.5mm)
 *   - 왼쪽 전원부: RPW-LED · USB-C(USB5V) · 전원 헤더 2×4 · JUMP 점퍼(기록된 자리에 노란 캡) · 다이오드 · 레귤레이터 ·
 *     47µF 콘덴서 둘 · 마이크로 USB · DC 잭 · I2C/UART 헤더 2×4
 * 핀 · 암 헤더 자리는 배선도 기록(scripts/wiring/boards/expansion.mjs)을 그대로 쓰고(선 끝이 맞게), 전원부 부품은 실물 mm 자리를
 * 그림 좌표로 옮겨 놓는다 (mmX · mmZ). 세로 늘림(암 헤더 사이를 실물 25.5mm 로)은 layout.ts 의 L.Z 가 한다.
 */

/** 실물 mm(사진 3 방향, 기판 왼쪽 위가 원점) ↔ 배선도 그림 y(보드 위 끝에서) 맞춤점: 위 S · 위 암 헤더 · 아래 암 헤더 · 아래 S · 끝 */
const Y_ANCHORS: [number, number][] = [[0, 0], [4.5, 40], [13.4, 103.6], [38.9, 209.8], [47.8, 273.4], [53.3, 314]];
/** 첫 기둥(실물 x 29mm)이 그림에서 보드 왼쪽 끝 + 200 */
const X_COL0_MM = 29, X_COL0_PX = 200;

function interp(v: number, pts: [number, number][]) {
  for (let i = 1; i < pts.length; i++) {
    const [a0, b0] = pts[i - 1], [a1, b1] = pts[i];
    if (v <= a1 || i === pts.length - 1) return b0 + ((v - a0) / (a1 - a0)) * (b1 - b0);
  }
  return pts[0][1];
}

/** 높이 (mm → 3D): 다른 부품과 어울리게 실물의 약 절반 (layout.ts 의 EX_* 와 같은 배율) */
const HM = 4;

/** 수 핀 굵기 (실물 0.64mm 보다 조금 굵게 — 멀리서도 보이게) */
const PIN_W = 3.6;
const BASE_W = 17.6;

export function ExpansionBoard({ b, L, index }: { b: ExpansionBoard3D; L: Layout; index: number }) {
  const api = useViewerApi();
  const top = PCB_H;
  const P = b.pitch;
  /** 실물 mm → 3D x · z */
  const mmX = (mm: number) => L.X(b.x + (mm <= X_COL0_MM ? (mm * X_COL0_PX) / X_COL0_MM : X_COL0_PX + (mm - X_COL0_MM) * b.mm));
  const mmZ = (mm: number) => L.Z(b.y + interp(mm, Y_ANCHORS));
  const d3 = L.Z(b.y + b.h) - L.Z(b.y);
  const cx = L.X(b.x + b.w / 2), cz = (L.Z(b.y) + L.Z(b.y + b.h)) / 2;

  // JUMP 세 핀은 늘린 띠 안에 있어 그림 자리 대신 실물처럼 2.54mm 간격 (선을 꽂지 않는 핀)
  const jumps = b.pins.filter((p) => p.row === "jump");
  const pinXZ = (p: ExpansionBoard3D["pins"][number]): [number, number] => {
    const k = jumps.indexOf(p);
    return k >= 0 ? [mmX(13.1), mmZ(11.5) + k * P] : [L.X(p.x), L.Z(p.y)];
  };

  // 기판: 오른쪽 두 모서리를 비스듬히 깎은 보라 판
  const pcb = useMemo(() => {
    const W = b.w, H = b.h;
    const pts: [number, number][] = [[0, 4], [4, 0], [W - 14, 0], [W, 14], [W, H - 14], [W - 14, H], [4, H], [0, H - 4]];
    const s = new THREE.Shape();
    pts.forEach(([px, py], k) => (k ? s.lineTo(L.X(b.x + px), L.Z(b.y + py)) : s.moveTo(L.X(b.x + px), L.Z(b.y + py))));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: PCB_H, bevelEnabled: false });
    g.rotateX(Math.PI / 2);
    g.translate(0, top, 0);
    return g;
  }, [b, L, top]);
  useEffect(() => () => pcb.dispose(), [pcb]);

  // 수 핀: 받침(색) · 금색 핀 · 마우스가 잡는 투명 상자
  const bases = useRef<THREE.InstancedMesh>(null);
  const golds = useRef<THREE.InstancedMesh>(null);
  const grips = useRef<THREE.InstancedMesh>(null);
  const baseMat = useMemo(() => toonOwn({ color: "#ffffff" }), []);
  useEffect(() => () => baseMat.dispose(), [baseMat]);
  useEffect(() => {
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    b.pins.forEach((p, i) => {
      const [x, z] = pinXZ(p);
      bases.current?.setMatrixAt(i, mx.compose(new THREE.Vector3(x, top + EX_BASE / 2, z), q, new THREE.Vector3(BASE_W, EX_BASE, BASE_W)));
      golds.current?.setMatrixAt(i, mx.compose(new THREE.Vector3(x, top + EX_PIN / 2, z), q, new THREE.Vector3(PIN_W, EX_PIN, PIN_W)));
      grips.current?.setMatrixAt(i, mx.compose(new THREE.Vector3(x, top + EX_PIN / 2, z), q, new THREE.Vector3(18, EX_PIN, 18)));
      // 실물처럼 S/V/G 기둥만 색 받침(노랑 · 빨강 · 검정), 전원 · I2C · UART · JUMP 헤더는 검은 받침
      const col = p.row === "S" ? "#f5c518" : p.row === "V" ? "#e03131" : "#1f1f23";
      c.set(col);
      if (!p.used && p.row && "SVG".includes(p.row)) c.lerp(new THREE.Color("#3a3a3f"), 0.12);
      bases.current?.setColorAt(i, c);
    });
    for (const m of [bases.current, golds.current, grips.current]) if (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    baseMat.needsUpdate = true;
    // pinXZ 는 b · L 에서 나온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, L, top, baseMat]);

  const hid = (i: number) => `xb${index}:${i}`;
  const move = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const st = api.getState();
    if (st.dragging || e.instanceId === undefined) return;
    const p = b.pins[e.instanceId];
    if (!p || st.hover?.id === hid(e.instanceId)) return;
    const [x, z] = pinXZ(p);
    const label = p.row === "jump" ? `JUMP ${p.label === "3V3" ? "3.3V" : p.label}` : p.row === "i2c" || p.row === "uart" ? `${p.row.toUpperCase()} ${p.label}` : p.row === "pwr" ? `전원 헤더 ${p.label}` : p.label.replace(/ ([SVG])$/, " 칸 $1");
    st.set({ hover: { id: hid(e.instanceId), label, text: expansionPinText(p.label, p.used, b.jumper, p.row), marks: [new THREE.Vector3(x, top + EX_PIN + 1, z)], markSize: [8, 3, 8] } });
    st.invalidate();
  };
  const out = () => { const st = api.getState(); if (st.hover?.id.startsWith(`xb${index}:`)) { st.set({ hover: null }); st.invalidate(); } };

  // 암 헤더: 줄마다 노란 몸통 + 검은 구멍
  const rows = useMemo(() => {
    const by = (r: string) => b.female.filter((f) => f.row === r);
    const outer = by("top"), bot = by("bot"), inner = by("top-inner");
    const zTop = L.Z(outer[0].y);
    return [
      { cells: outer, z: zTop },
      // 안쪽 줄은 바깥 줄 바로 옆 (두 줄짜리 헤더, 2.54mm)
      { cells: inner, z: zTop + P },
      { cells: bot, z: L.Z(bot[0].y) },
    ];
  }, [b, L, P]);
  const holes = useRef<THREE.InstancedMesh>(null);
  const nHoles = rows.reduce((n, r) => n + r.cells.length, 0);
  useEffect(() => {
    const mx = new THREE.Matrix4();
    let k = 0;
    for (const r of rows) for (const f of r.cells) holes.current?.setMatrixAt(k++, mx.makeTranslation(L.X(f.x), top + EX_FEMALE + 0.2, r.z));
    if (holes.current) holes.current.instanceMatrix.needsUpdate = true;
  }, [rows, L, top]);

  // 실크(흰 글자): 칸 이름 · S V G · 전원부 글자. 캔버스 좌표 = (그림 x - 보드 x, 3D z - 보드 위 끝 z)
  const z0 = L.Z(b.y);
  const silk = (g: CanvasRenderingContext2D, cw: number) => {
    const S = cw / b.w;
    g.scale(S, S);
    const u = (x: number) => x - L.X(b.x);
    const v = (z: number) => z - z0;
    g.fillStyle = "#f8f9fa"; g.strokeStyle = "#f8f9fa";
    g.textBaseline = "middle";
    const sPins = b.pins.filter((p) => p.row === "S");
    const topS = Math.min(...sPins.map((p) => p.y)), botS = Math.max(...sPins.map((p) => p.y));
    // 칸 이름: 위 줄은 S 핀 바깥(위)으로, 아래 줄은 S 핀 바깥(아래)으로 세로 글자
    g.font = "800 11px system-ui, sans-serif";
    for (const p of sPins) {
      const name = p.label.replace(/ S$/, "");
      const up = p.y === topS;
      g.save();
      g.translate(u(L.X(p.x)), v(L.Z(p.y + (up ? -12 : 12))));
      g.rotate(-Math.PI / 2);
      g.textAlign = up ? "left" : "right";
      g.globalAlpha = p.used ? 1 : 0.8;
      g.fillText(name, 0, 0);
      g.restore();
    }
    g.globalAlpha = 1;
    // 19번째 칸 자리의 S V G 글자 상자 (위 · 아래)
    const lastX = Math.max(...sPins.map((p) => p.x)) + P;
    g.font = "900 13px system-ui, sans-serif"; g.textAlign = "center"; g.lineWidth = 1.2;
    for (const [s0, dir] of [[topS, 1], [botS, -1]] as const) {
      const ys = [0, 1, 2].map((k) => s0 + dir * k * P);
      g.strokeRect(u(L.X(lastX)) - 9, v(L.Z(Math.min(...ys))) - 10, 18, v(L.Z(Math.max(...ys))) - v(L.Z(Math.min(...ys))) + 20);
      ["S", "V", "G"].forEach((t, k) => g.fillText(t, u(L.X(lastX)), v(L.Z(ys[k]))));
    }
    // 전원 헤더 · I2C/UART 헤더 글자
    const at = (row: string, label: string) => b.pins.find((p) => p.row === row && p.label === label);
    const pw = b.pins.filter((p) => p.row === "pwr");
    if (pw.length) {
      const x0 = Math.min(...pw.map((p) => p.x)), x1 = Math.max(...pw.map((p) => p.x)), y0 = Math.min(...pw.map((p) => p.y)), y1 = Math.max(...pw.map((p) => p.y));
      g.strokeRect(u(L.X(x0)) - 12, v(L.Z(y0)) - 12, L.X(x1) - L.X(x0) + 24, v(L.Z(y1)) - v(L.Z(y0)) + 24);
      g.font = "800 11px system-ui, sans-serif";
      g.fillText("GND", u(L.X((x0 + x1) / 2)), v(L.Z(y0)) - 19);
      g.fillText("3V", u(L.X(x0 + 10)), v(L.Z(y1)) + 19);
      g.fillText("5V", u(L.X(x1 - 10)), v(L.Z(y1)) + 19);
    }
    g.font = "800 10px system-ui, sans-serif";
    for (const [row, labels, dir] of [["i2c", ["GND", "VCC", "D21", "D22"], -1], ["uart", ["GND", "VCC", "RX", "TX"], 1]] as const) {
      for (const l of labels) {
        const p = at(row, l);
        if (!p) continue;
        g.save();
        g.translate(u(L.X(p.x)), v(L.Z(p.y)) + dir * 12);
        g.rotate(-Math.PI / 2);
        g.textAlign = dir < 0 ? "left" : "right";
        g.fillText(l, 0, 0);
        g.restore();
      }
    }
    // JUMP · 5V V 3.3V · USB5V · RPW-LED · DC6.5-16V
    // JUMP 글자는 위에, 5V · V · 3.3V 는 핀 왼쪽(오른쪽은 전원 헤더의 3V · 5V 글자 자리)
    g.textAlign = "center"; g.font = "800 11px system-ui, sans-serif";
    g.fillText("JUMP", u(mmX(13.1)), v(mmZ(11.5)) - 13);
    g.textAlign = "right"; g.font = "800 10px system-ui, sans-serif";
    ["5V", "V", "3.3V"].forEach((t, k) => g.fillText(t, u(mmX(13.1)) - 11, v(mmZ(11.5) + k * P)));
    g.textAlign = "left"; g.font = "800 11px system-ui, sans-serif";
    g.fillText("USB5V", u(mmX(0.8)), v(mmZ(8.7)));
    g.font = "800 9px system-ui, sans-serif";
    g.fillText("RPW-LED", u(mmX(1.2)), v(mmZ(6.2)));
    g.font = "800 11px system-ui, sans-serif";
    g.fillText("DC6.5-16V", u(mmX(0.6)), v(mmZ(39.9)));
    // 보드 이름 (DevKit 아래에 거의 가려진다)
    g.textAlign = "center"; g.font = "700 12px system-ui, sans-serif"; g.globalAlpha = 0.85;
    g.fillText("ESP32 ESP32S 38P Expansion board", u(L.X(b.x + 380)), v((rows[1].z + rows[2].z) / 2));
    g.globalAlpha = 1;
  };

  // 전원부 부품 (실물 mm)
  const box = (x0: number, x1: number, y0: number, y1: number) => ({ w: mmX(x1) - mmX(x0), d: mmZ(y1) - mmZ(y0), x: (mmX(x0) + mmX(x1)) / 2, z: (mmZ(y0) + mmZ(y1)) / 2 });
  const silver = toon("#d4d4d8", { metal: 0.8, rough: 0.3 }), black = toon("#17171a"), chip = toon("#1f1f23");
  const usbC = box(-0.4, 7.7, 10.4, 19.2), micro = box(-1.4, 5.4, 31, 38.6), dc = box(-2.4, 12.4, 40.9, 50.7);
  const reg = box(5.7, 14.2, 23.7, 30.4), dio = box(0.7, 3.4, 23.3, 28.4), smd = box(10.8, 17.2, 19.9, 22.3);
  const caps: [number, number][] = [[18.5, 29.4], [19.2, 39.2]];
  const holesMm: [number, number][] = [[16, 4], [13.8, 50.7], [76, 18.3], [76, 45.3]];
  const jIdx = b.jumper === "5V" ? 0 : 1;
  const capZ = mmZ(11.5) + (jIdx + 0.5) * P;

  const usedMat = useMemo(() => noOutline(toonOwn({ color: COLOR.glow, emissive: COLOR.glow, emissiveIntensity: 0.6 })), []);
  useEffect(() => () => usedMat.dispose(), [usedMat]);

  return (
    <group>
      <Part id={`board${index}`} label={b.name} text={TEXT.expansion} lift={false} glow={false} card={false}>
        <mesh geometry={pcb} material={toon(b.color, { rough: 0.5 })} castShadow receiveShadow />
      </Part>
      <Decal w={b.w} d={d3} at={[cx, top + 0.15, cz]} px={2048} paint={silk} />
      {/* 고정 구멍: 흰 테두리 · 구멍 */}
      {holesMm.map(([hx, hy], i) => (
        <group key={i}>
          <Cyl r={12} h={0.5} at={[mmX(hx), top + 0.2, mmZ(hy)]} mat={toon("#f1f3f5")} seg={24} />
          <Cyl r={8.5} h={0.7} at={[mmX(hx), top + 0.3, mmZ(hy)]} mat={toon("#2a1145")} seg={24} />
        </group>
      ))}

      {/* 노란 암 헤더 (DevKit 이 꽂힌다) */}
      <Part id={`board${index}-female`} label="암 헤더 (DevKit 자리)" text={TEXT.female} lift={false}>
        {rows.map((r, i) => {
          const xs = r.cells.map((f) => L.X(f.x));
          const x0 = Math.min(...xs) - P / 2, x1 = Math.max(...xs) + P / 2;
          return <Box key={i} size={[x1 - x0, EX_FEMALE, P]} at={[(x0 + x1) / 2, top + EX_FEMALE / 2, r.z]} mat={toon("#f5c518")} />;
        })}
      </Part>
      <instancedMesh ref={holes} args={[undefined, undefined, nHoles]} material={toon("#141414", { outline: false })} raycast={() => null}>
        <boxGeometry args={[6, 0.6, 6]} />
      </instancedMesh>

      {/* 수 핀 (S/V/G 기둥 · 전원 헤더 · I2C/UART · JUMP) */}
      <instancedMesh ref={bases} args={[undefined, undefined, b.pins.length]} material={baseMat} castShadow receiveShadow raycast={() => null} geometry={unitBox} />
      <instancedMesh ref={golds} args={[undefined, undefined, b.pins.length]} material={toon(COLOR.gold)} castShadow raycast={() => null} geometry={unitBox} />
      <instancedMesh ref={grips} args={[undefined, undefined, b.pins.length]} onPointerMove={move} onPointerOut={out} geometry={unitBox}>
        <meshBasicMaterial visible={false} />
      </instancedMesh>
      {/* 이번에 꽂는 핀: 받침 둘레 노란 테두리 */}
      {b.pins.filter((p) => p.used).map((p, i) => {
        const [x, z] = pinXZ(p);
        return (
          <mesh key={i} position={[x, top + EX_BASE + 0.4, z]} rotation={[Math.PI / 2, 0, Math.PI / 4]} scale={0.8} material={usedMat} raycast={() => null}>
            <torusGeometry args={[12, 1.4, 8, 4]} />
          </mesh>
        );
      })}

      {/* JUMP 점퍼 캡 (기록된 자리: 5V–V 또는 V–3.3V) */}
      <Part id={`board${index}-jumper`} label={`JUMP 점퍼 (지금 ${b.jumper === "5V" ? "5V" : "3.3V"})`} text={TEXT.jumper}>
        <Box size={[P * 0.95, 22, P * 1.95]} at={[mmX(13.1), top + EX_PIN - 9, capZ]} mat={toon("#fab005")} />
      </Part>
      {/* RPW-LED (빨간 전원 불) */}
      <Part id={`board${index}-pwr`} label="전원 LED (RPW-LED)" text={TEXT.powerLed}>
        <Box size={[9, 3, 6]} at={[mmX(9.5), top + 1.5, mmZ(6.2)]} mat={toon("#ff6b6b", { emissive: "#e03131", emissiveIntensity: 0.9 })} />
      </Part>
      {/* USB-C (USB5V): 은색 통, 구멍이 왼쪽 */}
      <Part id={`board${index}-usb`} label="USB-C (USB5V)" text={TEXT.usbPower}>
        <Box size={[usbC.w, 3.2 * HM, usbC.d]} at={[usbC.x, top + 1.6 * HM, usbC.z]} mat={toon(COLOR.metalLight)} />
        <mesh position={[mmX(-0.4) - 0.3, top + 1.6 * HM, usbC.z]} rotation={[Math.PI / 2, 0, Math.PI / 2]} material={toon("#1b1b1f", { outline: false })}>
          <capsuleGeometry args={[3.6, usbC.d * 0.55, 4, 10]} />
        </mesh>
      </Part>
      {/* 마이크로 USB */}
      <Part id={`board${index}-micro`} label="마이크로 USB" text={TEXT.microUsb}>
        <Box size={[micro.w, 2.8 * HM, micro.d]} at={[micro.x, top + 1.4 * HM, micro.z]} mat={toon(COLOR.metalLight)} />
        <Box size={[2, 1.4 * HM, micro.d * 0.6]} at={[mmX(-1.4) - 0.5, top + 1.4 * HM, micro.z]} mat={toon("#1b1b1f", { outline: false })} cast={false} />
      </Part>
      {/* DC 잭 (검은 통, 구멍 왼쪽) */}
      <Part id={`board${index}-dc`} label="DC 전원 잭 (6.5~16V)" text={TEXT.dcJack}>
        <Box size={[dc.w, 11 * HM, dc.d]} at={[dc.x, top + 5.5 * HM, dc.z]} mat={black} />
        <Cyl r={dc.d * 0.3} h={2} at={[mmX(-2.4) - 1, top + 6 * HM, dc.z]} rot={[0, 0, Math.PI / 2]} mat={toon("#0b0b0d")} seg={20} />
        <Cyl r={4} h={2.4} at={[mmX(-2.4) - 1.2, top + 6 * HM, dc.z]} rot={[0, 0, Math.PI / 2]} mat={silver} seg={12} />
      </Part>
      {/* 레귤레이터 AMS1117 (SOT-223): 다리 셋 왼쪽, 넓은 탭 오른쪽 */}
      <Part id={`board${index}-reg`} label="전원 조절 부품 (AMS1117)" text={TEXT.regulator}>
        <Box size={[reg.w * 0.62, 1.6 * HM, reg.d]} at={[reg.x, top + 0.8 * HM, reg.z]} mat={chip} />
        <Box size={[reg.w * 0.18, 1.2, reg.d * 0.8]} at={[reg.x + reg.w * 0.4, top + 0.6, reg.z]} mat={silver} cast={false} />
        {[-1, 0, 1].map((k) => <Box key={k} size={[reg.w * 0.2, 1.2, reg.d * 0.16]} at={[reg.x - reg.w * 0.4, top + 0.6, reg.z + k * reg.d * 0.32]} mat={silver} cast={false} />)}
      </Part>
      {/* 다이오드 (SMA, 흰 띠) · SMD 다이오드 */}
      <Box size={[dio.w, 2.2 * HM, dio.d]} at={[dio.x, top + 1.1 * HM, dio.z]} mat={chip} cast={false} />
      <Box size={[dio.w * 0.9, 0.4, dio.d * 0.12]} at={[dio.x, top + 2.2 * HM + 0.2, dio.z - dio.d * 0.32]} mat={toon("#dee2e6")} cast={false} />
      <Box size={[smd.w * 0.7, 1.2 * HM, smd.d]} at={[smd.x, top + 0.6 * HM, smd.z]} mat={chip} cast={false} />
      {[-1, 1].map((k) => <Box key={k} size={[smd.w * 0.14, 1.4, smd.d * 0.8]} at={[smd.x + k * smd.w * 0.42, top + 0.7, smd.z]} mat={silver} cast={false} />)}
      {/* 전해 콘덴서 47µF 35V 둘 (검은 받침 · 은색 통 · 검은 반달) */}
      <Part id={`board${index}-caps`} label="콘덴서 (47µF 35V)" text={TEXT.caps}>
        {caps.map(([mx, my], i) => (
          <group key={i}>
            <Box size={[6.6 * b.mm, 1.6 * HM, 6.6 * b.mm]} at={[mmX(mx), top + 0.8 * HM, mmZ(my)]} mat={black} />
            <Cyl r={3.15 * b.mm} h={5.4 * HM - 1} at={[mmX(mx), top + 2.7 * HM, mmZ(my)]} mat={toon("#d9dde3")} seg={28} />
            <Decal w={6.3 * b.mm} d={6.3 * b.mm} at={[mmX(mx), top + 5.4 * HM + 0.05, mmZ(my)]} px={128} paint={(g, cw, ch) => {
              g.fillStyle = "#1b1b1f";
              g.beginPath(); g.arc(cw / 2, ch / 2, cw * 0.48, -Math.PI / 2, Math.PI / 2); g.closePath(); g.fill();
              g.font = `800 ${Math.round(cw * 0.2)}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
              g.fillText("47", cw * 0.32, ch / 2);
            }} />
          </group>
        ))}
      </Part>
      {/* 전원 헤더 · I2C 헤더: 핀에 올리면 설명. 덩어리 설명은 아래 투명 판으로 */}
      <HeaderInfo id={`board${index}-pwrhdr`} label="전원 헤더 (GND · 3V · 5V)" text={TEXT.powerHeader} pins={b.pins.filter((p) => p.row === "pwr")} L={L} />
      <HeaderInfo id={`board${index}-i2c`} label="I2C · UART 헤더" text={TEXT.i2cHeader} pins={b.pins.filter((p) => p.row === "i2c" || p.row === "uart")} L={L} />
    </group>
  );
}

/** 헤더 덩어리 바닥(핀 받침 사이)에 올리면 묶음 설명 */
function HeaderInfo({ id, label, text, pins, L }: { id: string; label: string; text: string; pins: ExpansionBoard3D["pins"]; L: Layout }) {
  if (!pins.length) return null;
  const xs = pins.map((p) => L.X(p.x)), zs = pins.map((p) => L.Z(p.y));
  const x0 = Math.min(...xs) - 12, x1 = Math.max(...xs) + 12, z0 = Math.min(...zs) - 12, z1 = Math.max(...zs) + 12;
  return (
    <Part id={id} label={label} text={text} lift={false}>
      <mesh position={[(x0 + x1) / 2, PCB_H + 0.6, (z0 + z1) / 2]} material={toon("#4c1d86", { outline: false })} receiveShadow>
        <boxGeometry args={[x1 - x0, 0.6, z1 - z0]} />
      </mesh>
    </Part>
  );
}

/**
 * 확장 보드 암 헤더에 꽂힌 기본 보드 DevKit 38핀: devkit38.tsx 를 그대로, 배선도처럼 scale 배(0.9)로 줄여 얹는다.
 * DevKit 의 핀 두 줄이 위 암 헤더 바깥 줄 · 아래 암 헤더에 오도록 세로를 L.seat.F 배로 늘리고(실물 25.5mm),
 * 보드 밑면이 암 헤더 윗면에 닿는 높이에 둔다 (아래로 난 핀은 암 헤더 속으로).
 */
export function SeatedDevkit({ b, L, index, blueLed, pressEn, releaseEn, enCap }: {
  b: ChipBoard3D; L: Layout; index: number; blueLed: THREE.MeshStandardMaterial;
  pressEn: (e: ThreeEvent<PointerEvent>) => void; releaseEn: () => void; enCap: RefObject<THREE.Mesh | null>;
}) {
  const s = b.scale ?? 0.9;
  const F = L.seat?.F ?? 1.7;
  // 배선도 기록은 줄여 놓은 좌표 → DevKit 그림 그대로의 좌표 (보드 왼쪽 위가 0, 0)
  const b0 = useMemo<ChipBoard3D>(() => {
    const un = (r: { x: number; y: number; w: number; h: number }) => ({ x: (r.x - b.x) / s, y: (r.y - b.y) / s, w: r.w / s, h: r.h / s });
    return { ...b, x: 0, y: 0, w: b.w / s, h: b.h / s, chip: un(b.chip), usb: un(b.usb), pins: b.pins.map((p) => ({ ...p, x: (p.x - b.x) / s, y: (p.y - b.y) / s })) };
  }, [b, s]);
  const rowTop = Math.min(...b0.pins.map((p) => p.y));
  const local = useMemo<Layout>(() => ({
    X: (x) => x, Z: (y) => y * F, Zp: (p) => p.y * F, v: (p, y) => new THREE.Vector3(p.x, y, p.y * F),
    topAt: () => 0, unZ: (z) => z / F, F, zIn: () => (y) => y * F, size: { w: b0.w, d: b0.h * F }, focus: new THREE.Vector3(), sonars: [], diorama: null,
  }), [F, b0]);
  const pos = useMemo(() => new THREE.Vector3(L.X(b.x), PCB_H + EX_FEMALE - s * DEVKIT_LIFT, (L.seat ? L.Z(L.seat.y0) : L.Z(b.y)) - s * rowTop * F), [L, b, s, rowTop, F]);
  const toWorld = useMemo(() => ({ at: (v: THREE.Vector3) => v.clone().multiplyScalar(s).add(pos), scale: s }), [s, pos]);
  return (
    <group position={pos} scale={s}>
      <Devkit38 b={b0} L={local} index={index} blueLed={blueLed} pressEn={pressEn} releaseEn={releaseEn} enCap={enCap} toWorld={toWorld} />
    </group>
  );
}

/** 크기 1 상자 (인스턴스마다 크기를 준다) */
const unitBox = roundedBox(1, 1, 1);
