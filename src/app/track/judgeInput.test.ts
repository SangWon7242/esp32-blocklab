import { beforeAll, describe, expect, it } from "vitest";
import { registerBlocks } from "@/blocks";
import { judge } from "@/track/judge";
import type { Rule } from "@/track/schema";
import { judgeInputOf } from "./judgeInput";

const blink = "from machine import Pin\nimport time\n\nled = Pin(26, Pin.OUT)\n\nwhile True:\n    led.value(1)\n    time.sleep(2)\n    led.value(0)\n    time.sleep(1)\n";
const rule: Rule = { blocks: { type: "flow_wait", inputs: { SEC: { type: "math_number", fields: { NUM: 2 } } }, after: { type: "esp_pin_write", fields: { VALUE: "1" } } }, fail: "x?" };

describe("judgeInputOf — 미션·디버깅 판정 입력", () => {
  beforeAll(() => registerBlocks());

  it("blocksJson 이 비면 코드를 블록으로 바꿔 채운다 (코드 모드도 blocks 규칙을 받는다)", () => {
    const input = judgeInputOf({ code: blink, blocksJson: null }, "");
    expect(input.blocksJson).toBeTruthy();
    expect(judge([rule], input).pass).toBe(true);
    expect(judge([rule], judgeInputOf({ code: blink }, "")).pass).toBe(true);
  });

  it("blocksJson 이 있으면 그대로 넘기고, 출력·canonical 도 함께 넘긴다", () => {
    const blocksJson = { blocks: { languageVersion: 0, blocks: [] } };
    const input = judgeInputOf({ code: blink, blocksJson }, "hello");
    expect(input.blocksJson).toBe(blocksJson);
    expect(input.output).toBe("hello");
    expect(input.code).toBe(blink);
    expect(typeof input.canonical).toBe("function");
  });

  it("코드가 파싱되지 않으면 blocksJson 은 비고 blocks 규칙은 실패한다", () => {
    const input = judgeInputOf({ code: "while True\n  led.value(1" }, "");
    expect(input.blocksJson).toBeUndefined();
    expect(judge([rule], input).pass).toBe(false);
  });
});
