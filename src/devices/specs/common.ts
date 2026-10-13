import type { Part, SetupPattern } from "../types";

/** 핀 번호 칸 (0~39) */
export const pinNo = (name: string, d: number): Part => ({ kind: "pin", name, default: d });
/** 패턴 정규식 조각: 이름 `(\w+)`, 숫자 `(\d+)` */
export const RE_NAME = String.raw`(\w+)`;
export const RE_PIN = String.raw`(\d+)`;
/** ESP32 GPIO 번호(0~39). 블록의 핀 칸이 이 범위로 잘라 버리므로 밖의 번호는 준비 블록으로 접지 않는다 */
export const validPins = (...ns: string[]): boolean => ns.every((n) => Number(n) >= 0 && Number(n) <= 39);

/**
 * blockly/python 의 Order 값. specs 는 파서도 불러오므로 Blockly 를 import 하지 않고 숫자로 적는다
 * (값이 Blockly 와 같은지는 pin.test.ts 가 본다).
 */
export const ORDER = { FUNCTION_CALL: 2.2, MULTIPLICATIVE: 5, ADDITIVE: 6, RELATIONAL: 11 } as const;

/** 곱셈 안에 끼울 값 코드: 이름·숫자·속성·단순 호출이 아니면 괄호로 싼다 (생성기는 값 입력을 Order.NONE 으로 받는다) */
export const factor = (code: string): string => (/^[\w.]+$|^[\w.]+\([^()]*\)$/.test(code) ? code : `(${code})`);

/** 아날로그 핀 준비 3줄 (아날로그 핀·조도·가변저항·소리·불꽃 센서 공용) */
export const adcLines = (name: string, pin: string): string[] => [`${name} = ADC(Pin(${pin}))`, `${name}.atten(ADC.ATTN_11DB)`, `${name}.width(ADC.WIDTH_12BIT)`];

/** 준비 줄을 다른 선언(esp_pin_setup·dev_adc_setup)이 접는 장치의 패턴. 값 패턴은 objPart + objKinds 로 그 변수에 맞춘다 */
export const NO_SETUP_PATTERN: SetupPattern = { lines: [], fields: () => null, vars: () => [] };

/** 아날로그 핀 준비 3줄의 패턴 정규식 (그룹 1은 이름, 첫 줄 그룹 2는 핀). 이름 셋이 같은지는 fields 가 본다 */
export const adcPatternLines = (): RegExp[] => [
  new RegExp(String.raw`^${RE_NAME}\s*=\s*ADC\(\s*Pin\(\s*${RE_PIN}\s*\)\s*\)$`),
  new RegExp(String.raw`^${RE_NAME}\.atten\(\s*ADC\.ATTN_11DB\s*\)$`),
  new RegExp(String.raw`^${RE_NAME}\.width\(\s*ADC\.WIDTH_12BIT\s*\)$`),
];
