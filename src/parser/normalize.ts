/** 문자열 밖의 # 부터 끝까지 지운다 */
export function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "#") return line.slice(0, i);
  }
  return line;
}

/** 주석·빈 줄·끝 공백을 뗀 줄 배열. 왕복 비교와 미션 판정이 쓴다. */
export function normalizeCode(code: string): string[] {
  return code
    .replace(/\t/g, "    ")
    .split("\n")
    .map((line) => stripComment(line).replace(/\s+$/, ""))
    .filter((line) => line.trim().length > 0);
}
