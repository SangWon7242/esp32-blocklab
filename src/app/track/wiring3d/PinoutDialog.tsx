import { useEffect, useMemo, useState } from "react";
import { Map as MapIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Scene3D } from "@/track/wiring3d";
import { ADC2_NOTE, KIND, pinInfo, type PinInfo, type PinKind } from "./pinout";
import { DK38_BOT, DK38_TOP, K } from "./plusLayout";

/*
 * 핀 배치도 (한글): 지금 보드(기본 보드 38핀 · ESP32 Plus)를 위에서 본 그림과, 핀마다 할 수 있는 일.
 * 핀에 마우스를 올리거나 누르면 아래에 우리말 설명이 나온다. 이번 챕터에서 쓰는 핀은 노란 테두리.
 * 그림은 데이터시트를 보고 우리가 직접 그렸다.
 */

type Board = Scene3D["boards"][number];
type Hit = { info: PinInfo; where: string };

const textW = (t: string, size: number) => [...t].reduce((w, ch) => w + (/[가-힣]/.test(ch) ? size * 1.02 : size * 0.62), 0) + 12;

/** 이번 챕터에서 쓰는 핀: GPIO 번호 · 전원 이름 */
function usedSet(board: Board | undefined) {
  const gpio = new Set<number>(), power = new Set<string>();
  for (const p of board?.pins ?? []) {
    if (!p.used) continue;
    const base = p.label.replace(/ \(.*\)$/, "").replace(/^I2C /, "").replace(/ [SVG]$/, "");
    const v = / V$/.test(p.label) ? "5V" : / G$/.test(p.label) ? "GND" : null;
    const i = pinInfo(v ?? base);
    if (i.gpio !== null) gpio.add(i.gpio);
    else power.add(i.kind === "power" ? (/3/.test(i.tags[0]) ? "3V3" : "5V") : i.kind);
  }
  return { gpio, power };
}
const isUsed = (u: ReturnType<typeof usedSet>, i: PinInfo) =>
  i.gpio !== null ? u.gpio.has(i.gpio) : i.kind === "gnd" ? u.power.has("gnd") : i.kind === "power" ? u.power.has(/3/.test(i.tags[0]) ? "3V3" : "5V") : false;

/** 38핀 보드 실크 이름 → 핀 정보 (D0~D3 · CLK · CMD 는 플래시 핀이라 GPIO 번호가 다르다) */
const FLASH38: Record<string, number> = { CLK: 6, D0: 7, D1: 8, D2: 9, D3: 10, CMD: 11 };
const info38 = (name: string): PinInfo => {
  const i = pinInfo(name in FLASH38 ? String(FLASH38[name]) : name);
  return { ...i, label: name };
};

/* ───────── 기본 보드 38핀: 세워서 (USB 위), 양옆으로 핀 설명 줄 ───────── */
function Devkit38Sheet({ used, onHit, hit }: { used: ReturnType<typeof usedSet>; onHit: (h: Hit) => void; hit: Hit | null }) {
  const cx = 600, bx0 = cx - 72, bx1 = cx + 72, y0 = 92, P = 25.5;
  const row = (side: "L" | "R", name: string, k: number) => {
    const info = info38(name);
    const kd = KIND[info.kind];
    const y = y0 + k * P;
    const px = side === "L" ? bx0 + 13 : bx1 - 13;
    const dir = side === "L" ? -1 : 1;
    const on = isUsed(used, info);
    const chips = [info.gpio !== null ? `GPIO${info.gpio}` : name, ...(info.kind === "power" || info.kind === "gnd" || info.kind === "en" ? [] : info.tags.slice(0, 2))];
    let x = side === "L" ? bx0 - 30 : bx1 + 30;
    const sel = hit?.where === `${side}${k}`;
    return (
      <g key={`${side}${k}`} className="cursor-pointer" onMouseEnter={() => onHit({ info, where: `${side}${k}` })} onClick={() => onHit({ info, where: `${side}${k}` })}>
        <rect x={Math.min(px, x) - (side === "L" ? 470 : 0)} y={y - 11} width={500} height={22} fill={sel ? "#fff4e6" : "transparent"} />
        <circle cx={px} cy={y} r={8} fill="#c9cdd2" stroke="#868e96" strokeWidth={1.5} />
        <circle cx={px} cy={y} r={3.4} fill="#495057" />
        <line x1={px + dir * 9} y1={y} x2={x} y2={y} stroke="#adb5bd" strokeWidth={1.4} />
        {chips.map((c, ci) => {
          const w = textW(c, 11);
          const rx = side === "L" ? x - w : x;
          x += dir * (w + 4);
          const first = ci === 0;
          return (
            <g key={ci}>
              <rect x={rx} y={y - 10} width={w} height={20} rx={5} fill={first ? kd.fill : "#f8f9fa"} stroke={first && on ? "#f59f00" : first ? kd.ink : "#ced4da"} strokeWidth={first && on ? 2.6 : 1} />
              <text x={rx + w / 2} y={y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={first ? 800 : 600} fill={first ? kd.ink : "#495057"}>{c}</text>
            </g>
          );
        })}
        {on && <circle cx={x + dir * 8} cy={y} r={4.5} fill="#f59f00" />}
      </g>
    );
  };
  return (
    <svg viewBox="0 0 1200 640" className="mx-auto block h-auto w-full min-w-[960px] max-w-[1200px]" role="img" aria-label="기본 보드 ESP32 38핀 핀 배치도">
      {/* 보드 · USB-C · 버튼 · 모듈 (위에서 본 모습) */}
      <rect x={cx - 24} y={44} width={48} height={40} rx={6} fill="#d9dde3" stroke="#868e96" />
      <rect x={cx - 14} y={46} width={28} height={10} rx={4} fill="#1b1b1f" />
      <rect x={bx0} y={70} width={bx1 - bx0} height={500} rx={10} fill="#1d1d20" />
      {[["Boot", cx - 36], ["EN", cx + 36]].map(([n, x]) => (
        <g key={n as string}>
          <rect x={(x as number) - 11} y={84} width={22} height={22} rx={3} fill="#c9cdd2" />
          <circle cx={x as number} cy={95} r={7} fill="#495057" />
          <text x={x as number} y={122} textAnchor="middle" fontSize={9} fontWeight={800} fill="#f8f9fa">{n}</text>
        </g>
      ))}
      <rect x={cx - 18} y={150} width={36} height={36} rx={3} fill="#2b2b30" />
      <rect x={cx - 16} y={214} width={32} height={26} rx={2} fill="#2b2b30" />
      <rect x={cx - 52} y={380} width={104} height={230} rx={4} fill="#3f434a" />
      <rect x={cx - 46} y={386} width={92} height={160} rx={4} fill="#ececec" />
      <text x={cx} y={498} textAnchor="middle" fontSize={11} fontWeight={800} fill="#1b1b1f">ESPRESSIF</text>
      <text x={cx} y={516} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#1b1b1f">ESP32-WROOM-32</text>
      <path d={`M ${cx - 40} 602 V 562 H ${cx - 20} V 590 H ${cx} V 562 H ${cx + 20} V 590 H ${cx + 40} V 562`} fill="none" stroke="#5c6370" strokeWidth={4} />
      <text x={cx} y={634} textAnchor="middle" fontSize={11} fill="#868e96">안테나 (이쪽에 금속을 두지 않아요)</text>
      {DK38_BOT.map((n, k) => row("L", n, k))}
      {DK38_TOP.map((n, k) => row("R", n, k))}
      <text x={cx} y={30} textAnchor="middle" fontSize={13} fontWeight={800} fill="#212529">USB-C (컴퓨터와 연결)</text>
    </svg>
  );
}

/* ───────── ESP32 Plus: 실물 도면 배치 (위에서 본 모습), 핀마다 칸 ───────── */
function PlusSheet({ board, onHit, hit }: { board: Board | undefined; onHit: (h: Hit) => void; hit: Hit | null }) {
  // 이번 챕터에서 쓰는 핀: 3D 보드 핀 자리 → 도면 자리 (같은 칸만 표시)
  const usedXY = new Set((board?.pins ?? []).filter((p) => p.used).map((p) => `${Math.round((p.x - board!.x) / K + 35)},${Math.round((p.y - board!.y) / K + 12)}`));
  const cells: { x: number; y: number; name: string; role: "pin" | "S" | "V" | "G"; fill: string; where: string }[] = [];
  const add = (x: number, y: number, name: string, role: "pin" | "S" | "V" | "G", fill: string) => cells.push({ x, y, name, role, fill, where: `${x},${y}` });
  ["SCL", "SDA", "5V", "GND", "io18", "io19", "io23", "io5", "io13", "io12"].forEach((n, i) => add(232 + 22 * i, 28, n, "pin", "#eab308"));
  ["io14", "io27", "io16", "io17", "io25", "io26", "TX", "RX"].forEach((n, i) => add(526 + 22 * i, 28, n, "pin", "#eab308"));
  ["io0", "5V", "RST", "3V3", "5V", "GND", "GND", "VIN"].forEach((n, i) => add(336 + 22 * i, 423, n, "pin", "#eab308"));
  ["io32", "io33", "io34", "io35", "io36", "io39"].forEach((n, i) => add(580 + 22 * i, 423, n, "pin", "#eab308"));
  const rows = [["S", "#facc15"], ["V", "#dc2626"], ["G", "#27272a"]] as const;
  ["io18", "io19", "io23", "io5", "io13", "io12"].forEach((n, c) => rows.forEach(([r, f], k) => add(340 + 22 * c, 82 + 22 * k, n, r, f)));
  ["io14", "io27", "io16", "io17", "io25", "io26"].forEach((n, c) => rows.forEach(([r, f], k) => add(524 + 22 * c, 82 + 22 * k, n, r, f)));
  for (let r = 0; r < 3; r++) [["GND", "G", "#27272a"], ["5V", "V", "#dc2626"], ["SDA", "S", "#facc15"], ["SCL", "S", "#f8fafc"]].forEach(([n, role, f], c) => add(353 + 22 * c, 170 + 22 * r, n, role as "S", f));
  ["io35", "io34", "io33", "io32", "io4", "io2"].forEach((n, r) => [["G", "#27272a"], ["V", "#dc2626"], ["S", "#facc15"]].forEach(([role, f], c) => add(353 + 22 * c, 260 + 22 * r, n, role as "S", f)));
  const infoOf = (c: (typeof cells)[number]) => (c.role === "V" ? pinInfo("5V") : c.role === "G" ? pinInfo("GND") : pinInfo(c.name));
  return (
    <svg viewBox="0 0 800 470" className="mx-auto block h-auto w-full min-w-[820px] max-w-[1100px]" role="img" aria-label="ESP32 Plus 확장 보드 핀 배치도">
      <path d="M 35 12 L 735 12 L 755 32 L 755 125 L 775 145 L 775 415 L 745 445 L 35 445 Z" fill="#141619" />
      <rect x={18} y={80} width={84} height={72} rx={6} fill="#cbd5e1" /><text x={60} y={170} textAnchor="middle" fontSize={11} fontWeight={700} fill="#facc15">USB-C</text>
      <rect x={10} y={312} width={145} height={84} rx={5} fill="#facc15" /><text x={88} y={432} textAnchor="middle" fontSize={11} fontWeight={700} fill="#facc15">DC 7-12V</text>
      <rect x={504} y={176} width={286} height={160} rx={3} fill="#27272a" /><rect x={514} y={186} width={194} height={140} rx={4} fill="#d4d4d8" />
      <text x={611} y={262} textAnchor="middle" fontSize={16} fontWeight={800} fill="#27272a">ESPRESSIF</text>
      {[[318, 86, "S"], [318, 108, "V"], [318, 130, "G"]].map(([x, y, t]) => <text key={t as string} x={x as number} y={y as number} textAnchor="middle" fontSize={12} fontWeight={800} fill="#facc15">{t}</text>)}
      <text x={397} y={150} textAnchor="middle" fontSize={11} fontWeight={800} fill="#facc15">BUS I2C (GND · V · SDA · SCL)</text>
      <text x={386} y={240} textAnchor="middle" fontSize={11} fontWeight={800} fill="#facc15">ANALOG (G · V · S)</text>
      <text x={510} y={372} textAnchor="middle" fontSize={11} fontWeight={800} fill="#facc15">POWER</text>
      <text x={635} y={372} textAnchor="middle" fontSize={11} fontWeight={800} fill="#facc15">ANALOG IN</text>
      {cells.map((c) => {
        const info = infoOf(c);
        const on = usedXY.has(c.where);
        const sel = hit?.where === c.where;
        return (
          <g key={c.where} className="cursor-pointer" onMouseEnter={() => onHit({ info: { ...info, label: c.role === "pin" ? c.name : `${c.name} ${c.role}` }, where: c.where })} onClick={() => onHit({ info: { ...info, label: c.role === "pin" ? c.name : `${c.name} ${c.role}` }, where: c.where })}>
            <rect x={c.x - 10} y={c.y - 10} width={20} height={20} rx={3} fill={c.fill} stroke={sel ? "#38bdf8" : on ? "#f59f00" : "#52525b"} strokeWidth={sel || on ? 3 : 1} />
            <rect x={c.x - 3} y={c.y - 3} width={6} height={6} fill={c.role === "pin" ? "#18181b" : "#fef08a"} />
          </g>
        );
      })}
      {/* 위 · 아래 줄 이름 */}
      {cells.filter((c) => c.role === "pin").map((c) => (
        <text key={`t${c.where}`} x={c.x} y={c.y < 100 ? c.y + 30 : c.y - 30} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="#facc15" transform={`rotate(-90 ${c.x} ${c.y < 100 ? c.y + 30 : c.y - 30})`}>{c.name}</text>
      ))}
      {["io35", "io34", "io33", "io32", "io 4", "io 2"].map((t, r) => <text key={t} x={412} y={264 + 22 * r} fontSize={10} fontWeight={700} fill="#facc15">{t}</text>)}
    </svg>
  );
}

export function PinoutDialog({ scene, onClose }: { scene: Scene3D; onClose: () => void }) {
  const board = scene.boards[0];
  const used = useMemo(() => usedSet(board), [board]);
  const [hit, setHit] = useState<Hit | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  const devkit = board?.kind === "devkit";
  const legend: PinKind[] = ["safe", "care", "input", "serial", "flash", "power", "gnd", "en"];
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0f2239]/35 p-3 backdrop-blur-[2px]" onClick={onClose} data-testid="wiring-3d-pinout">
      <div role="dialog" aria-label="핀 배치도" className="flex max-h-full w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl border bg-[#fffcf8] text-[#0f2239] shadow-[0_6px_0_rgba(15,34,57,0.2)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <MapIcon className="size-4" />
          <p className="text-sm font-bold">핀 배치도 · {devkit ? "기본 보드 ESP32 (38핀)" : "ESP32 Plus 확장 보드"}</p>
          <span className="hidden text-xs text-[#5b6168] sm:inline">핀에 마우스를 올리면 설명이 나와요 · 노란 테두리는 이번 챕터에서 쓰는 핀</span>
          <Button type="button" size="icon" variant="ghost" className="ml-auto size-8" aria-label="핀 배치도 닫기" onClick={onClose}><X className="size-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-1.5 border-b px-4 py-2">
          {legend.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold" style={{ background: KIND[k].fill, color: KIND[k].ink, borderColor: KIND[k].ink }}>{KIND[k].name}</span>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-white px-2 py-2">
          {devkit ? <Devkit38Sheet used={used} onHit={setHit} hit={hit} /> : <PlusSheet board={board} onHit={setHit} hit={hit} />}
        </div>
        <div className={cn("border-t px-4 py-2.5 text-sm leading-relaxed break-keep", !hit && "text-[#5b6168]")} data-testid="wiring-3d-pinout-info" aria-live="polite">
          {hit ? (
            <>
              <p className="font-bold">
                {hit.info.label}{hit.info.gpio !== null && <span className="ml-1.5 font-mono text-[#5b6168]">GPIO{hit.info.gpio}</span>}
                <span className="ml-2 rounded px-1.5 py-0.5 text-xs" style={{ background: KIND[hit.info.kind].fill, color: KIND[hit.info.kind].ink }}>{KIND[hit.info.kind].name}</span>
              </p>
              <p className="mt-0.5">
                {KIND[hit.info.kind].help}
                {hit.info.note ? ` ${hit.info.note}` : ""}
                {hit.info.tags.length > 0 && hit.info.kind !== "power" && hit.info.kind !== "gnd" ? ` 할 수 있는 일: ${hit.info.tags.join(" · ")}.` : ""}
                {hit.info.tags.some((t) => t.includes("ADC2")) ? ` ${ADC2_NOTE}` : ""}
              </p>
            </>
          ) : "핀에 마우스를 올려 보세요. 어떤 핀인지, 무엇에 쓸 수 있는지 알려 줘요."}
        </div>
      </div>
    </div>
  );
}
