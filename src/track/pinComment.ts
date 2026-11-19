/*
 * 핀 번호를 바꾸면 그 줄 주석의 번호도 같이 (선생님 요청: 학생마다 배선이 달라 핀을 바꿔 쓴다).
 * `led_red = Pin(13, Pin.OUT)  # IO13 → 빨강` 의 13 을 15 로 바꾸면 주석도 `# IO15 → 빨강`.
 * 순수 함수 — 블록(필드 바꿈)·코드(CodeMirror 입력)·다음 단계로 이어 받기(pinCarry.ts)가 함께 쓴다.
 */

/**
 * 주석에서 핀 번호로 보는 자리 (옛 번호에만 맞춘다. 다른 숫자는 건드리지 않는다):
 * - 앞붙이: `IO13` `io13` `GPIO13` `D13` (`IO 13` 처럼 한 칸 띄운 것도). 앞붙이 앞은 영문이 아니어야 한다 (`LED13` 의 D 는 아님)
 * - `13번` (`13 번`도, `13번째`는 아님)
 * - `핀 13` `Pin 13` `PIN13`
 * - 맨 숫자: 뒤가 끝·`,`·`)`·`]`·`·`·`/` 인 것 (`빨강 27, 초록 25, 파랑 26` · `Trig 13, Echo 12` · `13·14·16번`)
 * 숫자 경계: 앞뒤에 숫자가 붙거나(`113` `1300`) 소수(`13.5`)면 아니다. 범위(`32~39번` `32-39`)의 숫자도 아니다.
 */
function pinPattern(nums: readonly number[]): RegExp {
  const n = `(${[...new Set(nums)].sort((a, b) => b - a).join("|")})`;
  // 숫자 뒤 경계: 숫자·소수점 숫자가 이어지지 않고, 범위 기호가 오지 않는다
  const end = String.raw`(?!\d|\.\d|\s*[~\-–]\s*\d)`;
  // 맨 숫자·번 앞 경계: 영문·숫자·_·소수점·범위 기호가 붙어 있지 않다
  const start = String.raw`(?<![\w.~\-–]|[~\-–]\s)`;
  const alts = [
    String.raw`(?<![A-Za-z])(?:GPIO|gpio|IO|io|Io|D)\s?${n}${end}`,
    String.raw`(?:핀|[Pp]in|PIN)\s?${n}${end}`,
    String.raw`${start}${n}(?=\s?번(?!째))${end}`,
    String.raw`${start}${n}(?=\s*(?:$|[,)\]·/]))`,
  ];
  return new RegExp(alts.join("|"), "gm");
}

/**
 * 주석 글에서 핀 번호들을 한꺼번에 바꾼다 (map: 옛 번호 → 새 번호). 한꺼번에라 13↔14 처럼 맞바꿔도 섞이지 않는다.
 * 블록 주석 형식(위 줄들 + 마지막 `|` 줄 끝 주석)이나 `#` 이 붙은 글 그대로 넣어도 된다 (숫자 자리만 바꾼다).
 */
export function renamePinsInComment(text: string, map: ReadonlyMap<number, number>): string {
  const olds = [...map].filter(([a, b]) => a !== b).map(([a]) => a);
  if (!text || olds.length === 0) return text;
  return text.replace(pinPattern(olds), (whole: string, ...groups: unknown[]) => {
    // 대안마다 숫자 그룹이 하나 — 잡힌 것 하나를 찾아 그 자리만 바꾼다
    const num = groups.slice(0, 4).find((g) => typeof g === "string") as string | undefined;
    if (num === undefined) return whole;
    const next = map.get(Number(num));
    if (next === undefined) return whole;
    const at = whole.lastIndexOf(num);
    return whole.slice(0, at) + String(next) + whole.slice(at + num.length);
  });
}

/** 주석 글에서 핀 번호 하나를 바꾼다 (renamePinsInComment 의 하나짜리) */
export function renamePinInComment(text: string, oldPin: number, newPin: number): string {
  return renamePinsInComment(text, new Map([[oldPin, newPin]]));
}

/* ---------- 코드 한 줄: 코드 부분 · 주석 부분, 핀 자리 ---------- */

/** 줄을 코드와 주석(`#` 부터)으로 나눈 자리. 문자열 안의 `#` 은 주석이 아니다. 주석이 없으면 commentStart 는 줄 길이 */
export function commentStart(line: string): number {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "#") return i;
  }
  return line.length;
}

/** 코드 한 줄의 핀 자리 (코드 부분 안 위치). value 가 null 이면 지우는 중이라 숫자가 비었다 (`Pin(`) */
export type PinSlot = { start: number; end: number; value: number | null };

/** 맨 숫자 인자로 핀을 받는 장치 준비 (장치 명세 rfid · lcd · ir · keypad 의 패턴과 같은 꼴) */
const BARE_CALLS: { re: RegExp; count: number }[] = [
  { re: /\bmfrc522\(\s*/g, count: 2 },
  { re: /\blcd128_32\(\s*/g, count: 2 },
  { re: /\birGetCMD\(\s*/g, count: 1 },
  { re: /\bKeyPad\(\s*/g, count: 8 },
];

/**
 * 코드 부분(주석 뺀 글)의 핀 자리들을 앞에서부터. `Pin(13` 의 첫 인자(`SoftI2C(scl=Pin(22), sda=Pin(21))` 처럼 여럿도),
 * `mfrc522(22, 21` · `lcd128_32(21, 22` · `irGetCMD(5)` · `KeyPad(8개)` 의 맨 숫자, 흐르는 LED 의 `pins = [18, 5, ...]`.
 * `Pin(pin, ...)` 처럼 변수면 자리가 아니다.
 */
export function pinSlots(code: string): PinSlot[] {
  const out: PinSlot[] = [];
  const add = (start: number, digits: string) => out.push({ start, end: start + digits.length, value: digits === "" ? null : Number(digits) });
  for (const m of code.matchAll(/\bPin\(\s*(\d*)(?=\s*[,)]|\s*$)/g)) add(m.index! + m[0].length - m[1].length, m[1]);
  for (const { re, count } of BARE_CALLS) {
    for (const m of code.matchAll(re)) {
      let at = m.index! + m[0].length;
      for (let k = 0; k < count; k++) {
        const d = /^(\d*)\s*(,\s*)?/.exec(code.slice(at))!;
        add(at, d[1]);
        if (!d[2]) break;
        at += d[0].length;
      }
    }
  }
  const list = /^\s*pins\s*=\s*\[/.exec(code);
  if (list) {
    const at = list[0].length;
    for (const d of code.slice(at).matchAll(/(\d+)|\]/g)) {
      if (d[0] === "]") break;
      add(at + d.index!, d[1]);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/* ---------- 코드 모드: 고친 줄의 주석 따라가기 ---------- */

/** 지우는 중(숫자가 빈 자리)이던 줄의 옛 번호 기억: 줄 모양 → 자리마다 번호 */
export type PinMemory = ReadonlyMap<string, readonly (number | null)[]>;
export const EMPTY_PIN_MEMORY: PinMemory = new Map();

/** 핀 숫자를 뺀 코드 부분 (같은 줄을 고치는 중인지 보는 열쇠) */
function lineShape(code: string, slots: readonly PinSlot[]): string {
  let out = "";
  let at = 0;
  for (const s of slots) {
    out += code.slice(at, s.start);
    at = s.end;
  }
  return out + code.slice(at);
}

/**
 * 코드 한 줄이 oldLine → newLine 으로 바뀌었을 때 (학생이 핀 숫자를 고쳤을 때) 주석의 그 번호도 따라 바꾼 새 줄.
 * 핀 자리 말고 다른 곳이 바뀌었으면 그대로. 입력 중 13 → 1 → 15 처럼 중간 값을 거쳐도 바로 앞 값 기준으로 따라가고,
 * 13 → (지움) → 15 처럼 숫자가 잠깐 비면 memory 에 13 을 기억해 두었다가 이어 쓴다.
 */
export function followPinLine(oldLine: string, newLine: string, memory: PinMemory = EMPTY_PIN_MEMORY): { line: string; memory: PinMemory } {
  const oldCode = oldLine.slice(0, commentStart(oldLine));
  const cut = commentStart(newLine);
  const newCode = newLine.slice(0, cut);
  const before = pinSlots(oldCode);
  const after = pinSlots(newCode);
  const shape = lineShape(newCode, after);
  if (before.length !== after.length || after.length === 0 || lineShape(oldCode, before) !== shape) return { line: newLine, memory };

  const remembered = memory.get(shape);
  const nextMemory = new Map(memory);
  const keep: (number | null)[] = after.map(() => null);
  const renames = new Map<number, number>();
  let remember = false;
  after.forEach((slot, k) => {
    const prev = before[k].value ?? remembered?.[k] ?? null;
    if (slot.value === null) {
      // 지우는 중: 옛 번호를 기억해 둔다
      keep[k] = prev;
      remember ||= prev !== null;
    } else if (prev !== null && prev !== slot.value) renames.set(prev, slot.value);
  });
  if (remember) nextMemory.set(shape, keep);
  else nextMemory.delete(shape);
  // 기억은 작게 (지우다 만 줄 몇 개면 충분하다)
  while (nextMemory.size > 20) nextMemory.delete(nextMemory.keys().next().value!);
  if (renames.size === 0 || cut === newLine.length) return { line: newLine, memory: nextMemory };
  return { line: newCode + renamePinsInComment(newLine.slice(cut), renames), memory: nextMemory };
}
