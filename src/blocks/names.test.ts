import { describe, expect, it } from "vitest";
import { isProgramName, isValidPythonName, PYTHON_KEYWORDS } from "./names";

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
