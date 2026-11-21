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
  | { type: "module"; kind: string; x: number; y: number; w: number; h: number; color: string; side: "top" | "bottom"; title: string; pins: (Pt & { name: string })[] }
  /** 호일 터치 패드: 판(pad)과 악어 클립 끝(clip, 선이 물리는 자리) */
  | { type: "touch"; pad: { x: number; y: number; w: number; h: number }; clip: Pt; label?: string }
  /** 1자리 7세그먼트 표시 장치 (공통 음극): 몸통 사각형과 다리 구멍들 */
  | { type: "seg7"; x: number; y: number; w: number; h: number; legs: Pt[] }
  /** 책상 위 소품: 건전지 상자 · 전원 플러그 · 물통과 미니 워터 펌프(펌프의 + · − 선 끝이 사각형 안에 닿는다) */
  | { type: "prop"; kind: "battery" | "jack" | "pump"; x: number; y: number; w: number; h: number; label?: string };

type Rect = { x: number; y: number; w: number; h: number };
/** 보드 핀. row 는 확장 보드만 ("S" | "V" | "G" | "pwr" | "i2c" | "uart" | "jump") */
type BoardPin = { x: number; y: number; label: string; fill: string; used: boolean; row?: string };

/** ESP32 Plus · 기본 보드 DevKit. seatedOn: "expansion" 이면 확장 보드 암 헤더에 꽂힌 DevKit (그림처럼 scale 배로 줄여 기록됨) */
export type ChipBoard3D = {
  kind: "plus" | "devkit"; name: string; x: number; y: number; w: number; h: number; color: string;
  chip: Rect;
  usb: Rect;
  pins: BoardPin[];
  seatedOn?: "expansion";
  /** "glb": 실물 모델(public/blocklab/models/esp32_devkit_38pin.glb)로 그린다 — 맨 기본 보드(devkitGlb.tsx) */
  model?: "glb";
  scale?: number;
};

/**
 * 38핀 확장 보드 (scripts/wiring/boards/expansion.mjs): GPIO 마다 S/V/G 수 핀, 전원 헤더 · I2C/UART 헤더 · JUMP,
 * 가운데 노란 암 헤더(female)에 DevKit 이 꽂힌다 (scene.boards 의 다음 보드). jumper 는 V 줄 전압 점퍼 자리.
 * pitch 는 핀 간격(px, 2.54mm), mm 는 px/mm. parts 는 전원부 부품 자리(그림 px).
 */
export type ExpansionBoard3D = {
  kind: "expansion"; name: string; x: number; y: number; w: number; h: number; color: string;
  pitch: number; mm: number; jumper: "3V3" | "5V";
  pins: BoardPin[];
  female: { x: number; y: number; label: string; row: "top" | "top-inner" | "bot" }[];
  parts: {
    usbC: Rect; microUsb: Rect; dcJack: Rect; diode: Rect; smd: Rect; regulator: Rect; led: Rect;
    caps: { x: number; y: number; r: number }[]; holes: { x: number; y: number; r: number }[];
  };
  devkit: { x: number; y: number; scale: number };
};

export type Board3D = ChipBoard3D | ExpansionBoard3D;

export type Scene3D = {
  board: "plus" | "devkit" | "expansion";
  height: number;
  title: string;
  boards: Board3D[];
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

/** 그 그림(보드판까지 정해진 "images/x.svg" · "images/x.devkit.svg" · "images/x.expansion.svg")에 3D 장면이 있는지 */
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
