import type { DeviceSpec } from "../types";
import { adcLines, NO_SETUP_PATTERN, pinNo, validPins } from "./common";

/**
 * 초음파 (esp_ultrasonic_setup). 이름 trig/echo 고정, get_distance() 도우미.
 * 도우미가 같은 이름·표준 본문으로 최상위에 있을 때만 접힌다(Task 4). 아니면 두 줄은 esp_pin_setup 으로 떨어진다.
 */
export const ultrasonic: DeviceSpec = {
  id: "ultrasonic", category: "sensor", label: "초음파 센서",
  setup: {
    blockType: "esp_ultrasonic_setup", message: "초음파 센서 준비하기 (trig 핀 %1, echo 핀 %2)",
    parts: [pinNo("TRIG", 13), pinNo("ECHO", 12)],
    tooltip: "trig/echo 핀을 만들고 거리를 재는 get_distance() 함수를 준비합니다.",
    lines: (v) => [`trig = Pin(${v.TRIG}, Pin.OUT)`, `echo = Pin(${v.ECHO}, Pin.IN)`],
    helpers: [
      {
        name: "get_distance", params: "",
        body: [
          "trig.value(1)", "time.sleep_us(10)", "trig.value(0)",
          "while not echo.value():", "  pass",
          "start = time.ticks_us()",
          "while echo.value():", "  pass",
          "stop = time.ticks_us()",
          "t = time.ticks_diff(stop, start) // 2",
          "return int(340 * t // 10000)",
        ],
      },
    ],
    kind: "ultrasonic",
    pattern: {
      lines: [/^trig\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.OUT\s*\)$/, /^echo\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.IN\s*\)$/],
      fields: ([t, e]) => (validPins(t[1], e[1]) ? { TRIG: t[1], ECHO: e[1] } : null),
      vars: () => ["trig", "echo"],
    },
  },
  actions: [],
  values: [
    {
      blockType: "esp_distance", message: "거리 (cm)", parts: [],
      tooltip: "get_distance() — 초음파로 잰 거리(cm)",
      code: () => "get_distance()",
      output: "Number",
      pattern: { kind: "call", name: "get_distance", args: [] },
    },
  ],
};

/**
 * 아날로그 센서 (조도·가변저항·소리·불꽃). 준비 줄은 아날로그 핀과 같은 3줄이라 dev_adc_setup 으로 접히고,
 * 값은 dev_adc_read 를 함께 쓴다 (툴박스에는 그 센서 이름으로 넣는다).
 */
function adcSensor(id: string, label: string, subject: string, name: string): DeviceSpec {
  return {
    id, category: "sensor", label,
    setup: {
      blockType: `dev_${id}_setup`,
      message: `${subject} 핀 %1 에 준비하고 %2 이름 붙이기`,
      parts: [{ kind: "pin", name: "PIN", default: 36, inputOnly: true }, { kind: "var", name: "VAR", default: name }],
      tooltip: `${name} = ADC(Pin(36)) — 값은 0~4095 로 읽습니다.`,
      lines: (v) => adcLines(v.VAR, v.PIN),
      kind: "adc",
      pattern: NO_SETUP_PATTERN,
    },
    actions: [],
    values: [],
    extraToolbox: [{ blockType: "dev_adc_read", fields: { VAR: name } }],
  };
}

export const light = adcSensor("light", "조도 센서", "조도 센서를", "light");
export const knob = adcSensor("knob", "가변저항", "가변저항을", "knob");
export const sound = adcSensor("sound", "소리 센서", "소리 센서를", "sound");
export const flame = adcSensor("flame", "불꽃 센서", "불꽃 센서를", "flame");
