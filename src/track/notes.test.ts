import { describe, expect, it } from "vitest";
import { leftoverFromStart, unusedSetup } from "./notes";
import type { Rule } from "./schema";

const blink = "from machine import Pin\nimport time\n\nled = Pin(26, Pin.OUT)\n\nwhile True:\n    led.value(1)\n    time.sleep(2)\n    led.value(0)\n    time.sleep(1)\n";

describe("unusedSetup — 준비만 하고 안 쓴 장치 변수", () => {
  it("쓰는 변수는 주의가 없다", () => {
    expect(unusedSetup(blink)).toEqual([]);
  });
  it("준비한 이름이 다른 줄에 한 번도 없으면 이름을 들어 주의한다", () => {
    const code = `${blink}buzzer = PWM(Pin(25))\n`;
    expect(unusedSetup(code)).toEqual(["buzzer 는 준비만 하고 쓰지 않았어요. 이 장치가 필요한가요?"]);
  });
  it("점 뒤의 같은 이름(oled.led)이나 다른 단어의 일부(led2)는 쓴 것으로 치지 않는다", () => {
    const code = "from machine import Pin\nled = Pin(26, Pin.OUT)\nled2 = Pin(27, Pin.OUT)\nwhile True:\n    led2.value(1)\n    print(oled.led)\n";
    expect(unusedSetup(code)).toEqual(["led 는 준비만 하고 쓰지 않았어요. 이 장치가 필요한가요?"]);
  });
  it("모듈을 붙인 준비(neopixel.NeoPixel)와 밑줄 이름(SSD1306_I2C)도 준비 줄로 본다", () => {
    const code = "np = neopixel.NeoPixel(Pin(27), 8)\noled = SSD1306_I2C(128, 64, i2c)\nnp[0] = (255, 0, 0)\n";
    expect(unusedSetup(code)).toEqual(["oled 는 준비만 하고 쓰지 않았어요. 이 장치가 필요한가요?"]);
  });
  it("들여쓴 줄·소문자 함수 호출·주석 속 이름은 준비 줄이 아니다", () => {
    const code = "def f():\n    x = Pin(1)\n# y = Pin(2)\nd = get_distance()\n";
    expect(unusedSetup(code)).toEqual([]);
  });
});

describe("leftoverFromStart — 시작 코드를 한 줄도 바꾸지 않았다", () => {
  const start = "from machine import Pin\nimport time\nled = Pin(26, Pin.OUT)\nwhile True:\n    led.value(1)\n    time.sleep(1)\n    led.value(0)\n    time.sleep(1)\n    print(1)\n    print(2)\n";
  it("그대로면 주의", () => {
    expect(leftoverFromStart(start, start)).toHaveLength(1);
    expect(leftoverFromStart(start, start)[0]).toContain("바꾸지 않았어요");
  });
  it("한 줄만 바꿔도 주의 없음 (지시문이 한 줄만 바꾸라는 미션이 많다)", () => {
    const one = start.replace("time.sleep(1)\n    led.value(0)", "time.sleep(2)\n    led.value(0)");
    expect(leftoverFromStart(start, one)).toEqual([]);
  });
  it("줄을 더하기만 해도 바꾼 것이다", () => {
    expect(leftoverFromStart(start, start + "    print(3)\n")).toEqual([]);
  });
  it("주석·빈 줄·들여쓰기 차이는 바꾼 것이 아니다", () => {
    const same = start.replace("import time", "import time  # 시간\n\n").replace("    led.value(1)", "        led.value(1)");
    expect(leftoverFromStart(start, same)).toHaveLength(1);
  });
  it("같은 줄이 여럿이면 개수만큼만 짝 지운다 (한 줄만 남기면 바꾼 것)", () => {
    const s = "a()\na()\na()\na()\na()\na()\na()\na()\na()\na()\n";
    expect(leftoverFromStart(s, "a()\n")).toEqual([]);
    expect(leftoverFromStart(s, "a()\n".repeat(9))).toEqual([]);
    expect(leftoverFromStart(s, "a()\n".repeat(10))).toHaveLength(1);
  });
  it("규칙에 notHas 가 있으면 그 규칙이 보므로 주의를 내지 않는다", () => {
    const rules = [{ notHas: "time.sleep(1)", fail: "바꿨나요?" }] as unknown as Rule[];
    expect(leftoverFromStart(start, start, rules)).toEqual([]);
    expect(leftoverFromStart(start, start, [{ codeMatches: "x", fail: "x?" }])).toHaveLength(1);
  });
  it("시작 코드가 비면 주의가 없다", () => {
    expect(leftoverFromStart("", "x = 1\n")).toEqual([]);
    expect(leftoverFromStart("# 주석만\n", "x = 1\n")).toEqual([]);
  });
});
