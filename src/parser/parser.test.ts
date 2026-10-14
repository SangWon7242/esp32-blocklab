import { describe, expect, it } from "vitest";
import { workspaceJsonToCode } from "@/codegen";
import { codeToBlocks } from "./index";
import type { BlockJson } from "./types";

function parse(code: string) {
  const r = codeToBlocks(code);
  if (!r.ok) throw new Error(`parse failed: ${r.error.message} (line ${r.error.line})`);
  return r;
}
/** start_program 몸통을 배열로 편다 */
function body(code: string): BlockJson[] {
  const r = parse(code);
  const start = (r.json.blocks.blocks as BlockJson[]).find((b) => b.type === "start_program");
  const out: BlockJson[] = [];
  let cur = start?.inputs?.BODY?.block;
  while (cur) { out.push(cur); cur = cur.next?.block; }
  return out;
}
const tops = (code: string) => (parse(code).json.blocks.blocks as BlockJson[]).filter((b) => b.type !== "start_program");

describe("설정 패턴", () => {
  it("Pin 대입은 esp_pin_setup, 알려진 import는 사라진다", () => {
    const b = body("from machine import Pin\nled = Pin(26, Pin.OUT)\n");
    expect(b).toHaveLength(1);
    expect(b[0].type).toBe("esp_pin_setup");
    expect(b[0].fields).toEqual({ PIN: 26, MODE: "OUT", VAR: { id: "var_led" } });
  });
  it("PWM + freq(50) + duty_u16(1638)은 서보 준비 하나로 접힌다", () => {
    const b = body("servo = PWM(Pin(4))\nservo.freq(50)\nservo.duty_u16(1638)\n");
    expect(b.map((x) => x.type)).toEqual(["esp_servo_setup"]);
    expect(b[0].fields).toEqual({ VAR: { id: "var_servo" }, PIN: 4 });
  });
  it("PWM + freq 만 있으면 esp_pwm_setup", () => {
    const b = body("pwm = PWM(Pin(2))\npwm.freq(1000)\npwm.duty_u16(300)\n");
    expect(b.map((x) => x.type)).toEqual(["esp_pwm_setup", "esp_pwm_duty"]);
    expect(b[0].fields).toEqual({ VAR: { id: "var_pwm" }, PIN: 2, FREQ: 1000 });
  });
  it("표준 get_distance 가 있으면 초음파 준비로 접힌다", () => {
    const src = [
      "trig = Pin(13, Pin.OUT)", "echo = Pin(12, Pin.IN)", "",
      "def get_distance():", "    trig.value(1)", "    time.sleep_us(10)", "    trig.value(0)",
      "    while not echo.value():", "        pass", "    start = time.ticks_us()",
      "    while echo.value():", "        pass", "    stop = time.ticks_us()",
      "    t = time.ticks_diff(stop, start) // 2", "    return int(340 * t // 10000)", "",
      "d = get_distance()", "",
    ].join("\n");
    const b = body(src);
    expect(b.map((x) => x.type)).toEqual(["esp_ultrasonic_setup", "variables_set"]);
    expect(b[0].fields).toEqual({ TRIG: 13, ECHO: 12 });
    expect(b[1].inputs?.VALUE?.block?.type).toBe("esp_distance");
    expect(tops(src)).toHaveLength(0);
    // 접힌 함수 안에서만 쓰인 start·stop·t 와 접힌 핀 trig·echo 는 변수 목록에 남지 않는다
    expect((parse(src).json.variables as { name: string }[]).map((v) => v.name)).toEqual(["d"]);
  });
  it("함수 매개변수는 쓰이지 않아도 변수로 남는다", () => {
    const r = parse("def wait(t):\n    pass\n");
    expect((r.json.variables as { name: string }[]).map((v) => v.name)).toEqual(["t"]);
  });
  it("본문이 다른 get_distance 는 사용자 함수로 남는다", () => {
    const src = [
      "trig = Pin(13, Pin.OUT)", "echo = Pin(12, Pin.IN)",
      "def get_distance():", "    t = time.ticks_diff(stop, start)", "    t = t // 2", "    return int(340 * t // 10000)",
      'print(get_distance(), "cm")', "",
    ].join("\n");
    const b = body(src);
    expect(b.map((x) => x.type)).toEqual(["esp_pin_setup", "esp_pin_setup", "esp_print2"]);
    expect(b[2].inputs?.A?.block?.type).toBe("procedures_callreturn");
    const def = tops(src)[0];
    expect(def.type).toBe("procedures_defreturn");
    expect(def.fields).toEqual({ NAME: "get_distance" });
    expect(def.inputs?.RETURN?.block?.type).toBe("calc_int");
    const r = parse(src);
    expect(r.unparsed.map((u) => u.text)).toEqual(["time.ticks_diff(stop, start)"]);
  });
  it("OLED 준비와 표준 show 는 접히고 show 호출은 esp_oled_show", () => {
    const src = [
      "i2c = SoftI2C(scl=Pin(22), sda=Pin(21))", "oled = ssd1306.SSD1306_I2C(128, 64, i2c)",
      "def show(a, b):", "    oled.fill(0)", "    oled.text(a, 0, 20)", "    oled.text(b, 0, 36)", "    oled.show()",
      'show("AUTO DOOR", str(d) + " cm")', "",
    ].join("\n");
    const b = body(src);
    expect(b.map((x) => x.type)).toEqual(["esp_oled_setup", "esp_oled_show"]);
    const second = b[1].inputs?.B?.block;
    expect(second?.type).toBe("calc_concat");
    expect(second?.inputs?.A?.block?.type).toBe("calc_str");
  });
});

describe("문장", () => {
  it("while True / for range / 기다리기", () => {
    const b = body("while True:\n    led.value(1)\n    time.sleep(1)\n    for i in range(3):\n        time.sleep_ms(500)\n");
    expect(b[0].type).toBe("flow_repeat_forever");
    let cur = b[0].inputs?.DO?.block;
    const types: string[] = [];
    while (cur) { types.push(cur.type); cur = cur.next?.block; }
    expect(types).toEqual(["code_stmt", "flow_wait", "flow_repeat_n"]); // led 가 핀으로 선언되지 않았으므로 code_stmt
  });
  it("선언된 핀의 value(1)은 esp_pin_write", () => {
    const b = body("led = Pin(26, Pin.OUT)\nled.value(1)\nled.value(0)\n");
    expect(b.slice(1).map((x) => [x.type, x.fields?.VALUE])).toEqual([["esp_pin_write", "1"], ["esp_pin_write", "0"]]);
  });
  it("if / elif / else 와 비교·논리", () => {
    const b = body("d = 3\nif d < 15 and d > 0:\n    print(d)\nelif d == 0:\n    print(0)\nelse:\n    pass\n");
    const iff = b[1];
    expect(iff.type).toBe("controls_if");
    expect(iff.extraState).toEqual({ elseIfCount: 1, hasElse: true });
    const cond = iff.inputs?.IF0?.block;
    expect(cond?.type).toBe("logic_operation");
    expect(cond?.fields).toEqual({ OP: "AND" });
    expect(cond?.inputs?.A?.block?.fields).toEqual({ OP: "LT" });
    expect(iff.inputs?.IF1?.block?.fields).toEqual({ OP: "EQ" });
    expect(iff.inputs?.DO0?.block?.type).toBe("esp_print");
    expect(iff.inputs?.ELSE).toBeUndefined(); // pass 만 있는 몸통은 비어 있다
  });
  it("while not X: pass → 될 때까지 반복", () => {
    const b = body("echo = Pin(12, Pin.IN)\nwhile not echo.value():\n    pass\n");
    expect(b[1].type).toBe("controls_whileUntil");
    expect(b[1].fields).toEqual({ MODE: "UNTIL" });
    expect(b[1].inputs?.BOOL?.block?.type).toBe("esp_pin_read");
    expect(b[1].inputs?.DO).toBeUndefined();
  });
  it("함수 정의·매개변수·호출", () => {
    const src = "def blink(t):\n    time.sleep(t)\n\nblink(0.2)\n";
    const def = tops(src)[0];
    expect(def.type).toBe("procedures_defnoreturn");
    expect(def.extraState).toEqual({ params: [{ name: "t", id: "var_t" }] });
    expect(def.inputs?.STACK?.block?.inputs?.SEC?.block).toEqual({ type: "variables_get", fields: { VAR: { id: "var_t" } } });
    const call = body(src)[0];
    expect(call.type).toBe("procedures_callnoreturn");
    expect(call.extraState).toEqual({ name: "blink", params: ["t"] });
    expect(call.inputs?.ARG0?.block).toEqual({ type: "math_number", fields: { NUM: 0.2 } });
  });
  it("줄 끝 주석은 블록 코멘트로", () => {
    const b = body("led = Pin(26, Pin.OUT)\nled.value(1)   # 켜기\nwhile True:  # 계속\n    pass\n");
    expect(b[1].icons?.comment.text).toBe("켜기");
    expect(b[2].icons?.comment.text).toBe("계속");
  });
  it("모르는 문장은 code_stmt 로, 모르는 식은 code_expr 로", () => {
    const r = parse("x = time.ticks_us()\noled.fill(0)\n");
    const b = body("x = time.ticks_us()\noled.fill(0)\n");
    expect(b[0].type).toBe("variables_set");
    expect(b[0].inputs?.VALUE?.block).toEqual({ type: "code_expr", fields: { CODE: "time.ticks_us()" } });
    expect(b[1]).toEqual({ type: "code_stmt", fields: { CODE: "oled.fill(0)" } });
    expect(r.unparsed.map((u) => u.line)).toEqual([1, 2]);
  });
  it("문법 오류는 ok:false 와 줄 번호", () => {
    const r = codeToBlocks("led = Pin(26, Pin.OUT)\nif d < 15\n    print(d)\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.line).toBe(2);
  });
  it("문자열은 따옴표 종류와 상관없이 내용만 담는다", () => {
    const b = body("print('가까워요!')\nprint(\"a\\\"b\")\n");
    expect(b[0].inputs?.VALUE?.block).toEqual({ type: "text", fields: { TEXT: "가까워요!" } });
    expect(b[1].inputs?.VALUE?.block).toEqual({ type: "text", fields: { TEXT: 'a"b' } });
  });
});

describe("뜻이 바뀔 수 있는 구문은 코드 블록으로", () => {
  const lines = (code: string) => parse(code).unparsed.map((u) => u.line);

  it("(a) 기본값·*args 매개변수가 있는 def 는 통째로 code_stmt, 함수로 등록하지 않는다", () => {
    const src = "def f(a, b=1):\n    pass\n\nf(1)\n";
    const b = body(src);
    expect(b.map((x) => x.type)).toEqual(["code_stmt", "code_stmt"]);
    expect(String(b[0].fields?.CODE)).toMatch(/^def f\(a, b=1\):\n    pass/);
    expect(b[1].fields?.CODE).toBe("f(1)");
    expect(tops(src)).toHaveLength(0);
    expect(lines(src)).toEqual([1, 4]);
    const star = body("def g(*args):\n    pass\n");
    expect(star.map((x) => x.type)).toEqual(["code_stmt"]);
    expect(lines("def g(*args):\n    pass\n")).toEqual([1]);
  });

  it("(b) 이름 붙인 인자·* 인자가 있는 호출은 code_stmt / code_expr", () => {
    const stmt = "def g(a, b):\n    pass\n\ng(b=2)\nprint(*items)\nprint(1, end=\"\")\n";
    expect(body(stmt).map((x) => [x.type, x.fields])).toEqual([
      ["code_stmt", { CODE: "g(b=2)" }],
      ["code_stmt", { CODE: "print(*items)" }],
      ["code_stmt", { CODE: 'print(1, end="")' }],
    ]);
    expect(lines(stmt)).toEqual([4, 5, 6]);
    const expr = "def f(a, b):\n    return a\n\nx = f(b=1)\n";
    expect(body(expr)[0].inputs?.VALUE?.block).toEqual({ type: "code_expr", fields: { CODE: "f(b=1)" } });
    expect(lines(expr)).toEqual([4]);
  });

  it("(c) 반복 변수가 i 가 아닌 for 는 code_stmt", () => {
    const src = "for j in range(3):\n    pass\n";
    expect(body(src)).toEqual([{ type: "code_stmt", fields: { CODE: "for j in range(3):\n    pass" } }]);
    expect(lines(src)).toEqual([1]);
  });

  it("(d) 쓴 그대로 돌아오지 않는 숫자는 code_expr", () => {
    const src = "x = 1_000\ny = 0x1F\nz = 0.5\nw = -1.0\n";
    expect(body(src).map((b) => b.inputs?.VALUE?.block)).toEqual([
      { type: "code_expr", fields: { CODE: "1_000" } },
      { type: "code_expr", fields: { CODE: "0x1F" } },
      { type: "math_number", fields: { NUM: 0.5 } },
      { type: "code_expr", fields: { CODE: "-1.0" } },
    ]);
    expect(lines(src)).toEqual([1, 2, 4]);
  });

  it("(e) 접두사 문자열·세 따옴표 문자열은 code_expr", () => {
    const src = 'print(r"a\\d")\nprint("""hi""")\nprint(b"x")\n';
    expect(body(src).map((b) => b.inputs?.VALUE?.block)).toEqual([
      { type: "code_expr", fields: { CODE: 'r"a\\d"' } },
      { type: "code_expr", fields: { CODE: '"""hi"""' } },
      { type: "code_expr", fields: { CODE: 'b"x"' } },
    ]);
    expect(lines(src)).toEqual([1, 2, 3]);
  });

  it("값 없는 return 만 있는 함수는 돌려주지 않는 함수", () => {
    const src = "def f():\n    return\n\nf()\nx = f()\n";
    expect(tops(src)[0].type).toBe("procedures_defnoreturn");
    expect(body(src)[0].type).toBe("procedures_callnoreturn");
    // 값을 돌려주지 않으므로 식 자리의 호출은 procedures_callreturn 이 아니다
    expect(body(src)[1].inputs?.VALUE?.block).toEqual({ type: "code_expr", fields: { CODE: "f()" } });
  });
});

describe("최종 리뷰: 뜻이 바뀌거나 사라지던 구문", () => {
  const lines = (code: string) => parse(code).unparsed.map((u) => u.line);

  it("C1 블록이 다시 만들지 못하는 import 는 code_stmt 로 남긴다", () => {
    expect(body("from machine import Pin, UART\n")).toEqual([{ type: "code_stmt", fields: { CODE: "from machine import Pin, UART" } }]);
    expect(body("from machine import Pin as P\n")).toEqual([{ type: "code_stmt", fields: { CODE: "from machine import Pin as P" } }]);
    expect(body("import time as t\nimport network\n").map((b) => b.fields?.CODE)).toEqual(["import time as t", "import network"]);
    expect(lines("import time as t\nimport network\n")).toEqual([1, 2]);
    // 블록이 다시 만드는 꼴은 여전히 사라진다
    expect(body("from machine import Pin, PWM, SoftI2C\nimport time\nimport ssd1306\n")).toEqual([]);
  });

  it("C2 이어진 비교(5 < d < 15)는 식 전체를 code_expr 로", () => {
    const b = body("d = 3\nif 5 < d < 15:\n    pass\n");
    expect(b[1].inputs?.IF0?.block).toEqual({ type: "code_expr", fields: { CODE: "5 < d < 15" } });
    expect(lines("d = 3\nif 5 < d < 15:\n    pass\n")).toEqual([2]);
    // 괄호로 묶은 비교는 블록 그대로
    expect(body("d = 3\nx = (5 < d) < 15\n")[1].inputs?.VALUE?.block?.type).toBe("logic_compare");
  });

  it("I9a else 가 붙은 while·for 는 통째로 code_stmt", () => {
    expect(body("while x:\n    pass\nelse:\n    pass\n")).toEqual([{ type: "code_stmt", fields: { CODE: "while x:\n    pass\nelse:\n    pass" } }]);
    expect(body("for i in range(3):\n    pass\nelse:\n    pass\n")).toEqual([{ type: "code_stmt", fields: { CODE: "for i in range(3):\n    pass\nelse:\n    pass" } }]);
  });

  it("I9b 여러 값을 돌려주는 def 는 통째로 code_stmt, 함수로 등록하지 않는다", () => {
    const src = "def f(a, b):\n    return a, b\n\nx = f(1, 2)\n";
    const b = body(src);
    expect(b[0]).toMatchObject({ type: "code_stmt", fields: { CODE: "def f(a, b):\n    return a, b" } });
    expect(b[1].inputs?.VALUE?.block).toEqual({ type: "code_expr", fields: { CODE: "f(1, 2)" } });
    expect(tops(src)).toHaveLength(0);
  });

  it("I9c 풀지 못하는 이스케이프가 든 문자열은 code_expr", () => {
    const src = 'print("\\x41")\n';
    expect(body(src)[0].inputs?.VALUE?.block).toEqual({ type: "code_expr", fields: { CODE: '"\\x41"' } });
    expect(lines(src)).toEqual([1]);
  });

  it("I9e 같은 이름의 두 번째 def 는 code_stmt, 첫 번째만 함수", () => {
    const src = "def f():\n    pass\n\ndef f():\n    print(1)\n\nf()\n";
    expect(tops(src).map((t) => t.type)).toEqual(["procedures_defnoreturn"]);
    const b = body(src);
    expect(b[0]).toMatchObject({ type: "code_stmt", fields: { CODE: "def f():\n    print(1)" } });
    expect(b[1].type).toBe("procedures_callnoreturn");
    expect(lines(src)).toEqual([4]);
  });

  it("I9f 안쪽 def 는 함수로 등록하지 않고 호출도 코드로", () => {
    const src = "if True:\n    def g():\n        pass\ng()\n";
    const b = body(src);
    expect(b[0].inputs?.DO0?.block).toEqual({ type: "code_stmt", fields: { CODE: "def g():\n    pass" } });
    expect(b[1]).toEqual({ type: "code_stmt", fields: { CODE: "g()" } });
    expect(tops(src)).toHaveLength(0);
  });

  it("I9g 0~39 밖의 핀 번호는 준비 블록으로 바꾸지 않는다", () => {
    const pin = body("led = Pin(40, Pin.OUT)\nled.value(1)\n");
    expect(pin[0]).toMatchObject({ type: "variables_set", fields: { VAR: { id: "var_led" } }, inputs: { VALUE: { block: { type: "code_expr", fields: { CODE: "Pin(40, Pin.OUT)" } } } } });
    expect(pin[1].type).toBe("code_stmt");
    expect(body("servo = PWM(Pin(44))\nservo.freq(50)\nservo.duty_u16(1638)\n").map((b) => b.type)).not.toContain("esp_servo_setup");
    expect(body("p = PWM(Pin(44))\np.freq(1000)\n").map((b) => b.type)).not.toContain("esp_pwm_setup");
    const distance = [
      "trig = Pin(45, Pin.OUT)", "echo = Pin(12, Pin.IN)",
      "def get_distance():", "    trig.value(1)", "    time.sleep_us(10)", "    trig.value(0)",
      "    while not echo.value():", "        pass", "    start = time.ticks_us()",
      "    while echo.value():", "        pass", "    stop = time.ticks_us()",
      "    t = time.ticks_diff(stop, start) // 2", "    return int(340 * t // 10000)", "",
    ].join("\n");
    expect(body(distance).map((b) => b.type)).not.toContain("esp_ultrasonic_setup");
    const oled = [
      "i2c = SoftI2C(scl=Pin(50), sda=Pin(21))", "oled = ssd1306.SSD1306_I2C(128, 64, i2c)",
      "def show(a, b):", "    oled.fill(0)", "    oled.text(a, 0, 20)", "    oled.text(b, 0, 36)", "    oled.show()", "",
    ].join("\n");
    expect(body(oled).map((b) => b.type)).not.toContain("esp_oled_setup");
  });
});

describe("최종 리뷰 I5: 주석 줄", () => {
  const start = (code: string) => (parse(code).json.blocks.blocks as BlockJson[]).find((b) => b.type === "start_program")!;

  it("문장 바로 위 주석 줄은 그 블록 코멘트의 윗줄, 줄 끝 주석은 | 로 시작하는 마지막 줄", () => {
    const b = body("led = Pin(26, Pin.OUT)\n# 켜기 전에\n# 한 번 더\nled.value(1)  # 켜기\n");
    expect(b[1].icons?.comment.text).toBe("켜기 전에\n한 번 더\n|켜기");
  });
  it("윗줄 하나만 있으면 끝에 빈 | 줄을 붙여 줄 끝 주석과 구별한다", () => {
    expect(body("led = Pin(26, Pin.OUT)\n# 켜기\nled.value(1)\n")[1].icons?.comment.text).toBe("켜기\n|");
    expect(body("led = Pin(26, Pin.OUT)\n# 켜기\n# 정말\nled.value(1)\n")[1].icons?.comment.text).toBe("켜기\n정말");
  });
  it("몸통 안 들여쓴 주석 줄도 다음 문장에 붙는다", () => {
    const b = body("while True:\n    # 기다리기\n    time.sleep(1)\n");
    expect(b[0].inputs?.DO?.block?.icons?.comment.text).toBe("기다리기\n|");
  });
  it("몸통 끝 주석은 바깥의 다음 문장에, 파일 끝 주석은 버린다", () => {
    const b = body("while True:\n    time.sleep(1)\n    # 몸통 끝\nprint(1)\n# 파일 끝\n");
    expect(b[1].icons?.comment.text).toBe("몸통 끝\n|");
  });
  it("첫 문장이 import 면 그 위 주석은 시작 블록 코멘트(파일 머리말)", () => {
    expect(start("# 머리말 1\n# 머리말 2\n\nfrom machine import Pin\nled = Pin(26, Pin.OUT)\n").icons?.comment.text).toBe("머리말 1\n머리말 2");
  });
  it("지운 import 뒤의 주석 줄은 다음 문장으로 넘어간다", () => {
    expect(body("from machine import Pin\n# 핀\nimport time\nled = Pin(26, Pin.OUT)\n")[0].icons?.comment.text).toBe("핀\n|");
  });
  it("함수 정의 위 주석 줄은 함수 블록 코멘트", () => {
    expect(tops("# 깜빡이기\ndef blink(t):  # 한 번\n    pass\n")[0].icons?.comment.text).toBe("깜빡이기\n|한 번");
  });
});

describe("계획 2A 편집기 정리", () => {
  const commentLines = (code: string) => code.split("\n").filter((l) => l.trim().startsWith("#")).map((l) => l.trim());
  const roundTrip = (src: string) => workspaceJsonToCode(parse(src).json);

  it("함수 블록은 시작 블록 오른쪽에 나란히 놓인다", () => {
    const fns = tops("def a():\n    pass\n\ndef b():\n    pass\n");
    expect(fns.map((f) => [f.x, f.y])).toEqual([[560, 40], [1080, 40]]);
  });

  it("for i in range(n) 몸통의 i 는 변수 블록", () => {
    const r = parse("for i in range(3):\n    print(i)\n");
    const loop = body("for i in range(3):\n    print(i)\n")[0];
    expect(loop.type).toBe("flow_repeat_n");
    const print = loop.inputs?.DO?.block;
    expect(print?.type).toBe("esp_print");
    expect(print?.inputs?.VALUE?.block).toEqual({ type: "variables_get", fields: { VAR: { id: "var_i" } } });
    expect(r.unparsed).toHaveLength(0);
    expect(roundTrip("for i in range(3):\n    print(i)\n")).toBe("for i in range(3):\n    print(i)\n");
  });

  it("| 로 시작하는 윗줄 주석은 \\| 로 적어 줄 끝 주석 표시와 구별한다", () => {
    expect(body("# | a | b |\nprint(1)\n")[0].icons?.comment.text).toBe("\\| a | b |\n|");
    expect(body("# | a\n# b\nprint(1)  # c\n")[0].icons?.comment.text).toBe("\\| a\nb\n|c");
  });

  it("| 로 시작하는 주석 줄이 왕복에서 그대로 돌아온다", () => {
    for (const src of [
      "# | a | b |\nprint(1)\n",
      "# | a | b |\n# | 1 | 2 |\nprint(1)\n",
      "# | a\nprint(1)  # 끝\n",
      "print(1)  # | 줄 끝\n",
      "# \\| 이미 역슬래시\nprint(1)\n",
      "while True:\n    # | 몸통 |\n    print(1)\n",
      "# | 머리말 |\nfrom machine import Pin\nled = Pin(26, Pin.OUT)\n",
    ]) {
      expect(commentLines(roundTrip(src)), src).toEqual(commentLines(src));
    }
  });
});
