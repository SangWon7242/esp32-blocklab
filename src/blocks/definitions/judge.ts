export const judgeBlocks: Record<string, unknown>[] = [
  {
    type: "judge_between",
    message0: "%1 이(가) %2 부터 %3 사이인가",
    args0: [
      { type: "input_value", name: "A", check: "Number" },
      { type: "input_value", name: "LOW", check: "Number" },
      { type: "input_value", name: "HIGH", check: "Number" },
    ],
    inputsInline: true,
    output: "Boolean",
    style: "logic_blocks",
    tooltip: "LOW <= A <= HIGH. 두 끝 값도 사이에 들어갑니다.",
  },
  {
    type: "judge_contains",
    message0: "%1 에 %2 이(가) 들어 있는가",
    args0: [
      { type: "input_value", name: "CONTAINER" },
      { type: "input_value", name: "ITEM" },
    ],
    inputsInline: true,
    output: "Boolean",
    style: "logic_blocks",
    tooltip: "ITEM in CONTAINER. 글자 안에 글자가, 리스트 안에 값이 들어 있는지 봅니다.",
  },
];
