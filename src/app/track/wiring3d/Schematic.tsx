import type { Pt, Scene3D } from "@/track/wiring3d";

/**
 * 회로도: 배선 장면에서 「핀 → 저항 → LED → GND」 한 줄씩을 찾아 기호로 그린다.
 * 3D 는 "어디에 꽂는가", 회로도는 "전기가 어떤 차례로 지나가는가" 를 보여 준다.
 */
type Row = { pin: string; ohm?: string; color: string };

const sameX = (a: number, b: number) => Math.abs(a - b) < 1;

export function schematicRows(scene: Scene3D): Row[] {
  // LED 와 저항만 있는 장면에서만 그린다 (다른 부품이 섞이면 일부만 그린 회로도가 되어 오해를 부른다)
  if (scene.parts.some((p) => p.type !== "led" && p.type !== "resistor")) return [];
  const resistors = scene.parts.filter((p) => p.type === "resistor");
  const leds = scene.parts.filter((p) => p.type === "led");
  // 같은 줄(전기적으로 이어진 다섯 칸)인지: 같은 열이고 가운데 홈의 같은 쪽
  const mids = scene.breadboards.map((bb) => ({ bb, mid: (bb.gap[0] + bb.gap[1]) / 2 }));
  const sameStrip = (a: Pt, b: Pt) => {
    if (!sameX(a.x, b.x)) return false;
    // 둘 다 같은 브레드보드 위에 있어야 한다 (보드 핀이 우연히 같은 x 에 있어도 같은 줄이 아니다)
    const inside = (p: Pt, bb: (typeof mids)[number]["bb"]) => p.y >= bb.y && p.y <= bb.y + bb.h && p.x >= bb.x && p.x <= bb.x + bb.w;
    const m = mids.find(({ bb }) => inside(a, bb) && inside(b, bb));
    return Boolean(m) && (m!.bb.gap[1] <= m!.bb.gap[0] || (a.y < m!.mid) === (b.y < m!.mid));
  };
  const pinAt = (p: Pt) => scene.boards.flatMap((b) => b.pins).find((q) => sameX(q.x, p.x) && Math.abs(q.y - p.y) < 1);
  const rows: Row[] = [];
  for (const led of leds) {
    const r = resistors.find((x) => sameStrip(x.a, led.a) || sameStrip(x.b, led.a));
    const entry = r ? (sameStrip(r.a, led.a) ? r.b : r.a) : led.a;
    const wire = scene.wires.find((w) => sameStrip(w.from, entry) || sameStrip(w.to, entry));
    if (!wire) continue;
    const pin = pinAt(sameStrip(wire.from, entry) ? wire.to : wire.from);
    if (!pin) continue;
    rows.push({ pin: pin.label.replace(/ \(.*\)$/, ""), ohm: r?.label, color: led.color });
  }
  return rows;
}

export function Schematic({ scene }: { scene: Scene3D }) {
  const rows = schematicRows(scene);
  if (!rows.length) return null;
  const H = 30, top = 26, w = 250, bus = 226;
  const height = top + rows.length * H + 26;
  const ink = "#0f2239";
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="block w-full" role="img" aria-label={`회로도: ${rows.map((r) => `${r.pin} → ${r.ohm ?? "선"} → LED → GND`).join(", ")}`} fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* 보드 */}
      <rect x="6" y="8" width="62" height={height - 16} rx="5" fill="#eef1f5" />
      <text x="37" y="20" textAnchor="middle" fontSize="9" fontWeight="700" fill={ink} stroke="none">ESP32</text>
      {rows.map((r, i) => {
        const y = top + i * H + H / 2;
        return (
          <g key={i}>
            <text x="62" y={y + 3} textAnchor="end" fontSize="9.5" fontWeight="600" fill={ink} stroke="none">{r.pin}</text>
            <path d={`M68 ${y} H92`} />
            {r.ohm ? (
              <>
                <path d={`M92 ${y} l4 -5 l7 10 l7 -10 l7 10 l7 -10 l4 5 H140`} />
                <text x="112" y={y - 8} textAnchor="middle" fontSize="8.5" fill={ink} stroke="none">{r.ohm}</text>
              </>
            ) : <path d={`M92 ${y} H140`} />}
            {/* LED: 세모 + 막대 (전기는 세모가 가리키는 쪽으로만 흐른다) */}
            <path d={`M140 ${y} H160`} />
            <path d={`M160 ${y - 7} L174 ${y} L160 ${y + 7} Z`} fill={r.color} />
            <path d={`M174 ${y - 7} V${y + 7}`} />
            <path d={`M170 ${y - 11} l5 -5 m-1 5 l1 -5 l-5 1 M177 ${y - 9} l5 -5 m-1 5 l1 -5 l-5 1`} strokeWidth="1.1" />
            <path d={`M174 ${y} H${bus}`} />
            <circle cx={bus} cy={y} r="2" fill={ink} stroke="none" />
          </g>
        );
      })}
      {/* GND 로 모이는 길 */}
      <path d={`M${bus} ${top + H / 2} V${height - 20}`} />
      <path d={`M${bus - 9} ${height - 20} h18 M${bus - 6} ${height - 16} h12 M${bus - 3} ${height - 12} h6`} />
      <text x={bus - 14} y={height - 13} textAnchor="end" fontSize="9" fontWeight="600" fill={ink} stroke="none">GND</text>
    </svg>
  );
}
