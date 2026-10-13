import type { BlockJson } from "@/parser/types";
import type { StepOf } from "./schema";

/**
 * 설계(design) 단계: ① 의사코드 빈칸 채점 ② 번역표 ③ 조립 작업판(시작 블록 몸통의 명령 블록을 떼어 흩어 둔다).
 * React·Blockly 없이 JSON 만 다룬다.
 */

type Blank = NonNullable<StepOf<"design">["pseudocode"][number]["blank"]>;

const NUMBER = /-?\d+(?:\.\d+)?|-?\.\d+/;

/** 글에서 첫 숫자 (없으면 null) */
function firstNumber(text: string): number | null {
  const m = NUMBER.exec(text);
  return m ? Number(m[0]) : null;
}

/** 비교용: 공백·끝 문장부호를 지우고 소문자로 */
const squash = (s: string) => s.replace(/\s+/g, "").replace(/[.。!?]+$/, "").toLowerCase();

/**
 * 빈칸 하나를 채점한다.
 * - answer 가 없으면 비어 있지 않은 글이면 맞다.
 * - answer 가 숫자이거나 숫자로 시작하는 글("15 cm", "0.3")이면 학생 글의 첫 숫자를 tolerance(기본 0) 범위로 비교한다.
 * - 그 밖에는 공백을 무시하고 같으면 맞다. "문(서보)" 처럼 괄호가 있으면 "문", "서보" 도 맞다.
 */
export function gradeBlank(blank: Partial<Blank> | undefined, text: string | undefined): boolean {
  const given = (text ?? "").trim();
  if (!given) return false;
  if (!blank || blank.answer === undefined || blank.answer === "") return true;
  const answer = blank.answer;
  const expected = typeof answer === "number" ? answer : /^\s*-?(\d|\.\d)/.test(answer) ? firstNumber(answer) : null;
  if (expected !== null) {
    const got = firstNumber(given);
    return got !== null && Math.abs(got - expected) <= (blank.tolerance ?? 0) + 1e-9;
  }
  const s = String(answer);
  const accepted = new Set([squash(s)]);
  const paren = /^(.*?)\((.*)\)\s*$/.exec(s);
  if (paren) {
    if (paren[1].trim()) accepted.add(squash(paren[1]));
    if (paren[2].trim()) accepted.add(squash(paren[2]));
  }
  return accepted.has(squash(given));
}

/** 의사코드 빈칸들을 채점한다. 빈칸이 없는 줄은 null */
export function gradeBlanks(step: StepOf<"design">, answers: readonly (string | undefined)[]): (boolean | null)[] {
  return step.pseudocode.map((line, i) => (line.blank ? gradeBlank(line.blank, answers[i]) : null));
}

/** 블록이 차지할 높이 짐작 (몸통 속 명령 수만큼 길다) */
function estimateHeight(block: BlockJson): number {
  let n = 0;
  const visit = (b: BlockJson | undefined) => {
    if (!b) return;
    n++;
    for (const input of Object.values(b.inputs ?? {})) visit(input.block);
    visit(b.next?.block);
  };
  visit(block);
  return 40 + n * 36;
}

type WorkspaceLike = { blocks?: { blocks?: BlockJson[] } } & Record<string, unknown>;

/**
 * codeToBlocks 결과에서 시작 블록 몸통의 명령 블록을 하나씩 떼어(안쪽 몸통은 그대로) 섞은 순서로 시작 블록 아래에 흩어 둔다.
 * 떼어 낸 블록은 꺼 두고(ORPHANED_BLOCK, 작업판의 disableOrphans 와 같은 이유) 시작 블록은 옮기거나 지울 수 없게 고정한다.
 * 함수 정의 같은 다른 맨 위 블록은 그대로 둔다. rand 는 0 이상 1 미만 (테스트에서 고정).
 */
export function scatterStartBody<T>(json: T, rand: () => number = Math.random): T {
  const ws = structuredClone(json) as WorkspaceLike;
  const tops = ws.blocks?.blocks ?? [];
  const start = tops.find((b) => b.type === "start_program");
  if (!start) return ws as T;
  Object.assign(start, { movable: false, deletable: false });
  const pieces: BlockJson[] = [];
  let cur = start.inputs?.BODY?.block;
  while (cur) {
    const next = cur.next?.block;
    delete cur.next;
    pieces.push(cur);
    cur = next;
  }
  if (start.inputs) {
    delete start.inputs.BODY;
    if (Object.keys(start.inputs).length === 0) delete start.inputs;
  }
  // 섞기 (Fisher–Yates)
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  let y = (start.y ?? 40) + 120;
  for (const p of pieces) {
    p.x = (start.x ?? 40) + 40 + Math.floor(rand() * 200);
    p.y = y;
    y += estimateHeight(p) + 24;
    (p as BlockJson & { disabledReasons?: string[] }).disabledReasons = ["ORPHANED_BLOCK"];
  }
  ws.blocks!.blocks = [...tops, ...pieces];
  return ws as T;
}

/** 조립 판정 실패 문장 */
export const DESIGN_FAIL = "순서나 값이 설계도와 달라요. 의사코드와 한 줄씩 대조해 보세요";
