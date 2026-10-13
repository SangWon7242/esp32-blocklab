/** MicroPython Traceback 읽기 */

const HEADER = "Traceback (most recent call last):";
const FILE_LINE = /^\s*File "([^"]*)", line (\d+)/;
/** 학생 코드가 실행되는 자리: raw REPL 실행(<stdin>) 또는 보드에 저장한 main.py */
const USER_FILES = new Set(["<stdin>", "main.py"]);

/**
 * Traceback 텍스트 → { line, message }.
 * line: 학생 코드(<stdin>/main.py) 의 마지막 File 줄 번호 (중첩 호출이면 가장 안쪽, 라이브러리 안에서 났으면 그 라이브러리를 부른 줄).
 *       학생 코드 줄이 없으면 마지막 File 줄, File 줄이 아예 없으면 null.
 * message: 마지막 줄 (예: "NameError: name 'd' isn't defined").
 * Traceback 이 아니면 null.
 */
export function parseTraceback(text: string): { line: number | null; message: string } | null {
  const start = text.lastIndexOf(HEADER);
  const lines = (start >= 0 ? text.slice(start) : text).split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
  const files = lines.map((l) => FILE_LINE.exec(l)).filter((m): m is RegExpExecArray => m !== null);
  if (start < 0 && files.length === 0) return null;
  const userFrames = files.filter((m) => USER_FILES.has(m[1]));
  const frame = userFrames.at(-1) ?? files.at(-1);
  const rest = lines.filter((l) => l !== HEADER && !FILE_LINE.test(l) && !/^\s/.test(l));
  const message = (rest.at(-1) ?? lines.at(-1) ?? "").trim();
  return { line: frame ? Number(frame[2]) : null, message };
}
