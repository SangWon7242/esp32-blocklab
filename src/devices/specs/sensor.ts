import type { DeviceSpec } from "../types";
import { adcLines, adcPatternLines, pinNo, validPins } from "./common";

/**
 * 초음파 (esp_ultrasonic_setup). 이름 trig/echo 고정, get_distance() 도우미.
 * 도우미가 같은 이름·표준 본문으로 최상위에 있을 때만 접힌다(Task 4). 아니면 두 줄은 esp_pin_setup 으로 떨어진다.
 */
export const ultrasonic: DeviceSpec = {
  id: "ultrasonic", category: "sensor", label: "초음파 센서", toolboxOrder: 46, colour: "#71bb4a",
  setup: {
    blockType: "esp_ultrasonic_setup", message: "초음파 센서 준비하기 (trig 핀 %1, echo 핀 %2)",
    parts: [pinNo("TRIG", 13, "out"), pinNo("ECHO", 12, "in")],
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
    provides: () => ["trig", "echo", "get_distance"],
    pattern: {
      lines: [/^trig\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.OUT\s*\)$/, /^echo\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.IN\s*\)$/],
      fields: ([t, e]) => (validPins(t[1], e[1]) ? { TRIG: t[1], ECHO: e[1] } : null),
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
 * 아날로그 센서 (조도·가변저항·소리·불꽃). 준비 줄은 아날로그 핀과 같은 3줄이지만, 변수 이름이 그 센서 이름(light…)으로
 * 시작할 때만 그 센서 준비 블록으로 접는다 (아니면 뒤의 dev_adc_setup 이 잡는다 — 레지스트리에서 adc 보다 앞에 둔다).
 * 값 블록(`dev_<id>_value`)은 센서마다 따로 두어 센서 색으로 보이게 한다. kind 도 센서마다 달라서 `light.read()` 는
 * 조도 센서 값 블록으로 돌아온다. 아날로그 핀의 dev_adc_read·dev_adc_voltage 도 이 변수들을 받는다 (objKinds).
 */
export const ADC_SENSOR_KINDS = ["light", "knob", "sound", "flame"] as const;

function adcSensor(id: (typeof ADC_SENSOR_KINDS)[number], label: string, subject: string, name: string, toolboxOrder: number, colour: string): DeviceSpec {
  const prefix = new RegExp(`^${id}`);
  return {
    id, category: "sensor", label, toolboxOrder, colour,
    setup: {
      blockType: `dev_${id}_setup`,
      message: `${subject} 핀 %1 에 준비하고 %2 이름 붙이기`,
      parts: [pinNo("PIN", 36, "adc"), { kind: "var", name: "VAR", default: name }],
      tooltip: `${name} = ADC(Pin(36)) — 값은 0~4095 로 읽습니다.`,
      lines: (v) => adcLines(v.VAR, v.PIN),
      kind: id,
      provides: (v) => [v.VAR],
      pattern: {
        lines: adcPatternLines(),
        fields: ([a, b, c]) => (a[1] === b[1] && a[1] === c[1] && prefix.test(a[1]) && validPins(a[2]) ? { PIN: a[2], VAR: a[1] } : null),
      },
    },
    actions: [],
    values: [
      {
        blockType: `dev_${id}_value`, message: "%1 값 (0~4095)",
        parts: [{ kind: "var", name: "VAR", default: name }],
        tooltip: `${name}.read() — 0 ~ 4095`,
        code: (v) => `${v.VAR}.read()`,
        output: "Number",
        pattern: { kind: "method", name: "read", args: [], objPart: "VAR" },
      },
    ],
  };
}

export const light = adcSensor("light", "조도 센서", "조도 센서를", "light", 40, "#5b9a1a");
export const knob = adcSensor("knob", "가변저항", "가변저항을", "knob", 41, "#5b8100");
export const sound = adcSensor("sound", "소리 센서", "소리 센서를", "sound", 42, "#918a00");
export const flame = adcSensor("flame", "불꽃 센서", "불꽃 센서를", "flame", 43, "#00935a");

/** 온습도 센서 DHT11 (dev_dht_setup). measure() 로 잰 뒤 temperature()·humidity() 를 읽는다 */
export const dht11: DeviceSpec = {
  id: "dht11", category: "sensor", label: "온습도(DHT11)", toolboxOrder: 47, colour: "#847500",
  setup: {
    blockType: "dev_dht_setup",
    message: "온습도 센서(DHT11)를 핀 %1 에 준비하고 %2 이름 붙이기",
    parts: [pinNo("PIN", 13, "bus"), { kind: "var", name: "VAR", default: "dht11" }], // 한 선으로 신호를 주고받는다
    tooltip: "dht11 = dht.DHT11(Pin(13)) — 측정하기 뒤에 온도·습도를 읽습니다.",
    lines: (v) => [`${v.VAR} = dht.DHT11(Pin(${v.PIN}))`],
    kind: "dht",
    provides: (v) => [v.VAR],
    pattern: {
      lines: [/^(\w+)\s*=\s*dht\.DHT11\(\s*Pin\(\s*(\d+)\s*\)\s*\)$/],
      fields: ([m]) => (validPins(m[2]) ? { PIN: m[2], VAR: m[1] } : null),
    },
  },
  actions: [
    {
      blockType: "dev_dht_measure", message: "%1 측정하기",
      parts: [{ kind: "var", name: "VAR", default: "dht11" }],
      tooltip: "dht11.measure() — 온도와 습도를 새로 잽니다 (1초에 한 번쯤).",
      code: (v) => `${v.VAR}.measure()`,
      pattern: { kind: "method", name: "measure", args: [], objPart: "VAR" },
    },
  ],
  values: [
    {
      blockType: "dev_dht_temp", message: "%1 온도 (℃)",
      parts: [{ kind: "var", name: "VAR", default: "dht11" }],
      tooltip: "dht11.temperature() — 마지막으로 잰 온도(℃)",
      code: (v) => `${v.VAR}.temperature()`,
      output: "Number",
      pattern: { kind: "method", name: "temperature", args: [], objPart: "VAR" },
    },
    {
      blockType: "dev_dht_hum", message: "%1 습도 (%)",
      parts: [{ kind: "var", name: "VAR", default: "dht11" }],
      tooltip: "dht11.humidity() — 마지막으로 잰 습도(%)",
      code: (v) => `${v.VAR}.humidity()`,
      output: "Number",
      pattern: { kind: "method", name: "humidity", args: [], objPart: "VAR" },
    },
  ],
};

/**
 * 아날로그 3줄 + 도우미로 온도를 재는 센서의 준비 패턴. 도우미가 이름을 고정해 쓰므로 그 이름일 때만 접는다
 * (다른 이름이거나 도우미가 표준 꼴이 아니면 adc 선언이 dev_adc_setup 으로 잡는다). 그래서 레지스트리에서 adc 보다 앞.
 */
const fixedAdcPattern = (name: string) => ({
  lines: adcPatternLines(),
  fields: ([a, b, c]: RegExpExecArray[]) => (a[1] === name && b[1] === name && c[1] === name && validPins(a[2]) ? { PIN: a[2] } : null),
});

/** 서미스터 (dev_ntc_setup). 이름 ntc 고정, ntc_temperature() 도우미가 10kΩ NTC(B 3950)의 저항을 온도로 바꾼다 */
export const ntc: DeviceSpec = {
  id: "ntc", category: "sensor", label: "온도(서미스터)", toolboxOrder: 44, colour: "#16b567",
  setup: {
    blockType: "dev_ntc_setup",
    message: "서미스터를 핀 %1 에 준비하기",
    parts: [pinNo("PIN", 36, "adc")],
    tooltip: "ntc = ADC(Pin(36)) 와 온도(℃)를 돌려주는 ntc_temperature() 함수를 준비합니다.",
    lines: (v) => adcLines("ntc", v.PIN),
    helpers: [
      {
        name: "ntc_temperature", params: "",
        body: [
          "v = ntc.read() / 4095 * 3.3",
          "r = 10 * v / (3.3 - v)",
          "return 1 / (math.log(r / 10) / 3950 + 1 / 298.15) - 273.15",
        ],
      },
    ],
    kind: "adc",
    provides: () => ["ntc", "ntc_temperature"],
    pattern: fixedAdcPattern("ntc"),
  },
  actions: [],
  values: [
    {
      blockType: "dev_ntc_temp", message: "서미스터 온도 (℃)", parts: [],
      tooltip: "ntc_temperature() — 서미스터로 잰 온도(℃)",
      code: () => "ntc_temperature()",
      output: "Number",
      pattern: { kind: "call", name: "ntc_temperature", args: [] },
    },
  ],
};

/** LM35 온도 센서 (dev_lm35_setup). 이름 lm35 고정, lm35_temperature() 도우미 (10mV/℃) */
export const lm35: DeviceSpec = {
  id: "lm35", category: "sensor", label: "온도(LM35)", toolboxOrder: 45, colour: "#007d51",
  setup: {
    blockType: "dev_lm35_setup",
    message: "LM35 온도 센서를 핀 %1 에 준비하기",
    parts: [pinNo("PIN", 36, "adc")],
    tooltip: "lm35 = ADC(Pin(36)) 와 온도(℃)를 돌려주는 lm35_temperature() 함수를 준비합니다.",
    lines: (v) => adcLines("lm35", v.PIN),
    helpers: [{ name: "lm35_temperature", params: "", body: ["return lm35.read() * 330 / 4095"] }],
    kind: "adc",
    provides: () => ["lm35", "lm35_temperature"],
    pattern: fixedAdcPattern("lm35"),
  },
  actions: [],
  values: [
    {
      blockType: "dev_lm35_temp", message: "LM35 온도 (℃)", parts: [],
      tooltip: "lm35_temperature() — LM35 로 잰 온도(℃)",
      code: () => "lm35_temperature()",
      output: "Number",
      pattern: { kind: "call", name: "lm35_temperature", args: [] },
    },
  ],
};
