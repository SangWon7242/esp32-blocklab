import * as THREE from "three";

/*
 * 그림체: 실사 재질(PBR, MeshStandardMaterial) — 금속은 반짝이고 플라스틱은 무광이다.
 * 방 안 빛(RoomEnvironment)이 비치고 부드러운 그림자가 진다(Scene.tsx). 외곽선은 그리지 않는다.
 * 같은 색 재질은 나눠 쓴다 (부품이 많아도 재질 수가 늘지 않게).
 * 이름 toon · toonOwn 은 예전 그대로 둔다 (부르는 곳이 많다).
 */

/** 예전 외곽선 표시(지금은 외곽선이 없어서 아무 일도 하지 않지만, 표시는 남겨 둔다) */
export function noOutline<M extends THREE.Material>(m: M): M {
  m.userData.outlineParameters = { visible: false };
  return m;
}

/** 금속 · 반짝이는 것: 핀 · 다리 · 은색 통 · 금색 판 */
const METAL: Record<string, { rough: number; metal: number }> = {
  "#b4bac4": { rough: 0.32, metal: 0.9 },
  "#d9dde3": { rough: 0.28, metal: 0.85 },
  "#e8b93c": { rough: 0.3, metal: 0.95 },
  "#aab0ba": { rough: 0.3, metal: 0.9 },
  "#8a8f98": { rough: 0.45, metal: 0.6 },
  "#adb5bd": { rough: 0.45, metal: 0.35 },
};

/** 색에 맞는 거칠기 · 금속감 (모르면 무광 플라스틱) */
function surface(color: string) {
  const m = METAL[color.toLowerCase()];
  if (m) return { roughness: m.rough, metalness: m.metal };
  return { roughness: 0.58, metalness: 0.02 };
}

type Opts = { outline?: boolean; emissive?: string; emissiveIntensity?: number; rough?: number; metal?: number };

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** 나눠 쓰는 재질. 바꾸지 않을 것에만 쓴다 (켜고 끄는 LED 처럼 바뀌는 것은 toonOwn) */
export function toon(color: string, opts: Opts = {}): THREE.MeshStandardMaterial {
  const k = `${color}|${opts.emissive ?? ""}|${opts.emissiveIntensity ?? 0}|${opts.rough ?? ""}|${opts.metal ?? ""}`;
  let m = cache.get(k);
  if (!m) {
    const sf = surface(color);
    m = new THREE.MeshStandardMaterial({
      color, emissive: opts.emissive ?? "#000000", emissiveIntensity: opts.emissiveIntensity ?? 0,
      roughness: opts.rough ?? sf.roughness, metalness: opts.metal ?? sf.metalness,
    });
    cache.set(k, m);
  }
  return m;
}

/** 이 부품만의 재질 (색 · 밝기가 바뀐다) */
export function toonOwn(params: THREE.MeshStandardMaterialParameters & { outline?: boolean }): THREE.MeshStandardMaterial {
  const { outline, ...rest } = params;
  void outline;
  const sf = surface(typeof rest.color === "string" ? rest.color : "#000000");
  return new THREE.MeshStandardMaterial({ roughness: sf.roughness, metalness: sf.metalness, ...rest });
}

export const COLOR = {
  ink: "#0f2239",
  pcbDevkit: "#1e2026",
  pcbPlus: "#1d1d1f",
  plastic: "#26262c",
  metal: "#b4bac4",
  metalLight: "#d9dde3",
  gold: "#e8b93c",
  leg: "#aab0ba",
  white: "#f4f4f1",
  breadboard: "#fbf7ee",
  breadboardSide: "#dfd0b6",
  hole: "#4a4338",
  glow: "#ffd43b",
  select: "#f76707",
  signal: "#1c7ed6",
};

/** 글자 · 무늬를 그린 캔버스 텍스처 */
export function canvasTexture(w: number, h: number, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = Math.max(4, Math.round(w));
  cv.height = Math.max(4, Math.round(h));
  paint(cv.getContext("2d")!, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 부드러운 둥근 빛 (빛 번짐 · 선택 빛) */
let glowTex: THREE.CanvasTexture | null = null;
export function glowTexture(): THREE.CanvasTexture {
  if (!glowTex) {
    glowTex = canvasTexture(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,255,255,0.8)");
      gr.addColorStop(0.45, "rgba(255,255,255,0.3)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });
  }
  return glowTex;
}
