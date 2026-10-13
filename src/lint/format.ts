import type { ConsoleEntry, Issue } from "./types";

const FILE = "main.py";

/**
 * 콘솔 항목: 문법 오류는 MicroPython Traceback 꼴로 맨 위에, 검사 결과는 영어 문구 앞에 `File "main.py", line N` 줄을 붙인다.
 * 줄 번호를 원문 줄로 옮기는 일(코드 모드 정렬)은 부르는 쪽이 먼저 한다.
 */
export function formatConsole(issues: Issue[], parseError: { line: number; message: string } | null): ConsoleEntry[] {
  const out: ConsoleEntry[] = [];
  if (parseError)
    out.push({
      level: "error",
      text: `Traceback (most recent call last):\n  File "${FILE}", line ${parseError.line}\nSyntaxError: invalid syntax`,
      line: parseError.line,
    });
  for (const issue of issues) {
    const entry: ConsoleEntry = { level: issue.level, text: issue.line !== undefined ? `  File "${FILE}", line ${issue.line}\n${issue.en}` : issue.en };
    if (issue.line !== undefined) entry.line = issue.line;
    if (issue.blockId !== undefined) entry.blockId = issue.blockId;
    out.push(entry);
  }
  return out;
}
