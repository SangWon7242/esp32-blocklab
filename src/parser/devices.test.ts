import { describe, expect, it } from "vitest";
import { codeToBlocks } from "./index";
import { workspaceJsonToCode } from "@/codegen";
import { normalizeCode } from "./normalize";
import type { BlockJson } from "./types";

const body = (code: string): BlockJson[] => {
  const r = codeToBlocks(code);
  if (!r.ok) throw new Error(r.error.message);
  const start = (r.json.blocks.blocks as BlockJson[]).find((b) => b.type === "start_program");
  const out: BlockJson[] = []; let cur = start?.inputs?.BODY?.block;
  while (cur) { out.push(cur); cur = cur.next?.block; }
  return out;
};
const roundtrip = (src: string) => { const r = codeToBlocks(src); if (!r.ok) throw new Error(); return { out: workspaceJsonToCode(r.json), unparsed: r.unparsed }; };

describe("레지스트리 접기", () => {
  it("서보 3줄은 서보, PWM 2줄은 PWM, 핀 1줄은 핀으로 접힌다 (우선순위)", () => {
    const b = body("servo = PWM(Pin(4))\nservo.freq(50)\nservo.duty_u16(1638)\npwm = PWM(Pin(2))\npwm.freq(1000)\nled = Pin(26, Pin.OUT)\n");
    expect(b.map((x) => x.type)).toEqual(["esp_servo_setup", "esp_pwm_setup", "esp_pin_setup"]);
  });
  it("메서드 패턴은 장치 종류를 본다: servo.duty_u16(8100) 은 문, pwm.duty_u16(8100) 은 세기", () => {
    const b = body("servo = PWM(Pin(4))\nservo.freq(50)\nservo.duty_u16(1638)\npwm = PWM(Pin(2))\npwm.freq(1000)\nservo.duty_u16(8100)\npwm.duty_u16(8100)\n");
    expect(b.slice(2).map((x) => x.type)).toEqual(["esp_servo_door", "esp_pwm_duty"]);
  });
  it("도우미가 있는 준비는 표준 def 가 있을 때만 접힌다", () => {
    const withHelper = "trig = Pin(13, Pin.OUT)\necho = Pin(12, Pin.IN)\n\ndef get_distance():\n    trig.value(1)\n    time.sleep_us(10)\n    trig.value(0)\n    while not echo.value():\n        pass\n    start = time.ticks_us()\n    while echo.value():\n        pass\n    stop = time.ticks_us()\n    t = time.ticks_diff(stop, start) // 2\n    return int(340 * t // 10000)\n\nprint(get_distance())\n";
    expect(body(withHelper).map((x) => x.type)).toEqual(["esp_ultrasonic_setup", "esp_print"]);
    expect(body("trig = Pin(13, Pin.OUT)\necho = Pin(12, Pin.IN)\n").map((x) => x.type)).toEqual(["esp_pin_setup", "esp_pin_setup"]);
  });
  it("접힌 장치의 준비 줄 주석은 준비 블록 코멘트로 남는다", () => {
    const { out } = roundtrip("servo = PWM(Pin(4))  # 문\nservo.freq(50)\nservo.duty_u16(1638)\n");
    expect(out).toContain("servo = PWM(Pin(4))  # 문");
  });
  it("알려진 import 는 사라지고 다시 생긴다", () => {
    const { out, unparsed } = roundtrip("from machine import Pin\nimport time\nled = Pin(26, Pin.OUT)\ntime.sleep(1)\n");
    expect(normalizeCode(out)).toEqual(["from machine import Pin", "import time", "led = Pin(26, Pin.OUT)", "time.sleep(1)"]);
    expect(unparsed).toEqual([]);
  });
});
