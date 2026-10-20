import { describe, expect, it } from "vitest";
import { arith, fromCode, num, toCode, v, type B } from "../testkit";
import { DEVICES } from "../registry";
import { workspaceJsonToCode, type WorkspaceJson } from "@/codegen";
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
  it("템플릿이 붙이는 괄호는 괄호 블록이 되지 않고, 학생이 더 적은 괄호는 괄호 블록으로 남는다", () => {
    const c = head + "a = 40\nservo.duty_u16(1638 + (a) * 6462 // 180)\nservo.duty_u16(1638 + ((a + 5)) * 6462 // 180)\n";
    const r = fromCode(c);
    // 템플릿 괄호 하나를 떼고 남은 괄호: (a) → 괄호 하나, ((a + 5)) → 괄호 둘 (다시 코드로 쓰면 같은 글자)
    expect(r.types.slice(3)).toEqual(["dev_servo_angle", "calc_paren", "variables_get", "dev_servo_angle", "calc_paren", "calc_paren", "calc_arith", "variables_get", "math_number"]);
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
  it("왕복: 같은 블록들 + 도우미 def 셋은 함수 블록, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.tops).toEqual(["procedures_defnoreturn", "procedures_defnoreturn", "procedures_defnoreturn", "start_program"]);
    expect(r.types).toEqual(["dev_motor_setup", "dev_motor_forward", "math_number", "dev_motor_backward", "math_number", "dev_motor_stop"]);
    expect(r.body[0].fields).toEqual({ A: 13, B: 12 });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("몸통을 바꾼 도우미를 부르는 곳만 학생 함수 호출이 된다 (다른 모터 블록·준비는 그대로)", () => {
    const changed = code.replace("    motor1b.duty(speed)", "    motor1b.duty(speed // 2)");
    const r = fromCode(changed);
    expect(r.types).toEqual(["dev_motor_setup", "dev_motor_forward", "math_number", "procedures_callnoreturn", "math_number", "dev_motor_stop"]);
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(changed);
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

describe("도우미와 같은 이름의 사용자 함수 블록이 있으면 그 함수가 도우미다", () => {
  /** 맨 위 블록들(함수 정의 → 시작 블록 순)로 된 작업판 */
  const workspace = (tops: B[], vars: string[] = []): WorkspaceJson =>
    ({ variables: vars.map((name) => ({ name, id: `var_${name}` })), blocks: { languageVersion: 0, blocks: tops.map((t, i) => ({ x: 0, y: 200 * i, ...t })) } }) as unknown as WorkspaceJson;
  const proc = (name: string, body: B[]): B => ({ type: "procedures_defnoreturn", fields: { NAME: name }, inputs: body.length ? { STACK: { block: chainOf(body) } } : {} });
  const call = (name: string): B => ({ type: "procedures_callnoreturn", extraState: { name } });
  const start = (body: B[]): B => ({ type: "start_program", inputs: { BODY: { block: chainOf(body) } } });
  function chainOf(blocks: B[]): B {
    const copies = blocks.map((b) => ({ ...b }));
    for (let i = 0; i < copies.length - 1; i++) copies[i].next = { block: copies[i + 1] };
    return copies[0];
  }

  it("사용자 함수 stop + 모터 정지: 도우미를 다시 만들지 않고 모터 정지 블록은 그 stop() 을 부른다 (함수 안에서 먼저 만들어져도)", () => {
    const code = workspaceJsonToCode(workspace([
      proc("halt", [{ type: "dev_motor_stop" }]),
      proc("stop", [{ type: "esp_print", inputs: { VALUE: { block: { type: "text", fields: { TEXT: "bye" } } } } }]),
      start([{ type: "dev_motor_setup", fields: { A: 13, B: 12 } }, { type: "dev_motor_stop" }, call("stop"), call("halt")]),
    ]));
    expect(code.match(/def stop\(/g)).toHaveLength(1);
    expect(code).toContain('\ndef stop():\n    print("bye")\n');
    expect(code).toContain("\ndef halt():\n    stop()\n");
    expect(code).toMatch(/\nstop\(\)\nstop\(\)\nhalt\(\)\n$/);
    expect(code).not.toContain("stop2");
    expect(code).not.toContain("\uE000");
  });
  it("사용자 함수 hc595_shift + 7세그먼트 지우기: 지우기 블록은 그 함수를 부르고, 쓰지 않은 show_digit 은 만들지 않는다", () => {
    const code = workspaceJsonToCode(workspace([
      proc("hc595_shift", []),
      start([{ type: "dev_seg_setup", fields: { SI: 5, RCK: 23, SCK: 18 } }, { type: "dev_seg_clear" }, call("hc595_shift")]),
    ]));
    expect(code.match(/def hc595_shift\(/g)).toHaveLength(1);
    expect(code).not.toContain("def show_digit");
    expect(code).toMatch(/\nhc595_shift\(0\)\nhc595_shift\(\)\n$/);
  });
  it("사용자 함수 hc595_shift + 7세그먼트 숫자: show_digit 도우미만 만들고 그 몸통은 사용자 hc595_shift 를 부른다", () => {
    const code = workspaceJsonToCode(workspace([
      proc("hc595_shift", []),
      start([{ type: "dev_seg_setup", fields: { SI: 5, RCK: 23, SCK: 18 } }, { type: "dev_seg_digit", inputs: { N: { block: { type: "math_number", fields: { NUM: 3 } } } }, fields: { DOT: "False" } }]),
    ]));
    expect(code).toContain("\ndef show_digit(n, dot):\n    code = SEGCODE[n]\n    if dot:\n        code = code | 128\n    hc595_shift(code)\n");
    expect(code.match(/def hc595_shift\(/g)).toHaveLength(1);
  });
  it("사용자 함수 show + OLED: 두 줄 보여주기는 그 show() 를 부르고 oled.show() 메서드 호출은 그대로", () => {
    const text = (t: string): B => ({ type: "text", fields: { TEXT: t } });
    const code = workspaceJsonToCode(workspace([
      proc("show", []),
      start([{ type: "esp_oled_setup", fields: { SCL: 22, SDA: 21 } }, { type: "esp_oled_show", inputs: { A: { block: text("a") }, B: { block: text("b") } } }, { type: "dev_oled_update" }]),
    ]));
    expect(code.match(/def show\(/g)).toHaveLength(1);
    expect(code).toMatch(/\nshow\("a", "b"\)\noled\.show\(\)\n$/);
  });
  it("꺼 둔 함수 블록은 도우미가 아니다 (생성기가 도우미를 겹치지 않는 이름으로 만들어 부른다)", () => {
    const off = { ...proc("stop", []), enabled: false };
    const code = workspaceJsonToCode(workspace([off, start([{ type: "dev_motor_setup", fields: { A: 13, B: 12 } }, { type: "dev_motor_stop" }])]));
    expect(code).toContain("\ndef stop2():\n    motor1a.duty(0)\n    motor1b.duty(0)\n");
    expect(code).toMatch(/\nstop2\(\)\n$/);
  });
  it("같은 이름의 변수가 있으면 도우미는 stop2 가 되고 모터 정지 블록도 stop2() 를 부른다", () => {
    const setStop: B = { type: "variables_set", fields: { VAR: { id: "var_stop" } }, inputs: { VALUE: { block: { type: "math_number", fields: { NUM: 1 } } } } };
    const code = workspaceJsonToCode(workspace([start([{ type: "dev_motor_setup", fields: { A: 13, B: 12 } }, setStop, { type: "dev_motor_stop" }])], ["stop"]));
    expect(code).toContain("\ndef stop2():\n    motor1a.duty(0)\n    motor1b.duty(0)\n");
    expect(code).toMatch(/\nstop = 1\nstop2\(\)\n$/);
  });
  it("사용자 함수 stop 과 (다른 함수의 지역) 변수 stop 이 함께 있어도 함수 이름을 바꾸지 않는다 (31장 안전 선풍기)", () => {
    const setStop: B = { type: "variables_set", fields: { VAR: { id: "var_stop" } }, inputs: { VALUE: { block: { type: "math_number", fields: { NUM: 1 } } } } };
    const pwm = (name: string): B => ({ type: "dev_pwm_duty10", fields: { VAR: { id: `var_${name}` } }, inputs: { DUTY: { block: { type: "math_number", fields: { NUM: 0 } } } } });
    const code = workspaceJsonToCode(workspace([
      proc("measure", [setStop]), proc("stop", [pwm("motor1a"), pwm("motor1b")]),
      start([{ type: "dev_motor_setup", fields: { A: 13, B: 12 } }, { type: "dev_motor_stop" }, call("measure")]),
    ], ["stop", "motor1a", "motor1b"]));
    expect(code).toContain("\n\ndef measure():\n    stop = 1\n\n\ndef stop():\n    motor1a.duty(0)\n    motor1b.duty(0)\n");
    expect(code).toMatch(/\nstop\(\)\nmeasure\(\)\n$/);
    expect(code).not.toContain("stop2");
  });
  it("겹치지 않으면 그대로 (stop)", () => {
    const code = workspaceJsonToCode(workspace([start([{ type: "dev_motor_setup", fields: { A: 13, B: 12 } }, { type: "dev_motor_stop" }])]));
    expect(code).toContain("\ndef stop():\n");
    expect(code).toMatch(/\nstop\(\)\n$/);
  });
});

describe("도우미 호출을 곱셈에 끼울 때 괄호를 덧붙이지 않는다 (생성기의 도우미 표시가 factor 를 속이지 않게)", () => {
  it("거리(get_distance()) → 서보 각도", () => {
    const code = toCode([
      { type: "esp_ultrasonic_setup", fields: { TRIG: 13, ECHO: 12 } },
      { type: "esp_servo_setup", fields: { VAR: v("servo"), PIN: 4 } },
      angle({ type: "esp_distance" }),
    ], ["servo"]);
    expect(code).toContain("\nservo.duty_u16(1638 + get_distance() * 6462 // 180)\n");
    const r = fromCode(code);
    expect(r.types).toContain("dev_servo_angle");
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("서미스터 온도(ntc_temperature()) → LED 밝기", () => {
    const code = toCode([
      { type: "dev_ntc_setup", fields: { PIN: 36 } },
      { type: "dev_led_pwm_setup", fields: { PIN: 26, VAR: v("led") } },
      { type: "dev_led_brightness", fields: { VAR: v("led") }, inputs: { PCT: { block: { type: "dev_ntc_temp" } } } },
    ], ["led"]);
    expect(code).toContain("\nled.duty(int(ntc_temperature() * 1023 / 100))\n");
    const r = fromCode(code);
    expect(r.types).toContain("dev_led_brightness");
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
});
