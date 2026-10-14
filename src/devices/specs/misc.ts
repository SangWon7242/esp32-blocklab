import type { DeviceSpec } from "../types";

/** print: 장치는 아니지만 같은 틀로 핀 카테고리 맨 아래("출력")에 둔다. 준비 블록 없음 */
export const printer: DeviceSpec = {
  id: "print", category: "pin", label: "출력", toolboxOrder: 5, colour: "#43d4e1",
  actions: [
    {
      blockType: "esp_print", message: "%1 출력하기",
      parts: [{ kind: "value", name: "VALUE" }],
      tooltip: "print(값) — 시리얼 모니터에 찍습니다.",
      code: (v) => `print(${v.VALUE})`,
      pattern: { kind: "call", name: "print", args: [null] },
    },
    {
      blockType: "esp_print2", message: "%1 와(과) %2 출력하기",
      parts: [{ kind: "value", name: "A" }, { kind: "value", name: "B" }],
      tooltip: "print(a, b) — 두 값을 띄어서 찍습니다.",
      code: (v) => `print(${v.A}, ${v.B})`,
      pattern: { kind: "call", name: "print", args: [null, null] },
    },
  ],
  values: [],
};
