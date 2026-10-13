import type { DeviceSpec } from "../types";
import { NO_SETUP_PATTERN, ORDER, pinNo, RE_NAME, RE_PIN, validPins } from "./common";

/** 버튼 (dev_button_setup). 풀업 입력 핀 줄을 dev_pin_in_setup 보다 먼저 잡는다 */
export const button: DeviceSpec = {
  id: "button", category: "switch", label: "버튼",
  setup: {
    blockType: "dev_button_setup",
    message: "버튼을 핀 %1 에 준비하고 %2 이름 붙이기",
    parts: [pinNo("PIN", 14), { kind: "var", name: "VAR", default: "button" }],
    tooltip: "button = Pin(14, Pin.IN, Pin.PULL_UP) — 누르면 0, 떼면 1",
    lines: (v) => [`${v.VAR} = Pin(${v.PIN}, Pin.IN, Pin.PULL_UP)`],
    kind: "pin",
    pattern: {
      lines: [new RegExp(String.raw`^${RE_NAME}\s*=\s*Pin\(\s*${RE_PIN}\s*,\s*Pin\.IN\s*,\s*Pin\.PULL_UP\s*\)$`)],
      fields: ([m]) => (validPins(m[2]) ? { PIN: m[2], VAR: m[1] } : null),
      vars: ([m]) => [m[1]],
    },
  },
  actions: [],
  values: [
    {
      blockType: "dev_button_pressed", message: "%1 이(가) 눌렸는가",
      parts: [{ kind: "var", name: "VAR", default: "button" }],
      tooltip: "button.value() == 0 — 풀업 버튼은 누르면 0 입니다.",
      code: (v) => `${v.VAR}.value() == 0`,
      output: "Boolean",
      order: ORDER.RELATIONAL,
      pattern: { kind: "expr", regex: /^(\w+)\.value\(\) == 0$/, objPart: "VAR", objKinds: ["pin"] },
    },
  ],
};

/** 틸트 스위치 (dev_tilt_setup). 준비 줄은 esp_pin_setup 이 접는다 */
export const tilt: DeviceSpec = {
  id: "tilt", category: "switch", label: "틸트 스위치",
  setup: {
    blockType: "dev_tilt_setup",
    message: "틸트 스위치를 핀 %1 에 준비하고 %2 이름 붙이기",
    parts: [pinNo("PIN", 14), { kind: "var", name: "VAR", default: "tilt" }],
    tooltip: "tilt = Pin(14, Pin.IN) — 기울면 1",
    lines: (v) => [`${v.VAR} = Pin(${v.PIN}, Pin.IN)`],
    kind: "pin",
    pattern: NO_SETUP_PATTERN,
  },
  actions: [],
  values: [
    {
      blockType: "dev_tilt_tilted", message: "%1 이(가) 기울었는가",
      parts: [{ kind: "var", name: "VAR", default: "tilt" }],
      tooltip: "tilt.value() == 1",
      code: (v) => `${v.VAR}.value() == 1`,
      output: "Boolean",
      order: ORDER.RELATIONAL,
      pattern: { kind: "expr", regex: /^(\w+)\.value\(\) == 1$/, objPart: "VAR", objKinds: ["pin"] },
    },
  ],
};

/** 인체감지 센서 (dev_pir_setup). 준비 줄은 esp_pin_setup, `x.value() == 1` 은 틸트 선언이 먼저 잡는다 */
export const pir: DeviceSpec = {
  id: "pir", category: "switch", label: "인체감지(PIR)",
  setup: {
    blockType: "dev_pir_setup",
    message: "인체감지 센서를 핀 %1 에 준비하고 %2 이름 붙이기",
    parts: [pinNo("PIN", 14), { kind: "var", name: "VAR", default: "pir" }],
    tooltip: "pir = Pin(14, Pin.IN) — 사람이 움직이면 1",
    lines: (v) => [`${v.VAR} = Pin(${v.PIN}, Pin.IN)`],
    kind: "pin",
    pattern: NO_SETUP_PATTERN,
  },
  actions: [],
  values: [
    {
      blockType: "dev_pir_detected", message: "%1 에 사람이 있는가",
      parts: [{ kind: "var", name: "VAR", default: "pir" }],
      tooltip: "pir.value() == 1",
      code: (v) => `${v.VAR}.value() == 1`,
      output: "Boolean",
      order: ORDER.RELATIONAL,
      pattern: { kind: "expr", regex: /^(\w+)\.value\(\) == 1$/, objPart: "VAR", objKinds: ["pin"] },
    },
  ],
};

/** 조이스틱 (dev_joystick_setup). 이름 rocker_x/rocker_y/button_z 고정. adc·버튼 선언보다 앞에 둔다 */
export const joystick: DeviceSpec = {
  id: "joystick", category: "switch", label: "조이스틱",
  setup: {
    blockType: "dev_joystick_setup",
    message: "조이스틱 준비하기 (X 핀 %1, Y 핀 %2, 버튼 핀 %3)",
    parts: [pinNo("X", 36), pinNo("Y", 39), pinNo("Z", 26)],
    tooltip: "rocker_x/rocker_y 아날로그 핀과 button_z 풀업 입력 핀을 만듭니다.",
    lines: (v) => [
      `rocker_x = ADC(Pin(${v.X}))`, `rocker_y = ADC(Pin(${v.Y}))`,
      "rocker_x.atten(ADC.ATTN_11DB)", "rocker_y.atten(ADC.ATTN_11DB)",
      `button_z = Pin(${v.Z}, Pin.IN, Pin.PULL_UP)`,
    ],
    kind: "joystick",
    pattern: {
      lines: [
        /^rocker_x\s*=\s*ADC\(\s*Pin\(\s*(\d+)\s*\)\s*\)$/,
        /^rocker_y\s*=\s*ADC\(\s*Pin\(\s*(\d+)\s*\)\s*\)$/,
        /^rocker_x\.atten\(\s*ADC\.ATTN_11DB\s*\)$/,
        /^rocker_y\.atten\(\s*ADC\.ATTN_11DB\s*\)$/,
        /^button_z\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.IN\s*,\s*Pin\.PULL_UP\s*\)$/,
      ],
      fields: ([x, y, , , z]) => (validPins(x[1], y[1], z[1]) ? { X: x[1], Y: y[1], Z: z[1] } : null),
      vars: () => ["rocker_x", "rocker_y", "button_z"],
    },
  },
  actions: [],
  values: [
    {
      blockType: "dev_joystick_x", message: "조이스틱 X 값", parts: [],
      tooltip: "rocker_x.read() — 0~4095",
      code: () => "rocker_x.read()",
      output: "Number",
      pattern: { kind: "expr", regex: /^rocker_x\.read\(\)$/ },
    },
    {
      blockType: "dev_joystick_y", message: "조이스틱 Y 값", parts: [],
      tooltip: "rocker_y.read() — 0~4095",
      code: () => "rocker_y.read()",
      output: "Number",
      pattern: { kind: "expr", regex: /^rocker_y\.read\(\)$/ },
    },
    {
      blockType: "dev_joystick_pressed", message: "조이스틱 버튼이 눌렸는가", parts: [],
      tooltip: "button_z.value() == 0",
      code: () => "button_z.value() == 0",
      output: "Boolean",
      order: ORDER.RELATIONAL,
      pattern: { kind: "expr", regex: /^button_z\.value\(\) == 0$/ },
    },
  ],
};
