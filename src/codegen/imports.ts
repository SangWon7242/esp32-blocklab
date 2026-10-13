/**
 * 생성된 본문을 보고 필요한 import 줄을 수업 저장소 순서(machine → ssd1306 → time)로 만든다.
 * 본문에 이미 그 모듈을 가져오는 줄(파서가 code_stmt 로 남긴 `from machine import Pin, ADC` 등)이
 * 맨 앞 칸에 있으면 그 줄을 다시 만들지 않는다 — 같은 이름을 두 번, 다르게 가져오지 않도록.
 */
export function collectImports(text: string): string[] {
  const lines: string[] = [];
  const machine = ["Pin", "PWM", "SoftI2C"].filter((name) => new RegExp(`\\b${name}\\(`).test(text));
  if (machine.length && !/^from\s+machine\s+import\b/m.test(text)) lines.push(`from machine import ${machine.join(", ")}`);
  if (/\bssd1306\./.test(text) && !/^import\s[^\n]*\bssd1306\b/m.test(text)) lines.push("import ssd1306");
  if (/\btime\./.test(text) && !/^import\s[^\n]*\btime\b/m.test(text)) lines.push("import time");
  return lines;
}

const IMPORT_LINE = /^(from\s+\S+\s+)?import\s/;

/** import 줄의 자리: machine → ssd1306 → time → 그 밖 */
function importRank(line: string): number {
  if (/^from\s+machine\b/.test(line)) return 0;
  if (/\bssd1306\b/.test(line)) return 1;
  if (/\btime\b/.test(line)) return 2;
  return 3;
}

/**
 * 본문 맨 앞 칸의 import 줄(블록이 다시 만들지 못해 code_stmt 로 남은 것)을 뽑아
 * 생성한 import 와 함께 맨 위로 모은다. 준비 줄이 본문보다 위로 올라가므로 그대로 두면
 * `led = Pin(...)` 이 `from machine import Pin, ADC` 보다 먼저 나와 실행되지 않는다.
 */
export function hoistImports(body: string, generated: string[]): { imports: string[]; body: string } {
  const kept: string[] = [];
  const rest = body.split("\n").filter((line) => {
    if (!IMPORT_LINE.test(line)) return true;
    kept.push(line);
    return false;
  });
  const imports = [...generated, ...kept]
    .map((line, i) => ({ line, i }))
    .sort((a, b) => importRank(a.line) - importRank(b.line) || a.i - b.i)
    .map((x) => x.line);
  return { imports, body: rest.join("\n").replace(/^\n+/, "") };
}
