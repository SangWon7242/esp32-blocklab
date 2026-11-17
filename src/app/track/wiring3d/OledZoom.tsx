import { useEffect, useRef } from "react";
import { Monitor, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OLED_BG, OLED_INK } from "./oled";
import { useViewer, useViewerApi } from "./store";

/*
 * OLED 크게 보기: 3D 에서 OLED 화면을 누르면 모듈을 세워서 크게 보여 준다.
 * 실물 0.96인치 SSD1306 처럼 — 파란 기판, 위쪽 핀 넷(GND · VCC · SCL · SDA), 검은 유리 안의 128 × 64 점.
 * 글자는 128 × 64 캔버스에 실제 점 크기(8점 줄)로 찍고 키워서, 점 하나하나가 보이게 한다.
 * 실행 중에는 보드가 보낸 글자를 그대로 따라간다 (0.1초마다).
 */

/**
 * 128 × 64 점에 글자를 찍는다. MicroPython framebuf 처럼 한 글자 = 8 × 8 점 칸, 한 줄 16글자 · 여덟 줄.
 * 큰 그림판(6배)에 칸마다 글자를 그린 뒤, 점 칸마다 얼마나 칠해졌는지 보고 켜거나 끈다 (실물 OLED 는 켜짐 · 꺼짐뿐).
 */
const S = 6;
let big: HTMLCanvasElement | null = null;
function paintPixels(g: CanvasRenderingContext2D, lines: string[] | null) {
  const img = g.createImageData(128, 64);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = 3; d[i + 1] = 10; d[i + 2] = 28; d[i + 3] = 255; }
  if (lines?.length) {
    big ??= document.createElement("canvas");
    big.width = 128 * S; big.height = 64 * S;
    const b = big.getContext("2d", { willReadFrequently: true })!;
    b.clearRect(0, 0, big.width, big.height);
    b.fillStyle = "#fff";
    b.textAlign = "center";
    b.textBaseline = "middle";
    b.font = `700 ${7.4 * S}px ui-monospace, "D2Coding", Menlo, monospace`;
    lines.slice(0, 8).forEach((line, row) => {
      [...line].slice(0, 16).forEach((ch, col) => b.fillText(ch, (col * 8 + 3.5) * S, (row * 8 + 4) * S));
    });
    const src = b.getImageData(0, 0, big.width, big.height).data;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x++) {
        let sum = 0;
        for (let yy = 1; yy < S - 1; yy++) for (let xx = 1; xx < S - 1; xx++) sum += src[((y * S + yy) * big.width + (x * S + xx)) * 4 + 3];
        if (sum / ((S - 2) * (S - 2) * 255) > 0.36) {
          const i = (y * 128 + x) * 4;
          d[i] = 0x9f; d[i + 1] = 0xd8; d[i + 2] = 0xff;
        }
      }
    }
  }
  g.putImageData(img, 0, 0);
}

export function OledZoom() {
  const api = useViewerApi();
  const part = useViewer((s) => s.oledZoom);
  const running = useViewer((s) => s.running);
  const set = useViewer((s) => s.set);
  const cv = useRef<HTMLCanvasElement>(null);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (part === null) return;
    last.current = null;
    const tick = () => {
      const s = api.getState();
      const lines = s.running && s.sim ? s.sim.outputs.oled : null;
      const k = lines?.join("\n") ?? "";
      if (k === last.current) return;
      last.current = k;
      const g = cv.current?.getContext("2d", { willReadFrequently: true });
      if (g) paintPixels(g, lines);
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [api, part]);

  useEffect(() => {
    if (part === null) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); set({ oledZoom: null }); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [part, set]);

  if (part === null) return null;
  const pins = ["GND", "VCC", "SCL", "SDA"];
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0f2239]/35 p-4 backdrop-blur-[2px]" data-testid="wiring-3d-oled-zoom" onClick={() => set({ oledZoom: null })}>
      <div role="dialog" aria-label="OLED 화면 크게 보기" className="w-full max-w-[34rem] rounded-2xl border bg-[#fffcf8] p-4 text-[#0f2239] shadow-[0_6px_0_rgba(15,34,57,0.2)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Monitor className="size-4 text-[#1c4fd8]" />
          <p className="text-sm font-bold">OLED 화면 크게 보기</p>
          <span className="text-xs text-[#5b6168]">0.96인치 · 128 × 64 점</span>
          <Button type="button" size="icon" variant="ghost" className="ml-auto size-8" aria-label="크게 보기 닫기" onClick={() => set({ oledZoom: null })}><X className="size-4" /></Button>
        </div>

        {/* 세운 모듈: 위쪽 핀 → 파란 기판 → 유리 화면 */}
        <div className="mx-auto mt-3 w-full max-w-[26rem] [perspective:900px]">
          <div className="relative [transform:rotateX(8deg)] rounded-[14px] bg-gradient-to-b from-[#2457d6] to-[#1a43ad] px-[6%] pt-[13%] pb-[7%] shadow-[0_10px_18px_rgba(15,34,57,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]">
            {/* 핀 넷과 이름 */}
            <div className="absolute top-0 left-1/2 flex -translate-x-1/2 -translate-y-[38%] gap-[0.9rem]">
              {pins.map((p) => (
                <div key={p} className="flex flex-col items-center">
                  <span className="h-5 w-1.5 rounded-t-sm bg-gradient-to-b from-[#f4d27a] to-[#c9971f]" />
                  <span className="h-2.5 w-3.5 rounded-[2px] bg-[#1b1b1f]" />
                  <span className="mt-1 font-mono text-[0.62rem] font-bold text-white/95">{p}</span>
                </div>
              ))}
            </div>
            {/* 고정 구멍 넷 */}
            {["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2"].map((c) => <span key={c} className={`absolute ${c} size-3 rounded-full border-2 border-[#c9d4f2] bg-[#0f2239]`} />)}
            {/* 유리 화면 */}
            <div className="relative rounded-md p-[3.5%] shadow-[inset_0_0_0_2px_#0b0f19]" style={{ background: OLED_BG }}>
              <canvas ref={cv} width={128} height={64} className="block aspect-[2/1] w-full [image-rendering:pixelated]" aria-label="OLED 에 보이는 글자" />
              <span className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-br from-white/12 via-transparent to-transparent" />
            </div>
            {/* 아래 띠 케이블 */}
            <div className="mx-auto mt-[4%] h-2 w-[38%] rounded-sm bg-[#e8c48a]/80" />
          </div>
        </div>

        <p className="mt-3 text-[0.8rem] leading-relaxed break-keep text-[#5b6168]">
          {running
            ? <>보드가 보낸 글자예요. 점 하나하나가 스스로 빛나서 <b style={{ color: OLED_INK }} className="rounded bg-[#030a1c] px-1">이렇게</b> 보여요. 한 줄은 점 8개 높이라서 여덟 줄까지 쓸 수 있어요.</>
            : "실행하면 보드가 보낸 글자가 여기에 나와요. 화면은 가로 128점 · 세로 64점이고, 한 줄은 점 8개 높이예요."}
        </p>
      </div>
    </div>
  );
}
