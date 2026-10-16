import { normalizeCode } from "@/parser/normalize";
import type { Rule } from "./schema";

/*
 * 판정을 통과한 뒤 덧붙이는 "주의" (완료를 막지 않는다). 검사(lint) 주의는 화면 쪽(src/app/track/judgeNotes.ts)이 모으고,
 * 여기는 코드 글만 보는 순수 함수 둘: 준비만 하고 안 쓴 장치 변수, 시작 코드를 한 줄도 바꾸지 않은 미션.
 */

/** `name = Pin(...)`, `oled = SSD1306_I2C(...)`, `np = neopixel.NeoPixel(...)` 처럼 들여쓰기 없는 장치 준비 줄 */
const SETUP_LINE = /^([A-Za-z_]\w*)\s*=\s*(?:[A-Za-z_]\w*\.)*[A-Z]\w*\(/;

/** 들여쓰기 없는 줄에서 장치를 준비해 이름을 붙였는데, 그 이름을 다른 줄에서 한 번도 쓰지 않았다 */
export function unusedSetup(code: string): string[] {
  const lines = normalizeCode(code);
  const out: string[] = [];
  lines.forEach((line, i) => {
    const m = SETUP_LINE.exec(line);
    if (!m) return;
    const name = m[1];
    const used = new RegExp(`(?<![\\w.])${name}\\b`);
    const elsewhere = lines.some((other, j) => j !== i && used.test(other));
    if (!elsewhere && !out.some((s) => s.startsWith(`${name} `))) out.push(`${name} 는 준비만 하고 쓰지 않았어요. 이 장치가 필요한가요?`);
  });
  return out;
}

/**
 * 시작 코드(`code:`)와 비교해 **한 줄도 바꾸지 않았으면** 주의(모든 시작 줄이 그대로 있고 새 줄도 없다). 규칙에 notHas 가 있으면 그 규칙이
 * 이미 보므로 내지 않는다. 줄은 주석·빈 줄을 뗀 뒤 앞뒤 공백을 빼고 같은 줄끼리 짝 지운다 (같은 줄이 여럿이면 개수만큼).
 * (처음 설계의 "90% 이상 그대로" 기준은 정답 65개 중 38개에 걸려 버려 "그대로"로 좁혔다.)
 */
export function leftoverFromStart(startCode: string, code: string, rules: readonly Rule[] = []): string[] {
  if (rules.some((r) => "notHas" in r)) return [];
  const start = normalizeCode(startCode).map((l) => l.trim());
  if (start.length === 0) return [];
  const remaining = new Map<string, number>();
  const codeLines = normalizeCode(code);
  if (codeLines.length !== start.length) return [];
  for (const l of codeLines) {
    const t = l.trim();
    remaining.set(t, (remaining.get(t) ?? 0) + 1);
  }
  let kept = 0;
  for (const l of start) {
    const n = remaining.get(l) ?? 0;
    if (n > 0) {
      kept++;
      remaining.set(l, n - 1);
    }
  }
  return kept === start.length ? ["시작 코드를 바꾸지 않았어요. 지시문이 바꾸라고 한 줄은 어디인가요?"] : [];
}
