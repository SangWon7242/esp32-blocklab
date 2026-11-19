import type { DebugInput, SavedProgram } from "./completion";
import type { LoadedChapter } from "./content";
import { allSteps } from "./gating";
import { commentStart, pinSlots, renamePinsInComment } from "./pinComment";
import type { StepRecord } from "./progress";

/*
 * 다음 단계로 핀 이어 받기. 학생마다 배선이 달라 핀을 바꿔 쓰는데(신호등 13·14·16 → 15·16·5), 단계마다 처음부터 다시 고치지
 * 않게 한 챕터 안에서 앞 단계들이 저장한 프로그램을 그 단계의 원래 시작 코드와 비교해 **핀 바꿈 표**(원래 번호 → 학생 번호)를 만들고,
 * 다음 단계의 시작 코드에 적용한다. 판정은 거꾸로 표(학생 번호 → 원래 번호)를 적용한 코드로 해서 바꾼 핀 때문에 떨어지지 않게 한다.
 * 순수 함수 — 화면(StepPage)과 서버 재판정(snapshot.ts)이 같은 기록으로 같은 표를 만든다.
 */

/** 핀 바꿈 표: 원래 번호 → 학생 번호 (물리 배선 기준이라 변수 이름과 상관없다) */
export type PinMap = ReadonlyMap<number, number>;
export type PinChange = { from: number; to: number };

/** 핀 자리가 있는 대입 줄: 변수 이름과 핀 번호들 (`led_red = Pin(13, Pin.OUT)` → led_red, [13]) */
type PinLine = { name: string; pins: number[] };

const ASSIGN = /^\s*([A-Za-z_]\w*)\s*=/;

function pinLines(code: string): PinLine[] {
  const out: PinLine[] = [];
  for (const line of code.split("\n")) {
    const part = line.slice(0, commentStart(line));
    const name = ASSIGN.exec(part)?.[1];
    if (!name) continue;
    const pins = pinSlots(part).map((s) => s.value);
    if (pins.length && pins.every((p) => p !== null)) out.push({ name, pins: pins as number[] });
  }
  return out;
}

/** 코드에 나오는 모든 핀 번호 */
export function pinsIn(code: string): Set<number> {
  const out = new Set<number>();
  for (const line of code.split("\n")) for (const s of pinSlots(line.slice(0, commentStart(line)))) if (s.value !== null) out.add(s.value);
  return out;
}

/**
 * 원래 코드와 학생 코드의 핀 바꿈: 같은 변수 이름 줄끼리(핀 자리 수도 같을 때) 핀 자리 숫자를 차례로 비교한다.
 * 바꾸지 않은 핀도 넣는다(13 → 13) — 뒤 단계가 원래 번호로 되돌린 것도 앞 단계의 바꿈을 덮게.
 */
export function pinChanges(original: string, edited: string): Map<number, number> {
  const out = new Map<number, number>();
  const edits = pinLines(edited);
  const used = new Set<number>();
  for (const o of pinLines(original)) {
    const i = edits.findIndex((e, k) => !used.has(k) && e.name === o.name && e.pins.length === o.pins.length);
    if (i < 0) continue;
    used.add(i);
    o.pins.forEach((p, k) => out.set(p, edits[i].pins[k]));
  }
  return out;
}

/**
 * 챕터의 기준 배선: 실행·미션·예측·읽기 체크 단계 코드 파일들의 변수 이름 → 핀 번호들.
 * 파일마다 같은 이름이 다른 핀이면 믿을 수 없어 뺀다. 디버깅 증상 코드는 일부러 틀린 핀이 있어 이것과 비교한다.
 */
export function chapterPinBaseline(chapter: LoadedChapter): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const conflicted = new Set<string>();
  for (const step of allSteps(chapter)) {
    if (step.type !== "run" && step.type !== "mission" && step.type !== "predict" && step.type !== "readcheck") continue;
    const code = step.code ? chapter.files[step.code] : undefined;
    if (code === undefined) continue;
    for (const { name, pins } of pinLines(code)) {
      const seen = out.get(name);
      if (!seen) out.set(name, pins);
      else if (seen.join() !== pins.join()) conflicted.add(name);
    }
  }
  for (const name of conflicted) out.delete(name);
  return out;
}

/** 기준 배선과 학생 코드의 핀 바꿈 (같은 변수 이름, 같은 핀 자리 수) */
function baselineChanges(baseline: ReadonlyMap<string, readonly number[]>, edited: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const e of pinLines(edited)) {
    const b = baseline.get(e.name);
    if (b && b.length === e.pins.length) b.forEach((p, k) => out.set(p, e.pins[k]));
  }
  return out;
}

const programOf = (input: Record<string, unknown>): SavedProgram | undefined => {
  const p = (input as { program?: unknown }).program;
  return p && typeof p === "object" && typeof (p as SavedProgram).code === "string" ? (p as SavedProgram) : undefined;
};

/**
 * stepId 앞 단계들의 기록으로 핀 바꿈 표를 만든다 (단계 순서대로, 뒤 단계의 바꿈이 앞 단계를 덮는다. 같은 번호는 표에서 뺀다).
 * - 실행·미션: 저장한 프로그램(input.program) ↔ 그 단계의 시작 코드 파일(`code`)
 * - 디버깅: 통과한 증상의 프로그램(input.programs[i]) ↔ 챕터의 기준 배선 (증상 코드는 일부러 틀린 핀이 있어 그것과 비교하지 않는다)
 * 설계(블록 조립)는 보지 않는다.
 */
export function carriedPinMap(chapter: LoadedChapter, records: Readonly<Record<string, StepRecord | undefined>>, stepId: string): Map<number, number> {
  const map = new Map<number, number>();
  const merge = (changes: ReadonlyMap<number, number>) => changes.forEach((to, from) => map.set(from, to));
  let baseline: Map<string, number[]> | undefined;
  for (const step of allSteps(chapter)) {
    if (step.id === stepId) break;
    const input = records[step.id]?.input;
    if (!input) continue;
    if (step.type === "run" || step.type === "mission") {
      const start = step.code ? chapter.files[step.code] : undefined;
      const program = programOf(input);
      if (start !== undefined && program) merge(pinChanges(start, program.code));
    } else if (step.type === "debug") {
      const d = input as DebugInput;
      step.symptoms.forEach((_, i) => {
        const program = d.programs?.[i];
        if (!program || d.passed?.[i] !== true) return;
        baseline ??= chapterPinBaseline(chapter);
        merge(baselineChanges(baseline, program.code));
      });
    }
  }
  for (const [from, to] of map) if (from === to) map.delete(from);
  return map;
}

/**
 * 시작 코드에 맞춰 표를 고른다. 바꾼 새 번호가 시작 코드의 다른(바꾸지 않는) 핀과 같아지거나, 두 핀이 한 번호로 모이면 그 바꿈은 뺀다.
 * active: 쓰는 바꿈 전부 (시작 코드에 없는 번호의 바꿈도 — 학생이 새로 꽂은 부품의 판정용), applied: 그중 시작 코드에 실제로 있는 번호,
 * skipped: 시작 코드에 있지만 부딪혀 뺀 것. startCode 가 없으면(빈 편집기로 시작하는 미션) 부딪힘을 보지 않는다.
 */
export function resolvePinMap(map: PinMap, startCode?: string): { active: Map<number, number>; applied: PinChange[]; skipped: PinChange[] } {
  const present = startCode === undefined ? new Set<number>() : pinsIn(startCode);
  const active = new Map([...map].filter(([from, to]) => from !== to));
  for (;;) {
    const stable = new Set([...present].filter((p) => !active.has(p)));
    const targets = new Map<number, number>();
    for (const to of active.values()) targets.set(to, (targets.get(to) ?? 0) + 1);
    const bad = [...active].filter(([, to]) => stable.has(to) || targets.get(to)! > 1).map(([from]) => from);
    if (bad.length === 0) break;
    for (const from of bad) active.delete(from);
  }
  // 안내는 시작 코드에 나오는 순서로
  const order = startCode === undefined ? [] : [...pinsIn(startCode)];
  const inOrder = (pins: Iterable<[number, number]>) => [...pins].filter(([from]) => present.has(from)).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)).map(([from, to]) => ({ from, to }));
  return {
    active,
    applied: inOrder(active),
    skipped: inOrder([...map].filter(([from, to]) => from !== to && !active.has(from))),
  };
}

/**
 * 코드의 핀 자리 숫자를 표대로 한꺼번에 바꾼다 (13↔14 맞바꿈도 섞이지 않는다). comments 면 핀 자리가 있는 줄의 주석 번호도 함께
 * (renamePinsInComment). 한 줄 주석이 여러 핀을 말하는 것(`red = PWM(Pin(27))  # 빨강 27, 초록 25, 파랑 26`)도 맞게 표 전체로 바꾼다.
 * 핀 줄이 아닌 줄(`time.sleep(5)  # 5초`)·주석만 있는 줄은 건드리지 않는다.
 */
export function replacePins(code: string, map: PinMap, { comments = true }: { comments?: boolean } = {}): string {
  if (map.size === 0) return code;
  return code
    .split("\n")
    .map((line) => {
      const cut = commentStart(line);
      let part = line.slice(0, cut);
      const slots = pinSlots(part);
      for (const s of [...slots].reverse()) {
        const to = s.value === null ? undefined : map.get(s.value);
        if (to === undefined || to === s.value) continue;
        part = part.slice(0, s.start) + String(to) + part.slice(s.end);
      }
      const comment = line.slice(cut);
      return part + (comments && slots.length && comment ? renamePinsInComment(comment, map) : comment);
    })
    .join("\n");
}

export type CarriedCode = {
  /** 표를 적용한 시작 코드 (적용한 것이 없으면 시작 코드 그대로) */
  code: string;
  /** 적용한 바꿈 (시작 코드 순서) */
  applied: PinChange[];
  /** 다른 부품의 핀과 부딪혀 적용하지 않은 바꿈 */
  skipped: PinChange[];
};

/** 다음 단계 시작 코드에 표를 적용한다 (핀 숫자 + 그 줄 주석) */
export function applyPinMap(startCode: string, map: PinMap): CarriedCode {
  const { active, applied, skipped } = resolvePinMap(map, startCode);
  return { code: applied.length ? replacePins(startCode, active) : startCode, applied, skipped };
}

/** 거꾸로 표 (학생 번호 → 원래 번호) */
export function invertPinMap(map: PinMap): Map<number, number> {
  return new Map([...map].map(([from, to]) => [to, from]));
}

/**
 * 판정할 코드: 학생 코드에 거꾸로 표를 적용해 원래 핀 번호로 되돌린다 (판정 규칙은 선생님 시작 코드의 핀 번호로 적혀 있다).
 * 표는 시작 코드와 부딪히지 않는 것만 (resolvePinMap). 화면(MissionStep·DebugStep)과 서버 재판정(snapshot.ts)이 같이 쓴다.
 */
export function judgeCodeOf(code: string, map: PinMap, startCode?: string): string {
  if (map.size === 0) return code;
  return replacePins(code, invertPinMap(resolvePinMap(map, startCode).active), { comments: false });
}
