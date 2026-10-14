export type DeviceCategory = "pin" | "led" | "switch" | "sensor" | "sound" | "motor" | "display" | "input";

/**
 * 핀의 쓰임 (계획 2B 검사용). out: 출력(LED·릴레이·부저·서보·PWM·모터·7세그먼트·trig),
 * in: 디지털 입력(버튼·틸트·PIR·echo·조이스틱 버튼·IR), adc: 아날로그 입력(ADC_PINS 중 하나여야),
 * bus: 양방향 데이터 선(I2C scl/sda, DHT11 한 선 데이터). 출력·버스 핀은 입력 전용 핀(34~39)을 쓸 수 없다.
 */
export type PinDir = "out" | "in" | "adc" | "bus";

/** 블록 한 칸. 필드(고정 값)와 값 입력(다른 블록이 끼워짐)을 메시지의 %n 순서대로 나열한다 */
export type Part =
  /** field_number 0..39. dir 이 "mode" 면 modeField 드롭다운 값(OUT→out, IN→in)이 쓰임을 정한다 (esp_pin_setup) */
  | { kind: "pin"; name: string; default: number; dir: PinDir | "mode"; modeField?: string }
  | { kind: "var"; name: string; default: string }                      // field_variable (보통 "VAR")
  | { kind: "number"; name: string; default: number; min?: number; max?: number; precision?: number }
  | { kind: "dropdown"; name: string; options: [label: string, value: string][] }
  /** field_input. validate 가 있으면 블록 칸이 맞지 않는 글을 받지 않는다 (src/blocks/index.ts 가 검사를 단다) */
  | { kind: "text"; name: string; default: string; validate?: RegExp }
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
 * - lines:  (명령) 연속 문장 N개의 정규식. 몸통 안에서도 맞추며 method·call 보다 먼저 본다. values 의 값 입력 칸 글은 다시 식으로 파싱된다.
 * objPart 가 있는 꼴은 그 변수가 objKinds(기본: 자기 장치 준비의 kind)로 등록돼 있어야 맞는다.
 * objName(고정 이름) method 꼴도 같다: 그 이름은 장치 준비가 접혀야(도우미가 있으면 도우미까지 접혀야) 장치 변수로 등록되므로,
 * 준비가 접히지 않은 코드의 `oled.fill(0)` 같은 호출은 블록이 되지 않는다.
 * objPart 도 objName 도 없는 call·lines·expr 은 그 장치가 준비돼 있어야(도우미가 있으면 접혀 있어야) 맞는다 (src/parser/devices.ts).
 */
export type SetupPattern = {
  lines: RegExp[];
  /** 정규식 매치 배열 → 필드 값. 핀 범위 밖이면 null 을 돌려 접지 않는다 */
  fields: (m: RegExpExecArray[]) => Values | null;
  /**
   * 접힌 뒤 ctx 에 등록할 장치 변수 이름들. 없으면 준비의 provides(fields) 에서 도우미 이름을 뺀 것
   * (registry.ts setupVars). provides 와 다를 때만 적는다.
   */
  vars?: (m: RegExpExecArray[]) => string[];
};
export type ActionPattern =
  | { kind: "none" }                                   // 파서가 되돌리지 않는 명령(다른 블록들로 돌아온다)
  | { kind: "method"; name: string; args: (string[] | null)[]; objPart?: string /* VAR 필드 이름 */; objName?: string /* 고정 이름 */; objKinds?: string[] /* 기본: 자기 장치 kind */ }
  | { kind: "call"; name: string; args: (string[] | null)[] }
  | { kind: "lines"; lines: RegExp[]; values: (m: RegExpExecArray[]) => Values | null; objPart?: string; objKinds?: string[] }
  | { kind: "expr"; regex: RegExp; objPart?: string; objKinds?: string[]; values?: (m: RegExpExecArray) => Values };

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
  /**
   * 이 준비가 프로그램에 만드는 이름: 변수(고정 이름 또는 VAR 필드 값)와 도우미 함수 이름.
   * 변수 이름 검사(src/blocks/names.ts)와 파서의 장치 변수 등록(pattern.vars 기본값)이 쓴다.
   */
  provides: (v: Values) => string[];
  pattern: SetupPattern;
  libFiles?: string[];
};

/** 검사용 값 범위 (계획 2B). label 은 안내 문구에 쓰는 값 이름 */
export type RangeSpec = { min: number; max: number; label: { ko: string; en: string } };

export type ActionSpec = {
  blockType: string;
  message: string;
  parts: Part[];
  tooltip: string;
  /** 명령 코드(줄바꿈 없이; 여러 줄이면 \n 으로 잇는다). 생성기가 끝에 \n 을 붙인다 */
  code: (v: Values) => string;
  pattern: ActionPattern;
  /** 검사용 값 범위 (계획 2B). 값 입력 이름 → 범위 */
  range?: Record<string, RangeSpec>;
  /**
   * 변수 칸의 장치가 준비돼 있어야 하는 kind (계획 2B 검사용). 패턴이 none 이라 objKinds 가 없는 블록에 적는다
   * (예: dev_led_blink → ["pin"]). 실제로 쓰는 값은 registry.ts requiredKinds(spec).
   */
  varKinds?: string[];
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
  /**
   * 이 장치 블록(준비·명령·값)의 색 "#rrggbb". 같은 카테고리 장치끼리 서로 다르고 카테고리 색 계열이다:
   * src/blocks/colors.ts 의 spreadHues(카테고리 색, 장치 수) 를 카테고리 안 툴박스 순서대로 적는다(첫 장치 = 카테고리 색).
   * 장치를 더하거나 빼면 그 카테고리 장치 색을 다시 뽑는다 (src/devices/colours.test.ts 가 확인한다).
   */
  colour: string;
  /** print 처럼 준비가 필요 없는 묶음은 생략 */
  setup?: SetupSpec;
  actions: ActionSpec[];
  values: ValueSpec[];
  /** 이 카테고리들에도 같은 항목을 보여 준다 (예: 핀 출력 블록을 LED 카테고리에도) */
  alsoIn?: DeviceCategory[];
  /** 라벨 아래에 다른 장치의 블록을 필드 기본값만 바꿔 넣는다 (예: 조도 센서 밑에 dev_adc_read VAR=light) */
  extraToolbox?: { blockType: string; fields: Record<string, string> }[];
  /**
   * 툴박스에서 카테고리 안의 보여 주는 순서 (작은 것이 위). DEVICES 순서는 파서가 맞추는 우선순위라 따로 둔다.
   * 없으면 순서가 있는 장치들 뒤에 DEVICES 순서대로.
   */
  toolboxOrder?: number;
};

export type ImportRule = { when: RegExp; line: string; rank: number };
