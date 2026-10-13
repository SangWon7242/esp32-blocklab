import type { DeviceSpec } from "../types";
import { factor, isSingleOperand, NO_SETUP_PATTERN, pinNo, validPins } from "./common";

/** 서보 (esp_servo_setup). PWM 2줄보다 구체적인 3줄이라 레지스트리에서 pwm 보다 앞에 둔다 */
export const servo: DeviceSpec = {
  id: "servo", category: "motor", label: "서보 모터", toolboxOrder: 60,
  setup: {
    blockType: "esp_servo_setup", message: "서보 %1 을(를) 핀 %2 에 준비하기 (처음엔 닫기)",
    parts: [{ kind: "var", name: "VAR", default: "servo" }, pinNo("PIN", 4, "out")],
    tooltip: "servo = PWM(Pin(4)); servo.freq(50); servo.duty_u16(1638)",
    lines: (v) => [`${v.VAR} = PWM(Pin(${v.PIN}))`, `${v.VAR}.freq(50)`, `${v.VAR}.duty_u16(1638)`],
    kind: "servo",
    provides: (v) => [v.VAR],
    pattern: {
      lines: [/^(\w+)\s*=\s*PWM\(\s*Pin\(\s*(\d+)\s*\)\s*\)$/, /^(\w+)\.freq\(\s*50\s*\)$/, /^(\w+)\.duty_u16\(\s*1638\s*\)$/],
      fields: ([a, b, c]) => (a[1] === b[1] && a[1] === c[1] && validPins(a[2]) ? { VAR: a[1], PIN: a[2] } : null),
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
    {
      blockType: "dev_servo_angle", message: "%1 각도를 %2 도로",
      parts: [{ kind: "var", name: "VAR", default: "servo" }, { kind: "value", name: "ANGLE", check: "Number", shadow: 90 }],
      tooltip: "0~180도를 duty_u16(1638~8100) 으로 바꿔 서보를 돌립니다.",
      code: (v) => `${v.VAR}.duty_u16(1638 + ${factor(v.ANGLE)} * 6462 // 180)`,
      // method 패턴(esp_pwm_duty)이면 계산 블록으로 풀린다. 1줄 lines 패턴으로 자기 블록으로 되돌린다
      pattern: {
        kind: "lines", objPart: "VAR", objKinds: ["servo"],
        lines: [/^(\w+)\.duty_u16\(1638 \+ (.+) \* 6462 \/\/ 180\)$/],
        values: ([m]) => (isSingleOperand(m[2]) ? { VAR: m[1], ANGLE: m[2] } : null),
      },
      range: { ANGLE: { min: 0, max: 180, label: { ko: "각도", en: "angle" } } },
    },
  ],
  values: [],
};

/** DC 모터 (dev_motor_setup). 이름 motor1a/motor1b 고정, forward(speed)·backward(speed)·stop() 도우미. PWM 핀 둘이라 pwm 보다 앞 */
export const dcMotor: DeviceSpec = {
  id: "dc_motor", category: "motor", label: "DC 모터", toolboxOrder: 61,
  setup: {
    blockType: "dev_motor_setup",
    message: "DC 모터 준비하기 (IN+ 핀 %1, IN- 핀 %2)",
    parts: [pinNo("A", 13, "out"), pinNo("B", 12, "out")],
    tooltip: "motor1a/motor1b PWM 핀과 forward·backward·stop 함수를 준비합니다.",
    lines: (v) => [`motor1a = PWM(Pin(${v.A}))`, `motor1b = PWM(Pin(${v.B}))`, "motor1a.freq(1000)", "motor1b.freq(1000)"],
    helpers: [
      { name: "forward", params: "speed", body: ["motor1a.duty(speed)", "motor1b.duty(0)"] },
      { name: "backward", params: "speed", body: ["motor1a.duty(0)", "motor1b.duty(speed)"] },
      { name: "stop", params: "", body: ["motor1a.duty(0)", "motor1b.duty(0)"] },
    ],
    kind: "motor",
    provides: () => ["motor1a", "motor1b", "forward", "backward", "stop"],
    pattern: {
      lines: [
        /^motor1a\s*=\s*PWM\(\s*Pin\(\s*(\d+)\s*\)\s*\)$/,
        /^motor1b\s*=\s*PWM\(\s*Pin\(\s*(\d+)\s*\)\s*\)$/,
        /^motor1a\.freq\(\s*1000\s*\)$/,
        /^motor1b\.freq\(\s*1000\s*\)$/,
      ],
      fields: ([a, b]) => (validPins(a[1], b[1]) ? { A: a[1], B: b[1] } : null),
    },
  },
  actions: [
    {
      blockType: "dev_motor_forward", message: "모터 앞으로 (속도 %1)",
      parts: [{ kind: "value", name: "SPEED", check: "Number", shadow: 1023 }],
      tooltip: "forward(속도) — 0~1023",
      code: (v) => `forward(${v.SPEED})`,
      pattern: { kind: "call", name: "forward", args: [null] },
      range: { SPEED: { min: 0, max: 1023, label: { ko: "속도", en: "speed" } } },
    },
    {
      blockType: "dev_motor_backward", message: "모터 뒤로 (속도 %1)",
      parts: [{ kind: "value", name: "SPEED", check: "Number", shadow: 1023 }],
      tooltip: "backward(속도) — 0~1023",
      code: (v) => `backward(${v.SPEED})`,
      pattern: { kind: "call", name: "backward", args: [null] },
      range: { SPEED: { min: 0, max: 1023, label: { ko: "속도", en: "speed" } } },
    },
    {
      blockType: "dev_motor_stop", message: "모터 정지", parts: [],
      tooltip: "stop() — 두 핀을 모두 0 으로",
      code: () => "stop()",
      pattern: { kind: "call", name: "stop", args: [] },
    },
  ],
  values: [],
};

/** 릴레이 (dev_relay_setup). 출력 핀이라 준비 줄은 esp_pin_setup 이 접고, 켜기·끄기는 esp_pin_write 를 쓴다 */
export const relay: DeviceSpec = {
  id: "relay", category: "motor", label: "릴레이", toolboxOrder: 62,
  setup: {
    blockType: "dev_relay_setup",
    message: "릴레이를 핀 %1 에 준비하고 %2 이름 붙이기",
    parts: [pinNo("PIN", 16, "out"), { kind: "var", name: "VAR", default: "relay" }],
    tooltip: "relay = Pin(16, Pin.OUT) — 켜면 연결된 회로가 이어집니다.",
    lines: (v) => [`${v.VAR} = Pin(${v.PIN}, Pin.OUT)`],
    kind: "pin",
    provides: (v) => [v.VAR],
    pattern: NO_SETUP_PATTERN,
  },
  actions: [],
  values: [],
  extraToolbox: [{ blockType: "esp_pin_write", fields: { VAR: "relay" } }],
};
