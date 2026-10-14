import type * as Blockly from "blockly";
import { deviceToolboxCategories } from "@/devices/toBlocks";

const block = (type: string, extra: Record<string, unknown> = {}) => ({ kind: "block", type, ...extra });
const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });

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
        block("calc_concat", { inputs: { A: { shadow: { type: "text", fields: { TEXT: "" } } }, B: { shadow: { type: "text", fields: { TEXT: " cm" } } } } }),
        block("calc_str"),
        block("calc_int"),
      ],
    },
    { kind: "category", name: "변수", categorystyle: "variable_category", icon: "variable", custom: "VARIABLE" },
    { kind: "category", name: "함수", categorystyle: "func_category", icon: "func", custom: "PROCEDURE" },
    // 하드웨어 카테고리 8개 (핀·LED·버튼·스위치·센서·소리·모터·화면·입력장치)는 장치 레지스트리에서 (icon·categorystyle 은 장치 카테고리 id)
    ...deviceToolboxCategories(),
    { kind: "category", name: "코드", categorystyle: "code_category", icon: "code", contents: [block("code_stmt"), block("code_expr")] },
  ],
} as Blockly.utils.toolbox.ToolboxDefinition;
