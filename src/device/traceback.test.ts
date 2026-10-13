import { describe, expect, it } from "vitest";
import { parseTraceback } from "./traceback";

describe("parseTraceback", () => {
  it("<stdin> 꼴: 줄 번호와 마지막 줄 메시지", () => {
    const tb = "Traceback (most recent call last):\r\n  File \"<stdin>\", line 3, in <module>\r\nNameError: name 'd' isn't defined\r\n";
    expect(parseTraceback(tb)).toEqual({ line: 3, message: "NameError: name 'd' isn't defined" });
  });
  it("main.py 꼴 (LF 줄바꿈)", () => {
    const tb = "Traceback (most recent call last):\n  File \"main.py\", line 12, in <module>\nValueError: x\n";
    expect(parseTraceback(tb)).toEqual({ line: 12, message: "ValueError: x" });
  });
  it("중첩 호출: 마지막 File 줄의 line", () => {
    const tb = [
      "Traceback (most recent call last):",
      "  File \"<stdin>\", line 10, in <module>",
      "  File \"<stdin>\", line 4, in show",
      "ZeroDivisionError: divide by zero",
    ].join("\r\n");
    expect(parseTraceback(tb)).toEqual({ line: 4, message: "ZeroDivisionError: divide by zero" });
  });
  it("라이브러리 안에서 난 오류는 학생 코드의 마지막 줄을 가리킨다", () => {
    const tb = [
      "Traceback (most recent call last):",
      "  File \"main.py\", line 7, in <module>",
      "  File \"ssd1306.py\", line 30, in __init__",
      "OSError: [Errno 19] ENODEV",
    ].join("\r\n");
    expect(parseTraceback(tb)).toEqual({ line: 7, message: "OSError: [Errno 19] ENODEV" });
  });
  it("문법 오류 (in 없음)", () => {
    const tb = "Traceback (most recent call last):\r\n  File \"<stdin>\", line 2\r\nSyntaxError: invalid syntax\r\n";
    expect(parseTraceback(tb)).toEqual({ line: 2, message: "SyntaxError: invalid syntax" });
  });
  it("File 줄이 없으면 line 은 null", () => {
    expect(parseTraceback("Traceback (most recent call last):\r\nMemoryError: \r\n")).toEqual({ line: null, message: "MemoryError:" });
  });
  it("앞뒤에 다른 출력이 섞여 있어도 Traceback 부분을 읽는다", () => {
    const text = "hello\r\nTraceback (most recent call last):\r\n  File \"<stdin>\", line 5, in <module>\r\nTypeError: unsupported types\r\n";
    expect(parseTraceback(text)).toEqual({ line: 5, message: "TypeError: unsupported types" });
  });
  it("Traceback 이 아니면 null", () => {
    expect(parseTraceback("")).toBeNull();
    expect(parseTraceback("1\r\n2\r\n")).toBeNull();
  });
});
