import { beforeAll, describe, expect, it } from "vitest";
import { registerBlocks } from "@/blocks";
import { codeToBlocks } from "@/parser";
import { checkAnswer, countBlocks, hasBlock, insideOf, judge, lineKey } from "./judge";
import { normalizeCode } from "@/parser/normalize";
import { RuleSchema, type Rule } from "./schema";
import type { BlockJson } from "@/parser/types";

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

describe("judge — 줄 규칙 (hasLine · notHas · order · count)", () => {
  // 함수 · 조건 · 반복이 섞인 코드 (주석·빈 줄은 정규화에서 빠진다)
  const code = [
    "from machine import Pin",
    "import time",
    "led = Pin(26, Pin.OUT)",
    "pressed = False",
    "",
    "def on_press(pin):",
    "    global pressed",
    "    pressed = True   # 깃발",
    "",
    "while True:",
    "    if pressed:",
    "        if led.value() == 0:",
    "            led.value(1)",
    "        else:",
    "            led.value(0)",
    "        pressed = False",
    "    time.sleep(0.05)",
    "print('end')",
    "",
  ].join("\n");

  it("lineKey: 앞뒤 공백·공백 묶음·따옴표 종류를 무시한다", () => {
    expect(lineKey("  show( 'OPEN',  \"a\" )  ")).toBe('show( "OPEN", "a" )');
    expect(lineKey("led.value(1)")).toBe(lineKey("\tled.value(1)   "));
    // 공백이 있고 없고는 다르다 (한 칸으로 줄일 뿐)
    expect(lineKey("led.value( 1 )")).not.toBe(lineKey("led.value(1)"));
  });

  it("hasLine: 그 줄이 있으면 통과, 없으면 fail 문장", () => {
    expect(judge([{ hasLine: { text: "time.sleep(0.05)" }, fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ hasLine: { text: "led  =  Pin(26,   Pin.OUT)" }, fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ hasLine: { text: 'print("end")' }, fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ hasLine: { text: "time.sleep(2)" }, fail: "2초 기다리는 줄이 있나요?" }], { code })).toEqual({ pass: false, failures: ["2초 기다리는 줄이 있나요?"] });
    // 줄의 일부만 같은 것은 아니다, 주석은 안 본다, 코드가 없으면 실패
    expect(judge([{ hasLine: { text: "led.value" }, fail: "x" }], { code }).pass).toBe(false);
    expect(judge([{ hasLine: { text: "깃발" }, fail: "x" }], { code }).pass).toBe(false);
    expect(judge([{ hasLine: { text: "import time" }, fail: "x" }], {}).pass).toBe(false);
  });

  it("hasLine inside: 가장 가까운 블록 머리를 들여쓰기로 판단한다", () => {
    const has = (text: string, inside: "loop" | "def" | "if" | "top") => judge([{ hasLine: { text, inside }, fail: "x" }], { code }).pass;
    expect(has("pressed = False", "top")).toBe(true); // 4번 줄
    expect(has("pressed = False", "if")).toBe(true); // else 뒤의 16번 줄 → 가장 가까운 머리는 if pressed:
    expect(has("pressed = False", "loop")).toBe(false);
    expect(has("pressed = True", "def")).toBe(true);
    expect(has("pressed = True", "top")).toBe(false);
    expect(has("global pressed", "def")).toBe(true);
    expect(has("time.sleep(0.05)", "loop")).toBe(true);
    expect(has("time.sleep(0.05)", "if")).toBe(false);
    expect(has("led.value(1)", "if")).toBe(true);
    expect(has("led.value(0)", "if")).toBe(true); // else: 도 if 로 본다
    expect(has("if pressed:", "loop")).toBe(true); // if 줄 자체는 while 안
    expect(has("def on_press(pin):", "top")).toBe(true);
  });

  it("insideOf: for 는 loop, try 처럼 모르는 머리는 undefined", () => {
    const lines = normalizeCode("for i in range(3):\n    led.value(1)\ntry:\n    x()\nexcept:\n    y()\n");
    expect(insideOf(lines, 1)).toBe("loop");
    expect(insideOf(lines, 3)).toBeUndefined();
    expect(insideOf(lines, 0)).toBe("top");
  });

  it("notHas: 그 줄이 없어야 통과 (공백·따옴표 차이도 같은 줄로 본다)", () => {
    expect(judge([{ notHas: "time.sleep(2)", fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ notHas: "print('end')", fail: "아직 남아 있지 않나요?" }], { code })).toEqual({ pass: false, failures: ["아직 남아 있지 않나요?"] });
    expect(judge([{ notHas: 'print( "end" )', fail: "x" }], { code }).pass).toBe(true); // 괄호 안 공백은 다른 줄
    expect(judge([{ notHas: "  time.sleep(0.05)  ", fail: "x" }], { code }).pass).toBe(false);
    expect(judge([{ notHas: "import time", fail: "x" }], {}).pass).toBe(true);
  });

  it("order: 첫 등장 순서가 그 차례여야 통과, 하나라도 없으면 실패", () => {
    expect(judge([{ order: ["global pressed", "while True:", "time.sleep(0.05)"], fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ order: ["led.value(1)", "led.value(0)"], fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ order: ["led.value(0)", "led.value(1)"], fail: "순서가 맞나요?" }], { code })).toEqual({ pass: false, failures: ["순서가 맞나요?"] });
    expect(judge([{ order: ["import time", "time.sleep(2)"], fail: "x" }], { code }).pass).toBe(false);
    // 같은 줄이 여러 번 있으면 첫 등장으로 본다
    expect(judge([{ order: ["pressed = False", "def on_press(pin):"], fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ order: ["def on_press(pin):", "pressed = False"], fail: "x" }], { code }).pass).toBe(false);
  });

  it("count: 줄 개수가 min 이상 · max 이하", () => {
    expect(judge([{ count: { text: "pressed = False", max: 2 }, fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ count: { text: "pressed = False", max: 1 }, fail: "몇 번 쓰였나요?" }], { code })).toEqual({ pass: false, failures: ["몇 번 쓰였나요?"] });
    expect(judge([{ count: { text: "pressed = False", min: 2 }, fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ count: { text: "pressed = False", min: 3 }, fail: "x" }], { code }).pass).toBe(false);
    expect(judge([{ count: { text: "led.value(1)", min: 1, max: 1 }, fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ count: { text: "time.sleep(2)", max: 0 }, fail: "x" }], { code }).pass).toBe(true);
    expect(judge([{ count: { text: "time.sleep(2)", min: 1 }, fail: "x" }], {}).pass).toBe(false);
  });
});

describe("judge — blocks 규칙 (블록 모양 · inside · after · inputs · 변수 이름)", () => {
  /* 손으로 짠 Blockly 직렬화 JSON. 변수 칸은 codeToBlocks 처럼 {id} 만 적고 이름은 variables 표에 둔다 */
  const num = (n: number): BlockJson => ({ type: "math_number", fields: { NUM: n } });
  const write = (value: string | number, VAR = "var_led"): BlockJson => ({ type: "esp_pin_write", fields: { VAR: { id: VAR }, VALUE: value } });
  const wait = (sec: number): BlockJson => ({ type: "flow_wait", inputs: { SEC: { block: num(sec) } } });
  /** 명령 블록 배열을 next 로 잇는다 */
  const chain = (list: BlockJson[]): BlockJson => {
    const copies = list.map((b) => ({ ...b }));
    copies.forEach((b, i) => { if (copies[i + 1]) b.next = { block: copies[i + 1] }; });
    return copies[0];
  };
  const forever = (body: BlockJson[]): BlockJson => ({ type: "flow_repeat_forever", inputs: { DO: { block: chain(body) } } });
  const ws = (body: BlockJson[], variables: { id: string; name: string }[] = [{ id: "var_led", name: "led" }]) => ({
    variables,
    blocks: { languageVersion: 0, blocks: [{ type: "start_program", inputs: { BODY: { block: chain(body) } } }] },
  });
  const setup: BlockJson = { type: "esp_pin_setup", fields: { PIN: 26, MODE: "OUT", VAR: { id: "var_led" } } };
  /** 01 미션 정답 모양: 준비 → 끝없이 { 켜기, 2초, 끄기, 1초 } */
  const slowBlink = ws([setup, forever([write("1"), wait(2), write("0"), wait(1)])]);

  it("type 만 적으면 그 블록이 있으면 통과, 없으면 fail 문장", () => {
    expect(judge([{ blocks: { type: "flow_repeat_forever" }, fail: "x" }], { blocksJson: slowBlink })).toEqual({ pass: true, failures: [] });
    expect(judge([{ blocks: { type: "flow_repeat_n" }, fail: "되풀이하나요?" }], { blocksJson: slowBlink })).toEqual({ pass: false, failures: ["되풀이하나요?"] });
    expect(judge([{ blocks: { type: "flow_wait" }, fail: "x" }], {}).pass).toBe(false);
    expect(judge([{ blocks: { type: "flow_wait" }, fail: "x" }], { blocksJson: null }).pass).toBe(false);
  });

  it("fields: 적은 칸만 비교하고 글·수는 String 으로 같으면 같다", () => {
    expect(hasBlock(slowBlink, { type: "esp_pin_write", fields: { VALUE: "1" } })).toBe(true);
    expect(hasBlock(slowBlink, { type: "esp_pin_write", fields: { VALUE: "2" } })).toBe(false);
    // YAML 에 수로 적어도(PIN: 26) JSON 의 26 과 같다. 글로 적어도("26") 같다
    expect(hasBlock(slowBlink, { type: "esp_pin_setup", fields: { PIN: 26, MODE: "OUT" } })).toBe(true);
    expect(hasBlock(slowBlink, { type: "esp_pin_setup", fields: { PIN: "26" } })).toBe(true);
    expect(hasBlock(slowBlink, { type: "esp_pin_setup", fields: { PIN: 27 } })).toBe(false);
    // 블록에 없는 칸을 적으면 실패
    expect(hasBlock(slowBlink, { type: "esp_pin_setup", fields: { NOPE: "1" } })).toBe(false);
    // 수는 수로 비교: "2.0" = 2, "0.10" = 0.1. 글은 글로: "OUT" ≠ "out"
    expect(hasBlock(slowBlink, { type: "flow_wait", inputs: { SEC: { type: "math_number", fields: { NUM: "2.0" } } } })).toBe(true);
    expect(hasBlock(ws([wait(0.1)]), { type: "flow_wait", inputs: { SEC: { type: "math_number", fields: { NUM: "0.10" } } } })).toBe(true);
    expect(hasBlock(slowBlink, { type: "esp_pin_setup", fields: { MODE: "out" } })).toBe(false);
    expect(hasBlock(slowBlink, { type: "esp_pin_write", fields: { VALUE: 1 } })).toBe(true);
  });

  it("코드 모드에서 블록으로 안 바뀐 수 글(code_expr \"2.0\")은 math_number 로 본다", () => {
    const codeExpr = ws([{ type: "flow_wait", inputs: { SEC: { block: { type: "code_expr", fields: { CODE: "2.0" } } } } }]);
    expect(hasBlock(codeExpr, { type: "flow_wait", inputs: { SEC: { type: "math_number", fields: { NUM: 2 } } } })).toBe(true);
    expect(hasBlock(codeExpr, { type: "flow_wait", inputs: { SEC: { type: "math_number", fields: { NUM: 3 } } } })).toBe(false);
    expect(hasBlock(codeExpr, { type: "flow_wait", inputs: { SEC: { type: "math_number" } } })).toBe(true);
    // 수가 아닌 코드 글(변수 t)은 수 블록이 아니다. 거꾸로 math_number 를 code_expr 모양으로 찾을 수도 없다
    const varExpr = ws([{ type: "flow_wait", inputs: { SEC: { block: { type: "code_expr", fields: { CODE: "t" } } } } }]);
    expect(hasBlock(varExpr, { type: "flow_wait", inputs: { SEC: { type: "math_number" } } })).toBe(false);
    expect(hasBlock(slowBlink, { type: "flow_wait", inputs: { SEC: { type: "code_expr", fields: { CODE: "2" } } } })).toBe(false);
  });

  it("inputs: 값 입력에 꽂힌 블록의 모양을 중첩으로 본다 (블록이 없으면 그림자)", () => {
    expect(hasBlock(slowBlink, { type: "flow_wait", inputs: { SEC: { type: "math_number", fields: { NUM: 2 } } } })).toBe(true);
    expect(hasBlock(slowBlink, { type: "flow_wait", inputs: { SEC: { type: "math_number", fields: { NUM: "1" } } } })).toBe(true);
    expect(hasBlock(slowBlink, { type: "flow_wait", inputs: { SEC: { type: "math_number", fields: { NUM: 3 } } } })).toBe(false);
    expect(hasBlock(slowBlink, { type: "flow_wait", inputs: { SEC: { type: "variables_get" } } })).toBe(false);
    expect(hasBlock(slowBlink, { type: "flow_wait", inputs: { MS: { type: "math_number" } } })).toBe(false);
    // 그림자만 있는 입력(수 칸 기본값)도 그 값으로 본다
    const shadowOnly = ws([{ type: "flow_wait", inputs: { SEC: { shadow: num(5) } } }]);
    expect(hasBlock(shadowOnly, { type: "flow_wait", inputs: { SEC: { type: "math_number", fields: { NUM: 5 } } } })).toBe(true);
    // 그림자는 블록으로 세지 않는다 (규칙의 대상 블록이 될 수 없다)
    expect(hasBlock(shadowOnly, { type: "math_number" })).toBe(false);
    // 두 단계 중첩: 비교 블록의 A 자리에 변수 읽기
    const cmp: BlockJson = { type: "logic_compare", fields: { OP: "EQ" }, inputs: { A: { block: { type: "variables_get", fields: { VAR: { id: "var_state" } } } }, B: { block: num(0) } } };
    const json = ws([{ type: "controls_if", inputs: { IF0: { block: cmp }, DO0: { block: write("1") } } }], [{ id: "var_state", name: "state" }, { id: "var_led", name: "led" }]);
    expect(hasBlock(json, { type: "controls_if", inputs: { IF0: { type: "logic_compare", fields: { OP: "EQ" }, inputs: { A: { type: "variables_get", fields: { VAR: "state" } }, B: { type: "math_number", fields: { NUM: 0 } } } } } })).toBe(true);
    expect(hasBlock(json, { type: "controls_if", inputs: { IF0: { type: "logic_compare", inputs: { A: { type: "variables_get", fields: { VAR: "led" } } } } } })).toBe(false);
  });

  it("변수 칸은 이름으로 비교한다: {id} 는 variables 표에서, Blockly 저장본의 {id, name} 은 name 으로", () => {
    expect(hasBlock(slowBlink, { type: "esp_pin_write", fields: { VAR: "led" } })).toBe(true);
    expect(hasBlock(slowBlink, { type: "esp_pin_write", fields: { VAR: "light" } })).toBe(false);
    expect(hasBlock(slowBlink, { type: "esp_pin_write", fields: { VAR: "var_led" } })).toBe(false);
    // Blockly 가 저장한 작업판: 변수 칸에 name 이 들어 있고 id 는 임의
    const saved = { blocks: { languageVersion: 0, blocks: [{ type: "esp_pin_write", fields: { VAR: { id: "a1B2", name: "light", type: "" }, VALUE: "1" } }] } };
    expect(hasBlock(saved, { type: "esp_pin_write", fields: { VAR: "light", VALUE: "1" } })).toBe(true);
    // 표에 없는 id 는 이름을 모른다 → 실패
    expect(hasBlock(ws([write("1", "var_unknown")]), { type: "esp_pin_write", fields: { VAR: "led" } })).toBe(false);
  });

  it("inside: 감싸는 블록(조상) 중에 그 타입 — loop·def·top 별칭, 아니면 타입 그대로. 형제(next)는 조상이 아니다", () => {
    const def: BlockJson = { type: "procedures_defnoreturn", fields: { NAME: "blink" }, inputs: { STACK: { block: chain([write("1"), wait(1)]) } } };
    const ifBlock: BlockJson = { type: "controls_if", inputs: { IF0: { block: { type: "logic_boolean", fields: { BOOL: "TRUE" } } }, DO0: { block: write("0") } } };
    const whileBlock: BlockJson = { type: "controls_whileUntil", fields: { MODE: "WHILE" }, inputs: { BOOL: { block: { type: "logic_boolean" } }, DO: { block: wait(0.01) } } };
    const forBlock: BlockJson = { type: "flow_for_range", inputs: { TIMES: { block: num(3) }, DO: { block: { type: "esp_print", inputs: { VALUE: { block: num(7) } } } } } };
    const json = { variables: [{ id: "var_led", name: "led" }], blocks: { languageVersion: 0, blocks: [
      { type: "start_program", inputs: { BODY: { block: chain([setup, forever([ifBlock, whileBlock]), forBlock]) } } },
      def,
    ] } };
    // loop 별칭: 끝없이 · while · for
    expect(hasBlock(json, { type: "esp_pin_write", fields: { VALUE: "0" }, inside: "loop" })).toBe(true); // if 안이지만 조상에 끝없이 반복
    expect(hasBlock(json, { type: "flow_wait", inputs: { SEC: { type: "math_number", fields: { NUM: 0.01 } } }, inside: "loop" })).toBe(true);
    expect(hasBlock(json, { type: "esp_print", inside: "loop" })).toBe(true);
    expect(hasBlock(json, { type: "esp_pin_setup", inside: "loop" })).toBe(false);
    expect(hasBlock(json, { type: "flow_wait", fields: {}, inside: "flow_repeat_forever" })).toBe(true);
    expect(hasBlock(json, { type: "esp_print", inside: "flow_repeat_forever" })).toBe(false); // for 안이지 끝없이 안이 아니다
    // 타입 그대로
    expect(hasBlock(json, { type: "esp_pin_write", inside: "controls_if" })).toBe(true);
    expect(hasBlock(json, { type: "esp_pin_write", fields: { VALUE: "1" }, inside: "controls_if" })).toBe(false);
    // def 별칭
    expect(hasBlock(json, { type: "esp_pin_write", fields: { VALUE: "1" }, inside: "def" })).toBe(true);
    expect(hasBlock(json, { type: "esp_pin_write", fields: { VALUE: "0" }, inside: "def" })).toBe(false);
    // top: 시작 블록 몸통 바로 아래 (감싸는 블록 없음)
    expect(hasBlock(json, { type: "esp_pin_setup", inside: "top" })).toBe(true);
    expect(hasBlock(json, { type: "flow_repeat_forever", inside: "top" })).toBe(true);
    expect(hasBlock(json, { type: "controls_if", inside: "top" })).toBe(false);
    expect(hasBlock(json, { type: "flow_wait", inside: "top" })).toBe(false);
    // 형제: 끝없이 반복은 esp_pin_setup 의 next 지만 그 안이 아니다
    expect(hasBlock(json, { type: "flow_repeat_forever", inside: "esp_pin_setup" })).toBe(false);
    // 규칙으로도 fail 문장이 나온다
    expect(judge([{ blocks: { type: "esp_pin_setup", inside: "loop" }, fail: "반복 안에 있나요?" }], { blocksJson: json })).toEqual({ pass: false, failures: ["반복 안에 있나요?"] });
  });

  it("after: 같은 몸통에서 바로 앞 형제 블록의 모양 (둘 앞·다른 몸통·몸통 첫 블록은 아니다)", () => {
    const two: Rule = { blocks: { type: "flow_wait", inputs: { SEC: { type: "math_number", fields: { NUM: 2 } } }, after: { type: "esp_pin_write", fields: { VALUE: "1" } } }, fail: "켜진 뒤 기다리나요?" };
    expect(judge([two], { blocksJson: slowBlink }).pass).toBe(true);
    // 켜기 뒤에 1초, 끄기 뒤에 2초 → 실패
    const swapped = ws([setup, forever([write("1"), wait(1), write("0"), wait(2)])]);
    expect(judge([two], { blocksJson: swapped })).toEqual({ pass: false, failures: ["켜진 뒤 기다리나요?"] });
    // 둘 앞은 아니다: 켜기 → 찍기 → 2초
    const gap = ws([setup, forever([write("1"), { type: "esp_print", inputs: { VALUE: { block: num(1) } } }, wait(2)])]);
    expect(judge([two], { blocksJson: gap }).pass).toBe(false);
    // 몸통의 첫 블록에는 앞 형제가 없다 (바깥 몸통의 마지막 블록은 앞 형제가 아니다)
    const first = ws([setup, write("1"), forever([wait(2), write("0")])]);
    expect(judge([two], { blocksJson: first }).pass).toBe(false);
    // after 의 모양이 틀리면 실패
    expect(hasBlock(slowBlink, { type: "flow_wait", after: { type: "esp_pin_write", fields: { VALUE: "0" }, inputs: {} } })).toBe(true);
    expect(hasBlock(slowBlink, { type: "flow_wait", after: { type: "flow_wait" } })).toBe(false);
  });

  describe("코드 모드 입력: codeToBlocks 로 만든 JSON 도 같은 규칙으로 본다", () => {
    beforeAll(() => registerBlocks());
    const rules: Rule[] = [
      { blocks: { type: "flow_wait", inputs: { SEC: { type: "math_number", fields: { NUM: 2 } } }, after: { type: "esp_pin_write", fields: { VALUE: "1" } } }, fail: "켜진 시간" },
      { blocks: { type: "esp_pin_write", fields: { VAR: "led", VALUE: "1" }, inside: "loop" }, fail: "반복" },
      { blocks: { type: "esp_pin_setup", fields: { PIN: 26, MODE: "OUT" } }, fail: "준비" },
    ];
    const blocksOf = (code: string) => { const r = codeToBlocks(code); return r.ok ? r.json : undefined; };
    it("정답 코드는 통과(2.0 으로 써도), 숫자를 안 바꾼 코드는 그 규칙만 실패", () => {
      expect(judge(rules, { code: blink, blocksJson: blocksOf(blink) })).toEqual({ pass: true, failures: [] });
      const point = blink.replace("time.sleep(2)", "time.sleep(2.0)");
      expect(judge(rules, { code: point, blocksJson: blocksOf(point) })).toEqual({ pass: true, failures: [] });
      const start = blink.replace("time.sleep(2)", "time.sleep(1)");
      expect(judge(rules, { code: start, blocksJson: blocksOf(start) })).toEqual({ pass: false, failures: ["켜진 시간"] });
    });
    it("변수 이름이 달라도 VAR 를 적지 않은 규칙은 통과하고, 적은 규칙은 이름으로 걸린다", () => {
      const renamed = blink.replace(/led/g, "light");
      expect(judge(rules, { code: renamed, blocksJson: blocksOf(renamed) }).failures).toEqual(["반복"]);
      expect(judge([{ blocks: { type: "esp_pin_write", fields: { VAR: "light" } }, fail: "x" }], { blocksJson: blocksOf(renamed) }).pass).toBe(true);
    });
    it("blocksJson 이 없으면(코드만) blocks 규칙은 실패한다 — 화면은 judgeInput 으로 채워 넘긴다", () => {
      expect(judge(rules, { code: blink }).pass).toBe(false);
    });
  });

  it("스키마: 계획의 YAML 모양을 받아들이고, 모르는 키·빈 type 은 거부한다", () => {
    const ok = { blocks: { type: "esp_pin_write", fields: { VALUE: "1" }, inside: "loop", after: { type: "flow_wait", inputs: { SEC: { type: "math_number", fields: { NUM: 2 } } } } }, fail: "x?" };
    expect(RuleSchema.safeParse(ok).success).toBe(true);
    expect(RuleSchema.safeParse({ blocks: { type: "esp_pin_write" }, fail: "x?" }).success).toBe(true);
    expect(RuleSchema.safeParse({ blocks: { type: "" }, fail: "x?" }).success).toBe(false);
    expect(RuleSchema.safeParse({ blocks: { type: "a", field: { X: 1 } }, fail: "x?" }).success).toBe(false);
    expect(RuleSchema.safeParse({ blocks: { type: "a", inputs: { SEC: { type: "b", inside: "loop" } } }, fail: "x?" }).success).toBe(false); // 중첩 모양에는 inside 가 없다
    expect(RuleSchema.safeParse({ blocks: { type: "a", fields: { X: { id: "v" } } }, fail: "x?" }).success).toBe(false); // 변수는 이름(글)으로
    expect(RuleSchema.safeParse({ blocks: { type: "a" } }).success).toBe(false); // fail 없음
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
