import { describe, expect, it } from "vitest";
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
