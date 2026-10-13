import { describe, expect, it } from "vitest";
import { arith, fromCode, num, toCode, v, type B } from "../testkit";
import { DEVICES } from "../registry";
import { deviceToolboxCategories } from "../toBlocks";

const angle = (a: B, name = "servo"): B => ({ type: "dev_servo_angle", fields: { VAR: v(name) }, inputs: { ANGLE: { block: a } } });

describe("서보 각도 (dev_servo_angle)", () => {
  const head = "from machine import Pin, PWM\n\nservo = PWM(Pin(4))\nservo.freq(50)\nservo.duty_u16(1638)\n\n";
  const code = head + "servo.duty_u16(1638 + 90 * 6462 // 180)\nservo.duty_u16(1638 + (45 + 45) * 6462 // 180)\nservo.duty_u16(8100)\n";
  const blocks: B[] = [
    { type: "esp_servo_setup", fields: { VAR: v("servo"), PIN: 4 } },
    angle(num(90)),
    angle(arith(num(45), "ADD", num(45))),
    { type: "esp_servo_door", fields: { VAR: v("servo"), ACTION: "8100" } },
  ];

  it("각도를 duty_u16 으로 (식은 괄호로 싸서 곱한다)", () => {
    expect(toCode(blocks, ["servo"])).toBe(code);
  });
  it("왕복: 각도 블록은 1줄 lines 패턴으로 자기 블록으로, 문 열기는 그대로", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["esp_servo_setup", "dev_servo_angle", "math_number", "dev_servo_angle", "calc_arith", "math_number", "math_number", "esp_servo_door"]);
    const { next: _next, ...first } = r.body[1];
    expect(first).toEqual(angle(num(90)));
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("곱셈 앞 그룹에 괄호 밖 덧셈이 걸리면 각도 블록으로 접지 않는다 (다시 묶여 뜻이 바뀌지 않게)", () => {
    const c = head + "offset = 10\na = 90\nservo.duty_u16(1638 + offset + a * 6462 // 180)\n";
    const r = fromCode(c);
    expect(r.types).not.toContain("dev_servo_angle");
    expect(r.types[5]).toBe("esp_pwm_duty"); // 식 그대로 계산 블록으로 (1638 + offset) + a * 6462 // 180
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(c);
  });
  it("괄호로 싼 덧셈은 피연산자 하나라 접는다 (ANGLE 은 (a + b))", () => {
    const c = head + "a = 40\nb = 50\nservo.duty_u16(1638 + (a + b) * 6462 // 180)\n";
    const r = fromCode(c);
    expect(r.types.slice(5)).toEqual(["dev_servo_angle", "calc_arith", "variables_get", "variables_get"]);
    expect(r.body[3].inputs?.ANGLE?.block?.fields).toEqual({ OP: "ADD" });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(c);
  });
  it("서보가 아닌 PWM 변수의 같은 꼴은 PWM 세기 블록", () => {
    const r = fromCode("from machine import Pin, PWM\n\npwm = PWM(Pin(2))\npwm.freq(1000)\n\npwm.duty_u16(1638 + 90 * 6462 // 180)\n");
    expect(r.types[1]).toBe("esp_pwm_duty");
    expect(r.unparsed).toEqual([]);
  });
});

describe("DC 모터 (dev_motor_setup)", () => {
  const code = [
    "from machine import Pin, PWM",
    "",
    "motor1a = PWM(Pin(13))",
    "motor1b = PWM(Pin(12))",
    "motor1a.freq(1000)",
    "motor1b.freq(1000)",
    "",
    "",
    "def forward(speed):",
    "    motor1a.duty(speed)",
    "    motor1b.duty(0)",
    "",
    "",
    "def backward(speed):",
    "    motor1a.duty(0)",
    "    motor1b.duty(speed)",
    "",
    "",
    "def stop():",
    "    motor1a.duty(0)",
    "    motor1b.duty(0)",
    "",
    "",
    "forward(1023)",
    "backward(512)",
    "stop()",
    "",
  ].join("\n");
  const blocks: B[] = [
    { type: "dev_motor_setup", fields: { A: 13, B: 12 } },
    { type: "dev_motor_forward", inputs: { SPEED: { block: num(1023) } } },
    { type: "dev_motor_backward", inputs: { SPEED: { block: num(512) } } },
    { type: "dev_motor_stop" },
  ];

  it("준비 4줄과 forward·backward·stop 도우미", () => {
    expect(toCode(blocks)).toBe(code);
  });
  it("왕복: 도우미 셋이 접혀 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.tops).toEqual(["start_program"]);
    expect(r.types).toEqual(["dev_motor_setup", "dev_motor_forward", "math_number", "dev_motor_backward", "math_number", "dev_motor_stop"]);
    expect(r.body[0].fields).toEqual({ A: 13, B: 12 });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("도우미 하나라도 표준 꼴이 아니면 접지 않는다", () => {
    const r = fromCode(code.replace("    motor1b.duty(speed)", "    motor1b.duty(speed // 2)"));
    expect(r.types).not.toContain("dev_motor_setup");
    expect(r.types).not.toContain("dev_motor_stop");
  });
  it("DC 모터 선언이 PWM 선언보다 앞에 있다", () => {
    const ids = DEVICES.map((d) => d.id);
    expect(ids.indexOf("dc_motor")).toBeLessThan(ids.indexOf("pwm"));
  });
});

describe("릴레이 (준비 줄은 esp_pin_setup 이 접는다)", () => {
  const code = "from machine import Pin\n\nrelay = Pin(16, Pin.OUT)\n\nrelay.value(1)\n";

  it("준비 + 켜기 (esp_pin_write)", () => {
    expect(toCode([{ type: "dev_relay_setup", fields: { PIN: 16, VAR: v("relay") } }, { type: "esp_pin_write", fields: { VAR: v("relay"), VALUE: "1" } }], ["relay"])).toBe(code);
  });
  it("왕복: esp_pin_setup + esp_pin_write, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["esp_pin_setup", "esp_pin_write"]);
    expect(r.body[0].fields).toEqual({ VAR: v("relay"), PIN: 16, MODE: "OUT" });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("툴박스: 라벨 밑에 준비 블록과 그 이름의 켜기 블록", () => {
    const items = deviceToolboxCategories().find((c) => c.name === "모터")!.contents;
    const at = items.findIndex((i) => i.kind === "label" && i.text === "릴레이");
    expect(items.slice(at)).toEqual([
      { kind: "label", text: "릴레이" },
      { kind: "block", type: "dev_relay_setup" },
      { kind: "block", type: "esp_pin_write", fields: { VAR: { name: "relay" } } },
    ]);
  });
});
