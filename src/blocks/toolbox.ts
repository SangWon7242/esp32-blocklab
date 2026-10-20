import type * as Blockly from "blockly";
import { deviceToolboxCategories } from "@/devices/toBlocks";

const block = (type: string, extra: Record<string, unknown> = {}) => ({ kind: "block", type, ...extra });
const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
const text = (t: string) => ({ shadow: { type: "text", fields: { TEXT: t } } });
/** 리스트 변수 items 를 읽는 블록 (그림자가 아니라 진짜 변수 블록: 다른 변수로 바꿔 끼울 수 있다) */
const items = () => ({ block: { type: "variables_get", fields: { VAR: { name: "items" } } } });

export const toolbox = {
  kind: "categoryToolbox",
  contents: [
    { kind: "category", name: "시작", categorystyle: "start_category", icon: "start", contents: [block("start_program")] },
    {
      kind: "category",
      name: "흐름",
      categorystyle: "flow_category",
      icon: "flow",
      contents: [
        block("flow_repeat_forever"),
        block("flow_repeat_n", { inputs: { TIMES: num(3) } }),
        block("controls_whileUntil"),
        block("controls_if"),
        block("controls_if", { extraState: { hasElse: true } }),
        block("flow_wait", { inputs: { SEC: num(1) } }),
        block("flow_wait_ms", { inputs: { MS: num(500) } }),
        block("flow_wait_us", { inputs: { US: num(10) } }),
        // 계획 6: 범위·각 항목 반복, 멈추기·건너뛰기 (자주 쓰는 반복·기다리기가 팔레트 위에 그대로 보이게 뒤에 둔다).
        // 팔레트가 넘쳐 아래가 가려지므로 글자 표시로 아래에 반복 블록이 더 있다고 알린다
        { kind: "label", text: "반복 더 보기" },
        block("flow_for_range", { inputs: { FROM: num(0), TO: num(5) } }),
        block("flow_for_range_step", { inputs: { FROM: num(10), TO: num(0), STEP: num(-2) } }),
        block("flow_for_each", { inputs: { LIST: items() } }),
        block("flow_break"),
        block("flow_continue"),
      ],
    },
    {
      kind: "category",
      name: "판단",
      categorystyle: "judge_category",
      icon: "judge",
      contents: [
        block("logic_compare", { inputs: { A: num(0), B: num(15) } }),
        block("logic_operation"),
        block("logic_negate"),
        block("logic_boolean"),
        block("judge_between", { inputs: { A: num(10), LOW: num(0), HIGH: num(100) } }),
        block("judge_contains", { inputs: { CONTAINER: text("hello"), ITEM: text("e") } }),
      ],
    },
    {
      kind: "category",
      name: "계산",
      categorystyle: "calc_category",
      icon: "calc",
      contents: [
        block("math_number", { fields: { NUM: 0 } }),
        block("text", { fields: { TEXT: "안녕" } }),
        block("calc_arith", { inputs: { A: num(1), B: num(1) } }),
        block("calc_paren"),
        block("calc_random", { inputs: { A: num(1), B: num(6) } }),
        block("calc_round", { inputs: { X: num(3.7) } }),
        block("calc_minmax", { inputs: { A: num(3), B: num(7) } }),
        block("calc_concat", { inputs: { A: text(""), B: text(" cm") } }),
        block("calc_str"),
        block("calc_int"),
        block("calc_len", { inputs: { X: text("hello") } }),
        block("calc_item", { inputs: { X: text("hello"), INDEX: num(0) } }),
        block("calc_ticks"),
        block("calc_elapsed", { inputs: { X: { block: { type: "variables_get", fields: { VAR: { name: "start" } } } } } }),
        block("calc_ticks_diff", {
          // stop 은 모터 도우미 이름이라 변수 이름으로 막혀 있으므로 start_t·end_t
          inputs: { END: { block: { type: "variables_get", fields: { VAR: { name: "end_t" } } } }, START: { block: { type: "variables_get", fields: { VAR: { name: "start_t" } } } } },
        }),
        block("calc_map", { inputs: { X: num(2048), A: num(0), B: num(4095), C: num(0), D: num(100) } }),
      ],
    },
    { kind: "category", name: "변수", categorystyle: "variable_category", icon: "variable", custom: "VARIABLE" },
    {
      kind: "category",
      name: "리스트",
      categorystyle: "list_category",
      icon: "list",
      contents: [
        block("list_create"),
        block("list_create_from"),
        block("list_append", { inputs: { V: num(4) } }),
        block("list_insert", { inputs: { I: num(0), V: num(5) } }),
        block("list_remove_at", { inputs: { I: num(0) } }),
        block("list_remove_value", { inputs: { V: num(3) } }),
        block("list_clear"),
        block("list_set", { inputs: { I: num(0), V: num(10) } }),
        block("calc_item", { inputs: { X: items(), INDEX: num(0) } }),
        block("calc_len", { inputs: { X: items() } }),
        block("list_index", { inputs: { V: num(3) } }),
        block("list_reversed", { inputs: { X: items() } }),
        block("judge_contains", { inputs: { CONTAINER: items(), ITEM: num(3) } }),
        block("flow_for_each", { inputs: { LIST: items() } }),
      ],
    },
    { kind: "category", name: "함수", categorystyle: "func_category", icon: "func", custom: "PROCEDURE" },
    // 하드웨어 카테고리 9개 (핀·LED·버튼·스위치·센서·소리·모터·화면·입력장치·통신)는 장치 레지스트리에서 (icon·categorystyle 은 장치 카테고리 id)
    ...deviceToolboxCategories(),
    { kind: "category", name: "코드", categorystyle: "code_category", icon: "code", contents: [block("code_stmt"), block("code_expr")] },
  ],
// icon 은 Blockly 정의에 없는 칸(entryToolbox 가 읽는다)이고 글자 표시(label)가 섞이면 TS 가 겹침을 못 찾으므로 unknown 을 거친다
} as unknown as Blockly.utils.toolbox.ToolboxDefinition;
