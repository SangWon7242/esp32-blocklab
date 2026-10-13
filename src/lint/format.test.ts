import { describe, expect, it } from "vitest";
import { formatConsole } from "./format";
import type { Issue } from "./types";

describe("formatConsole", () => {
  it("문법 오류는 MicroPython Traceback 꼴로 맨 위에", () => {
    const issue: Issue = { id: "orphan", level: "warning", blockId: "o", line: 9, ko: "…", en: "Warning: orphan block ignored" };
    const out = formatConsole([issue], { line: 12, message: "괄호가 닫히지 않았어요" });
    expect(out[0]).toEqual({
      level: "error",
      line: 12,
      text: 'Traceback (most recent call last):\n  File "main.py", line 12\nSyntaxError: invalid syntax',
    });
    expect(out[1]).toEqual({ level: "warning", line: 9, blockId: "o", text: '  File "main.py", line 9\nWarning: orphan block ignored' });
  });

  it("줄을 모르는 문제는 영어 문구만, 문제가 없으면 빈 목록", () => {
    const issue: Issue = { id: "no-start", level: "error", ko: "…", en: 'Error: no "프로그램이 시작되면" block' };
    expect(formatConsole([issue], null)).toEqual([{ level: "error", text: 'Error: no "프로그램이 시작되면" block' }]);
    expect(formatConsole([], null)).toEqual([]);
  });

  it("문제 순서를 그대로 둔다", () => {
    const a: Issue = { id: "a", level: "error", line: 3, ko: "", en: "A" };
    const b: Issue = { id: "b", level: "info", line: 1, ko: "", en: "B" };
    expect(formatConsole([a, b], null).map((e) => e.level)).toEqual(["error", "info"]);
  });
});
