import type { ActionSpec, DeviceCategory, DeviceSpec, HelperSpec, Part, SetupSpec, ValueSpec, Values } from "./types";
import { adc, pinIn, pinOut, pwm } from "./specs/pin";
import { flowLed, led, ledPwm, rgb } from "./specs/led";
import { button, joystick, pir, tilt, touch } from "./specs/switch";
import { dcMotor, relay, servo } from "./specs/motor";
import { dht11, flame, knob, light, lm35, ntc, sound, ultrasonic } from "./specs/sensor";
import { buzzerActive, buzzerPassive } from "./specs/sound";
import { lcd, oled, seg7 } from "./specs/display";
import { ir, keypad, rfid } from "./specs/input";
import { printer } from "./specs/misc";
import { web, wifi } from "./specs/net";

export const DEVICE_CATEGORIES: { id: DeviceCategory; label: string }[] = [
  { id: "pin", label: "핀" }, { id: "led", label: "LED" }, { id: "switch", label: "버튼·스위치" }, { id: "sensor", label: "센서" },
  { id: "sound", label: "소리" }, { id: "motor", label: "모터" }, { id: "display", label: "화면" }, { id: "input", label: "입력장치" },
  { id: "net", label: "통신" },
];

/**
 * 순서가 곧 우선순위: 같은 줄에 맞는 선언이 여럿이면 앞의 것이 접힌다
 * (서보 3줄 > 밝기 LED(freq 1000) > 수동 부저(freq 440, duty 0) > DC 모터 > PWM 2줄, 초음파 > 핀,
 *  조이스틱 > 버튼 > 입력 핀 > 핀, 조이스틱 > 서미스터·LM35(이름 고정 + 도우미) > 아날로그 핀,
 *  틸트 > PIR (같은 `x.value() == 1`), RGB 색 > RGB 세 값, 7세그먼트(si·rck·sck + 도우미) > 출력 핀). 같은 값·명령 꼴도 앞의 선언이 먼저 맞는다.
 * 툴박스의 카테고리 안 순서는 이것과 따로 각 장치의 toolboxOrder 로 정한다.
 */
export const DEVICES: DeviceSpec[] = [
  servo, ultrasonic, oled, lcd, seg7, rfid, keypad, ir,
  joystick, button, tilt, pir, touch,
  pinIn, dht11, ntc, lm35, light, knob, sound, flame, adc,
  pinOut, ledPwm, led, rgb, flowLed,
  buzzerActive, buzzerPassive, dcMotor, relay,
  pwm, printer,
  wifi, web,
];

/** 장치의 준비 블록들: setup 다음에 extraSetups (툴박스 순서) */
export const setupsOf = (d: DeviceSpec): SetupSpec[] => [...(d.setup ? [d.setup] : []), ...(d.extraSetups ?? [])];
/** 장치의 명령 블록이 쓰는 선택 도우미 (ActionSpec.helper) */
export const actionHelpersOf = (d: DeviceSpec): HelperSpec[] => d.actions.flatMap((a) => (a.helper ? [a.helper] : []));

type WithDevice<T> = T & { device: DeviceSpec };
const byType = <T extends { blockType: string }>(items: T[]) => new Map(items.map((i) => [i.blockType, i]));
const setups = byType(DEVICES.flatMap((d): WithDevice<SetupSpec>[] => setupsOf(d).map((s) => ({ ...s, device: d }))));
const actions = byType(DEVICES.flatMap((d) => d.actions.map((a): WithDevice<ActionSpec> => ({ ...a, device: d }))));
const values = byType(DEVICES.flatMap((d) => d.values.map((v): WithDevice<ValueSpec> => ({ ...v, device: d }))));

export const findSetupByBlock = (type: string): WithDevice<SetupSpec> | undefined => setups.get(type);
export const findActionByBlock = (type: string): WithDevice<ActionSpec> | undefined => actions.get(type);
export const findValueByBlock = (type: string): WithDevice<ValueSpec> | undefined => values.get(type);
/** 모든 준비 선언 (DEVICES 우선순위 순) */
export const setupSpecs = (): WithDevice<SetupSpec>[] => [...setups.values()];
export const devicesByCategory = (c: DeviceCategory): DeviceSpec[] => DEVICES.filter((d) => d.category === c);

/**
 * 이 명령·값 블록의 변수 칸 장치(변수 칸이 없으면 이 블록이 쓰는 장치)가 준비돼 있어야 하는 kind (계획 2B 검사용).
 * varKinds → 패턴의 objKinds → 자기 장치 준비의 kind 순. 준비가 없는 묶음(print)은 빈 목록.
 */
export function requiredKinds(spec: ActionSpec | ValueSpec): string[] {
  if (spec.varKinds) return spec.varKinds;
  const p = spec.pattern;
  if ((p.kind === "method" || p.kind === "lines" || p.kind === "expr") && p.objKinds) return p.objKinds;
  const device = (actions.get(spec.blockType) ?? values.get(spec.blockType))?.device;
  return device?.setup ? [device.setup.kind] : [];
}

/** 칸들의 기본값 (툴박스에서 꺼낸 그대로의 블록이 코드 템플릿에 넘기는 값). 값 입력은 shadow 글 또는 숫자 */
export function defaultValues(parts: Part[]): Values {
  const v: Values = {};
  for (const p of parts) {
    if (p.kind === "dropdown") v[p.name] = p.options[0][1];
    else if (p.kind === "value") v[p.name] = typeof p.shadow === "string" ? JSON.stringify(p.shadow) : String(p.shadow ?? 0);
    else v[p.name] = String(p.default);
  }
  return v;
}

/** 준비가 접힌 뒤 장치 변수로 등록할 이름: pattern.vars 가 없으면 provides(fields) 에서 도우미 이름을 뺀 것 */
export function setupVars(spec: SetupSpec, fields: Values, ms: RegExpExecArray[]): string[] {
  if (spec.pattern.vars) return spec.pattern.vars(ms);
  const helpers = new Set((spec.helpers ?? []).map((h) => h.name));
  return spec.provides(fields).filter((n) => !helpers.has(n));
}

/**
 * 준비 블록이 고정해서 만드는 이름 (도우미 함수 이름 + VAR 칸이 아닌 고정 변수 이름) + 명령 블록의 선택 도우미 이름. 학생 변수·함수가 이 이름을
 * 덮으면 생성 코드가 깨지므로 src/blocks/names.ts 가 막는다.
 */
export function fixedSetupNames(): string[] {
  const out = new Set<string>();
  for (const s of setupSpecs()) {
    const v = defaultValues(s.parts);
    const varValues = new Set(s.parts.filter((p) => p.kind === "var").map((p) => v[p.name]));
    for (const n of s.provides(v)) if (!varValues.has(n)) out.add(n);
    for (const h of s.helpers ?? []) out.add(h.name);
  }
  for (const d of DEVICES) for (const h of actionHelpersOf(d)) out.add(h.name);
  return [...out];
}

/** 이 블록들 중 준비 블록이 쓰는 보드 라이브러리 파일 (public/lib/ 아래 이름, 중복 없이 DEVICES 순) */
export function libFilesFor(blockTypes: string[]): string[] {
  const used = new Set(blockTypes);
  return [...new Set(setupSpecs().filter((s) => used.has(s.blockType)).flatMap((s) => s.libFiles ?? []))];
}

/**
 * 프로그램이 필요로 하는 라이브러리: 쓰인 준비 블록의 것 + 코드가 직접 `import`/`from … import` 하는 모듈의 것.
 * 코드 모드에서 손으로 `import ssd1306` 을 적은 경우도 잡는다. 한 모듈을 가져오면 그 장치의 묶음(mfrc522_i2c → config·soft_iic)을 모두 올린다.
 */
/** 블록이 없어 어떤 장치에도 안 붙지만 코드가 import 하면 올려야 하는 라이브러리 (public/lib) */
const IMPORT_ONLY_LIBS = ["gfx.py"];

export function libFilesForProgram({ code, blockTypes }: { code: string; blockTypes: string[] }): string[] {
  const files = new Set(libFilesFor(blockTypes));
  const groups: string[][] = [...setupSpecs().map((spec) => spec.libFiles ?? []), ...IMPORT_ONLY_LIBS.map((f) => [f])];
  for (const libs of groups) {
    const imported = libs.some((f) => {
      const mod = f.replace(/\.py$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(String.raw`^\s*(?:import\s+(?:[\w.]+\s*,\s*)*${mod}\b|from\s+${mod}\s+import\b)`, "m").test(code);
    });
    if (imported) for (const f of libs) files.add(f);
  }
  return [...files];
}
