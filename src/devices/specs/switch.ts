import type { DeviceSpec } from "../types";
import { ORDER, RE_NAME, RE_PIN, factor, isSingleOperand, pinNo, unfactor, validPins } from "./common";

/** 인터럽트 함수 이름 칸: 파이썬 이름 꼴 */
const HANDLER_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** 버튼 (dev_button_setup). 풀업 입력 핀 줄을 dev_pin_in_setup 보다 먼저 잡는다 */
export const button: DeviceSpec = {
  id: "button", category: "switch", label: "버튼", toolboxOrder: 30, colour: "#6d3fe0",
  setup: {
    blockType: "dev_button_setup",
    message: "버튼을 핀 %1 에 준비하고 %2 이름 붙이기",
    parts: [pinNo("PIN", 14, "in"), { kind: "var", name: "VAR", default: "button" }],
    tooltip: "button = Pin(14, Pin.IN, Pin.PULL_UP) — 누르면 0, 떼면 1",
    lines: (v) => [`${v.VAR} = Pin(${v.PIN}, Pin.IN, Pin.PULL_UP)`],
    kind: "pin",
    provides: (v) => [v.VAR],
    pattern: {
      lines: [new RegExp(String.raw`^${RE_NAME}\s*=\s*Pin\(\s*${RE_PIN}\s*,\s*Pin\.IN\s*,\s*Pin\.PULL_UP\s*\)$`)],
      fields: ([m]) => (validPins(m[2]) ? { PIN: m[2], VAR: m[1] } : null),
    },
  },
  actions: [
    {
      blockType: "dev_button_irq", message: "버튼 %1 이 눌렸을 때 함수 %2 실행하기",
      parts: [{ kind: "var", name: "VAR", default: "button" }, { kind: "text", name: "FUNC", default: "on_press", validate: HANDLER_NAME }],
      tooltip: "button.irq(trigger=Pin.IRQ_FALLING, handler=on_press) — 버튼을 누르는 순간(1 → 0) 함수를 실행합니다. 함수는 매개변수 하나(pin)를 받아야 해요.",
      code: (v) => `${v.VAR}.irq(trigger=Pin.IRQ_FALLING, handler=${v.FUNC})`,
      // 이름 붙인 인자라 method 패턴(위치 인자만)으로는 못 잡는다. 생성기가 쓰는 글자 그대로의 한 줄만 블록으로
      pattern: {
        kind: "lines", objPart: "VAR", objKinds: ["pin", "tilt", "pir"],
        lines: [/^(\w+)\.irq\(trigger=Pin\.IRQ_FALLING, handler=([A-Za-z_]\w*)\)$/],
        values: ([m]) => ({ VAR: m[1], FUNC: m[2] }),
      },
    },
  ],
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

/**
 * 내장 터치 패드 (dev_touch_setup). 핀에 손가락을 대면 read() 값이 작아진다 (손을 떼면 수백, 대면 100 안팎).
 * 터치 핀은 T0~T9: 4·0·2·15·13·12·14·27·33·32 (검사 pin-rule 이 다른 핀에 주의를 준다).
 */
export const touch: DeviceSpec = {
  id: "touch", category: "switch", label: "터치 패드", toolboxOrder: 31, colour: "#9340de",
  setup: {
    blockType: "dev_touch_setup",
    message: "터치 핀 %1 을 %2 이름으로 준비하기",
    parts: [pinNo("PIN", 4, "touch"), { kind: "var", name: "VAR", default: "touch" }],
    tooltip: "touch = TouchPad(Pin(4)) — 손가락을 대면 값이 작아집니다.",
    lines: (v) => [`${v.VAR} = TouchPad(Pin(${v.PIN}))`],
    kind: "touch",
    provides: (v) => [v.VAR],
    pattern: {
      lines: [new RegExp(String.raw`^${RE_NAME}\s*=\s*TouchPad\(\s*Pin\(\s*${RE_PIN}\s*\)\s*\)$`)],
      fields: ([m]) => (validPins(m[2]) ? { PIN: m[2], VAR: m[1] } : null),
    },
  },
  actions: [],
  values: [
    {
      blockType: "dev_touch_value", message: "%1 터치 값",
      parts: [{ kind: "var", name: "VAR", default: "touch" }],
      tooltip: "touch.read() — 손을 떼면 큰 값, 손가락을 대면 작은 값",
      code: (v) => `${v.VAR}.read()`,
      output: "Number",
      pattern: { kind: "method", name: "read", args: [], objPart: "VAR" },
    },
    {
      blockType: "dev_touch_pressed", message: "%1 을 만졌는가 (기준 %2)",
      parts: [{ kind: "var", name: "VAR", default: "touch" }, { kind: "value", name: "THRESHOLD", check: "Number", shadow: 300 }],
      tooltip: "touch.read() < 300 — 값이 기준보다 작으면 만진 것입니다.",
      code: (v) => `${v.VAR}.read() < ${factor(v.THRESHOLD)}`,
      output: "Boolean",
      order: ORDER.RELATIONAL,
      // 기준 칸은 비교보다 단단히 묶는 피연산자 하나일 때만 (`touch.read() < 300 and ok` 의 `300 and ok` 는 아니다)
      pattern: {
        kind: "expr", regex: /^(\w+)\.read\(\) < (.+)$/, objPart: "VAR",
        values: (m) => (isSingleOperand(m[2]) ? { THRESHOLD: unfactor(m[2]) } : null),
      },
      range: { THRESHOLD: { min: 0, max: 1023, label: { ko: "기준", en: "threshold" } } },
    },
  ],
};

/** 틸트 스위치 (dev_tilt_setup). 이름이 tilt… 이면 자기 준비 블록으로 접힌다(kind tilt) */
export const tilt: DeviceSpec = {
  id: "tilt", category: "switch", label: "틸트 스위치", toolboxOrder: 32, colour: "#7c20c2",
  setup: {
    blockType: "dev_tilt_setup",
    message: "틸트 스위치를 핀 %1 에 준비하고 %2 이름 붙이기",
    parts: [pinNo("PIN", 14, "in"), { kind: "var", name: "VAR", default: "tilt" }],
    tooltip: "tilt = Pin(14, Pin.IN) — 기울면 1",
    lines: (v) => [`${v.VAR} = Pin(${v.PIN}, Pin.IN)`],
    kind: "tilt",
    provides: (v) => [v.VAR],
    // 이름이 tilt 으로 시작하는 `x = Pin(n, Pin.IN)` 만 이 장치로 접는다 (아니면 입력 핀 선언이 잡는다)
    pattern: {
      lines: [new RegExp(String.raw`^${RE_NAME}\s*=\s*Pin\(\s*${RE_PIN}\s*,\s*Pin\.IN\s*\)$`)],
      fields: ([m]) => (/^tilt/.test(m[1]) && validPins(m[2]) ? { PIN: m[2], VAR: m[1] } : null),
    },
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
      pattern: { kind: "expr", regex: /^(\w+)\.value\(\) == 1$/, objPart: "VAR" },
    },
  ],
};

/** 인체감지 센서 (dev_pir_setup). 이름이 pir… 이면 자기 준비 블록으로 접힌다(kind pir) */
export const pir: DeviceSpec = {
  id: "pir", category: "switch", label: "인체감지(PIR)", toolboxOrder: 33, colour: "#591ec4",
  setup: {
    blockType: "dev_pir_setup",
    message: "인체감지 센서를 핀 %1 에 준비하고 %2 이름 붙이기",
    parts: [pinNo("PIN", 14, "in"), { kind: "var", name: "VAR", default: "pir" }],
    tooltip: "pir = Pin(14, Pin.IN) — 사람이 움직이면 1",
    lines: (v) => [`${v.VAR} = Pin(${v.PIN}, Pin.IN)`],
    kind: "pir",
    provides: (v) => [v.VAR],
    // 이름이 pir 으로 시작하는 `x = Pin(n, Pin.IN)` 만 이 장치로 접는다 (아니면 입력 핀 선언이 잡는다)
    pattern: {
      lines: [new RegExp(String.raw`^${RE_NAME}\s*=\s*Pin\(\s*${RE_PIN}\s*,\s*Pin\.IN\s*\)$`)],
      fields: ([m]) => (/^pir/.test(m[1]) && validPins(m[2]) ? { PIN: m[2], VAR: m[1] } : null),
    },
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
      pattern: { kind: "expr", regex: /^(\w+)\.value\(\) == 1$/, objPart: "VAR" },
    },
  ],
};

/** 조이스틱 (dev_joystick_setup). 이름 rocker_x/rocker_y/button_z 고정. adc·버튼 선언보다 앞에 둔다 */
export const joystick: DeviceSpec = {
  id: "joystick", category: "switch", label: "조이스틱", toolboxOrder: 34, colour: "#8864ff",
  setup: {
    blockType: "dev_joystick_setup",
    message: "조이스틱 준비하기 (X 핀 %1, Y 핀 %2, 버튼 핀 %3)",
    parts: [pinNo("X", 36, "adc"), pinNo("Y", 39, "adc"), pinNo("Z", 26, "in")],
    tooltip: "rocker_x/rocker_y 아날로그 핀과 button_z 풀업 입력 핀을 만듭니다.",
    lines: (v) => [
      `rocker_x = ADC(Pin(${v.X}))`, `rocker_y = ADC(Pin(${v.Y}))`,
      "rocker_x.atten(ADC.ATTN_11DB)", "rocker_y.atten(ADC.ATTN_11DB)",
      `button_z = Pin(${v.Z}, Pin.IN, Pin.PULL_UP)`,
    ],
    kind: "joystick",
    provides: () => ["rocker_x", "rocker_y", "button_z"],
    pattern: {
      lines: [
        /^rocker_x\s*=\s*ADC\(\s*Pin\(\s*(\d+)\s*\)\s*\)$/,
        /^rocker_y\s*=\s*ADC\(\s*Pin\(\s*(\d+)\s*\)\s*\)$/,
        /^rocker_x\.atten\(\s*ADC\.ATTN_11DB\s*\)$/,
        /^rocker_y\.atten\(\s*ADC\.ATTN_11DB\s*\)$/,
        /^button_z\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.IN\s*,\s*Pin\.PULL_UP\s*\)$/,
      ],
      fields: ([x, y, , , z]) => (validPins(x[1], y[1], z[1]) ? { X: x[1], Y: y[1], Z: z[1] } : null),
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
