import type { DeviceSpec } from "../types";
import { adcLines, adcPatternLines, ORDER, pinNo, RE_NAME, RE_PIN, validPins } from "./common";

/** 핀 출력·입력 (esp_pin_setup). 초음파 trig/echo 도 핀이므로 켜기·끄기·값 블록은 그 변수에도 맞는다 */
export const pinOut: DeviceSpec = {
  id: "pin_out", category: "pin", label: "핀", toolboxOrder: 1,
  alsoIn: ["led"], // LED 는 따로 준비 블록이 없다: 출력 핀 준비·켜기·끄기를 LED 카테고리에도 보여 준다
  setup: {
    blockType: "esp_pin_setup",
    message: "핀 %1 을(를) %2 으로 준비하고 %3 이름 붙이기",
    parts: [pinNo("PIN", 26), { kind: "dropdown", name: "MODE", options: [["출력", "OUT"], ["입력", "IN"]] }, { kind: "var", name: "VAR", default: "led" }],
    tooltip: "led = Pin(26, Pin.OUT) 처럼 핀에 이름을 붙입니다. 코드 맨 위에 모입니다.",
    lines: (v) => [`${v.VAR} = Pin(${v.PIN}, Pin.${v.MODE})`],
    kind: "pin",
    pattern: {
      lines: [new RegExp(String.raw`^${RE_NAME}\s*=\s*Pin\(\s*${RE_PIN}\s*,\s*Pin\.(OUT|IN)\s*\)$`)],
      fields: ([m]) => (validPins(m[2]) ? { VAR: m[1], PIN: m[2], MODE: m[3] } : null),
      vars: ([m]) => [m[1]],
    },
  },
  actions: [
    {
      blockType: "esp_pin_write", message: "%1 %2",
      parts: [{ kind: "var", name: "VAR", default: "led" }, { kind: "dropdown", name: "VALUE", options: [["켜기", "1"], ["끄기", "0"]] }],
      tooltip: "led.value(1) 은 켜기, led.value(0) 은 끄기",
      code: (v) => `${v.VAR}.value(${v.VALUE})`,
      pattern: { kind: "method", name: "value", args: [["0", "1"]], objPart: "VAR", objKinds: ["pin", "ultrasonic"] },
    },
  ],
  values: [
    {
      blockType: "esp_pin_read", message: "%1 값",
      parts: [{ kind: "var", name: "VAR", default: "echo" }],
      tooltip: "echo.value() — 입력 핀의 값(0 또는 1)",
      code: (v) => `${v.VAR}.value()`,
      output: ["Number", "Boolean"], // while not echo.value(): 처럼 조건에도 쓴다
      pattern: { kind: "method", name: "value", args: [], objPart: "VAR", objKinds: ["pin", "ultrasonic"] },
    },
  ],
};

/** PWM 핀 (esp_pwm_setup). 세기 블록은 서보 변수에도 쓴다 */
export const pwm: DeviceSpec = {
  id: "pwm", category: "pin", label: "PWM 핀", toolboxOrder: 3,
  setup: {
    blockType: "esp_pwm_setup", message: "PWM %1 을(를) 핀 %2 에 준비하기 (주파수 %3 Hz)",
    parts: [{ kind: "var", name: "VAR", default: "pwm" }, pinNo("PIN", 2), { kind: "number", name: "FREQ", default: 1000, min: 1 }],
    tooltip: "pwm = PWM(Pin(2)); pwm.freq(1000)",
    lines: (v) => [`${v.VAR} = PWM(Pin(${v.PIN}))`, `${v.VAR}.freq(${v.FREQ})`],
    kind: "pwm",
    pattern: {
      lines: [new RegExp(String.raw`^${RE_NAME}\s*=\s*PWM\(\s*Pin\(\s*${RE_PIN}\s*\)\s*\)$`), new RegExp(String.raw`^${RE_NAME}\.freq\(\s*(\d+)\s*\)$`)],
      fields: ([a, b]) => (a[1] === b[1] && validPins(a[2]) ? { VAR: a[1], PIN: a[2], FREQ: b[2] } : null),
      vars: ([a]) => [a[1]],
    },
  },
  actions: [
    {
      blockType: "esp_pwm_duty", message: "%1 세기를 %2 로 정하기",
      parts: [{ kind: "var", name: "VAR", default: "pwm" }, { kind: "value", name: "DUTY", check: "Number", shadow: 32768 }],
      tooltip: "pwm.duty_u16(0~65535)",
      code: (v) => `${v.VAR}.duty_u16(${v.DUTY})`,
      pattern: { kind: "method", name: "duty_u16", args: [null], objPart: "VAR", objKinds: ["pwm", "servo"] },
      range: { DUTY: [0, 65535] },
    },
  ],
  values: [],
};

/** 풀업 입력 핀 (dev_pin_in_setup). 풀업 줄은 버튼 선언이 먼저 잡고, 그대로(NONE) 줄은 esp_pin_setup 이 잡는다 */
export const pinIn: DeviceSpec = {
  id: "pin_in", category: "pin", label: "입력 핀", toolboxOrder: 2,
  setup: {
    blockType: "dev_pin_in_setup",
    message: "입력 핀 %1 을(를) %2 준비하고 %3 이름 붙이기",
    parts: [pinNo("PIN", 14), { kind: "dropdown", name: "PULL", options: [["풀업으로", "PULL_UP"], ["그대로", "NONE"]] }, { kind: "var", name: "VAR", default: "button" }],
    tooltip: "button = Pin(14, Pin.IN, Pin.PULL_UP) — 풀업이면 누르지 않을 때 1, 누르면 0 입니다.",
    lines: (v) => [v.PULL === "PULL_UP" ? `${v.VAR} = Pin(${v.PIN}, Pin.IN, Pin.PULL_UP)` : `${v.VAR} = Pin(${v.PIN}, Pin.IN)`],
    kind: "pin",
    pattern: {
      lines: [new RegExp(String.raw`^${RE_NAME}\s*=\s*Pin\(\s*${RE_PIN}\s*,\s*Pin\.IN\s*,\s*Pin\.PULL_UP\s*\)$`)],
      fields: ([m]) => (validPins(m[2]) ? { PIN: m[2], PULL: "PULL_UP", VAR: m[1] } : null),
      vars: ([m]) => [m[1]],
    },
  },
  actions: [],
  values: [],
};

/** 아날로그 핀 (dev_adc_setup). 0~4095 로 읽는다. 조도·가변저항·소리·불꽃 센서도 이 3줄로 접힌다 */
export const adc: DeviceSpec = {
  id: "adc", category: "pin", label: "아날로그 핀", toolboxOrder: 4,
  setup: {
    blockType: "dev_adc_setup",
    message: "아날로그 핀 %1 을(를) 준비하고 %2 이름 붙이기",
    parts: [{ kind: "pin", name: "PIN", default: 36, inputOnly: true }, { kind: "var", name: "VAR", default: "adc" }],
    tooltip: "adc = ADC(Pin(36)) — 0~3.3V 를 0~4095 로 읽습니다 (11dB 감쇠, 12비트).",
    lines: (v) => adcLines(v.VAR, v.PIN),
    kind: "adc",
    pattern: {
      lines: adcPatternLines(),
      fields: ([a, b, c]) => (a[1] === b[1] && a[1] === c[1] && validPins(a[2]) ? { PIN: a[2], VAR: a[1] } : null),
      vars: ([a]) => [a[1]],
    },
  },
  actions: [],
  values: [
    {
      blockType: "dev_adc_read", message: "%1 값 (0~4095)",
      parts: [{ kind: "var", name: "VAR", default: "adc" }],
      tooltip: "adc.read() — 0(0V) ~ 4095(3.3V)",
      code: (v) => `${v.VAR}.read()`,
      output: "Number",
      pattern: { kind: "method", name: "read", args: [], objPart: "VAR" },
    },
    {
      blockType: "dev_adc_voltage", message: "%1 전압 (V)",
      parts: [{ kind: "var", name: "VAR", default: "adc" }],
      tooltip: "adc.read() * 3.3 / 4095 — 읽은 값을 전압으로",
      code: (v) => `${v.VAR}.read() * 3.3 / 4095`,
      output: "Number",
      order: ORDER.MULTIPLICATIVE,
      pattern: { kind: "expr", regex: /^(\w+)\.read\(\) \* 3\.3 \/ 4095$/, objPart: "VAR" },
    },
  ],
};
