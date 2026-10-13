import type { Part } from "../types";

/** 핀 번호 칸 (0~39) */
export const pinNo = (name: string, d: number): Part => ({ kind: "pin", name, default: d });
/** 패턴 정규식 조각: 이름 `(\w+)`, 숫자 `(\d+)` */
export const RE_NAME = String.raw`(\w+)`;
export const RE_PIN = String.raw`(\d+)`;
/** ESP32 GPIO 번호(0~39). 블록의 핀 칸이 이 범위로 잘라 버리므로 밖의 번호는 준비 블록으로 접지 않는다 */
export const validPins = (...ns: string[]): boolean => ns.every((n) => Number(n) >= 0 && Number(n) <= 39);
