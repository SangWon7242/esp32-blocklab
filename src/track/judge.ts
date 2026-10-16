import { normalizeCode } from "@/parser/normalize";
import type { BlockJson } from "@/parser/types";
import type { LineInside, ReadQuestion, Rule } from "./schema";

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

/** 그림자가 아닌 블록을 모두 (입력·다음 블록을 따라 재귀) */
function walk(block: BlockJson | undefined, out: BlockJson[]): void {
  if (!block) return;
  out.push(block);
  for (const input of Object.values(block.inputs ?? {})) walk(input.block, out);
  walk(block.next?.block, out);
}

function realBlocks(json: unknown): BlockJson[] {
  const out: BlockJson[] = [];
  for (const b of topBlocks(json)) walk(b, out);
  return out;
}

export function blockTypes(json: unknown): string[] {
  return realBlocks(json).map((b) => b.type);
}

/** 그림자 블록을 뺀 블록 수 */
export function countBlocks(json: unknown): number {
  return realBlocks(json).length;
}

/* ---------- 읽기 체크 ---------- */

/** 읽기 체크 문항 채점. number 는 값, choice 는 선택지 번호(0부터), line 은 줄 번호(1부터) */
export function checkAnswer(q: ReadQuestion, given: number): boolean {
  return q.answer === given;
}
