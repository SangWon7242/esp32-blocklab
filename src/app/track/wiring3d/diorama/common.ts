import type { Device } from "@/track/sim/circuit";
import type { Outputs } from "@/track/sim/engine";
import type { ViewerState } from "../store";

/*
 * 현장 모형이 함께 쓰는 것: 시뮬레이션 출력 읽기.
 * 현장 모형은 회로와 같은 신호(서보 각도 · 핀 · 부저 · OLED)로 움직인다. 실행하지 않을 때는 쉬는 모습.
 */

/** 실행 중일 때만 출력 (멈추면 null → 쉬는 모습) */
export const simOut = (s: ViewerState): Outputs | null => (s.running && s.sim ? s.sim.outputs : null);

/** 그 종류의 첫 장치 */
export const deviceKind = <K extends Device["kind"]>(s: ViewerState, kind: K) =>
  s.devices.find((d): d is Extract<Device, { kind: K }> => d.kind === kind);

/** 첫 서보의 각도 (없거나 멈췄으면 rest) */
export function servoAngle(s: ViewerState, rest: number): number {
  const o = simOut(s);
  const d = deviceKind(s, "servo");
  return o && d ? o.servo[d.pin] ?? rest : rest;
}

/** 핀 값 0~1 */
export const pinLevel = (s: ViewerState, pin: number | undefined): number => {
  const o = simOut(s);
  return o && pin !== undefined ? o.pins[pin] ?? 0 : 0;
};

/** 첫 RGB LED 의 색 (r, g, b 0~1) */
export function rgbOf(s: ViewerState): [number, number, number] {
  const d = deviceKind(s, "rgb");
  return [pinLevel(s, d?.r), pinLevel(s, d?.g), pinLevel(s, d?.b)];
}

/** 부저가 울리는지 */
export function buzzing(s: ViewerState): boolean {
  const o = simOut(s);
  const d = deviceKind(s, "buzzer");
  if (!o || !d) return false;
  return (o.tone[d.pin] ?? 0) > 0 || (o.pins[d.pin] ?? 0) > 0.5;
}

/** 부드럽게 따라가기: 지금 값에서 목표로 한 화면만큼 */
export const ease = (cur: number, goal: number, dt: number, rate = 6) => cur + (goal - cur) * Math.min(1, dt * rate);
