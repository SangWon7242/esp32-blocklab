/**
 * 3D 배선 장면: content/chapters/<id>/images/<이름>.3d.json (scripts/wiring/build.mjs 가 SVG 와 함께 쓴다).
 * 좌표는 배선도 SVG 와 같은 px. 장면은 필요할 때만 불러온다(조각).
 */
export type Pt = { x: number; y: number };
export type Part3D =
  | { type: "led"; a: Pt; c: Pt; color: string }
  | { type: "resistor"; a: Pt; b: Pt; bands: string[]; label?: string }
  | { type: "button"; legs: Pt[]; color: string }
  | { type: "buzzer"; a: Pt; b: Pt; active: boolean }
  | { type: "pot"; legs: Pt[] }
  | { type: "photo"; a: Pt; b: Pt }
  | { type: "tilt"; a: Pt; b: Pt }
  | { type: "rgb"; legs: Pt[] }
  | { type: "irrx"; legs: Pt[] }
  | { type: "dip"; l: Pt; r: Pt; label: string }
  | { type: "servo"; x: number; y: number; plug: Pt[]; onBoard: boolean; plugBox?: { x: number; y: number; w: number; h: number } }
  | { type: "module"; kind: string; x: number; y: number; w: number; h: number; color: string; side: "top" | "bottom"; title: string; pins: (Pt & { name: string })[] };

export type Scene3D = {
  board: "plus" | "devkit";
  height: number;
  title: string;
  boards: {
    kind: "plus" | "devkit"; name: string; x: number; y: number; w: number; h: number; color: string;
    chip: { x: number; y: number; w: number; h: number };
    usb: { x: number; y: number; w: number; h: number };
    pins: { x: number; y: number; label: string; fill: string; used: boolean }[];
  }[];
  breadboards: { x: number; y: number; w: number; h: number; gap: [number, number]; holes: [number, number][]; rails: { y: number; plus: boolean; xs: number[] }[] }[];
  parts: Part3D[];
  wires: { from: Pt; to: Pt; color: string; ends: ["f" | "m", "f" | "m"] }[];
  rows: { colors: string[]; part: string; to: string }[];
};

const scenes = import.meta.glob<Scene3D>("/content/chapters/*/images/*.3d.json", { import: "default" });

const REF = /^images\/[\w.-]+\.svg$/;

function key(chapterId: string, svgRef: string | undefined): string | undefined {
  if (!svgRef || !REF.test(svgRef) || !/^[\w-]+$/.test(chapterId)) return undefined;
  return `/content/chapters/${chapterId}/${svgRef.replace(/\.svg$/, ".3d.json")}`;
}

/** 그 그림(보드판까지 정해진 "images/x.svg" 또는 "images/x.devkit.svg")에 3D 장면이 있는지 */
export function hasScene3D(chapterId: string, svgRef: string | undefined): boolean {
  const k = key(chapterId, svgRef);
  return k !== undefined && k in scenes;
}

export function loadScene3D(chapterId: string, svgRef: string | undefined): Promise<Scene3D> | undefined {
  const k = key(chapterId, svgRef);
  return k !== undefined && k in scenes ? scenes[k]() : undefined;
}

/** 3D 를 강제로 켜거나 끄는 값을 두는 곳 (localStorage). "on" · "off" — 없으면 기기를 보고 정한다 */
export const WIRING_3D_KEY = "esp32-blocklab:3d";

let can3d: boolean | undefined;
/**
 * 이 기기에서 3D 배선을 보여 줄지. 그래픽 가속이 없는 기기(소프트웨어로 그리는 브라우저)는 3D 가 느려
 * 화면 전체가 굼떠지므로 배선도 그림으로 보여 준다. 브라우저에서만 부른다(서버에서는 false).
 */
export function canShow3D(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const forced = localStorage.getItem(WIRING_3D_KEY);
    if (forced === "on") return true;
    if (forced === "off") return false;
  } catch {
    // localStorage 가 막혀 있으면 기기를 보고 정한다
  }
  if (can3d !== undefined) return can3d;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return (can3d = false);
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return (can3d = !/swiftshader|llvmpipe|software|basic render/i.test(renderer));
  } catch {
    return (can3d = false);
  }
}
