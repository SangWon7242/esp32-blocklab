import { IMPORT_RULES, MACHINE_NAMES } from "@/devices/imports";
import type { ImportRule } from "@/devices/types";

/**
 * 맨 앞 칸의 `from machine import …` 줄(파서가 code_stmt 로 남긴 줄)이 이미 가져오는 이름들.
 * `X as Y` 는 X 를 주지 않으므로 넣지 않는다.
 */
function machineNamesProvided(text: string): Set<string> {
  const names = new Set<string>();
  for (const m of text.matchAll(/^from\s+machine\s+import\s+(.+)$/gm)) {
    for (const part of m[1].replace(/[()]/g, "").split(",")) {
      const name = part.trim();
      if (/^\w+$/.test(name)) names.add(name);
    }
  }
  return names;
}

/** 규칙 줄이 가져오는 모듈 이름 (`import time` → time, `from lcd128_32 import lcd128_32` → lcd128_32) */
const ruleModule = (line: string) => /^(?:from\s+(\S+)\s+import|import\s+(\S+))/.exec(line)?.slice(1).find(Boolean) ?? "";
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 본문에 이 규칙의 줄(또는 `import utime as time` 처럼 같은 이름을 주는 import)이 이미 있는지 */
function ruleProvided(text: string, rule: ImportRule): boolean {
  if (text.split("\n").includes(rule.line)) return true;
  const plain = /^import\s+(\S+)$/.exec(rule.line);
  return plain ? new RegExp(`^import\\s[^\\n]*\\b${escapeRe(plain[1])}\\b`, "m").test(text) : false;
}

/**
 * 생성된 본문을 보고 필요한 import 줄을 수업 저장소 순서(machine → ssd1306 → time → 그 밖)로 만든다.
 * machine 이름은 MACHINE_NAMES, 나머지는 레지스트리의 IMPORT_RULES 를 차례로 적용한다.
 * 본문에 남은 `from machine import Pin, ADC` 같은 줄이 이미 주는 이름은 빼고 모자란 이름만 가져온다
 * (같은 이름을 두 번 가져오지 않고, 블록에서 PWM·SoftI2C 를 더해도 빠지지 않도록).
 * 규칙의 모듈은 본문에 그 모듈을 가져오는 줄이 있으면 만들지 않는다.
 */
export function collectImports(text: string): string[] {
  const lines: string[] = [];
  const provided = machineNamesProvided(text);
  const machine = MACHINE_NAMES.filter((name) => new RegExp(`\\b${name}\\(`).test(text) && !provided.has(name));
  if (machine.length) lines.push(`from machine import ${machine.join(", ")}`);
  for (const rule of IMPORT_RULES) {
    if (rule.when.test(text) && !lines.includes(rule.line) && !ruleProvided(text, rule)) lines.push(rule.line);
  }
  return lines;
}

const IMPORT_LINE = /^(from\s+\S+\s+)?import\s/;

/** import 줄의 자리: machine 0, 그 밖은 같은 모듈을 가져오는 IMPORT_RULES 의 rank (ssd1306 1, time 2), 모르면 3 */
function importRank(line: string): number {
  if (/^from\s+machine\b/.test(line)) return 0;
  const exact = IMPORT_RULES.find((r) => r.line === line);
  if (exact) return exact.rank;
  const byModule = IMPORT_RULES.find((r) => new RegExp(`\\b${escapeRe(ruleModule(r.line))}\\b`).test(line));
  return byModule ? byModule.rank : 3;
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
