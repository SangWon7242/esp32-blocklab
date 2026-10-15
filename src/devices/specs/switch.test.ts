import { describe, expect, it } from "vitest";
import { fromCode, ifThen, num, print, toCode, v, type B } from "../testkit";
import { DEVICES } from "../registry";

const val = (type: string, name?: string): B => (name ? { type, fields: { VAR: v(name) } } : { type });

describe("버튼 (dev_button_setup)", () => {
  const code = "from machine import Pin\n\nbutton = Pin(14, Pin.IN, Pin.PULL_UP)\n\nif button.value() == 0:\n    print(1)\n";

  it("준비 + 눌렸는가를 if 조건에", () => {
    expect(toCode([{ type: "dev_button_setup", fields: { PIN: 14, VAR: v("button") } }, ifThen(val("dev_button_pressed", "button"), [print(num(1))])], ["button"])).toBe(code);
  });
  it("왕복: 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["dev_button_setup", "controls_if", "esp_print", "math_number", "dev_button_pressed"]);
    expect(r.body[1].inputs?.IF0?.block).toEqual(val("dev_button_pressed", "button"));
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("not 과 함께 써도 괄호 없이 맞는 코드이고 다시 같은 블록으로", () => {
    const c = toCode([{ type: "dev_button_setup", fields: { PIN: 14, VAR: v("button") } }, ifThen({ type: "logic_negate", inputs: { BOOL: { block: val("dev_button_pressed", "button") } } }, [print(num(1))])], ["button"]);
    expect(c).toContain("if not button.value() == 0:\n");
    const r = fromCode(c);
    expect(r.types).toContain("dev_button_pressed");
    expect(r.unparsed).toEqual([]);
  });
  it("준비되지 않은 이름의 == 0 은 비교 블록", () => {
    expect(fromCode("if b.value() == 0:\n    print(1)\n").body[0].inputs?.IF0?.block?.type).toBe("logic_compare");
  });
});

describe("틸트 스위치·인체감지 (이름 접두사로 자기 준비 블록에 접힌다)", () => {
  it("틸트: 준비 + 기울었는가 → dev_tilt_setup + dev_tilt_tilted (이름이 tilt 로 시작)", () => {
    const code = toCode([{ type: "dev_tilt_setup", fields: { PIN: 14, VAR: v("tilt") } }, ifThen(val("dev_tilt_tilted", "tilt"), [print(num(1))])], ["tilt"]);
    expect(code).toBe("from machine import Pin\n\ntilt = Pin(14, Pin.IN)\n\nif tilt.value() == 1:\n    print(1)\n");
    const r = fromCode(code);
    expect(r.types).toEqual(["dev_tilt_setup", "controls_if", "esp_print", "math_number", "dev_tilt_tilted"]);
    expect(r.body[0].fields).toEqual({ VAR: v("tilt"), PIN: 14 });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("PIR: 이름이 pir 로 시작하면 자기 블록(dev_pir_setup·dev_pir_detected)으로 돌아온다", () => {
    const code = toCode([{ type: "dev_pir_setup", fields: { PIN: 27, VAR: v("pir") } }, ifThen(val("dev_pir_detected", "pir"), [print(num(1))])], ["pir"]);
    expect(code).toBe("from machine import Pin\n\npir = Pin(27, Pin.IN)\n\nif pir.value() == 1:\n    print(1)\n");
    const r = fromCode(code);
    expect(r.types).toEqual(["dev_pir_setup", "controls_if", "esp_print", "math_number", "dev_pir_detected"]);
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("다른 이름(sensor)의 입력 핀은 핀 준비·핀 읽기 비교로 접힌다(틸트·PIR 블록이 아니다)", () => {
    const code = "from machine import Pin\n\nsensor = Pin(27, Pin.IN)\n\nif sensor.value() == 1:\n    print(1)\n";
    const r = fromCode(code);
    expect(r.types).toEqual(["esp_pin_setup", "controls_if", "esp_print", "math_number", "logic_compare", "esp_pin_read", "math_number"]);
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("틸트 선언이 PIR 보다 앞에 있다", () => {
    const ids = DEVICES.map((d) => d.id);
    expect(ids.indexOf("tilt")).toBeLessThan(ids.indexOf("pir"));
  });
});

describe("조이스틱 (dev_joystick_setup)", () => {
  const code = [
    "from machine import Pin, ADC",
    "",
    "rocker_x = ADC(Pin(36))",
    "rocker_y = ADC(Pin(39))",
    "rocker_x.atten(ADC.ATTN_11DB)",
    "rocker_y.atten(ADC.ATTN_11DB)",
    "button_z = Pin(26, Pin.IN, Pin.PULL_UP)",
    "",
    "print(rocker_x.read())",
    "print(rocker_y.read())",
    "if button_z.value() == 0:",
    "    print(1)",
    "",
  ].join("\n");

  it("준비 5줄, X·Y 값, 버튼", () => {
    const blocks = [{ type: "dev_joystick_setup", fields: { X: 36, Y: 39, Z: 26 } }, print(val("dev_joystick_x")), print(val("dev_joystick_y")), ifThen(val("dev_joystick_pressed"), [print(num(1))])];
    expect(toCode(blocks)).toBe(code);
  });
  it("왕복: 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["dev_joystick_setup", "esp_print", "dev_joystick_x", "esp_print", "dev_joystick_y", "controls_if", "esp_print", "math_number", "dev_joystick_pressed"]);
    expect(r.body[0].fields).toEqual({ X: 36, Y: 39, Z: 26 });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("조이스틱 준비가 없으면 rocker_x.read() 는 장치 블록이 아니다", () => {
    expect(fromCode("print(rocker_x.read())\n").types).not.toContain("dev_joystick_x");
  });
  it("조이스틱 선언이 아날로그 핀·버튼보다, 버튼이 입력 핀보다, 입력 핀이 핀보다 앞에 있다", () => {
    const ids = DEVICES.map((d) => d.id);
    const before = (a: string, b: string) => expect(ids.indexOf(a), `${a} < ${b}`).toBeLessThan(ids.indexOf(b));
    before("joystick", "adc"); before("joystick", "button"); before("button", "pin_in"); before("pin_in", "pin_out"); before("led_pwm", "pwm");
  });
});
