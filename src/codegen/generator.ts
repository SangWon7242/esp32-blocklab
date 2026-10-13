import * as Blockly from "blockly";
import { PythonGenerator, pythonGenerator } from "blockly/python";
import { PYTHON_KEYWORDS } from "@/blocks/names";
import { collectImports, hoistImports } from "./imports";

type SplitComment = { above: string[]; trailing: string | null };

/**
 * 블록 코멘트를 문장 위 주석 줄(above)과 줄 끝 주석(trailing)으로 나눈다.
 * - `|` 로 시작하는 줄이 하나라도 있으면(파서가 만든 꼴): `|` 줄은 줄 끝 주석, 나머지는 위 주석 줄.
 *   `|` 뒤가 비었으면 줄 끝 주석 없음 (위 주석 한 줄만 있던 문장).
 * - 아니면(작업판에서 친 코멘트): 한 줄이면 줄 끝 주석, 여러 줄이면 모두 위 주석 줄.
 */
export function splitComment(text: string): SplitComment {
  const lines = text.split("\n").map((l) => l.replace(/\s+$/, ""));
  if (lines.some((l) => l.startsWith("|"))) {
    const trailing = lines.filter((l) => l.startsWith("|")).map((l) => l.slice(1).trim()).filter(Boolean).join(" ");
    return { above: lines.filter((l) => !l.startsWith("|")), trailing: trailing || null };
  }
  const filled = lines.filter((l) => l.trim());
  if (filled.length <= 1) return { above: [], trailing: filled[0]?.trim() || null };
  return { above: lines.slice(lines.findIndex((l) => l.trim()), lines.findLastIndex((l) => l.trim()) + 1), trailing: null };
}

const commentLine = (text: string) => (text ? `# ${text}` : "#");

/**
 * 수업 저장소 코드 모양을 내는 MicroPython 생성기.
 * - 들여쓰기 4칸, 변수 `= None` 선언 없음
 * - 준비(setup) 블록은 setupLines 에 모아 코드 맨 위(import 바로 아래)에 둔다
 * - 도우미 함수(provideFunction_) → 사용자 함수(procedures) → 본문 순서
 * - 블록 코멘트는 문장 위 `# ...` 줄과 줄 끝 `# ...` 로 (splitComment). 준비 블록은 끌어올린 첫 줄에,
 *   시작 블록 코멘트는 파일 맨 위 머리말로
 */
export class MicroPythonGenerator extends PythonGenerator {
  setupLines: string[] = [];
  /** setupLines 번호 → 그 줄 위·끝에 붙일 준비 블록 코멘트 */
  private setupComments = new Map<number, SplitComment>();
  /** 시작 블록 코멘트: 파일 맨 위(import 보다 위) 주석 줄 */
  private headerLines: string[] = [];
  /** 방금 생성한 준비 블록이 넣은(또는 이미 있던) 첫 줄 번호. scrub_ 가 코멘트를 붙이고 비운다 */
  private lastSetupLine: number | null = null;

  constructor() {
    super("MicroPython");
    this.INDENT = "    ";
    // PythonGenerator 는 max·list 같은 내장 이름까지 피해 max2 로 바꾼다. 키워드만 피한다.
    // (nameDB_ 는 첫 init() 에서 이 값으로 만들어지므로 생성자에서 바꾸면 된다)
    this.RESERVED_WORDS_ = PYTHON_KEYWORDS.join(",");
    Object.assign(this.forBlock, pythonGenerator.forBlock);
  }

  override init(workspace: Blockly.Workspace): void {
    super.init(workspace);
    delete this.definitions_["variables"];
    this.setupLines = [];
    this.setupComments.clear();
    this.headerLines = [];
    this.lastSetupLine = null;
  }

  /** 준비 블록이 부르는 함수. 같은 줄은 한 번만 넣는다. */
  addSetup(...lines: string[]): void {
    lines.forEach((line, i) => {
      let at = this.setupLines.indexOf(line);
      if (at < 0) at = this.setupLines.push(line) - 1;
      if (i === 0) this.lastSetupLine = at;
    });
  }

  // definitions_ / provideFunction_ / scrub_ 는 protected 라서 forBlock.ts 가 쓸 공개 창구를 둔다
  setDefinition(name: string, code: string): void { this.definitions_[name] = code; }
  provideHelper(name: string, lines: string[]): string { return this.provideFunction_(name, lines); }
  scrubBlock(block: Blockly.Block, code: string): string { return this.scrub_(block, code, true); }

  override finish(code: string): string {
    const helpers: string[] = [];
    const defs: string[] = [];
    for (const name of Object.keys(this.definitions_)) {
      const def = this.definitions_[name];
      if (/^(from\s+\S+\s+)?import\s+\S+/.test(def)) continue; // import 는 collectImports 가 다시 계산
      (name.startsWith("%") ? defs : helpers).push(def.replace(/\n+$/, ""));
    }
    this.isInitialized = false;
    this.nameDB_?.reset();

    const functions = [...helpers, ...defs];
    const generated = collectImports([this.setupLines.join("\n"), ...functions, code].join("\n"));
    const { imports, body: rest } = hoistImports(code, generated);
    const body = rest.replace(/\n+$/, "");
    const sections: string[] = [];
    const setup = this.setupLines.map((line, i) => {
      const c = this.setupComments.get(i);
      return c ? [...c.above.map(commentLine), c.trailing ? `${line}  # ${c.trailing}` : line].join("\n") : line;
    });
    if (setup.length) sections.push(setup.join("\n"));
    if (functions.length) sections.push(functions.join("\n\n\n"));
    if (body) sections.push(body);
    const text = sections.join(sections.length > 1 && functions.length ? "\n\n\n" : "\n\n");
    const header = this.headerLines.length ? this.headerLines.map(commentLine).join("\n") + "\n\n" : "";
    const out = header + (imports.length ? imports.join("\n") + "\n\n" : "") + text;
    return out.trim() ? out.replace(/\n*$/, "\n") : "";
  }

  override scrub_(block: Blockly.Block, code: string, thisOnly = false): string {
    const text = block.getCommentText() ?? "";
    // 시작 블록 코멘트는 파일 머리말. 줄마다 맨 위 주석 줄로 (| 표시는 뗀다)
    if (block.type === "start_program") {
      this.headerLines = text.trim() ? text.split("\n").map((l) => l.replace(/^\|/, "").replace(/\s+$/, "")) : [];
      return code;
    }
    const comment = text.trim() ? splitComment(text) : null;
    const hasComment = !!comment && (comment.above.length > 0 || comment.trailing !== null);
    const setupLine = this.lastSetupLine;
    this.lastSetupLine = null;
    // 준비 블록은 코드 대신 setupLines 에 줄을 넣으므로 코멘트도 그 첫 줄로 보낸다
    if (hasComment && !code && setupLine !== null && !this.setupComments.has(setupLine)) this.setupComments.set(setupLine, comment);
    if (hasComment && code && !block.outputConnection) {
      if (comment.trailing) {
        const nl = code.indexOf("\n");
        code = nl >= 0 ? `${code.slice(0, nl)}  # ${comment.trailing}${code.slice(nl)}` : `${code}  # ${comment.trailing}`;
      }
      // 위 주석 줄은 문장과 같은 들여쓰기로 (부모의 statementToCode 가 줄마다 들여쓴다)
      if (comment.above.length) code = comment.above.map(commentLine).join("\n") + "\n" + code;
    }
    const next = block.nextConnection?.targetBlock();
    return thisOnly || !next ? code : code + this.blockToCode(next);
  }
}
