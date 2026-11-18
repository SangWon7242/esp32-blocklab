import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { Scene3D } from "@/track/wiring3d";
import { cueDuration, cueIntro, easeInOut, easeOut, endLabel, firstEnd, framePoints, lerpPose, phase, stageOf, tubeDrawCount, viewBasis, WIRE, type AssemblyCue } from "./assemblyCue";

/* 메이커 데이 색깔 카드 AI: DevKit + RGB 모듈, 선 넷 (R→D27, G→D25, B→D26, −→GND) */
const pin = (x: number, label: string) => ({ x, y: 186, label, fill: "#e8c547", used: true });
const scene: Scene3D = {
  board: "devkit", height: 340, title: "",
  boards: [{ kind: "devkit", name: "ESP32 DevKit (38핀)", x: 110, y: 170, w: 470, h: 150, color: "#161618", chip: { x: 0, y: 0, w: 1, h: 1 }, usb: { x: 0, y: 0, w: 1, h: 1 },
    pins: [pin(234, "GND"), pin(300, "D27"), pin(322, "D26"), pin(344, "D25 (DAC1)")] }],
  breadboards: [],
  parts: [{ type: "module", kind: "rgb", x: 272, y: 20, w: 100, h: 64, color: "#212529", side: "bottom", title: "RGB LED 모듈",
    pins: [{ name: "R", x: 292, y: 96 }, { name: "G", x: 312, y: 96 }, { name: "B", x: 332, y: 96 }, { name: "-", x: 352, y: 96 }] }],
  wires: [
    { from: { x: 292, y: 96 }, to: { x: 300, y: 186 }, color: "#e03131", ends: ["f", "f"] },
    { from: { x: 312, y: 96 }, to: { x: 344, y: 186 }, color: "#2f9e44", ends: ["f", "f"] },
    { from: { x: 332, y: 96 }, to: { x: 322, y: 186 }, color: "#1971c2", ends: ["f", "f"] },
    { from: { x: 234, y: 186 }, to: { x: 352, y: 96 }, color: "#343a40", ends: ["f", "f"] },
  ],
  rows: [],
};

const plan: AssemblyCue[] = [
  { kind: "place", board: 0 }, { kind: "place", part: 0 },
  { kind: "wire", wire: 0 }, { kind: "wire", wire: 1 }, { kind: "wire", wire: 2 }, { kind: "wire", wire: 3 },
  { kind: "all" },
];

describe("cueIntro · stageOf", () => {
  it("행사 차례: 보드 0, 모듈 1, 선 2~5", () => {
    expect(cueIntro(scene, plan)).toEqual({ boards: [0], parts: [1], wires: [2, 3, 4, 5] });
  });
  it("차례에 없는 보드는 늘 보이고, 부품 · 선은 다 보기 차례에 나온다", () => {
    const intro = cueIntro(scene, [{ kind: "wire", wire: 1 }, { kind: "all" }]);
    expect(intro.boards).toEqual([-1]);
    expect(intro.parts).toEqual([1]);
    expect(intro.wires).toEqual([1, 0, 1, 1]);
  });
  it("다 보기 차례도 없으면 끝내 숨는다", () => {
    expect(cueIntro(scene, [{ kind: "wire", wire: 0 }]).parts).toEqual([Infinity]);
  });
  it("지금 차례 앞은 다 된 모습, 지금은 움직임, 뒤는 숨김", () => {
    expect([0, 1, 2].map((intro) => stageOf(intro, 1))).toEqual(["done", "active", "hidden"]);
    expect(stageOf(-1, 0)).toBe("done");
    expect(stageOf(Infinity, 6)).toBe("hidden");
  });
});

describe("시간표", () => {
  it("구간 진행률은 0..1 로 자른다", () => {
    expect(phase([1, 3], 0)).toBe(0);
    expect(phase([1, 3], 2)).toBe(0.5);
    expect(phase([1, 3], 9)).toBe(1);
    expect(phase([2, 2], 2)).toBe(1);
  });
  it("선 잇기: 카메라 → 첫 끝 → 그리기 → 다른 끝 → 물러나기 차례이고 3~4초", () => {
    expect(WIRE.plugA[0]).toBeLessThan(WIRE.draw[0]);
    expect(WIRE.plugA[1]).toBeLessThanOrEqual(WIRE.draw[0]);
    expect(WIRE.draw[1]).toBeLessThanOrEqual(WIRE.plugB[1]);
    expect(WIRE.plugB[1]).toBeLessThanOrEqual(WIRE.camOut[1]);
    expect(cueDuration({ kind: "wire", wire: 0 })).toBeGreaterThanOrEqual(3);
    expect(cueDuration({ kind: "wire", wire: 0 })).toBeLessThanOrEqual(4);
    expect(cueDuration({ kind: "place", part: 0 })).toBeLessThan(2);
    expect(cueDuration(undefined)).toBe(0);
  });
  it("느려지는 곡선은 끝점을 지킨다", () => {
    for (const f of [easeOut, easeInOut]) { expect(f(0)).toBe(0); expect(f(1)).toBe(1); }
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });
  it("관 그리기 index 개수", () => {
    expect(tubeDrawCount(0, 64, 8)).toBe(0);
    expect(tubeDrawCount(0.5, 64, 8)).toBe(32 * 8 * 6);
    expect(tubeDrawCount(1, 64, 8)).toBe(64 * 8 * 6);
    expect(tubeDrawCount(2, 64, 8)).toBe(64 * 8 * 6);
  });
});

describe("선의 끝", () => {
  it("모듈 쪽 끝을 먼저 꽂는다 (보드 핀이 from 이어도)", () => {
    expect(firstEnd(scene, 0)).toBe("from");
    expect(firstEnd(scene, 3)).toBe("to");
  });
  it("끝 이름: 보드 핀은 괄호를 떼고, 모듈 − 는 긴 빼기표로", () => {
    expect(endLabel(scene, { x: 344, y: 186 })).toBe("D25");
    expect(endLabel(scene, { x: 352, y: 96 })).toBe("−");
    expect(endLabel(scene, { x: 292, y: 96 })).toBe("R");
  });
});

describe("카메라 맞춤", () => {
  const basis = viewBasis(Math.PI / 5, (36 * Math.PI) / 180);
  it("화면 기준 방향은 서로 직각", () => {
    expect(Math.abs(basis.right.dot(basis.up))).toBeLessThan(1e-9);
    expect(Math.abs(basis.right.y)).toBeLessThan(1e-9);
    expect(basis.up.y).toBeGreaterThan(0);
  });
  it("두 점이 여백 안에 들어오고 가운데가 맞는다", () => {
    const a = new THREE.Vector3(-50, 0, 0), b = new THREE.Vector3(50, 0, 0);
    const pose = framePoints([a, b], basis, { w: 800, h: 600 }, 50);
    const span = Math.abs(b.clone().sub(a).dot(basis.right)) * pose.zoom;
    expect(span).toBeLessThanOrEqual(700 + 1e-6);
    expect(pose.target.dot(basis.right)).toBeCloseTo(0, 6);
    expect(framePoints([a, b], basis, { w: 800, h: 600 }, 50, 0, 2).zoom).toBe(2);
  });
  it("배율은 곱셈으로 섞는다", () => {
    const p = lerpPose({ target: new THREE.Vector3(), zoom: 1 }, { target: new THREE.Vector3(10, 0, 0), zoom: 4 }, 0.5);
    expect(p.zoom).toBeCloseTo(2);
    expect(p.target.x).toBeCloseTo(5);
  });
});
