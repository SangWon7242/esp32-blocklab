import type { Part, PinDir, SetupPattern } from "../types";

/** 핀 번호 칸 (0~39)과 그 핀의 쓰임 */
export const pinNo = (name: string, d: number, dir: PinDir): Part => ({ kind: "pin", name, default: d, dir });

/** ESP32 에서 ADC 로 읽을 수 있는 GPIO (ADC1: 32~39, ADC2: 0·2·4·12~15·25~27). dir "adc" 핀은 이 중 하나여야 한다 */
export const ADC_PINS: readonly number[] = [0, 2, 4, 12, 13, 14, 15, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39];
/** I2C 주소 칸(LCD·RFID)의 글: 16진수 1~2자리 */
export const I2C_ADDR = /^0x[0-9a-fA-F]{1,2}$/;

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

/**
 * 생성기가 도우미 호출 이름 앞뒤에 붙이는 표시 글자 (유니코드 사용자 영역, MicroPythonGenerator.helperCall).
 * 생성기의 finish 가 실제로 정의된 도우미 이름으로 바꾸며 지운다. 템플릿이 값 코드를 검사할 때는 이 글자를 빼고 본다.
 */
export const HELPER_MARK = "\uE000";

/**
 * 곱셈 안에 끼울 값 코드: 이름·숫자·속성·단순 호출이 아니면 괄호로 싼다 (생성기는 값 입력을 Order.NONE 으로 받는다).
 * 도우미 호출(`get_distance()`)은 표시 글자를 달고 오므로 그 글자를 빼고 검사한다.
 */
export const factor = (code: string): string => (/^[\w.]+$|^[\w.]+\([^()]*\)$/.test(code.replaceAll(HELPER_MARK, "")) ? code : `(${code})`);

/** 아날로그 핀 준비 3줄 (아날로그 핀·조도·가변저항·소리·불꽃 센서 공용) */
export const adcLines = (name: string, pin: string): string[] => [`${name} = ADC(Pin(${pin}))`, `${name}.atten(ADC.ATTN_11DB)`, `${name}.width(ADC.WIDTH_12BIT)`];

/** 준비 줄을 다른 선언(esp_pin_setup·dev_adc_setup)이 접는 장치의 패턴. 값 패턴은 objPart + objKinds 로 그 변수에 맞춘다 */
export const NO_SETUP_PATTERN: SetupPattern = { lines: [], fields: () => null };

/** 아날로그 핀 준비 3줄의 패턴 정규식 (그룹 1은 이름, 첫 줄 그룹 2는 핀). 이름 셋이 같은지는 fields 가 본다 */
export const adcPatternLines = (): RegExp[] => [
  new RegExp(String.raw`^${RE_NAME}\s*=\s*ADC\(\s*Pin\(\s*${RE_PIN}\s*\)\s*\)$`),
  new RegExp(String.raw`^${RE_NAME}\.atten\(\s*ADC\.ATTN_11DB\s*\)$`),
  new RegExp(String.raw`^${RE_NAME}\.width\(\s*ADC\.WIDTH_12BIT\s*\)$`),
];

/**
 * 식 글을 문자열 밖·괄호 밖(깊이 0)의 글자로 훑는다. 괄호가 맞지 않거나 문자열이 닫히지 않으면 null.
 * 1줄 lines 패턴의 그룹(`(.+)`)이 식 하나인지 볼 때 쓴다.
 */
function topLevelChars(text: string): string | null {
  const close: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  let quote: string | null = null;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if ("([{".includes(ch)) stack.push(ch);
    else if (close[ch]) { if (stack.pop() !== close[ch]) return null; }
    else if (!stack.length) out += ch;
  }
  return quote || stack.length ? null : out;
}

/** 곱셈보다 약하게 묶는 것: 덧셈·뺄셈, 시프트·비트·비교·대입식 연산자 글자, 쉼표, 조건식·논리·lambda·in·is 낱말 */
const LOOSER_THAN_MUL = /[-+<>&|^=!,]|\b(?:if|else|and|or|not|lambda|in|is)\b/;

/**
 * 곱셈 앞에 놓인 그룹이 피연산자 하나인지: 괄호가 맞고, 괄호 밖에 곱셈보다 약하게 묶는 연산자가 없다.
 * `1638 + offset + a * 6462 // 180` 의 `offset + a` 처럼 덧셈이 그룹에 걸려 든 것을 접으면
 * `(offset + a) * 6462` 로 다시 묶여 뜻이 바뀌므로 접지 않는다 (서보 각도·LED 밝기). `a << 1`·`a if c else b` 도 같다.
 */
export const isSingleOperand = (text: string): boolean => {
  const top = topLevelChars(text);
  return top !== null && !LOOSER_THAN_MUL.test(top);
};

/** 그룹이 함수 인자 하나인지: 괄호가 맞고, 괄호 밖에 쉼표가 없다 (`lcd.Cursor(0, f(a, b))` 를 잘못 나누지 않게) */
export const isSingleArg = (text: string): boolean => {
  const top = topLevelChars(text);
  return top !== null && !top.includes(",");
};
