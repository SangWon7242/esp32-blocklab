import { normalizeCode } from "@/parser/normalize";
import type { BlockJson } from "@/parser/types";
import type { ReadQuestion, Rule } from "./schema";

export type JudgeInput = {
  /** 학생 코드 (파이썬 글) */
  code?: string;
  /** 작업판 직렬화 JSON ({blocks: {blocks: [...]}}), 블록 배열, 블록 하나 중 무엇이든 */
  blocksJson?: unknown;
  /** 실행 출력 (FakeDevice 포함) */
  output?: string;
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
    return expected !== undefined && codeEquals(lines(), normalizeCode(expected), rule.codeEquals.tolerance ?? 0);
  }
  if ("pinIs" in rule) {
    const { name, pin } = rule.pinIs;
    const re = new RegExp(`^\\s*${name}\\s*=.*\\bPin\\(\\s*${pin}\\s*[,)]`);
    return lines().some((l) => re.test(l));
  }
  if ("maxBlocks" in rule) return countBlocks(input.blocksJson) <= rule.maxBlocks;
  return (input.output ?? "").includes(rule.outputIncludes);
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
