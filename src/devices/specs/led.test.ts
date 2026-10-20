import { describe, expect, it } from "vitest";
import { arith, forever, fromCode, num, toCode, v, type B } from "../testkit";
import { deviceToolboxCategories } from "../toBlocks";

const ledPwmSetup: B = { type: "dev_led_pwm_setup", fields: { PIN: 26, VAR: v("led") } };
const brightness = (pct: B): B => ({ type: "dev_led_brightness", fields: { VAR: v("led") }, inputs: { PCT: { block: pct } } });

describe("밝기 LED (dev_led_pwm_setup)", () => {
  const code = "from machine import Pin, PWM\n\nled = PWM(Pin(26))\nled.freq(1000)\n\nled.duty(int(50 * 1023 / 100))\nled.duty(512)\n";

  it("준비 2줄, 밝기(%), 세기(0~1023)", () => {
    const blocks = [ledPwmSetup, brightness(num(50)), { type: "dev_pwm_duty10", fields: { VAR: v("led") }, inputs: { DUTY: { block: num(512) } } }];
    expect(toCode(blocks, ["led"])).toBe(code);
  });
  it("왕복: 밝기 블록은 1줄 lines 패턴으로 자기 블록으로 돌아온다", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["dev_led_pwm_setup", "dev_led_brightness", "math_number", "dev_pwm_duty10", "math_number"]);
    const { next: _next, ...first } = r.body[1];
    expect(first).toEqual(brightness(num(50)));
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("곱셈 앞 그룹에 괄호 밖 덧셈·뺄셈이 걸리면 밝기 블록으로 접지 않는다", () => {
    const c = "from machine import Pin, PWM\n\nled = PWM(Pin(26))\nled.freq(1000)\n\nled.duty(int(base - a * 1023 / 100))\n";
    const r = fromCode(c);
    expect(r.types).not.toContain("dev_led_brightness");
    expect(r.code).toBe(c);
  });
  it("밝기 값이 식이면 괄호로 싸서 곱셈 앞에 둔다 (왕복해도 같은 식)", () => {
    const c = toCode([ledPwmSetup, brightness(arith(num(10), "ADD", num(20)))], ["led"]);
    expect(c).toContain("led.duty(int((10 + 20) * 1023 / 100))\n");
    const r = fromCode(c);
    expect(r.types).toEqual(["dev_led_pwm_setup", "dev_led_brightness", "calc_arith", "math_number", "math_number"]);
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(c);
  });
  it("PWM 핀(esp_pwm_setup, 주파수 1000)은 그대로 PWM 핀으로 돌아오고, 0~1023 세기 블록도 쓸 수 있다", () => {
    const c = toCode([
      { type: "esp_pwm_setup", fields: { VAR: v("pwm"), PIN: 2, FREQ: 1000 } },
      { type: "dev_pwm_duty10", fields: { VAR: v("pwm") }, inputs: { DUTY: { block: num(100) } } },
    ], ["pwm"]);
    expect(c).toBe("from machine import Pin, PWM\n\npwm = PWM(Pin(2))\npwm.freq(1000)\n\npwm.duty(100)\n");
    const r = fromCode(c);
    expect(r.types).toEqual(["esp_pwm_setup", "dev_pwm_duty10", "math_number"]);
    expect(r.unparsed).toEqual([]);
  });
  it("주파수가 1000 이 아니면 PWM 핀으로 접힌다", () => {
    expect(fromCode("led = PWM(Pin(26))\nled.freq(500)\n").types).toEqual(["esp_pwm_setup"]);
  });
});

describe("LED (dev_led_blink)", () => {
  const blink: B = { type: "dev_led_blink", fields: { VAR: v("led") }, inputs: { SEC: { block: num(0.5) }, TIMES: { block: num(3) } } };
  const pinSetup: B = { type: "esp_pin_setup", fields: { PIN: 26, MODE: "OUT", VAR: v("led") } };

  it("여러 줄 코드, 몸통 안에서는 줄마다 들여쓴다", () => {
    expect(toCode([pinSetup, blink], ["led"])).toBe(
      "from machine import Pin\nimport time\n\nled = Pin(26, Pin.OUT)\n\nfor i in range(3):\n    led.value(1)\n    time.sleep(0.5)\n    led.value(0)\n    time.sleep(0.5)\n",
    );
    expect(toCode([pinSetup, forever([blink])], ["led"])).toBe(
      "from machine import Pin\nimport time\n\nled = Pin(26, Pin.OUT)\n\nwhile True:\n    for i in range(3):\n        led.value(1)\n        time.sleep(0.5)\n        led.value(0)\n        time.sleep(0.5)\n",
    );
  });
  it("왕복: 반복 블록으로 돌아오고 unparsed 0 (패턴 none)", () => {
    const code = toCode([pinSetup, blink], ["led"]);
    const r = fromCode(code);
    expect(r.types).toEqual(["esp_pin_setup", "flow_repeat_n", "esp_pin_write", "flow_wait", "math_number", "esp_pin_write", "flow_wait", "math_number", "math_number"]);
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("툴박스: 핀 준비 블록이 LED 카테고리에도 나온다 (pinOut.alsoIn)", () => {
    const cats = deviceToolboxCategories();
    const types = (name: string) => cats.find((c) => c.name === name)!.contents.flatMap((i) => (i.kind === "block" ? [i.type] : []));
    expect(types("LED").slice(0, 5)).toEqual(["esp_pin_setup", "esp_pin_setup_var", "esp_pin_write", "dev_pin_write_value", "esp_pin_read"]);
    expect(types("LED")).toEqual(expect.arrayContaining(["dev_led_pwm_setup", "dev_led_brightness", "dev_pwm_duty10", "dev_led_blink", "dev_rgb_setup", "dev_flow_setup"]));
    expect(types("핀")).toContain("esp_pin_setup");
  });
});

describe("RGB LED (dev_rgb_setup)", () => {
  const head = [
    "from machine import Pin, PWM",
    "",
    "red = PWM(Pin(27))",
    "green = PWM(Pin(25))",
    "blue = PWM(Pin(26))",
    "red.freq(1000)",
    "green.freq(1000)",
    "blue.freq(1000)",
    "",
    "",
    "def set_color(r, g, b):",
    "    red.duty(r * 1023 // 255)",
    "    green.duty(g * 1023 // 255)",
    "    blue.duty(b * 1023 // 255)",
    "",
    "",
    "",
  ].join("\n");
  const blocks: B[] = [
    { type: "dev_rgb_setup", fields: { R: 27, G: 25, B: 26 } },
    { type: "dev_rgb_colour", fields: { COLOUR: "#ff69b4" } },
    { type: "dev_rgb_set", inputs: { R: { block: arith(num(100), "ADD", num(5)) }, G: { block: num(0) }, B: { block: num(255) } } },
    { type: "dev_rgb_off" },
  ];
  const code = head + "set_color(255, 105, 180)\nset_color(100 + 5, 0, 255)\nset_color(0, 0, 0)\n";

  it("준비 6줄과 set_color 도우미, 색 블록은 10진 세 값으로", () => {
    expect(toCode(blocks)).toBe(code);
  });
  it("왕복: 리터럴 셋은 색 블록(\"#ff69b4\"), 식이 있으면 세 값 블록, 끄기는 검은색", () => {
    const r = fromCode(code);
    expect(r.tops).toEqual(["procedures_defnoreturn", "start_program"]); // set_color def 는 함수 블록 (생성기는 다시 만들지 않는다)
    expect(r.types).toEqual(["dev_rgb_setup", "dev_rgb_colour", "dev_rgb_set", "math_number", "math_number", "calc_arith", "math_number", "math_number", "dev_rgb_colour"]);
    expect(r.body[1].fields).toEqual({ COLOUR: "#ff69b4" });
    expect(r.body[3].fields).toEqual({ COLOUR: "#000000" });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("set_color 도우미가 표준 꼴이 아니면 색 블록이 아니라 학생 함수 호출 (준비는 그대로 접힌다)", () => {
    const changed = code.replace("b * 1023 // 255", "b * 4");
    const r = fromCode(changed);
    expect(r.types[0]).toBe("dev_rgb_setup");
    expect(r.types).not.toContain("dev_rgb_colour");
    expect(r.types).toContain("procedures_callnoreturn");
    expect(r.code).toBe(changed);
  });
});

describe("흐르는 LED (dev_flow_setup)", () => {
  const code = [
    "from machine import Pin",
    "import time",
    "",
    "pins = [18, 5, 14, 17, 26]",
    "",
    "",
    "def flow_leds(ms):",
    "    for pin in pins:",
    "        led = Pin(pin, Pin.OUT)",
    "        led.value(1)",
    "        time.sleep_ms(ms)",
    "        led.value(0)",
    "",
    "",
    "flow_leds(100)",
    "",
  ].join("\n");

  it("준비 줄과 flow_leds 도우미, 차례로 켜기", () => {
    expect(toCode([{ type: "dev_flow_setup", fields: { PINS: "18, 5, 14, 17, 26" } }, { type: "dev_flow_run", inputs: { MS: { block: num(100) } } }])).toBe(code);
  });
  it("왕복: 같은 블록들, 핀 목록은 \"a, b, c\" 꼴로 다시 적는다", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["dev_flow_setup", "dev_flow_run", "math_number"]);
    expect(r.body[0].fields).toEqual({ PINS: "18, 5, 14, 17, 26" });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
    expect(fromCode(code.replace("[18, 5, 14, 17, 26]", "[18,5,  14]")).body[0].fields).toEqual({ PINS: "18, 5, 14" });
  });
});
