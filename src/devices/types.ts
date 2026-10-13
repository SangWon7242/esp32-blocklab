export type DeviceCategory = "pin" | "led" | "switch" | "sensor" | "sound" | "motor" | "display" | "input";

/** 블록 한 칸. 필드(고정 값)와 값 입력(다른 블록이 끼워짐)을 메시지의 %n 순서대로 나열한다 */
export type Part =
  | { kind: "pin"; name: string; default: number; inputOnly?: boolean } // field_number 0..39
  | { kind: "var"; name: string; default: string }                      // field_variable (보통 "VAR")
  | { kind: "number"; name: string; default: number; min?: number; max?: number; precision?: number }
  | { kind: "dropdown"; name: string; options: [label: string, value: string][] }
  | { kind: "text"; name: string; default: string }                     // field_input
  | { kind: "colour"; name: string; default: string }                   // field_colour "#rrggbb"
  | { kind: "value"; name: string; check?: "Number" | "String" | "Boolean"; shadow?: number | string }; // input_value

/** 코드 템플릿이 받는 값: 필드는 문자열(변수 필드는 생성기가 이름으로 바꿔 준다), 값 입력은 생성된 코드 조각 */
export type Values = Record<string, string>;

/**
 * 파서가 알아보는 꼴.
 * - lines: 최상위 연속 문장들의 정규식. 모두 맞으면 준비 블록 하나로 접는다. 그룹은 fields 로 넘어간다.
 * - method: 등록된 장치 변수의 메서드 호출 `obj.name(args)`. args 는 인자별 허용 리터럴(드롭다운 값) 또는 null(아무 식).
 * - call:   접힌 도우미 함수 호출 `name(args)`.
 * - expr:   식 전체 텍스트의 정규식(값 블록 전용, 예: `button.value() == 0`). 그룹 1은 장치 변수 이름.
 */
export type SetupPattern = {
  lines: RegExp[];
  /** 정규식 매치 배열 → 필드 값. 핀 범위 밖이면 null 을 돌려 접지 않는다 */
  fields: (m: RegExpExecArray[]) => Values | null;
  /** 접힌 뒤 ctx 에 등록할 장치 변수 이름들 (m 에서 뽑거나 고정 이름) */
  vars: (m: RegExpExecArray[]) => string[];
};
export type ActionPattern =
  | { kind: "none" }                                   // 파서가 되돌리지 않는 명령(다른 블록들로 돌아온다)
  | { kind: "method"; name: string; args: (string[] | null)[]; objPart?: string /* VAR 필드 이름 */; objName?: string /* 고정 이름 */; objKinds?: string[] /* 기본: 자기 장치 kind */ }
  | { kind: "call"; name: string; args: (string[] | null)[] }
  | { kind: "lines"; lines: RegExp[]; values: (m: RegExpExecArray[]) => Values | null; objPart?: string }
  | { kind: "expr"; regex: RegExp; objPart?: string; values?: (m: RegExpExecArray) => Values };

export type HelperSpec = { name: string; params: string; body: string[] /* 2칸 단위 들여쓰기 */ };

export type SetupSpec = {
  blockType: string;
  message: string;
  parts: Part[];
  tooltip: string;
  /** 준비 줄. 변수 필드 값은 이미 파이썬 이름으로 바뀌어 온다 */
  lines: (v: Values) => string[];
  helpers?: HelperSpec[];
  /** 이 장치 변수들의 종류. 메서드 패턴이 objKind 로 맞춘다 */
  kind: string;
  pattern: SetupPattern;
  libFiles?: string[];
};

export type ActionSpec = {
  blockType: string;
  message: string;
  parts: Part[];
  tooltip: string;
  /** 명령 코드(줄바꿈 없이; 여러 줄이면 \n 으로 잇는다). 생성기가 끝에 \n 을 붙인다 */
  code: (v: Values) => string;
  pattern: ActionPattern;
  /** 검사용 값 범위 (계획 2B) */
  range?: Record<string, [number, number]>;
};

export type ValueSpec = Omit<ActionSpec, "code"> & {
  code: (v: Values) => string;
  output: string | string[] | null;
  /** blockly/python Order 값. 기본 FUNCTION_CALL */
  order?: number;
};

export type DeviceSpec = {
  id: string;
  category: DeviceCategory;
  label: string;
  /** print 처럼 준비가 필요 없는 묶음은 생략 */
  setup?: SetupSpec;
  actions: ActionSpec[];
  values: ValueSpec[];
  /** 이 카테고리들에도 같은 항목을 보여 준다 (예: 핀 출력 블록을 LED 카테고리에도) */
  alsoIn?: DeviceCategory[];
  /** 라벨 아래에 다른 장치의 블록을 필드 기본값만 바꿔 넣는다 (예: 조도 센서 밑에 dev_adc_read VAR=light) */
  extraToolbox?: { blockType: string; fields: Record<string, string> }[];
};

export type ImportRule = { when: RegExp; line: string; rank: number };
