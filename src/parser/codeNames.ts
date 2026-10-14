/**
 * 코드 블록(code_stmt) 원문에서 값을 정하는 이름을 찾는다. 정의되지 않은 이름 검사가 쓴다.
 * 문자열·주석을 먼저 지우고, 괄호 밖(깊이 0)에서 시작하는 줄만 본다 (여러 줄 호출의 `addr=0x3c` 같은 이름 붙인 인자를
 * 정의로 잘못 세지 않게). 틀리게 정의로 세는 것보다 놓치는 쪽을 고른다.
 */

const NAME = String.raw`[A-Za-z_]\w*`;
const NAMES = String.raw`${NAME}(?:\s*,\s*${NAME})*`;

/** 문자열(세 따옴표·접두사 포함)은 빈 "" 로, # 주석은 줄 끝까지 지운다 */
function stripStringsAndComments(code: string): string {
  let out = "";
  for (let i = 0; i < code.length; ) {
    const c = code[i];
    if (c === "#") {
      while (i < code.length && code[i] !== "\n") i++;
    } else if (c === '"' || c === "'") {
      const quote = code.startsWith(c.repeat(3), i) ? c.repeat(3) : c;
      let j = i + quote.length;
      while (j < code.length && !code.startsWith(quote, j)) {
        if (quote.length === 1 && code[j] === "\n") break; // 닫히지 않은 한 줄 문자열
        j += code[j] === "\\" ? 2 : 1;
      }
      out += '""';
      i = Math.min(code.length, j + (code.startsWith(quote, j) ? quote.length : 0));
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** 괄호 밖에서 시작하는 줄들 (괄호가 열린 채 이어지는 줄은 앞 줄에 붙인다) */
function logicalLines(code: string): string[] {
  const lines: string[] = [];
  let depth = 0;
  let current = "";
  for (const line of code.split("\n")) {
    current = depth > 0 ? `${current} ${line}` : line;
    for (const ch of line) {
      if ("([{".includes(ch)) depth++;
      else if (")]}".includes(ch)) depth = Math.max(0, depth - 1);
    }
    if (depth === 0) lines.push(current);
  }
  if (depth > 0) lines.push(current);
  return lines;
}

/** 이름 자리에 올 수 없는 낱말 (`else: y = 1` 의 else 를 이름으로 세지 않게) */
const KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else",
  "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
  "return", "try", "while", "with", "yield",
]);

const split = (names: string) => names.split(",").map((n) => n.trim()).filter(Boolean);

/** import a.b, c as d → a, d / from m import x, y as z → x, z */
function importNames(stmt: string): string[] {
  const from = new RegExp(String.raw`^from\s+[\w.]+\s+import\s+\(?([^)]*)\)?$`).exec(stmt);
  const plain = new RegExp(String.raw`^import\s+(.+)$`).exec(stmt);
  const list = from?.[1] ?? plain?.[1];
  if (!list) return [];
  return list.split(",").flatMap((part) => {
    const m = new RegExp(String.raw`^\s*([\w.]+)(?:\s+as\s+(${NAME}))?\s*$`).exec(part);
    if (!m) return [];
    if (m[2]) return [m[2]];
    return from ? [m[1]] : [m[1].split(".")[0]];
  });
}

const ASSIGN = new RegExp(String.raw`^\s*\(?\s*(${NAMES})\s*,?\s*\)?\s*(?::[^=]*)?=(?!=)`);
const FOR = new RegExp(String.raw`^(?:async\s+)?for\s+\(?\s*(${NAMES})\s*,?\s*\)?\s+in\b`);
const GLOBAL = new RegExp(String.raw`^(?:global|nonlocal)\s+(${NAMES})\s*$`);
const DEF = new RegExp(String.raw`^(?:async\s+)?(?:def|class)\s+(${NAME})\b`);
const AS = new RegExp(String.raw`\bas\s+(${NAME})`, "g");

/** 문장 하나(한 줄, 앞뒤 공백 없음)가 정하는 이름 */
function statementNames(stmt: string): string[] {
  const out: string[] = [];
  // x = y = 0, a, b = 0, 0, n: int = 3 (a += 1 은 읽기라 맞지 않는다)
  let rest = stmt;
  for (let m = ASSIGN.exec(rest); m; m = ASSIGN.exec(rest)) {
    out.push(...split(m[1]));
    rest = rest.slice(m[0].length);
  }
  const loop = FOR.exec(stmt);
  if (loop) out.push(...split(loop[1]));
  if (/^(?:async\s+)?with\b|^except\b/.test(stmt)) for (const m of stmt.matchAll(AS)) out.push(m[1]);
  const global = GLOBAL.exec(stmt);
  if (global) out.push(...split(global[1]));
  const def = DEF.exec(stmt);
  if (def) out.push(def[1]);
  out.push(...importNames(stmt));
  return out.filter((n) => !KEYWORDS.has(n));
}

/** 코드 블록 원문(여러 줄)이 값을 정하는 이름들 */
export function definedNames(code: string): string[] {
  const names = new Set<string>();
  for (const line of logicalLines(stripStringsAndComments(code))) {
    // 한 줄에 ; 로 이은 문장, if x: y = 1 처럼 콜론 뒤 한 줄 몸통은 보지 않는다 (; 만 나눈다)
    for (const stmt of line.split(";")) for (const n of statementNames(stmt.trim())) names.add(n);
  }
  return [...names];
}
