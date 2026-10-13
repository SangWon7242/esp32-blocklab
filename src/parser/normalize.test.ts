import { describe, expect, it } from "vitest";
import { normalizeCode, stripComment } from "./normalize";

describe("normalizeCode", () => {
  it("주석·빈 줄·끝 공백을 떼고 들여쓰기는 남긴다", () => {
    const src = 'from machine import Pin   # 핀\n\nled = Pin(26, Pin.OUT)\n\nwhile True:   \n    led.value(1)  # 켜기\n';
    expect(normalizeCode(src)).toEqual(["from machine import Pin", "led = Pin(26, Pin.OUT)", "while True:", "    led.value(1)"]);
  });
  it("문자열 안의 #은 주석이 아니다", () => {
    expect(stripComment('print("a # b")  # c')).toBe('print("a # b")  ');
    expect(stripComment("x = '#'")).toBe("x = '#'");
  });
});
