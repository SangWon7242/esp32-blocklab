import { describe, expect, it } from "vitest";
import { checkAnswer, countBlocks, judge } from "./judge";
import type { Rule } from "./schema";

const blink = "from machine import Pin\nimport time\n\nled = Pin(26, Pin.OUT)\n\nwhile True:\n    led.value(1)\n    time.sleep(2)\n    led.value(0)\n    time.sleep(1)\n";
const files = { "slow.py": "from machine import Pin   # 핀\nimport time\nled = Pin(26, Pin.OUT)\nwhile True:\n    led.value(1)  # 켜기\n    time.sleep(2)\n\n    led.value(0)\n    time.sleep(1)\n" };

// Blockly 직렬화 모양: 최상위 blocks.blocks, inputs 의 block/shadow, next
const workspace = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: "controls_whileUntil",
        inputs: {
          BOOL: { block: { type: "logic_boolean" } },
          DO: {
            block: {
              type: "esp_pin_write",
              next: { block: { type: "time_sleep", inputs: { SECONDS: { shadow: { type: "math_number" }, block: { type: "math_number" } } } } },
            },
          },
        },
      },
      { type: "esp_pin_setup", x: 10, y: 10 },
    ],
  },
};

describe("judge — 6가지 규칙", () => {
  it("codeEquals: 주석·빈 줄·공백 차이는 같다고 본다", () => {
    const rules: Rule[] = [{ codeEquals: { file: "slow.py" }, fail: "다시" }];
    expect(judge(rules, { code: blink.replace("time.sleep(2)", "time.sleep( 2 )") }, files)).toEqual({ pass: true, failures: [] });
  });
  it("codeEquals: canonical 함수가 있으면 양쪽을 그 꼴로 바꿔 비교한다 (함수 위치·import 순서 차이 흡수)", () => {
    const rules: Rule[] = [{ codeEquals: { file: "t.py" }, fail: "다시" }];
    const files = { "t.py": "import time\nfrom machine import Pin\nled = Pin(26, Pin.OUT)\ndef on():\n    led.value(1)\non()\n" };
    const student = "from machine import Pin\nimport time\n\ndef on():\n    led.value(1)\n\nled = Pin(26, Pin.OUT)\n\non()\n";
    // 정규화 원문끼리는 순서가 달라 실패
    expect(judge(rules, { code: student }, files).pass).toBe(false);
    // 표준 꼴(여기서는 줄을 정렬하는 가짜 함수)로는 통과
    const canonical = (code: string) => code.split("\n").map((l) => l.trim()).filter(Boolean).sort();
    expect(judge(rules, { code: student, canonical }, files).pass).toBe(true);
  });

  it("codeEquals: 숫자가 다르면 실패하고 규칙의 fail 을 돌려준다", () => {
    const rules: Rule[] = [{ codeEquals: { file: "slow.py" }, fail: "켜진 시간을 다시 보세요" }];
    expect(judge(rules, { code: blink.replace("time.sleep(2)", "time.sleep(1)") }, files)).toEqual({ pass: false, failures: ["켜진 시간을 다시 보세요"] });
  });
  it("codeEquals: tolerance 안의 숫자는 같다고 본다 (절대값)", () => {
    const rules: Rule[] = [{ codeEquals: { file: "slow.py", tolerance: 0.5 }, fail: "x" }];
    expect(judge(rules, { code: blink.replace("time.sleep(2)", "time.sleep(2.4)") }, files).pass).toBe(true);
    expect(judge(rules, { code: blink.replace("time.sleep(2)", "time.sleep(2.6)") }, files).pass).toBe(false);
    // 줄 모양이 다르면 tolerance 와 상관없이 실패
    expect(judge(rules, { code: blink.replace("led.value(0)", "led.value(0, 1)") }, files).pass).toBe(false);
  });
  it("codeEquals: 이름 속 숫자(duty_u16 의 16)는 숫자 리터럴이 아니다", () => {
    const f = { "d.py": "servo.duty_u16(8100)\n" };
    const rules: Rule[] = [{ codeEquals: { file: "d.py", tolerance: 200 }, fail: "x" }];
    expect(judge(rules, { code: "servo.duty_u16(8000)" }, f).pass).toBe(true);
    expect(judge(rules, { code: "servo.duty_u15(8100)" }, f).pass).toBe(false);
  });
  it("codeEquals: 들여쓰기·줄 수가 다르면 실패, 파일이 없으면 실패", () => {
    const rules: Rule[] = [{ codeEquals: { file: "slow.py" }, fail: "x" }];
    expect(judge(rules, { code: blink.replace("    time.sleep(1)", "time.sleep(1)") }, files).pass).toBe(false);
    expect(judge(rules, { code: blink + "print(1)\n" }, files).pass).toBe(false);
    expect(judge([{ codeEquals: { file: "none.py" }, fail: "x" }], { code: blink }, files).pass).toBe(false);
  });
  it("codeEquals: 문자열 안의 숫자는 tolerance 를 받지 않는다", () => {
    const f = { "s.py": 'print("15 cm")\n' };
    expect(judge([{ codeEquals: { file: "s.py", tolerance: 5 }, fail: "x" }], { code: 'print("16 cm")' }, f).pass).toBe(false);
  });

  it("useBlock: 블록 JSON 을 재귀로 훑어 하나라도 있으면 통과", () => {
    expect(judge([{ useBlock: ["esp_pin_write"], fail: "x" }], { blocksJson: workspace }).pass).toBe(true);
    expect(judge([{ useBlock: ["dev_servo_write", "time_sleep"], fail: "x" }], { blocksJson: workspace }).pass).toBe(true);
    expect(judge([{ useBlock: ["dev_servo_write"], fail: "서보 블록?" }], { blocksJson: workspace })).toEqual({ pass: false, failures: ["서보 블록?"] });
    expect(judge([{ useBlock: ["esp_pin_write"], fail: "x" }], {}).pass).toBe(false);
  });

  it("codeMatches: 정규화 코드(줄바꿈으로 이은 것)에 정규식", () => {
    const code = "if d < 15:   # 가까우면\n    print(\"가까워요!\")\n";
    expect(judge([{ codeMatches: 'print\\("가까워요!"\\)', fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ codeMatches: "if d < 15:\\n    print", fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ codeMatches: "^    print", fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ codeMatches: "가까우면", fail: "주석은 안 본다" }], { code })).toEqual({ pass: false, failures: ["주석은 안 본다"] });
  });

  it("pinIs: name = Pin(n, …) 또는 그 이름의 준비 줄에 Pin(n", () => {
    expect(judge([{ pinIs: { name: "led", pin: 26 }, fail: "x" }], { code: blink }).pass).toBe(true);
    expect(judge([{ pinIs: { name: "led", pin: 2 }, fail: "LED 핀?" }], { code: blink })).toEqual({ pass: false, failures: ["LED 핀?"] });
    expect(judge([{ pinIs: { name: "servo", pin: 4 }, fail: "x" }], { code: "servo = PWM(Pin(4))\n" }).pass).toBe(true);
    expect(judge([{ pinIs: { name: "led", pin: 26 }, fail: "x" }], { code: "buzzer = Pin(26, Pin.OUT)\n" }).pass).toBe(false);
    expect(judge([{ pinIs: { name: "led", pin: 26 }, fail: "x" }], { code: "# led = Pin(26, Pin.OUT)\n" }).pass).toBe(false);
  });

  it("maxBlocks: 그림자 블록은 세지 않는다", () => {
    expect(countBlocks(workspace)).toBe(6);
    expect(countBlocks(undefined)).toBe(0);
    expect(judge([{ maxBlocks: 6, fail: "x" }], { blocksJson: workspace }).pass).toBe(true);
    expect(judge([{ maxBlocks: 5, fail: "블록이 많아요" }], { blocksJson: workspace })).toEqual({ pass: false, failures: ["블록이 많아요"] });
  });

  it("outputIncludes: 실행 출력에 글자 포함", () => {
    expect(judge([{ outputIncludes: "가까워요!", fail: "x" }], { output: "12 cm\n가까워요!\n" }).pass).toBe(true);
    expect(judge([{ outputIncludes: "가까워요!", fail: "출력?" }], { output: "40 cm\n" })).toEqual({ pass: false, failures: ["출력?"] });
    expect(judge([{ outputIncludes: "가까워요!", fail: "x" }], {}).pass).toBe(false);
  });

  it("여러 규칙은 실패한 것만 순서대로 모은다, 빈 규칙은 통과", () => {
    const rules: Rule[] = [
      { codeMatches: "if d < 15:", fail: "a" },
      { pinIs: { name: "led", pin: 26 }, fail: "b" },
      { outputIncludes: "x", fail: "c" },
    ];
    expect(judge(rules, { code: blink, output: "" })).toEqual({ pass: false, failures: ["a", "c"] });
    expect(judge([], {})).toEqual({ pass: true, failures: [] });
  });
});

describe("checkAnswer — 읽기 체크 문항", () => {
  it("number·choice·line 은 같은 수면 정답", () => {
    expect(checkAnswer({ kind: "number", q: "", answer: 3 }, 3)).toBe(true);
    expect(checkAnswer({ kind: "number", q: "", answer: 3 }, 4)).toBe(false);
    expect(checkAnswer({ kind: "choice", q: "", options: ["a", "b"], answer: 1 }, 1)).toBe(true);
    expect(checkAnswer({ kind: "line", q: "", answer: 8 }, 7)).toBe(false);
  });
});
