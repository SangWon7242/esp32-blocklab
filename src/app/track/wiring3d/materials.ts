import * as THREE from "three";

/*
 * 그림체: 밝음 세 단계(그림자 · 중간 · 빛 받는 면)의 toon 재질 + 짙은 남색 외곽선(OutlineEffect).
 * 같은 색 재질은 나눠 쓴다 (부품이 많아도 재질 수가 늘지 않게).
 */

let ramp: THREE.DataTexture | null = null;
export function toonRamp(): THREE.DataTexture {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
}

/** 외곽선을 그리지 않을 재질 (구멍 · 글자 판 · 빛처럼 작거나 납작한 것) */
export function noOutline<M extends THREE.Material>(m: M): M {
  m.userData.outlineParameters = { visible: false };
  return m;
}

const cache = new Map<string, THREE.MeshToonMaterial>();

/** 나눠 쓰는 toon 재질. 바꾸지 않을 것에만 쓴다 (켜고 끄는 LED 처럼 바뀌는 것은 toonOwn) */
export function toon(color: string, opts: { outline?: boolean; emissive?: string; emissiveIntensity?: number } = {}): THREE.MeshToonMaterial {
  const k = `${color}|${opts.outline ?? true}|${opts.emissive ?? ""}|${opts.emissiveIntensity ?? 0}`;
  let m = cache.get(k);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), emissive: opts.emissive ?? "#000000", emissiveIntensity: opts.emissiveIntensity ?? 0 });
    if (opts.outline === false) noOutline(m);
    cache.set(k, m);
  }
  return m;
}

/** 이 부품만의 재질 (색 · 밝기가 바뀐다) */
export function toonOwn(params: THREE.MeshToonMaterialParameters & { outline?: boolean }): THREE.MeshToonMaterial {
  const { outline, ...rest } = params;
  const m = new THREE.MeshToonMaterial({ gradientMap: toonRamp(), ...rest });
  if (outline === false) noOutline(m);
  return m;
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
