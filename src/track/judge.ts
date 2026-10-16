import { normalizeCode } from "@/parser/normalize";
import type { BlockJson } from "@/parser/types";
import type { BlockPattern, BlocksRule, LineInside, ReadQuestion, Rule } from "./schema";

export type JudgeInput = {
  /** 학생 코드 (파이썬 글) */
  code?: string;
  /** 작업판 직렬화 JSON ({blocks: {blocks: [...]}}), 블록 배열, 블록 하나 중 무엇이든 */
  blocksJson?: unknown;
  /** 실행 출력 (FakeDevice 포함) */
  output?: string;
  /**
   * codeEquals 비교용 표준 꼴 함수 (없으면 정규화 원문). 화면은 src/app/track/canonical.ts 의 canonicalLines 를 넘긴다:
   * 블록으로 바꿨다가 다시 코드로 낸 것이라, 생성기가 함수 정의를 위로 올리고 import 순서를 정해도 선생님 파일과 같다고 본다.
   */
  canonical?: (code: string) => string[];
};
export type JudgeResult = { pass: boolean; failures: string[] };

/**
 * 규칙을 모두 검사해 실패한 규칙의 fail 문장을 순서대로 모은다.
 * files 는 codeEquals 가 참조하는 같은 폴더의 코드 파일 (LoadedChapter.files).
 */
export function judge(rules: readonly Rule[], input: JudgeInput, files: Readonly<Record<string, string>> = {}): JudgeResult {
  const failures = rules.filter((r) => !passes(r, input, files)).map((r) => r.fail);
  return { pass: failures.length === 0, failures };
}

function passes(rule: Rule, input: JudgeInput, files: Readonly<Record<string, string>>): boolean {
  const lines = () => normalizeCode(input.code ?? "");
  if ("useBlock" in rule) {
    const types = new Set(blockTypes(input.blocksJson));
    return rule.useBlock.some((t) => types.has(t));
  }
  if ("codeMatches" in rule) return new RegExp(rule.codeMatches, "m").test(lines().join("\n"));
  if ("codeEquals" in rule) {
    const expected = files[rule.codeEquals.file];
    const canon = input.canonical ?? normalizeCode;
    return expected !== undefined && codeEquals(canon(input.code ?? ""), canon(expected), rule.codeEquals.tolerance ?? 0);
  }
  if ("pinIs" in rule) {
    const { name, pin } = rule.pinIs;
    const re = new RegExp(`^\\s*${name}\\s*=.*\\bPin\\(\\s*${pin}\\s*[,)]`);
    return lines().some((l) => re.test(l));
  }
  if ("maxBlocks" in rule) return countBlocks(input.blocksJson) <= rule.maxBlocks;
  if ("hasLine" in rule) {
    const { text, inside } = rule.hasLine;
    return findLines(lines(), text).some((i) => inside === undefined || insideOf(lines(), i) === inside);
  }
  if ("notHas" in rule) return findLines(lines(), rule.notHas).length === 0;
  if ("order" in rule) {
    const firsts = rule.order.map((t) => findLines(lines(), t)[0] ?? -1);
    return firsts.every((i, k) => i >= 0 && (k === 0 || i > firsts[k - 1]));
  }
  if ("count" in rule) {
    const { text, min, max } = rule.count;
    const n = findLines(lines(), text).length;
    return (min === undefined || n >= min) && (max === undefined || n <= max);
  }
  if ("blocks" in rule) return hasBlock(input.blocksJson, rule.blocks);
  return (input.output ?? "").includes(rule.outputIncludes);
}

/* ---------- 줄 규칙 (hasLine · notHas · order · count) ---------- */

/** 줄 비교용 열쇠: 앞뒤 공백을 떼고, 공백 묶음은 한 칸으로, 작은따옴표는 큰따옴표로 */
export function lineKey(line: string): string {
  return line.trim().replace(/\s+/g, " ").replace(/'/g, '"');
}

/** 정규화 코드에서 text 와 같은 줄들의 번호 (0부터) */
function findLines(lines: readonly string[], text: string): number[] {
  const key = lineKey(text);
  const out: number[] = [];
  lines.forEach((l, i) => {
    if (lineKey(l) === key) out.push(i);
  });
  return out;
}

const indentOf = (line: string) => /^\s*/.exec(line)![0].length;

/**
 * 줄 i 가 속한 가장 가까운 블록 머리의 종류 (들여쓰기로 판단).
 * 들여쓰기 0 → top. 아니면 위로 올라가며 처음 만나는 더 얕은 줄이 머리:
 * while/for → loop, def → def, if/elif/else → if. 그 밖(try·with·class 등)은 undefined.
 */
export function insideOf(lines: readonly string[], i: number): LineInside | undefined {
  const indent = indentOf(lines[i]);
  if (indent === 0) return "top";
  for (let k = i - 1; k >= 0; k--) {
    if (indentOf(lines[k]) >= indent) continue;
    const head = lines[k].trim();
    if (/^(while|for)\b/.test(head)) return "loop";
    if (/^def\b/.test(head)) return "def";
    if (/^(if|elif|else)\b/.test(head)) return "if";
    return undefined;
  }
  return undefined;
}

/* ---------- codeEquals ---------- */

type Shape = { indent: string; text: string; nums: number[] };

// 이름·속성의 일부가 아닌 숫자 리터럴 (duty_u16 의 16, ssd1306 은 아니다)
const NUM = /(?<![\w.])(\d+\.\d*|\.\d+|\d+)(?![\w])/g;

/**
 * 한 줄을 비교용 모양으로: 들여쓰기는 그대로, 문자열 밖에서는 공백을 단어 사이 하나로 줄이고
 * 숫자 리터럴은 # 로 바꿔 따로 모은다. 문자열 안은 글자 그대로.
 */
function shape(line: string): Shape {
  const indent = /^\s*/.exec(line)![0];
  const nums: number[] = [];
  let text = "";
  const rest = line.slice(indent.length);
  const parts = rest.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      text += part;
      return;
    }
    const code = part
      .replace(/\s+/g, " ")
      .replace(/ ?([^\w\s]) ?/g, "$1")
      .replace(NUM, (m) => {
        nums.push(Number(m));
        return "#";
      });
    text += code;
  });
  return { indent, text, nums };
}

function codeEquals(actual: string[], expected: string[], tolerance: number): boolean {
  if (actual.length !== expected.length) return false;
  return actual.every((line, i) => {
    const a = shape(line);
    const b = shape(expected[i]);
    return a.indent === b.indent && a.text === b.text && a.nums.every((n, k) => Math.abs(n - b.nums[k]) <= tolerance + 1e-9);
  });
}

/* ---------- 블록 JSON ---------- */

function topBlocks(json: unknown): BlockJson[] {
  if (!json || typeof json !== "object") return [];
  if (Array.isArray(json)) return json as BlockJson[];
  const ws = (json as { blocks?: { blocks?: BlockJson[] } }).blocks;
  if (ws && Array.isArray(ws.blocks)) return ws.blocks;
  return typeof (json as BlockJson).type === "string" ? [json as BlockJson] : [];
}

/** 블록 하나와 그 자리: 감싸는 블록들(바깥 → 안), 같은 몸통에서 바로 앞 형제 */
type Placed = { block: BlockJson; parents: readonly BlockJson[]; prev?: BlockJson };

/** 그림자가 아닌 블록을 모두 (입력·다음 블록을 따라 재귀). 입력으로 내려가면 그 블록이 감싸는 블록, next 는 같은 몸통의 형제 */
function walk(block: BlockJson | undefined, parents: readonly BlockJson[], prev: BlockJson | undefined, out: Placed[]): void {
  if (!block) return;
  out.push({ block, parents, prev });
  const inner = [...parents, block];
  for (const input of Object.values(block.inputs ?? {})) walk(input.block, inner, undefined, out);
  walk(block.next?.block, parents, block, out);
}

function placedBlocks(json: unknown): Placed[] {
  const out: Placed[] = [];
  for (const b of topBlocks(json)) walk(b, [], undefined, out);
  return out;
}

function realBlocks(json: unknown): BlockJson[] {
  return placedBlocks(json).map((p) => p.block);
}

export function blockTypes(json: unknown): string[] {
  return realBlocks(json).map((b) => b.type);
}

/** 그림자 블록을 뺀 블록 수 */
export function countBlocks(json: unknown): number {
  return realBlocks(json).length;
}

/* ---------- blocks 규칙 ---------- */

/** inside 별칭 loop: 되풀이하는 블록들 */
const isLoop = (type: string) => type === "flow_repeat_forever" || type === "flow_repeat_n" || type === "controls_whileUntil" || type.startsWith("flow_for_");
/** inside 별칭 def: 함수 정의 블록들 */
const isDef = (type: string) => type.startsWith("procedures_def");
/** 작업판의 시작 블록 — top 은 이 블록 몸통 바로 아래(다른 감싸는 블록이 없음) */
const START = "start_program";

/** 작업판 JSON 의 변수 표 (id → 이름). codeToBlocks 는 변수 칸에 id 만 적고 이름은 여기에 둔다 */
function variableNames(json: unknown): Map<string, string> {
  const map = new Map<string, string>();
  const vars = (json as { variables?: unknown })?.variables;
  if (Array.isArray(vars)) for (const v of vars as { id?: string; name?: string }[]) if (v?.id && v.name) map.set(v.id, v.name);
  return map;
}

/** 필드 값을 비교용 글로. 변수 칸({id, name?})은 변수 이름, 그 밖(글·수·참거짓)은 String() */
function fieldText(value: unknown, vars: ReadonlyMap<string, string>): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object") {
    const v = value as { id?: string; name?: string };
    return v.name ?? (v.id !== undefined ? vars.get(v.id) : undefined);
  }
  return String(value);
}

/** 수로 읽히는 글·수 ("2.0", 26, "0.10") */
const isNumeric = (v: unknown) => typeof v === "number" ? Number.isFinite(v) : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v));

/** 필드 값 비교: 둘 다 수면 수로(2 = "2.0"), 아니면 글로 */
function sameField(actual: string | undefined, want: string | number | boolean): boolean {
  if (actual === undefined) return false;
  const w = String(want);
  return actual === w || (isNumeric(actual) && isNumeric(w) && Number(actual) === Number(w));
}

/**
 * 코드 모드에서 블록으로 안 바뀐 수 글(time.sleep(2.0) 의 "2.0" 은 code_expr 로 남는다)은 그 수의 math_number 로 본다.
 * 블록 모드에서는 수 칸에 2.0 을 적어도 2 가 되므로 코드 모드만 달라지는 것을 막는다.
 */
function asNumberBlock(block: BlockJson): BlockJson | undefined {
  const code = block.fields?.CODE;
  return block.type === "code_expr" && isNumeric(code) ? { type: "math_number", fields: { NUM: Number(code) } } : undefined;
}

/** 블록이 모양(type · 적은 fields · 중첩 inputs)과 맞는가. 값 입력에 블록이 없으면 그림자(수 칸 기본값)를 본다 */
function matchesPattern(block: BlockJson, pattern: BlockPattern, vars: ReadonlyMap<string, string>): boolean {
  if (block.type !== pattern.type) {
    const num = pattern.type === "math_number" ? asNumberBlock(block) : undefined;
    return num !== undefined && matchesPattern(num, pattern, vars);
  }
  for (const [name, want] of Object.entries(pattern.fields ?? {})) {
    if (!sameField(fieldText(block.fields?.[name], vars), want)) return false;
  }
  for (const [name, sub] of Object.entries(pattern.inputs ?? {})) {
    const input = block.inputs?.[name];
    const child = input?.block ?? input?.shadow;
    if (!child || !matchesPattern(child, sub, vars)) return false;
  }
  return true;
}

/** 감싸는 블록들이 inside 조건을 만족하는가 (loop · def · top 별칭, 아니면 블록 type 그대로) */
function insideMatches(parents: readonly BlockJson[], inside: string): boolean {
  if (inside === "top") return parents.every((p) => p.type === START);
  if (inside === "loop") return parents.some((p) => isLoop(p.type));
  if (inside === "def") return parents.some((p) => isDef(p.type));
  return parents.some((p) => p.type === inside);
}

/** blocks 규칙: 모양·inside·after 를 모두 만족하는 블록이 하나라도 있는가 */
export function hasBlock(json: unknown, rule: BlocksRule): boolean {
  const vars = variableNames(json);
  const { inside, after, ...pattern } = rule;
  return placedBlocks(json).some(({ block, parents, prev }) =>
    matchesPattern(block, pattern, vars)
    && (inside === undefined || insideMatches(parents, inside))
    && (after === undefined || (prev !== undefined && matchesPattern(prev, after, vars))),
  );
}

/* ---------- 읽기 체크 ---------- */

/** 읽기 체크 문항 채점. number 는 값, choice 는 선택지 번호(0부터), line 은 줄 번호(1부터) */
export function checkAnswer(q: ReadQuestion, given: number): boolean {
  return q.answer === given;
}
