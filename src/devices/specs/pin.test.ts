import { describe, expect, it } from "vitest";
import { Order } from "blockly/python";
import { arith, fromCode, num, print, toCode, v, type B } from "../testkit";
import { deviceToolboxCategories } from "../toBlocks";
import { ORDER } from "./common";

const adcRead = (name: string): B => ({ type: "dev_adc_read", fields: { VAR: v(name) } });

describe("ORDER 상수", () => {
  it("blockly/python 의 Order 와 같다", () => {
    expect(ORDER).toEqual({ ATOMIC: Order.ATOMIC, FUNCTION_CALL: Order.FUNCTION_CALL, MULTIPLICATIVE: Order.MULTIPLICATIVE, ADDITIVE: Order.ADDITIVE, RELATIONAL: Order.RELATIONAL });
  });
});

describe("입력 핀 (dev_pin_in_setup)", () => {
  it("풀업: 코드 → 버튼 준비 블록으로 돌아온다 (버튼 선언이 같은 줄을 먼저 잡는다)", () => {
    const code = toCode([{ type: "dev_pin_in_setup", fields: { PIN: 14, PULL: "PULL_UP", VAR: v("button") } }, print({ type: "esp_pin_read", fields: { VAR: v("button") } })], ["button"]);
    expect(code).toBe("from machine import Pin\n\nbutton = Pin(14, Pin.IN, Pin.PULL_UP)\n\nprint(button.value())\n");
    const r = fromCode(code);
    expect(r.types).toEqual(["dev_button_setup", "esp_print", "esp_pin_read"]);
    expect(r.body[0].fields).toEqual({ PIN: 14, VAR: v("button") });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("그대로: 코드 → 핀 준비 블록(입력)으로 돌아온다", () => {
    const code = toCode([{ type: "dev_pin_in_setup", fields: { PIN: 4, PULL: "NONE", VAR: v("sw") } }], ["sw"]);
    expect(code).toBe("from machine import Pin\n\nsw = Pin(4, Pin.IN)\n");
    const r = fromCode(code);
    expect(r.body).toEqual([{ type: "esp_pin_setup", fields: { VAR: v("sw"), PIN: 4, MODE: "IN" } }]);
    expect(r.unparsed).toEqual([]);
  });
});

describe("PWM 핀 주파수 (dev_pwm_freq)", () => {
  const freq = (name: string, hz: B): B => ({ type: "dev_pwm_freq", fields: { VAR: v(name) }, inputs: { FREQ: { block: hz } } });
  const blocks: B[] = [
    { type: "esp_pwm_setup", fields: { VAR: v("pwm"), PIN: 2, FREQ: 1000 } },
    freq("pwm", num(500)),
    { type: "dev_pwm_duty10", fields: { VAR: v("pwm") }, inputs: { DUTY: { block: num(512) } } },
  ];
  const code = "from machine import Pin, PWM\n\npwm = PWM(Pin(2))\npwm.freq(1000)\n\npwm.freq(500)\npwm.duty(512)\n";

  it("코드: pwm.freq(주파수)", () => {
    expect(toCode(blocks, ["pwm"])).toBe(code);
  });
  it("왕복: 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["esp_pwm_setup", "dev_pwm_freq", "math_number", "dev_pwm_duty10", "math_number"]);
    expect(r.body[0].fields).toEqual({ VAR: v("pwm"), PIN: 2, FREQ: 1000 });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("준비 2줄(x = PWM(Pin(2)), x.freq(1000))은 freq 블록이 아니라 준비 블록 하나로 접힌다", () => {
    const r = fromCode("from machine import Pin, PWM\n\nx = PWM(Pin(2))\nx.freq(1000)\n");
    expect(r.types).toEqual(["esp_pwm_setup"]);
    expect(r.body[0].fields).toEqual({ VAR: v("x"), PIN: 2, FREQ: 1000 });
  });
  it("서보·수동 부저 변수의 freq 도 이 블록, 출력 핀 변수의 freq 는 아니다", () => {
    const servo = fromCode("from machine import Pin, PWM\n\nservo = PWM(Pin(4))\nservo.freq(50)\nservo.duty_u16(1638)\n\nservo.freq(60)\n");
    expect(servo.types).toEqual(["esp_servo_setup", "dev_pwm_freq", "math_number"]);
    const beeper = fromCode("from machine import Pin, PWM\n\nbeeper = PWM(Pin(15))\nbeeper.freq(440)\nbeeper.duty(0)\n\nbeeper.freq(880)\n");
    expect(beeper.types).toEqual(["dev_beeper_setup", "dev_pwm_freq", "math_number"]);
    const pin = fromCode("from machine import Pin\n\nled = Pin(2, Pin.OUT)\n\nled.freq(5)\n");
    expect(pin.types).not.toContain("dev_pwm_freq");
  });
  it("툴박스: PWM 핀 밑에 준비·세기·주파수, 그리고 0~1023 세기 블록 (이름 pwm)", () => {
    const pin = deviceToolboxCategories().find((c) => c.name === "핀")!.contents;
    const at = pin.findIndex((i) => i.kind === "label" && i.text === "PWM 핀");
    expect(pin.slice(at, at + 5)).toEqual([
      { kind: "label", text: "PWM 핀" },
      { kind: "block", type: "esp_pwm_setup" },
      { kind: "block", type: "esp_pwm_duty", inputs: { DUTY: { shadow: { type: "math_number", fields: { NUM: 32768 } } } } },
      { kind: "block", type: "dev_pwm_freq", inputs: { FREQ: { shadow: { type: "math_number", fields: { NUM: 1000 } } } } },
      { kind: "block", type: "dev_pwm_duty10", fields: { VAR: { name: "pwm" } }, inputs: { DUTY: { shadow: { type: "math_number", fields: { NUM: 512 } } } } },
    ]);
  });
});

describe("아날로그 핀 (dev_adc_setup)", () => {
  const blocks: B[] = [
    { type: "dev_adc_setup", fields: { PIN: 36, VAR: v("adc") } },
    print(adcRead("adc")),
    print({ type: "dev_adc_voltage", fields: { VAR: v("adc") } }),
    print(arith({ type: "dev_adc_voltage", fields: { VAR: v("adc") } }, "ADD", num(1))),
  ];
  const code = [
    "from machine import Pin, ADC",
    "",
    "adc = ADC(Pin(36))",
    "adc.atten(ADC.ATTN_11DB)",
    "adc.width(ADC.WIDTH_12BIT)",
    "",
    "print(adc.read())",
    "print(adc.read() * 3.3 / 4095)",
    "print(adc.read() * 3.3 / 4095 + 1)",
    "",
  ].join("\n");

  it("준비 3줄, 값, 전압", () => {
    expect(toCode(blocks, ["adc"])).toBe(code);
  });
  it("왕복: 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["dev_adc_setup", "esp_print", "dev_adc_read", "esp_print", "dev_adc_voltage", "esp_print", "calc_arith", "dev_adc_voltage", "math_number"]);
    expect(r.body[0].fields).toEqual({ PIN: 36, VAR: v("adc") });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("이름이 다른 3줄은 접지 않는다", () => {
    const r = fromCode("from machine import Pin, ADC\n\nadc = ADC(Pin(36))\nadc.atten(ADC.ATTN_11DB)\nother.width(ADC.WIDTH_12BIT)\n");
    expect(r.types[0]).not.toBe("dev_adc_setup");
  });
});

describe("아날로그 센서 (조도·가변저항·소리·불꽃)", () => {
  for (const id of ["light", "knob", "sound", "flame"]) {
    it(`${id}: 아날로그 핀 3줄을 내고 이름이 ${id} 로 시작하면 자기 준비·값 블록으로 돌아온다`, () => {
      const code = toCode([{ type: `dev_${id}_setup`, fields: { PIN: 39, VAR: v(id) } }, print({ type: `dev_${id}_value`, fields: { VAR: v(id) } })], [id]);
      expect(code).toBe(`from machine import Pin, ADC\n\n${id} = ADC(Pin(39))\n${id}.atten(ADC.ATTN_11DB)\n${id}.width(ADC.WIDTH_12BIT)\n\nprint(${id}.read())\n`);
      const r = fromCode(code);
      expect(r.types).toEqual([`dev_${id}_setup`, "esp_print", `dev_${id}_value`]);
      expect(r.body[0].fields).toEqual({ PIN: 39, VAR: v(id) });
      expect(r.unparsed).toEqual([]);
      expect(r.code).toBe(code);
    });
  }

  it("이름이 센서 이름으로 시작하지 않으면 아날로그 핀 블록으로 돌아온다", () => {
    const r = fromCode("from machine import Pin, ADC\n\nsensor1 = ADC(Pin(39))\nsensor1.atten(ADC.ATTN_11DB)\nsensor1.width(ADC.WIDTH_12BIT)\n\nprint(sensor1.read())\n");
    expect(r.types).toEqual(["dev_adc_setup", "esp_print", "dev_adc_read"]);
    expect(r.unparsed).toEqual([]);
  });

  it("아날로그 핀의 값·전압 블록도 센서 변수를 받는다 (light.read() * 3.3 / 4095 는 전압 블록)", () => {
    const r = fromCode("from machine import Pin, ADC\n\nlight = ADC(Pin(39))\nlight.atten(ADC.ATTN_11DB)\nlight.width(ADC.WIDTH_12BIT)\n\nprint(light.read() * 3.3 / 4095)\n");
    expect(r.types).toEqual(["dev_light_setup", "esp_print", "dev_adc_voltage"]);
    expect(r.unparsed).toEqual([]);
  });

  it("툴박스: 센서 라벨 밑에 그 센서의 준비 블록과 값 블록 (센서 색)", () => {
    const sensor = deviceToolboxCategories().find((c) => c.name === "센서")!.contents;
    const at = sensor.findIndex((i) => i.kind === "label" && i.text === "조도 센서");
    expect(sensor.slice(at, at + 3)).toEqual([
      { kind: "label", text: "조도 센서" },
      { kind: "block", type: "dev_light_setup" },
      { kind: "block", type: "dev_light_value" },
    ]);
  });
});
