import { describe, expect, it } from "vitest";
import { isValidPythonName, PYTHON_KEYWORDS } from "./names";

describe("isValidPythonName", () => {
  it("영어 글자·숫자·_ 로, 숫자로 시작하지 않는 이름만", () => {
    expect(isValidPythonName("led2")).toBe(true);
    expect(isValidPythonName("_count")).toBe(true);
    expect(isValidPythonName("2led")).toBe(false);
    expect(isValidPythonName("엘이디")).toBe(false);
    expect(isValidPythonName("my led")).toBe(false);
    expect(isValidPythonName("")).toBe(false);
  });
  it("파이썬 키워드는 안 된다", () => {
    expect(isValidPythonName("while")).toBe(false);
    expect(isValidPythonName("True")).toBe(false);
    expect(PYTHON_KEYWORDS).toContain("lambda");
  });
});
