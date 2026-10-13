import type { DeviceSpec } from "../types";
import { pinNo, validPins } from "./common";

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
