export const codeBlocks: Record<string, unknown>[] = [
  {
    type: "code_stmt",
    message0: "코드 %1",
    // 여러 줄(for·def 통째)을 담으므로 여러 줄 칸. registerBlocks() 가 field_multilinetext 를 등록한다.
    args0: [{ type: "field_multilinetext", name: "CODE", text: "pass" }],
    previousStatement: null,
    nextStatement: null,
    style: "code_blocks",
    tooltip: "블록으로 바꾸지 못한 코드를 그대로 둡니다. 여러 줄도 됩니다.",
  },
  {
    type: "code_expr",
    message0: "식 %1",
    args0: [{ type: "field_input", name: "CODE", text: "0" }],
    output: null,
    style: "code_blocks",
    tooltip: "블록으로 바꾸지 못한 식을 그대로 둡니다.",
  },
];
