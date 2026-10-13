export const calcBlocks: Record<string, unknown>[] = [
  {
    type: "calc_arith",
    message0: "%1 %2 %3",
    args0: [
      { type: "input_value", name: "A" },
      {
        type: "field_dropdown",
        name: "OP",
        options: [["+", "ADD"], ["-", "MINUS"], ["×", "MULTIPLY"], ["÷", "DIVIDE"], ["//", "FLOORDIV"], ["%", "MOD"]],
      },
      { type: "input_value", name: "B" },
    ],
    inputsInline: true,
    output: "Number",
    style: "math_blocks",
    tooltip: "// 는 나눈 몫(정수), % 는 나머지입니다.",
  },
  {
    type: "calc_concat",
    message0: "%1 와(과) %2 합치기",
    args0: [{ type: "input_value", name: "A" }, { type: "input_value", name: "B" }],
    inputsInline: true,
    output: "String",
    style: "text_blocks",
    tooltip: "두 글자를 이어 붙입니다. 숫자는 먼저 글자로 바꿔야 합니다.",
  },
  {
    type: "calc_str",
    message0: "%1 을(를) 글자로",
    args0: [{ type: "input_value", name: "X" }],
    output: "String",
    style: "text_blocks",
    tooltip: "str(값). 화면에는 글자만 들어갑니다.",
  },
  {
    type: "calc_int",
    message0: "%1 을(를) 정수로",
    args0: [{ type: "input_value", name: "X" }],
    output: "Number",
    style: "math_blocks",
    tooltip: "int(값). 소수점을 버립니다.",
  },
];
