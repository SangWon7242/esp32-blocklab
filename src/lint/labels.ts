import { findActionByBlock, findSetupByBlock, findValueByBlock } from "@/devices/registry";

/** 레지스트리 밖 블록(시작·흐름·판단·계산·변수·함수·코드)의 한글 이름. 값 칸은 … 로 적는다 */
const BUILTIN_LABELS: Record<string, string> = {
  start_program: "프로그램이 시작되면",
  flow_repeat_forever: "계속 반복하기",
  flow_repeat_n: "… 번 반복하기",
  flow_for_range: "… 을(를) … 부터 … 전까지 바꾸며 반복",
  flow_for_each: "… 의 각 항목을 … 에 넣으며 반복",
  flow_break: "반복 멈추고 나가기",
  flow_continue: "다음 반복으로 건너뛰기",
  controls_whileUntil: "… 인 동안 반복하기",
  controls_if: "만약 … 이라면",
  flow_wait: "… 초 기다리기",
  flow_wait_ms: "… 밀리초 기다리기",
  flow_wait_us: "… 마이크로초 기다리기",
  logic_compare: "… 비교 …",
  logic_operation: "… 그리고/또는 …",
  logic_negate: "… 이(가) 아니다",
  logic_boolean: "참/거짓",
  judge_between: "… 이(가) … 부터 … 사이인가",
  judge_contains: "… 에 … 이(가) 들어 있는가",
  math_number: "숫자",
  text: "글자",
  calc_arith: "… 계산 …",
  calc_concat: "… 와(과) … 합치기",
  calc_str: "… 을(를) 글자로",
  calc_int: "… 을(를) 정수로",
  calc_random: "… 부터 … 사이의 무작위 정수",
  calc_round: "… 반올림/내림/올림/절댓값/제곱근",
  calc_minmax: "… 와(과) … 중 큰 수/작은 수",
  calc_len: "… 의 길이",
  calc_item: "… 의 … 번째 항목 (0부터)",
  calc_ticks: "지금까지 지난 시간 (ms)",
  variables_set: "… 를 … 로 정하기",
  variables_get: "변수",
  var_change: "… 을(를) … 만큼 바꾸기",
  list_create: "리스트 … 만들기 (비어 있음)",
  list_create_from: "리스트 … 을(를) … 로 만들기",
  list_append: "… 에 … 추가하기",
  list_insert: "… 의 … 번째에 … 끼워 넣기 (0부터)",
  list_remove_at: "… 의 … 번째 항목 지우기 (0부터)",
  list_remove_value: "… 에서 … 지우기",
  list_clear: "… 비우기",
  list_set: "… 의 … 번째 항목을 … 로 정하기 (0부터)",
  list_index: "… 에서 … 의 위치 (0부터)",
  procedures_defnoreturn: "함수 정의하기",
  procedures_defreturn: "함수 정의하기 (돌려주기 …)",
  procedures_callnoreturn: "함수 실행하기",
  procedures_callreturn: "함수 실행 값",
  code_stmt: "코드 …",
  code_expr: "식 …",
};

/** 블록 type → 한글 블록 이름 (장치 블록은 레지스트리 메시지의 %n 을 … 로) */
export function blockLabel(type: string): string {
  const spec = findSetupByBlock(type) ?? findActionByBlock(type) ?? findValueByBlock(type);
  if (spec) return spec.message.replace(/%\d+/g, "…");
  return BUILTIN_LABELS[type] ?? type;
}

/**
 * 레지스트리 밖 블록의 꼭 채워야 하는 값 입력. 장치 블록은 레지스트리 parts 의 value 칸 전부.
 * controls_if 는 extraState.elseIfCount 만큼 IF1.., 함수 호출은 extraState.params 수만큼 ARG0.. 가 붙는다.
 */
const BUILTIN_REQUIRED: Record<string, string[]> = {
  flow_wait: ["SEC"],
  flow_wait_ms: ["MS"],
  flow_wait_us: ["US"],
  flow_repeat_n: ["TIMES"],
  flow_for_range: ["FROM", "TO"],
  flow_for_each: ["LIST"],
  controls_whileUntil: ["BOOL"],
  logic_compare: ["A", "B"],
  logic_operation: ["A", "B"],
  logic_negate: ["BOOL"],
  calc_arith: ["A", "B"],
  calc_concat: ["A", "B"],
  calc_str: ["X"],
  calc_int: ["X"],
  judge_between: ["A", "LOW", "HIGH"],
  judge_contains: ["CONTAINER", "ITEM"],
  calc_random: ["A", "B"],
  calc_round: ["X"],
  calc_minmax: ["A", "B"],
  calc_len: ["X"],
  calc_item: ["X", "INDEX"],
  variables_set: ["VALUE"],
  var_change: ["DELTA"],
  list_append: ["V"],
  list_insert: ["I", "V"],
  list_remove_at: ["I"],
  list_remove_value: ["V"],
  list_set: ["I", "V"],
  list_index: ["V"],
  procedures_defreturn: ["RETURN"],
};

export function requiredInputs(type: string, extraState: unknown): string[] {
  const spec = findActionByBlock(type) ?? findValueByBlock(type);
  if (spec) return spec.parts.filter((p) => p.kind === "value").map((p) => p.name);
  const state = (extraState ?? {}) as { elseIfCount?: unknown; params?: unknown };
  if (type === "controls_if") {
    const n = typeof state.elseIfCount === "number" ? state.elseIfCount : 0;
    return Array.from({ length: n + 1 }, (_, i) => `IF${i}`);
  }
  if (type === "procedures_callnoreturn" || type === "procedures_callreturn") {
    const n = Array.isArray(state.params) ? state.params.length : 0;
    return Array.from({ length: n }, (_, i) => `ARG${i}`);
  }
  return BUILTIN_REQUIRED[type] ?? [];
}

/** 고정 이름 장치를 "먼저 준비해 주세요" 문구에 쓸 때의 이름 (기본은 장치 label) */
const DEVICE_NOUNS: Record<string, string> = { oled: "OLED 화면" };
export const deviceNoun = (deviceId: string, label: string): string => DEVICE_NOUNS[deviceId] ?? label;

// ── 조사 ──────────────────────────────────────────────

/** 영문 글자·숫자를 읽었을 때 받침이 있는지 (엘·엠·엔·알, 영·일·삼·육·칠·팔) */
const LATIN_BATCHIM = new Set(["L", "M", "N", "R", "0", "1", "3", "6", "7", "8"]);

/** 낱말 끝소리에 받침이 있는지. 끝의 괄호 덧말은 떼고 본다 ("온도(LM35)" → "온도") */
export function hasBatchim(word: string): boolean {
  const w = word.replace(/\s*\([^()]*\)\s*$/, "").trim();
  const ch = w[w.length - 1] ?? "";
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  return LATIN_BATCHIM.has(ch.toUpperCase());
}

/** 낱말 + 조사. pair 는 [받침 있을 때, 없을 때] (예: ["을", "를"], ["은", "는"], ["이에요", "예요"]) */
export const josa = (word: string, pair: [string, string]): string => word + (hasBatchim(word) ? pair[0] : pair[1]);
