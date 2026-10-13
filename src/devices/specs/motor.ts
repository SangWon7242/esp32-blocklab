import type { DeviceSpec } from "../types";
import { pinNo, validPins } from "./common";

/** 서보 (esp_servo_setup). PWM 2줄보다 구체적인 3줄이라 레지스트리에서 pwm 보다 앞에 둔다 */
export const servo: DeviceSpec = {
  id: "servo", category: "motor", label: "서보 모터",
  setup: {
    blockType: "esp_servo_setup", message: "서보 %1 을(를) 핀 %2 에 준비하기 (처음엔 닫기)",
    parts: [{ kind: "var", name: "VAR", default: "servo" }, pinNo("PIN", 4)],
    tooltip: "servo = PWM(Pin(4)); servo.freq(50); servo.duty_u16(1638)",
    lines: (v) => [`${v.VAR} = PWM(Pin(${v.PIN}))`, `${v.VAR}.freq(50)`, `${v.VAR}.duty_u16(1638)`],
    kind: "servo",
    pattern: {
      lines: [/^(\w+)\s*=\s*PWM\(\s*Pin\(\s*(\d+)\s*\)\s*\)$/, /^(\w+)\.freq\(\s*50\s*\)$/, /^(\w+)\.duty_u16\(\s*1638\s*\)$/],
      fields: ([a, b, c]) => (a[1] === b[1] && a[1] === c[1] && validPins(a[2]) ? { VAR: a[1], PIN: a[2] } : null),
      vars: ([a]) => [a[1]],
    },
  },
  actions: [
    {
      blockType: "esp_servo_door", message: "%1 문 %2",
      parts: [{ kind: "var", name: "VAR", default: "servo" }, { kind: "dropdown", name: "ACTION", options: [["열기", "8100"], ["닫기", "1638"]] }],
      tooltip: "열기 = duty_u16(8100), 닫기 = duty_u16(1638)",
      code: (v) => `${v.VAR}.duty_u16(${v.ACTION})`,
      pattern: { kind: "method", name: "duty_u16", args: [["8100", "1638"]], objPart: "VAR" },
    },
  ],
  values: [],
};
