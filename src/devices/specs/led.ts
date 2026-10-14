import type { DeviceSpec } from "../types";
import { factor, isSingleOperand, pinNo, RE_NAME, RE_PIN, validPins } from "./common";

/**
 * 밝기 LED (dev_led_pwm_setup). PWM 2줄과 같은 꼴이지만 freq 가 1000 이고 이름이 led… 일 때만 접는다 (아니면 pwm 선언이 잡는다).
 * 그래서 레지스트리에서 pwm 보다 앞에 둔다. 장치 kind 는 pwm 이라 세기 블록은 PWM 핀에도 쓸 수 있다.
 */
export const ledPwm: DeviceSpec = {
  id: "led_pwm", category: "led", label: "밝기 LED", toolboxOrder: 11, colour: "#d5d410",
  setup: {
    blockType: "dev_led_pwm_setup",
    message: "밝기 조절 LED를 핀 %1 에 준비하고 %2 이름 붙이기",
    parts: [pinNo("PIN", 26, "out"), { kind: "var", name: "VAR", default: "led" }],
    tooltip: "led = PWM(Pin(26)); led.freq(1000) — 밝기를 0~1023 세기로 조절합니다.",
    lines: (v) => [`${v.VAR} = PWM(Pin(${v.PIN}))`, `${v.VAR}.freq(1000)`],
    kind: "pwm",
    provides: (v) => [v.VAR],
    pattern: {
      lines: [new RegExp(String.raw`^${RE_NAME}\s*=\s*PWM\(\s*Pin\(\s*${RE_PIN}\s*\)\s*\)$`), new RegExp(String.raw`^${RE_NAME}\.freq\(\s*(\d+)\s*\)$`)],
      // esp_pwm_setup 의 기본 주파수도 1000 이라 같은 줄을 낸다. 이름이 led 로 시작할 때만 밝기 LED 로 접는다 (나머지는 pwm 선언이 잡는다)
      fields: ([a, b]) => (a[1] === b[1] && b[2] === "1000" && /^led/.test(a[1]) && validPins(a[2]) ? { PIN: a[2], VAR: a[1] } : null),
    },
  },
  actions: [
    {
      blockType: "dev_led_brightness", message: "%1 밝기를 %2 % 로",
      parts: [{ kind: "var", name: "VAR", default: "led" }, { kind: "value", name: "PCT", check: "Number", shadow: 50 }],
      tooltip: "led.duty(int(퍼센트 * 1023 / 100)) — 0 은 꺼짐, 100 은 가장 밝게",
      code: (v) => `${v.VAR}.duty(int(${factor(v.PCT)} * 1023 / 100))`,
      // method 패턴이면 인자 식이 계산 블록으로 풀려 dev_pwm_duty10 으로 돌아온다. 1줄 lines 패턴으로 자기 블록으로 되돌린다
      pattern: {
        kind: "lines", objPart: "VAR",
        lines: [/^(\w+)\.duty\(int\((.+) \* 1023 \/ 100\)\)$/],
        values: ([m]) => (isSingleOperand(m[2]) ? { VAR: m[1], PCT: m[2] } : null),
      },
      range: { PCT: { min: 0, max: 100, label: { ko: "밝기", en: "brightness" } } },
    },
    {
      blockType: "dev_pwm_duty10", message: "%1 세기를 %2 로 정하기 (0~1023)",
      parts: [{ kind: "var", name: "VAR", default: "led" }, { kind: "value", name: "DUTY", check: "Number", shadow: 512 }],
      tooltip: "led.duty(0~1023)",
      code: (v) => `${v.VAR}.duty(${v.DUTY})`,
      pattern: { kind: "method", name: "duty", args: [null], objPart: "VAR", objKinds: ["pwm"] },
      range: { DUTY: { min: 0, max: 1023, label: { ko: "세기", en: "duty" } } },
    },
  ],
  values: [],
};

/** LED: 준비 블록은 핀 출력(esp_pin_setup, pinOut.alsoIn)을 쓴다. 깜빡이기는 반복 블록으로 돌아온다 */
export const led: DeviceSpec = {
  id: "led", category: "led", label: "LED", toolboxOrder: 10, colour: "#ffd500",
  actions: [
    {
      blockType: "dev_led_blink", message: "%1 을(를) %2 초 간격으로 %3 번 깜빡이기",
      parts: [{ kind: "var", name: "VAR", default: "led" }, { kind: "value", name: "SEC", check: "Number", shadow: 0.5 }, { kind: "value", name: "TIMES", check: "Number", shadow: 3 }],
      tooltip: "켜고 기다리고 끄고 기다리기를 정한 번만큼 되풀이합니다.",
      code: (v) => [`for i in range(${v.TIMES}):`, `    ${v.VAR}.value(1)`, `    time.sleep(${v.SEC})`, `    ${v.VAR}.value(0)`, `    time.sleep(${v.SEC})`].join("\n"),
      pattern: { kind: "none" },
      varKinds: ["pin"],
      range: { TIMES: { min: 1, max: 1000, label: { ko: "횟수", en: "times" } } },
    },
  ],
  values: [],
};

const RGB_NAMES = ["red", "green", "blue"] as const;
const hex2 = (n: number) => n.toString(16).padStart(2, "0");

/** RGB LED (dev_rgb_setup). 이름 red/green/blue 고정, set_color(r, g, b) 도우미 (0~255) */
export const rgb: DeviceSpec = {
  id: "rgb", category: "led", label: "RGB LED", toolboxOrder: 12, colour: "#ffbf47",
  setup: {
    blockType: "dev_rgb_setup",
    message: "RGB LED 준비하기 (빨강 핀 %1, 초록 핀 %2, 파랑 핀 %3)",
    parts: [pinNo("R", 27, "out"), pinNo("G", 25, "out"), pinNo("B", 26, "out")],
    tooltip: "red/green/blue PWM 핀을 만들고 색을 정하는 set_color(r, g, b) 함수를 준비합니다.",
    lines: (v) => [
      `red = PWM(Pin(${v.R}))`, `green = PWM(Pin(${v.G}))`, `blue = PWM(Pin(${v.B}))`,
      "red.freq(1000)", "green.freq(1000)", "blue.freq(1000)",
    ],
    helpers: [{ name: "set_color", params: "r, g, b", body: ["red.duty(r * 1023 // 255)", "green.duty(g * 1023 // 255)", "blue.duty(b * 1023 // 255)"] }],
    kind: "rgb",
    provides: () => [...RGB_NAMES, "set_color"],
    pattern: {
      lines: [
        ...RGB_NAMES.map((n) => new RegExp(String.raw`^${n}\s*=\s*PWM\(\s*Pin\(\s*(\d+)\s*\)\s*\)$`)),
        ...RGB_NAMES.map((n) => new RegExp(String.raw`^${n}\.freq\(\s*1000\s*\)$`)),
      ],
      fields: ([r, g, b]) => (validPins(r[1], g[1], b[1]) ? { R: r[1], G: g[1], B: b[1] } : null),
    },
  },
  actions: [
    // 리터럴 셋은 색 블록으로 돌아오도록 dev_rgb_set 보다 앞에 둔다 (lines 패턴은 call 보다 먼저 본다)
    {
      blockType: "dev_rgb_colour", message: "RGB 색 %1",
      parts: [{ kind: "colour", name: "COLOUR", default: "#ff69b4" }],
      tooltip: "고른 색으로 set_color(r, g, b) 를 부릅니다.",
      code: (v) => `set_color(${[1, 3, 5].map((i) => parseInt(v.COLOUR.slice(i, i + 2), 16)).join(", ")})`,
      pattern: {
        kind: "lines",
        lines: [/^set_color\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/],
        values: ([m]) => {
          const ns = [m[1], m[2], m[3]].map(Number);
          return ns.every((n) => n <= 255) ? { COLOUR: "#" + ns.map(hex2).join("") } : null;
        },
      },
    },
    {
      blockType: "dev_rgb_set", message: "RGB 색 정하기 (빨강 %1 초록 %2 파랑 %3)",
      parts: [
        { kind: "value", name: "R", check: "Number", shadow: 255 },
        { kind: "value", name: "G", check: "Number", shadow: 105 },
        { kind: "value", name: "B", check: "Number", shadow: 180 },
      ],
      tooltip: "set_color(빨강, 초록, 파랑) — 각각 0~255",
      code: (v) => `set_color(${v.R}, ${v.G}, ${v.B})`,
      pattern: { kind: "call", name: "set_color", args: [null, null, null] },
      range: {
        R: { min: 0, max: 255, label: { ko: "빨강", en: "red" } },
        G: { min: 0, max: 255, label: { ko: "초록", en: "green" } },
        B: { min: 0, max: 255, label: { ko: "파랑", en: "blue" } },
      },
    },
    {
      blockType: "dev_rgb_off", message: "RGB 끄기", parts: [],
      tooltip: "set_color(0, 0, 0)",
      code: () => "set_color(0, 0, 0)",
      pattern: { kind: "none" }, // 검은색 색 블록으로 돌아온다
    },
  ],
  values: [],
};

/** 흐르는 LED (dev_flow_setup). 이름 pins 고정, flow_leds(ms) 도우미 */
export const flowLed: DeviceSpec = {
  id: "flow_led", category: "led", label: "흐르는 LED", toolboxOrder: 13, colour: "#cbfa65",
  setup: {
    blockType: "dev_flow_setup",
    message: "흐르는 LED 준비하기 (핀 목록 %1)",
    parts: [{ kind: "text", name: "PINS", default: "18, 5, 14, 17, 26", validate: /^\d+(\s*,\s*\d+)*$/ }],
    tooltip: "pins 목록을 만들고 LED 를 차례로 켜는 flow_leds(ms) 함수를 준비합니다.",
    lines: (v) => [`pins = [${v.PINS}]`],
    helpers: [
      {
        name: "flow_leds", params: "ms",
        body: ["for pin in pins:", "  led = Pin(pin, Pin.OUT)", "  led.value(1)", "  time.sleep_ms(ms)", "  led.value(0)"],
      },
    ],
    kind: "flow",
    provides: () => ["pins", "flow_leds"],
    pattern: {
      lines: [/^pins\s*=\s*\[([\d,\s]+)\]$/],
      fields: ([m]) => {
        const pins = m[1].split(",").map((s) => s.trim()).filter(Boolean);
        return pins.length && validPins(...pins) ? { PINS: pins.join(", ") } : null;
      },
    },
  },
  actions: [
    {
      blockType: "dev_flow_run", message: "LED 차례로 켜기 (간격 %1 ms)",
      parts: [{ kind: "value", name: "MS", check: "Number", shadow: 100 }],
      tooltip: "flow_leds(ms) — 목록의 LED 를 하나씩 켰다 끕니다.",
      code: (v) => `flow_leds(${v.MS})`,
      pattern: { kind: "call", name: "flow_leds", args: [null] },
    },
  ],
  values: [],
};
