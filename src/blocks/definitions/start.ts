export const startBlocks: Record<string, unknown>[] = [
  {
    type: "start_program",
    message0: "프로그램이 시작되면",
    message1: "%1",
    args1: [{ type: "input_statement", name: "BODY" }],
    style: "start_blocks",
    hat: "cap",
    tooltip: "보드가 켜지면 이 안의 블록을 위에서부터 차례로 실행합니다.",
  },
];
