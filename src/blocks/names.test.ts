import { describe, expect, it } from "vitest";
import { isProgramName, isValidPythonName, PYTHON_KEYWORDS } from "./names";
import { defaultValues, DEVICES } from "@/devices/registry";

describe("isValidPythonName", () => {
  it("영어 글자·숫자·_ 로, 숫자로 시작하지 않는 이름만", () => {
    expect(isValidPythonName("led2")).toBe(true);
    expect(isValidPythonName("_count")).toBe(true);
    expect(isValidPythonName("2led")).toBe(false);
    expect(isValidPythonName("엘이디")).toBe(false);
    expect(isValidPythonName("my led")).toBe(false);
    expect(isValidPythonName("")).toBe(false);
  });
  it("생성 코드가 쓰는 내장 이름·모듈·도우미 이름은 안 된다", () => {
    expect(isValidPythonName("str")).toBe(false);
    expect(isValidPythonName("get_distance")).toBe(false);
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
  it("모든 도우미 이름과 고정 변수 이름은 변수·함수 이름으로 안 된다", () => {
    const names: string[] = [];
    for (const d of DEVICES) {
      const s = d.setup;
      if (!s) continue;
      names.push(...(s.helpers ?? []).map((h) => h.name));
      const v = defaultValues(s.parts);
      const varValues = s.parts.filter((p) => p.kind === "var").map((p) => v[p.name]);
      names.push(...s.provides(v).filter((n) => !varValues.includes(n)));
    }
    expect(names).toEqual(expect.arrayContaining(["stop", "show_digit", "set_color", "ntc", "rocker_x", "SEGCODE", "pins", "rc522"]));
    for (const n of names) expect(isValidPythonName(n), n).toBe(false);
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
