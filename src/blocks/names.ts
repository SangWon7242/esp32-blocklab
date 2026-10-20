import { IMPORT_RULES, MACHINE_NAMES } from "@/devices/imports";
import { allActionHelpers, fixedSetupNames } from "@/devices/registry";

/** 파이썬 키워드. 변수 이름으로 쓸 수 없고, 생성기가 이 이름만 피해서(뒤에 숫자를 붙여서) 쓴다. */
export const PYTHON_KEYWORDS: readonly string[] = [
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue",
  "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in",
  "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
];

/** 생성 코드가 쓰는 파이썬 내장 이름과 machine 모듈 이름 */
const BUILTIN_NAMES: readonly string[] = [
  "print", "str", "int", "range", "reversed", "len", "float", "bool", "list", "dict", "input", "abs", "min", "max", "sum", "round",
  "machine",
];

/** import 줄이 프로그램에 만드는 이름: `import X` 는 X, `from M import N` 은 N */
const importedNames = (): string[] =>
  IMPORT_RULES.flatMap((r) => {
    const m = /^(?:from\s+\S+\s+)?import\s+(.+)$/.exec(r.line);
    // `from blocklab_net import *` 의 * 는 이름이 아니다 (그 라이브러리가 주는 이름은 준비 블록의 libNames)
    return m ? m[1].split(",").map((n) => n.trim()).filter((n) => /^\w+$/.test(n)) : [];
  });

/**
 * 생성한 코드가 기대는 이름: 내장 함수, import 하는 모듈·클래스(IMPORT_RULES·MACHINE_NAMES),
 * 준비 블록이 고정해서 만드는 변수 이름과 보드 라이브러리 함수 이름(레지스트리 provides·libNames).
 * 학생 변수·함수가 이 이름을 덮으면 생성 코드가 깨지므로 받지 않는다.
 * (생성기 예약어는 키워드만 — 이 이름들까지 피하게 하면 수업 코드의 이름이 바뀐다)
 */
export const PROGRAM_NAMES: readonly string[] = [...new Set([...BUILTIN_NAMES, ...MACHINE_NAMES, ...importedNames(), ...fixedSetupNames()])];

/**
 * 장치 블록이 부르는 짧은 도우미 함수 이름 (get_distance·set_color·stop·show …). 학생 **함수** 이름으로는 쓸 수 있다:
 * 같은 이름의 함수 블록이 있으면 생성기가 도우미를 만들지 않고 그 함수를 쓴다 (수업 코드의 def get_distance 가 함수 블록이 된다).
 * 학생 **변수** 이름으로는 받지 않는다 (변수와 도우미 함수가 같은 이름이면 도우미가 get_distance2 처럼 바뀐다).
 */
export const HELPER_NAMES: readonly string[] = [...new Set(allActionHelpers().map((h) => h.name))];

/** 변수 이름 안내 문구 (변수 만들기·이름 바꾸기 창) */
export const VARIABLE_NAME_HINT = "변수 이름은 영어 글자, 숫자, _ 만 쓸 수 있어요 (예: led, count)";
/** 함수 이름 안내 문구 (함수 이름 창) */
export const FUNCTION_NAME_HINT = "함수 이름은 영어 글자, 숫자, _ 만 쓸 수 있어요 (예: blink)";
/** 프로그램이 이미 쓰는 이름을 골랐을 때 */
export const PROGRAM_NAME_HINT = "이 이름은 프로그램이 이미 쓰고 있어요. 다른 이름을 골라 주세요";

export const isProgramName = (name: string): boolean => PROGRAM_NAMES.includes(name);

/** 이 종류(변수·함수)의 학생 이름으로 쓰면 프로그램이 쓰는 이름을 덮는지 (함수는 도우미 이름을 써도 된다 — HELPER_NAMES) */
export const isReservedName = (name: string, kind: "variable" | "function" = "variable"): boolean =>
  isProgramName(name) || (kind === "variable" && HELPER_NAMES.includes(name));

/**
 * 학생 변수·함수 이름으로 쓸 수 있는지: 영어 글자·_ 로 시작, 영어 글자·숫자·_ 만, 키워드도 프로그램이 쓰는 이름도 아님.
 * 함수 이름(kind "function")은 장치 도우미 이름(get_distance …)도 받는다.
 */
export function isValidPythonName(name: string, kind: "variable" | "function" = "variable"): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !PYTHON_KEYWORDS.includes(name) && !isReservedName(name, kind);
}
