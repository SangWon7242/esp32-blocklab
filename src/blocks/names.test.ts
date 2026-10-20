import { describe, expect, it } from "vitest";
import { HELPER_NAMES, isProgramName, isValidPythonName, PYTHON_KEYWORDS } from "./names";
import { defaultValues, DEVICES, setupsOf } from "@/devices/registry";

describe("isValidPythonName", () => {
  it("영어 글자·숫자·_ 로, 숫자로 시작하지 않는 이름만", () => {
    expect(isValidPythonName("led2")).toBe(true);
    expect(isValidPythonName("_count")).toBe(true);
    expect(isValidPythonName("2led")).toBe(false);
    expect(isValidPythonName("엘이디")).toBe(false);
    expect(isValidPythonName("my led")).toBe(false);
    expect(isValidPythonName("")).toBe(false);
  });
  it("생성 코드가 쓰는 내장 이름·모듈·라이브러리 함수 이름은 안 된다", () => {
    expect(isValidPythonName("str")).toBe(false);
    expect(isValidPythonName("wifi_connect")).toBe(false);
    expect(isValidPythonName("card_present", "function")).toBe(false);
    expect(isValidPythonName("Pin")).toBe(false);
    expect(isValidPythonName("led")).toBe(true);
    expect(isProgramName("time")).toBe(true);
    expect(isProgramName("led")).toBe(false);
  });
  it("파이썬 키워드는 안 된다", () => {
    expect(isValidPythonName("while")).toBe(false);
    expect(isValidPythonName("True")).toBe(false);
    expect(PYTHON_KEYWORDS).toContain("lambda");
  });
});

describe("장치 준비가 고정해서 만드는 이름", () => {
  it("고정 변수 이름과 보드 라이브러리 함수 이름은 변수·함수 이름으로 안 된다", () => {
    const names: string[] = [];
    for (const d of DEVICES) {
      for (const s of setupsOf(d)) {
        const v = defaultValues(s.parts);
        const varValues = s.parts.filter((p) => p.kind === "var").map((p) => v[p.name]);
        names.push(...s.provides(v).filter((n) => !varValues.includes(n)), ...(s.libNames ?? []));
      }
    }
    expect(names).toEqual(expect.arrayContaining(["ntc", "rocker_x", "SEGCODE", "pins", "rc522", "trig", "web_send", "card_uid"]));
    for (const n of names) {
      expect(isValidPythonName(n), n).toBe(false);
      expect(isValidPythonName(n, "function"), n).toBe(false);
    }
  });
  it("장치 도우미 이름(get_distance·stop·show …)은 함수 이름으로는 되고 변수 이름으로는 안 된다", () => {
    expect(HELPER_NAMES).toEqual(expect.arrayContaining(["get_distance", "set_color", "forward", "backward", "stop", "show", "flow_leds", "hc595_shift", "show_digit", "ntc_temperature", "lm35_temperature"]));
    for (const n of HELPER_NAMES) {
      expect(isValidPythonName(n, "function"), n).toBe(true);
      expect(isValidPythonName(n), n).toBe(false);
      expect(isProgramName(n), n).toBe(false);
    }
  });
  it("import 하는 모듈·클래스 이름과 machine 이름도 안 된다", () => {
    for (const n of ["dht", "math", "ssd1306", "time", "mfrc522", "KeyPad", "irGetCMD", "lcd128_32", "lcd128_32_fonts", "machine", "Pin", "PWM", "SoftI2C", "ADC"]) {
      expect(isValidPythonName(n), n).toBe(false);
    }
  });
  it("VAR 칸의 기본 이름(led·button·servo …)은 학생이 쓸 수 있다", () => {
    for (const n of ["led", "button", "servo", "pwm", "beeper", "dht11", "adc"]) expect(isValidPythonName(n), n).toBe(true);
  });
});
