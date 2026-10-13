/** 파이썬 키워드. 변수 이름으로 쓸 수 없고, 생성기가 이 이름만 피해서(뒤에 숫자를 붙여서) 쓴다. */
export const PYTHON_KEYWORDS: readonly string[] = [
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue",
  "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in",
  "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
];

/** 변수 이름 안내 문구 (변수 만들기·이름 바꾸기 창) */
export const VARIABLE_NAME_HINT = "변수 이름은 영어 글자, 숫자, _ 만 쓸 수 있어요 (예: led, count)";

/** MicroPython 에서 그대로 쓸 수 있는 변수 이름인지: 영어 글자·_ 로 시작, 영어 글자·숫자·_ 만, 키워드 아님 */
export function isValidPythonName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !PYTHON_KEYWORDS.includes(name);
}
