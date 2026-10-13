import { describe, expect, it } from "vitest";
import { arith, forever, fromCode, num, toCode, v, type B } from "../testkit";
import { DEVICES } from "../registry";
import { deviceToolboxCategories } from "../toBlocks";

const beeperSetup: B = { type: "dev_beeper_setup", fields: { PIN: 15, VAR: v("beeper") } };
const tone = (hz: B, sec: B): B => ({ type: "dev_beeper_tone", fields: { VAR: v("beeper") }, inputs: { HZ: { block: hz }, SEC: { block: sec } } });
const note = (n: string, beat: B): B => ({ type: "dev_beeper_note", fields: { VAR: v("beeper"), NOTE: n }, inputs: { BEAT: { block: beat } } });
const stop: B = { type: "dev_beeper_stop", fields: { VAR: v("beeper") } };

describe("능동 부저 (준비 줄은 esp_pin_setup 이 접는다)", () => {
  const code = "from machine import Pin\n\nbuzzer = Pin(15, Pin.OUT)\n\nbuzzer.value(1)\nbuzzer.value(0)\n";
  const write = (value: string): B => ({ type: "esp_pin_write", fields: { VAR: v("buzzer"), VALUE: value } });

  it("준비 + 켜기·끄기 (esp_pin_write)", () => {
    expect(toCode([{ type: "dev_buzzer_setup", fields: { PIN: 15, VAR: v("buzzer") } }, write("1"), write("0")], ["buzzer"])).toBe(code);
  });
  it("왕복: esp_pin_setup + esp_pin_write, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["esp_pin_setup", "esp_pin_write", "esp_pin_write"]);
    expect(r.body[0].fields).toEqual({ VAR: v("buzzer"), PIN: 15, MODE: "OUT" });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("툴박스: 라벨 밑에 준비 블록과 그 이름의 켜기 블록", () => {
    const items = deviceToolboxCategories().find((c) => c.name === "소리")!.contents;
    expect(items.slice(0, 3)).toEqual([
      { kind: "label", text: "능동 부저" },
      { kind: "block", type: "dev_buzzer_setup" },
      { kind: "block", type: "esp_pin_write", fields: { VAR: { name: "buzzer" } } },
    ]);
  });
});

describe("수동 부저 (dev_beeper_setup)", () => {
  const head = "from machine import Pin, PWM\nimport time\n\nbeeper = PWM(Pin(15))\nbeeper.freq(440)\nbeeper.duty(0)\n\n";
  const code = head + [
    "beeper.freq(440)", "beeper.duty(512)", "time.sleep(0.5)", "beeper.duty(0)",
    "beeper.freq(262)", "beeper.duty(512)", "time.sleep(1 * 0.5)", "beeper.duty(0)",
    "beeper.duty(0)",
    "",
  ].join("\n");

  it("준비 3줄, 음(Hz), 계이름(박), 멈추기", () => {
    expect(toCode([beeperSetup, tone(num(440), num(0.5)), note("262", num(1)), stop], ["beeper"])).toBe(code);
  });
  it("왕복: Hz 음은 자기 블록으로, 계이름 음은 Hz 음 블록(박 * 0.5)으로, 멈추기는 그대로", () => {
    const r = fromCode(code);
    expect(r.types).toEqual([
      "dev_beeper_setup",
      "dev_beeper_tone", "math_number", "math_number",
      "dev_beeper_tone", "math_number", "calc_arith", "math_number", "math_number",
      "dev_beeper_stop",
    ]);
    const { next: _next, ...first } = r.body[1];
    expect(first).toEqual(tone(num(440), num(0.5)));
    expect(r.body[2].inputs?.SEC?.block).toEqual(arith(num(1), "MULTIPLY", num(0.5)));
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("박이 식이면 괄호로 싸서 곱한다", () => {
    expect(toCode([beeperSetup, note("392", arith(num(1), "ADD", num(1)))], ["beeper"])).toContain("time.sleep((1 + 1) * 0.5)\n");
  });
  it("반복 안에서도 4줄이 들여써지고 음 블록으로 돌아온다", () => {
    const c = toCode([beeperSetup, forever([tone(arith(num(440), "MULTIPLY", num(2)), num(0.25))])], ["beeper"]);
    expect(c).toBe(head + "while True:\n    beeper.freq(440 * 2)\n    beeper.duty(512)\n    time.sleep(0.25)\n    beeper.duty(0)\n");
    const r = fromCode(c);
    expect(r.types).toEqual(["dev_beeper_setup", "flow_repeat_forever", "dev_beeper_tone", "calc_arith", "math_number", "math_number", "math_number"]);
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(c);
  });
  it("freq 440·duty 0 이 아닌 PWM 은 PWM 핀으로 접힌다", () => {
    expect(fromCode("from machine import Pin, PWM\n\nb = PWM(Pin(15))\nb.freq(440)\n\nb.duty(100)\n").types).toEqual(["esp_pwm_setup", "dev_pwm_duty10", "math_number"]);
    expect(fromCode("from machine import Pin, PWM\n\nb = PWM(Pin(15))\nb.freq(500)\nb.duty(0)\n").types[0]).toBe("esp_pwm_setup");
  });
  it("PWM 핀(440 Hz) 바로 뒤의 첫 문장이 세기 0 이면 같은 3줄이라 수동 부저로 접힌다 (빈 줄 말고는 같은 코드)", () => {
    const c = toCode([{ type: "esp_pwm_setup", fields: { VAR: v("b"), PIN: 15, FREQ: 440 } }, { type: "dev_pwm_duty10", fields: { VAR: v("b") }, inputs: { DUTY: { block: num(0) } } }], ["b"]);
    const r = fromCode(c);
    expect(r.types).toEqual(["dev_beeper_setup"]);
    const lines = (x: string) => x.split("\n").filter(Boolean);
    expect(lines(r.code)).toEqual(lines(c)); // 빈 줄 자리만 다르다 (duty(0) 이 준비 줄로 올라간다)
  });
  it("다른 부저 이름이 섞인 4줄은 음 블록이 아니다", () => {
    const r = fromCode(head + "beeper.freq(440)\nbeeper.duty(512)\ntime.sleep(0.5)\nother.duty(0)\n");
    expect(r.types).not.toContain("dev_beeper_tone");
  });
  it("수동 부저 선언이 PWM 선언보다 앞에 있다", () => {
    const ids = DEVICES.map((d) => d.id);
    expect(ids.indexOf("buzzer_passive")).toBeLessThan(ids.indexOf("pwm"));
  });
});
