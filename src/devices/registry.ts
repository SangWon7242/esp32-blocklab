import type { ActionSpec, DeviceCategory, DeviceSpec, SetupSpec, ValueSpec } from "./types";
import { pinOut, pwm } from "./specs/pin";
import { servo } from "./specs/motor";
import { ultrasonic } from "./specs/sensor";
import { oled } from "./specs/display";
import { printer } from "./specs/misc";

export const DEVICE_CATEGORIES: { id: DeviceCategory; label: string }[] = [
  { id: "pin", label: "핀" }, { id: "led", label: "LED" }, { id: "switch", label: "버튼·스위치" }, { id: "sensor", label: "센서" },
  { id: "sound", label: "소리" }, { id: "motor", label: "모터" }, { id: "display", label: "화면" }, { id: "input", label: "입력장치" },
];

/**
 * 순서가 곧 우선순위: 같은 줄에 맞는 선언이 여럿이면 앞의 것이 접힌다 (서보 3줄 > PWM 2줄, 초음파 > 핀).
 * 툴박스도 카테고리 안에서 이 순서로 보여 준다 (핀 카테고리: 핀 → PWM 핀 → 출력).
 */
export const DEVICES: DeviceSpec[] = [servo, ultrasonic, oled, pinOut, pwm, printer];

type WithDevice<T> = T & { device: DeviceSpec };
const byType = <T extends { blockType: string }>(items: T[]) => new Map(items.map((i) => [i.blockType, i]));
const setups = byType(DEVICES.flatMap((d): WithDevice<SetupSpec>[] => (d.setup ? [{ ...d.setup, device: d }] : [])));
const actions = byType(DEVICES.flatMap((d) => d.actions.map((a): WithDevice<ActionSpec> => ({ ...a, device: d }))));
const values = byType(DEVICES.flatMap((d) => d.values.map((v): WithDevice<ValueSpec> => ({ ...v, device: d }))));

export const findSetupByBlock = (type: string): WithDevice<SetupSpec> | undefined => setups.get(type);
export const findActionByBlock = (type: string): WithDevice<ActionSpec> | undefined => actions.get(type);
export const findValueByBlock = (type: string): WithDevice<ValueSpec> | undefined => values.get(type);
/** 모든 준비 선언 (DEVICES 우선순위 순) */
export const setupSpecs = (): WithDevice<SetupSpec>[] => [...setups.values()];
export const devicesByCategory = (c: DeviceCategory): DeviceSpec[] => DEVICES.filter((d) => d.category === c);
