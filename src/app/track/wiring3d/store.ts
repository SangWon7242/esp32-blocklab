import { createContext, useContext } from "react";
import * as THREE from "three";
import { createStore, useStore, type StoreApi } from "zustand";
import type { Device } from "@/track/sim/circuit";
import type { Assembly } from "./assembly";
import type { Simulator } from "@/track/sim/engine";

/*
 * 3D 배선 보기 한 대의 상태. 3D 속 부품(R3F 컴포넌트)과 화면 위 글자(카드 · 설명 · 읽은 값 판)가 함께 본다.
 * 시뮬레이션의 입력 · 출력은 매 화면 바뀌므로 상태에 넣지 않고 sim 객체를 직접 읽고 쓴다 (다시 그리기를 줄인다).
 */

/** 마우스를 올린 것 */
export type Hover = {
  id: string;
  label: string;
  text: string;
  /** 선: 같은 색 선만 또렷하게 */
  wire?: string;
  /** 노랗게 덧칠할 칸들 (핀 · 구멍) — 크기는 markSize */
  marks?: THREE.Vector3[];
  markSize?: [number, number, number];
  /** 들어 올릴지 (부품) */
  lift?: boolean;
  /** 둘레 빛을 깔 바닥 상자 (부품) */
  box?: THREE.Box3;
};

/** 누른 부품: 원형 빛 + 부품 카드 */
export type Selected = {
  id: string;
  label: string;
  text: string;
  center: THREE.Vector3;
  radius: number;
  control?: { type: "led"; part: number } | { type: "resistor" };
};

export type ViewerState = {
  hover: Hover | null;
  selected: Selected | null;
  /** 연결 목록 · 선을 눌러 고른 선 색 */
  picked: string | null;
  /** 목록 줄에 마우스를 올린 선 색 */
  preview: string | null;
  running: boolean;
  sound: boolean;
  topView: boolean;
  dragging: boolean;
  ledColor: Record<number, string>;
  /** 저항 값에 따른 밝기 배수 */
  dim: number;
  /** 읽은 값 판 (초당 몇 번만 고친다) */
  readings: [string, string][];
  serial: string[];
  /** 폰 화면 (WiFi 챕터): 보드 웹서버가 보여 주는 단추 · 글 */
  phone: { title: string; buttons: { label: string; path: string }[]; lines: string[] } | null;
  /** 조립 순서 보기: 지금 단계 (null 이면 다 보인다) */
  step: number | null;
  assembly: Assembly | null;
  /** 시뮬레이션 (없으면 그 챕터 동작이 아직 없다) */
  sim: Simulator | null;
  devices: Device[];
  /** 장면이 다시 그려지게 (R3F invalidate) */
  invalidate: () => void;
  /** 화면 위 글자들이 따라갈 DOM (부품 카드 · 점선 · 설명 카드 …) */
  dom: {
    partCard: HTMLElement | null;
    leader: SVGPathElement | null;
    leaderHalo: SVGPathElement | null;
    leaderDot: SVGGElement | null;
    tip: HTMLElement | null;
    callouts: HTMLElement | null;
    nodes: Map<string, { dot: HTMLElement | null; card: HTMLElement | null; line: SVGLineElement | null }>;
  };
  /** 카메라 다루기 (보기 단추 · 키보드) — 카메라 컴포넌트가 채운다 */
  camera: { rotate: (dir: 1 | -1) => void; zoom: (f: number) => void; pan: (dx: number, dy: number) => void; top: (on: boolean) => void; reset: () => void; focus: (at: THREE.Vector3 | null) => void } | null;
  set: (p: Partial<ViewerState>) => void;
};

export function createViewerStore(): StoreApi<ViewerState> {
  return createStore<ViewerState>((set) => ({
    hover: null, selected: null, picked: null, preview: null,
    running: false, sound: false, topView: false, dragging: false,
    ledColor: {}, dim: 1, readings: [], serial: [], phone: null,
    sim: null, devices: [], step: null, assembly: null,
    invalidate: () => {},
    dom: { partCard: null, leader: null, leaderHalo: null, leaderDot: null, tip: null, callouts: null, nodes: new Map() },
    camera: null,
    set: (p) => set(p),
  }));
}

export const ViewerContext = createContext<StoreApi<ViewerState> | null>(null);

export function useViewerApi(): StoreApi<ViewerState> {
  const api = useContext(ViewerContext);
  if (!api) throw new Error("ViewerContext 가 없어요");
  return api;
}

export function useViewer<T>(pick: (s: ViewerState) => T): T {
  return useStore(useViewerApi(), pick);
}
