/** 파이썬 키워드. 변수 이름으로 쓸 수 없고, 생성기가 이 이름만 피해서(뒤에 숫자를 붙여서) 쓴다. */
export const PYTHON_KEYWORDS: readonly string[] = [
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue",
  "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in",
  "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
];

/**
 * 생성한 코드가 기대는 이름: 내장 함수, 모듈·machine 클래스, 준비 블록·도우미 함수가 만드는 이름.
 * 학생 변수가 이 이름을 덮으면 생성 코드가 깨지므로 변수 이름으로 받지 않는다.
 * (생성기 예약어는 키워드만 — 이 이름들까지 피하게 하면 도우미가 get_distance2 처럼 바뀐다)
 */
export const PROGRAM_NAMES: readonly string[] = [
  "print", "str", "int", "range", "len", "float", "bool", "list", "dict", "input", "abs", "min", "max", "sum", "round",
  "time", "machine", "ssd1306", "Pin", "PWM", "SoftI2C",
  "get_distance", "show", "trig", "echo", "i2c", "oled",
];

/** 변수 이름 안내 문구 (변수 만들기·이름 바꾸기 창) */
export const VARIABLE_NAME_HINT = "변수 이름은 영어 글자, 숫자, _ 만 쓸 수 있어요 (예: led, count)";
/** 프로그램이 이미 쓰는 이름을 골랐을 때 */
export const PROGRAM_NAME_HINT = "이 이름은 프로그램이 이미 쓰고 있어요. 다른 이름을 골라 주세요";

export const isProgramName = (name: string): boolean => PROGRAM_NAMES.includes(name);

/** 학생 변수 이름으로 쓸 수 있는지: 영어 글자·_ 로 시작, 영어 글자·숫자·_ 만, 키워드도 프로그램이 쓰는 이름도 아님 */
export function isValidPythonName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !PYTHON_KEYWORDS.includes(name) && !isProgramName(name);
}
