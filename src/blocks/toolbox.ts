import type * as Blockly from "blockly";

const block = (type: string, extra: Record<string, unknown> = {}) => ({ kind: "block", type, ...extra });
const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });

export const toolbox = {
  kind: "categoryToolbox",
  contents: [
    { kind: "category", name: "시작", categorystyle: "start_category", contents: [block("start_program")] },
    {
      kind: "category",
      name: "흐름",
      categorystyle: "flow_category",
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
      contents: [
        block("math_number", { fields: { NUM: 0 } }),
        block("text", { fields: { TEXT: "안녕" } }),
        block("calc_arith", { inputs: { A: num(1), B: num(1) } }),
        block("calc_concat", { inputs: { A: { shadow: { type: "text", fields: { TEXT: "" } } }, B: { shadow: { type: "text", fields: { TEXT: " cm" } } } } }),
        block("calc_str"),
        block("calc_int"),
      ],
    },
    { kind: "category", name: "변수", categorystyle: "variable_category", custom: "VARIABLE" },
    { kind: "category", name: "함수", categorystyle: "func_category", custom: "PROCEDURE" },
    {
      kind: "category",
      name: "ESP32",
      categorystyle: "hardware_category",
      contents: [
        { kind: "label", text: "핀" },
        block("esp_pin_setup"),
        block("esp_pin_write"),
        block("esp_pin_read"),
        block("esp_print"),
        block("esp_print2"),
        { kind: "label", text: "모터" },
        block("esp_servo_setup"),
        block("esp_servo_door"),
        block("esp_pwm_setup"),
        block("esp_pwm_duty", { inputs: { DUTY: num(32768) } }),
        { kind: "label", text: "센서와 화면" },
        block("esp_ultrasonic_setup"),
        block("esp_distance"),
        block("esp_oled_setup"),
        block("esp_oled_show", { inputs: { A: { shadow: { type: "text", fields: { TEXT: "AUTO DOOR" } } }, B: { shadow: { type: "text", fields: { TEXT: "Come closer" } } } } }),
      ],
    },
    { kind: "category", name: "코드", categorystyle: "code_category", contents: [block("code_stmt"), block("code_expr")] },
  ],
} as Blockly.utils.toolbox.ToolboxDefinition;
