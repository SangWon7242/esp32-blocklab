import type { DeviceSpec } from "../types";
import { factor, NO_SETUP_PATTERN, pinNo, RE_NAME, RE_PIN, validPins } from "./common";

/** 능동 부저 (dev_buzzer_setup). 출력 핀이라 준비 줄은 esp_pin_setup 이 접고, 켜기·끄기는 esp_pin_write 를 쓴다 */
export const buzzerActive: DeviceSpec = {
  id: "buzzer_active", category: "sound", label: "능동 부저", toolboxOrder: 50, colour: "#e4518c",
  setup: {
    blockType: "dev_buzzer_setup",
    message: "부저를 핀 %1 에 준비하고 %2 이름 붙이기",
    parts: [pinNo("PIN", 15, "out"), { kind: "var", name: "VAR", default: "buzzer" }],
    tooltip: "buzzer = Pin(15, Pin.OUT) — 켜면 삐 소리가 납니다.",
    lines: (v) => [`${v.VAR} = Pin(${v.PIN}, Pin.OUT)`],
    kind: "pin",
    provides: (v) => [v.VAR],
    pattern: NO_SETUP_PATTERN,
  },
  actions: [],
  values: [],
  extraToolbox: [{ blockType: "esp_pin_write", fields: { VAR: "buzzer" } }],
};

const NOTES: [string, string][] = [
  ["도(C4)", "262"], ["레(D4)", "294"], ["미(E4)", "330"], ["파(F4)", "349"],
  ["솔(G4)", "392"], ["라(A4)", "440"], ["시(B4)", "494"], ["높은 도(C5)", "523"],
];

/** 음 하나: 주파수를 정하고 울리고 기다리고 멈춘다 (dev_beeper_tone·dev_beeper_note 공용) */
const toneCode = (name: string, hz: string, sec: string) => [`${name}.freq(${hz})`, `${name}.duty(512)`, `time.sleep(${sec})`, `${name}.duty(0)`].join("\n");

/**
 * 수동 부저 (dev_beeper_setup). PWM 주파수로 음 높이를 낸다. 준비 3줄(freq 440, duty 0)이 PWM 2줄보다 구체적이라
 * 레지스트리에서 pwm 보다 앞에 둔다.
 */
export const buzzerPassive: DeviceSpec = {
  id: "buzzer_passive", category: "sound", label: "수동 부저(음)", toolboxOrder: 51, colour: "#f95e70",
  setup: {
    blockType: "dev_beeper_setup",
    message: "소리 나는 부저를 핀 %1 에 준비하고 %2 이름 붙이기",
    parts: [pinNo("PIN", 15, "out"), { kind: "var", name: "VAR", default: "beeper" }],
    tooltip: "beeper = PWM(Pin(15)) — 처음에는 조용히(duty 0) 둡니다.",
    lines: (v) => [`${v.VAR} = PWM(Pin(${v.PIN}))`, `${v.VAR}.freq(440)`, `${v.VAR}.duty(0)`],
    kind: "beeper",
    provides: (v) => [v.VAR],
    pattern: {
      lines: [
        new RegExp(String.raw`^${RE_NAME}\s*=\s*PWM\(\s*Pin\(\s*${RE_PIN}\s*\)\s*\)$`),
        new RegExp(String.raw`^${RE_NAME}\.freq\(\s*440\s*\)$`),
        new RegExp(String.raw`^${RE_NAME}\.duty\(\s*0\s*\)$`),
      ],
      fields: ([a, b, c]) => (a[1] === b[1] && a[1] === c[1] && validPins(a[2]) ? { PIN: a[2], VAR: a[1] } : null),
    },
  },
  actions: [
    {
      blockType: "dev_beeper_tone", message: "%1 로 %2 Hz 음을 %3 초 울리기",
      parts: [{ kind: "var", name: "VAR", default: "beeper" }, { kind: "value", name: "HZ", check: "Number", shadow: 440 }, { kind: "value", name: "SEC", check: "Number", shadow: 0.5 }],
      tooltip: "주파수(Hz)로 소리를 내고 정한 초만큼 기다린 뒤 멈춥니다.",
      code: (v) => toneCode(v.VAR, v.HZ, v.SEC),
      pattern: {
        kind: "lines", objPart: "VAR", objKinds: ["beeper"],
        lines: [/^(\w+)\.freq\((.+)\)$/, /^(\w+)\.duty\(512\)$/, /^time\.sleep\((.+)\)$/, /^(\w+)\.duty\(0\)$/],
        values: ([f, d, t, z]) => (f[1] === d[1] && f[1] === z[1] ? { VAR: f[1], HZ: f[2], SEC: t[1] } : null),
      },
      range: { HZ: { min: 20, max: 20000, label: { ko: "주파수", en: "frequency" } } },
    },
    {
      blockType: "dev_beeper_note", message: "%1 로 %2 음을 %3 박 울리기",
      parts: [{ kind: "var", name: "VAR", default: "beeper" }, { kind: "dropdown", name: "NOTE", options: NOTES }, { kind: "value", name: "BEAT", check: "Number", shadow: 1 }],
      tooltip: "고른 음을 박 수만큼 울립니다 (한 박 = 0.5초).",
      code: (v) => toneCode(v.VAR, v.NOTE, `${factor(v.BEAT)} * 0.5`),
      pattern: { kind: "none" }, // 같은 4줄이라 음 높이(Hz) 블록으로 돌아온다
      varKinds: ["beeper"],
    },
    {
      blockType: "dev_beeper_stop", message: "%1 소리 멈추기",
      parts: [{ kind: "var", name: "VAR", default: "beeper" }],
      tooltip: "beeper.duty(0) — 소리를 끕니다.",
      code: (v) => `${v.VAR}.duty(0)`,
      pattern: { kind: "method", name: "duty", args: [["0"]], objPart: "VAR" },
    },
  ],
  values: [],
};
