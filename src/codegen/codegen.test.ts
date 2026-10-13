import { describe, expect, it, beforeAll } from "vitest";
import { registerBlocks } from "@/blocks";
import { workspaceJsonToCode, type WorkspaceJson } from "./index";

beforeAll(() => registerBlocks());

type B = Record<string, unknown>;
const num = (n: number): B => ({ type: "math_number", fields: { NUM: n } });
const str = (s: string): B => ({ type: "text", fields: { TEXT: s } });
const varGet = (name: string): B => ({ type: "variables_get", fields: { VAR: { id: `var_${name}` } } });
/** 명령 블록 배열을 next 체인으로 잇는다 */
function chain(blocks: B[]): B {
  const [head, ...rest] = blocks.map((b) => ({ ...b }));
  let cur = head;
  for (const b of rest) { cur.next = { block: b }; cur = b; }
  return head;
}
function program(body: B[], extra: { tops?: B[]; vars?: string[] } = {}): WorkspaceJson {
  return {
    variables: (extra.vars ?? []).map((name) => ({ name, id: `var_${name}` })),
    blocks: { languageVersion: 0, blocks: [...(extra.tops ?? []), { type: "start_program", x: 0, y: 0, inputs: { BODY: { block: chain(body) } } }] },
  } as WorkspaceJson;
}
const pinSetup = (name: string, pin: number, mode = "OUT"): B => ({ type: "esp_pin_setup", fields: { PIN: pin, MODE: mode, VAR: { id: `var_${name}` } } });
const pinWrite = (name: string, v: 0 | 1): B => ({ type: "esp_pin_write", fields: { VAR: { id: `var_${name}` }, VALUE: String(v) } });
const wait = (sec: number): B => ({ type: "flow_wait", inputs: { SEC: { block: num(sec) } } });
const waitMs = (ms: number): B => ({ type: "flow_wait_ms", inputs: { MS: { block: num(ms) } } });
const forever = (body: B[]): B => ({ type: "flow_repeat_forever", inputs: { DO: { block: chain(body) } } });

describe("챕터 1 코드 모양", () => {
  it("step1_led_on", () => {
    const code = workspaceJsonToCode(program([pinSetup("led", 26), pinWrite("led", 1)], { vars: ["led"] }));
    expect(code).toBe("from machine import Pin\n\nled = Pin(26, Pin.OUT)\n\nled.value(1)\n");
  });

  it("step4_blink_loop", () => {
    const code = workspaceJsonToCode(
      program([pinSetup("led", 26), forever([pinWrite("led", 1), wait(1), pinWrite("led", 0), wait(1)])], { vars: ["led"] }),
    );
    expect(code).toBe(
      "from machine import Pin\nimport time\n\nled = Pin(26, Pin.OUT)\n\nwhile True:\n    led.value(1)\n    time.sleep(1)\n    led.value(0)\n    time.sleep(1)\n",
    );
  });

  it("mission3_sos: 함수 정의·매개변수·n번 반복", () => {
    const def: B = {
      type: "procedures_defnoreturn",
      x: 0, y: 0,
      extraState: { params: [{ name: "t", id: "var_t" }] },
      fields: { NAME: "blink" },
      inputs: { STACK: { block: chain([pinWrite("led", 1), { type: "flow_wait", inputs: { SEC: { block: varGet("t") } } }, pinWrite("led", 0), wait(0.2)]) } },
    };
    const call = (t: number): B => ({ type: "procedures_callnoreturn", extraState: { name: "blink", params: ["t"] }, inputs: { ARG0: { block: num(t) } } });
    const repeat3 = (t: number): B => ({ type: "flow_repeat_n", inputs: { TIMES: { block: num(3) }, DO: { block: call(t) } } });
    const code = workspaceJsonToCode(
      program([pinSetup("led", 26), forever([repeat3(0.2), repeat3(0.6), repeat3(0.2), wait(1)])], { tops: [def], vars: ["led", "t"] }),
    );
    expect(code).toBe(
      [
        "from machine import Pin",
        "import time",
        "",
        "led = Pin(26, Pin.OUT)",
        "",
        "",
        "def blink(t):",
        "    led.value(1)",
        "    time.sleep(t)",
        "    led.value(0)",
        "    time.sleep(0.2)",
        "",
        "",
        "while True:",
        "    for i in range(3):",
        "        blink(0.2)",
        "    for i in range(3):",
        "        blink(0.6)",
        "    for i in range(3):",
        "        blink(0.2)",
        "    time.sleep(1)",
        "",
      ].join("\n"),
    );
  });
});

describe("챕터 10 코드 모양", () => {
  it("step3_auto_door: 접힌 초음파·서보·OLED, if, 문자 합치기", () => {
    const d = "d";
    const show = (a: B, b: B): B => ({ type: "esp_oled_show", inputs: { A: { block: a }, B: { block: b } } });
    const door = (action: "8100" | "1638"): B => ({ type: "esp_servo_door", fields: { VAR: { id: "var_servo" }, ACTION: action } });
    const code = workspaceJsonToCode(
      program(
        [
          { type: "esp_ultrasonic_setup", fields: { TRIG: 13, ECHO: 12 } },
          { type: "esp_servo_setup", fields: { VAR: { id: "var_servo" }, PIN: 4 } },
          { type: "esp_oled_setup", fields: { SCL: 22, SDA: 21 } },
          wait(2),
          show(str("AUTO DOOR"), str("Come closer")),
          forever([
            { type: "variables_set", fields: { VAR: { id: `var_${d}` } }, inputs: { VALUE: { block: { type: "esp_distance" } } } },
            {
              type: "controls_if",
              inputs: {
                IF0: { block: { type: "logic_compare", fields: { OP: "LT" }, inputs: { A: { block: varGet(d) }, B: { block: num(15) } } } },
                DO0: {
                  block: chain([
                    show(str("DOOR OPEN"), { type: "calc_concat", inputs: { A: { block: { type: "calc_str", inputs: { X: { block: varGet(d) } } } }, B: { block: str(" cm") } } }),
                    door("8100"), wait(3), show(str("DOOR CLOSE"), str("Bye~")), door("1638"), wait(1), show(str("AUTO DOOR"), str("Come closer")),
                  ]),
                },
              },
            },
            waitMs(300),
          ]),
        ],
        { vars: ["servo", "d"] },
      ),
    );
    expect(code).toBe(
      [
        "from machine import Pin, PWM, SoftI2C",
        "import ssd1306",
        "import time",
        "",
        "trig = Pin(13, Pin.OUT)",
        "echo = Pin(12, Pin.IN)",
        "servo = PWM(Pin(4))",
        "servo.freq(50)",
        "servo.duty_u16(1638)",
        "i2c = SoftI2C(scl=Pin(22), sda=Pin(21))",
        "oled = ssd1306.SSD1306_I2C(128, 64, i2c)",
        "",
        "",
        "def get_distance():",
        "    trig.value(1)",
        "    time.sleep_us(10)",
        "    trig.value(0)",
        "    while not echo.value():",
        "        pass",
        "    start = time.ticks_us()",
        "    while echo.value():",
        "        pass",
        "    stop = time.ticks_us()",
        "    t = time.ticks_diff(stop, start) // 2",
        "    return int(340 * t // 10000)",
        "",
        "",
        "def show(a, b):",
        "    oled.fill(0)",
        "    oled.text(a, 0, 20)",
        "    oled.text(b, 0, 36)",
        "    oled.show()",
        "",
        "",
        "time.sleep(2)",
        'show("AUTO DOOR", "Come closer")',
        "while True:",
        "    d = get_distance()",
        "    if d < 15:",
        '        show("DOOR OPEN", str(d) + " cm")',
        "        servo.duty_u16(8100)",
        "        time.sleep(3)",
        '        show("DOOR CLOSE", "Bye~")',
        "        servo.duty_u16(1638)",
        "        time.sleep(1)",
        '        show("AUTO DOOR", "Come closer")',
        "    time.sleep_ms(300)",
        "",
      ].join("\n"),
    );
  });

  it("practice_near: print 두 인자와 if 안 print", () => {
    const code = workspaceJsonToCode(
      program(
        [
          forever([
            { type: "variables_set", fields: { VAR: { id: "var_d" } }, inputs: { VALUE: { block: { type: "esp_distance" } } } },
            { type: "esp_print2", inputs: { A: { block: varGet("d") }, B: { block: str("cm") } } },
            {
              type: "controls_if",
              inputs: {
                IF0: { block: { type: "logic_compare", fields: { OP: "LT" }, inputs: { A: { block: varGet("d") }, B: { block: num(15) } } } },
                DO0: { block: { type: "esp_print", inputs: { VALUE: { block: str("가까워요!") } } } },
              },
            },
          ]),
        ],
        { vars: ["d"] },
      ),
    );
    expect(code).toContain('    print(d, "cm")\n    if d < 15:\n        print("가까워요!")\n');
  });
});

describe("식과 우선순위", () => {
  const arith = (op: string, a: B, b: B): B => ({ type: "calc_arith", fields: { OP: op }, inputs: { A: { block: a }, B: { block: b } } });
  const setT = (value: B): B => ({ type: "variables_set", fields: { VAR: { id: "var_t" } }, inputs: { VALUE: { block: value } } });
  const body = (value: B) => workspaceJsonToCode(program([setT(value)], { vars: ["t"] })).trim();

  it("같은 우선순위는 왼쪽부터, 괄호 없이", () => {
    expect(body(arith("FLOORDIV", arith("MULTIPLY", num(340), varGet("t")), num(10000)))).toBe("t = 340 * t // 10000");
  });
  it("낮은 우선순위가 안에 있으면 괄호", () => {
    expect(body(arith("MULTIPLY", arith("ADD", num(1), num(2)), num(3)))).toBe("t = (1 + 2) * 3");
    expect(body(arith("MINUS", num(1), arith("MINUS", num(2), num(3))))).toBe("t = 1 - (2 - 3)");
  });
  it("코드 식은 그대로, time. 이 보이면 import time", () => {
    const code = workspaceJsonToCode(program([setT({ type: "code_expr", fields: { CODE: "time.ticks_us()" } })], { vars: ["t"] }));
    expect(code).toBe("import time\n\nt = time.ticks_us()\n");
  });
  it("문자열은 큰따옴표", () => {
    expect(workspaceJsonToCode(program([{ type: "esp_print", inputs: { VALUE: { block: str('He said "hi"') } } }]))).toBe('print("He said \\"hi\\"")\n');
  });
  it("~이 될 때까지 반복과 빈 몸통", () => {
    const code = workspaceJsonToCode(
      program([{ type: "controls_whileUntil", fields: { MODE: "UNTIL" }, inputs: { BOOL: { block: { type: "esp_pin_read", fields: { VAR: { id: "var_echo" } } } } } }], { vars: ["echo"] }),
    );
    expect(code).toBe("while not echo.value():\n    pass\n");
  });
  it("블록 코멘트는 줄 끝 주석으로", () => {
    const code = workspaceJsonToCode(
      program([{ type: "esp_pin_write", fields: { VAR: { id: "var_led" }, VALUE: "1" }, icons: { comment: { text: "켜기", pinned: false, height: 80, width: 160 } } }], { vars: ["led"] }),
    );
    expect(code).toBe("led.value(1)  # 켜기\n");
  });
  it("여러 줄 코멘트는 문장 위의 주석 줄로", () => {
    const code = workspaceJsonToCode(
      program([{ type: "esp_pin_write", fields: { VAR: { id: "var_led" }, VALUE: "1" }, icons: { comment: { text: "켜기\n그리고 기다리기", pinned: false, height: 80, width: 160 } } }], { vars: ["led"] }),
    );
    expect(code).toBe("# 켜기\n# 그리고 기다리기\nled.value(1)\n");
  });
  it("준비 블록 코멘트는 끌어올린 첫 줄 끝 주석으로", () => {
    const servo = { type: "esp_servo_setup", fields: { PIN: 4, VAR: { id: "var_servo" } }, icons: { comment: { text: "문 모터", pinned: false, height: 80, width: 160 } } };
    const led = { ...pinSetup("led", 26), icons: { comment: { text: "time 켜기용", pinned: false, height: 80, width: 160 } } };
    const code = workspaceJsonToCode(program([servo, led, pinWrite("led", 1)], { vars: ["servo", "led"] }));
    expect(code).toBe(
      "from machine import Pin, PWM\n\nservo = PWM(Pin(4))  # 문 모터\nservo.freq(50)\nservo.duty_u16(1638)\nled = Pin(26, Pin.OUT)  # time 켜기용\n\nled.value(1)\n",
    );
  });
  it("연산자가 든 코드 식은 계산 안에서 괄호로 감싼다", () => {
    expect(body(arith("MULTIPLY", { type: "code_expr", fields: { CODE: "a + b" } }, num(3)))).toBe("t = (a + b) * 3");
  });
  it("호출 두 개가 이어진 코드 식은 괄호로 감싼다", () => {
    expect(body(arith("MULTIPLY", { type: "code_expr", fields: { CODE: "f(a) + g(b)" } }, num(3)))).toBe("t = (f(a) + g(b)) * 3");
  });
  it("중첩 호출 하나인 코드 식은 괄호 없이", () => {
    expect(body({ type: "code_expr", fields: { CODE: "PWM(Pin(4))" } })).toBe("from machine import Pin, PWM\n\nt = PWM(Pin(4))");
  });
  it("호출 하나인 코드 식은 괄호 없이", () => {
    expect(body({ type: "code_expr", fields: { CODE: "time.ticks_us()" } })).toBe("import time\n\nt = time.ticks_us()");
    expect(body(arith("FLOORDIV", { type: "code_expr", fields: { CODE: "time.ticks_diff(stop, start)" } }, num(2)))).toBe(
      "import time\n\nt = time.ticks_diff(stop, start) // 2",
    );
  });
  it("함수 안에 global 선언을 넣지 않고 반환형 함수를 만든다", () => {
    const def: B = {
      type: "procedures_defreturn", x: 0, y: 0, extraState: { params: [] }, fields: { NAME: "twice" },
      inputs: { RETURN: { block: arith("MULTIPLY", varGet("t"), num(2)) } },
    };
    const code = workspaceJsonToCode(program([setT(num(1))], { tops: [def], vars: ["t"] }));
    expect(code).toBe("def twice():\n    return t * 2\n\n\nt = 1\n");
  });
});

const comment = (text: string) => ({ comment: { text, pinned: false, height: 80, width: 160 } });

describe("최종 리뷰: 주석 줄·이름·여러 줄 코드·떨어진 블록", () => {
  it("I5 | 로 시작하는 줄은 줄 끝 주석, 나머지는 문장 위 주석 줄 (들여쓰기 맞춤)", () => {
    const write = { type: "esp_pin_write", fields: { VAR: { id: "var_led" }, VALUE: "1" }, icons: comment("켜기 전에\n한 번 더\n|켜기") };
    expect(workspaceJsonToCode(program([forever([write])], { vars: ["led"] }))).toBe("while True:\n    # 켜기 전에\n    # 한 번 더\n    led.value(1)  # 켜기\n");
    const only = { ...write, icons: comment("위에만\n|") };
    expect(workspaceJsonToCode(program([only], { vars: ["led"] }))).toBe("# 위에만\nled.value(1)\n");
  });
  it("I5 준비 블록의 윗줄 주석은 끌어올린 첫 줄 위로", () => {
    const led = { ...pinSetup("led", 26), icons: comment("핀 준비\n|LED") };
    expect(workspaceJsonToCode(program([led], { vars: ["led"] }))).toBe("from machine import Pin\n\n# 핀 준비\nled = Pin(26, Pin.OUT)  # LED\n");
  });
  it("I5 시작 블록 코멘트는 파일 맨 위 머리말", () => {
    const json = program([pinWrite("led", 1)], { vars: ["led"] });
    const start = (json.blocks as { blocks: B[] }).blocks.find((b) => b.type === "start_program")!;
    start.icons = comment("첫 줄\n둘째 줄");
    expect(workspaceJsonToCode(json)).toBe("# 첫 줄\n# 둘째 줄\n\nled.value(1)\n");
  });
  it("I6 파이썬 키워드가 아닌 이름(max, list)은 바꾸지 않는다", () => {
    const set = (name: string): B => ({ type: "variables_set", fields: { VAR: { id: `var_${name}` } }, inputs: { VALUE: { block: num(1) } } });
    expect(workspaceJsonToCode(program([set("max"), set("list")], { vars: ["max", "list"] }))).toBe("max = 1\nlist = 1\n");
  });
  it("I7 여러 줄 코드 블록은 줄마다 들여쓴다", () => {
    const code = workspaceJsonToCode(program([forever([{ type: "code_stmt", fields: { CODE: "for k in range(3):\n    print(k)" } }])]));
    expect(code).toBe("while True:\n    for k in range(3):\n        print(k)\n");
  });
  it("I8 꺼진(떨어진) 블록은 코드에 넣지 않는다", () => {
    const def: B = { type: "procedures_defnoreturn", x: 0, y: 0, fields: { NAME: "f" }, inputs: { STACK: { block: { type: "esp_print", inputs: { VALUE: { block: str("in") } } } } } };
    const loose: B = { type: "esp_print", x: 0, y: 300, disabledReasons: ["ORPHANED_BLOCK"], inputs: { VALUE: { block: str("loose") } } };
    const code = workspaceJsonToCode(program([pinWrite("led", 1)], { tops: [def, loose], vars: ["led"] }));
    expect(code).toContain('print("in")');
    expect(code).not.toContain("loose");
  });
  it("I9d 문자열의 \\r 은 이스케이프한다", () => {
    expect(workspaceJsonToCode(program([{ type: "esp_print", inputs: { VALUE: { block: str("a\rb") } } }]))).toBe('print("a\\rb")\n');
  });
});
