import * as Blockly from "blockly";
import { PythonGenerator, pythonGenerator } from "blockly/python";
import { collectImports } from "./imports";

/**
 * 수업 저장소 코드 모양을 내는 MicroPython 생성기.
 * - 들여쓰기 4칸, 변수 `= None` 선언 없음
 * - 준비(setup) 블록은 setupLines 에 모아 코드 맨 위(import 바로 아래)에 둔다
 * - 도우미 함수(provideFunction_) → 사용자 함수(procedures) → 본문 순서
 * - 블록 코멘트는 줄 끝 `# ...` 로 (준비 블록은 끌어올린 첫 줄 끝에)
 */
export class MicroPythonGenerator extends PythonGenerator {
  setupLines: string[] = [];
  /** setupLines 번호 → 그 줄 끝에 붙일 준비 블록 코멘트 */
  private setupComments = new Map<number, string>();
  /** 방금 생성한 준비 블록이 넣은(또는 이미 있던) 첫 줄 번호. scrub_ 가 코멘트를 붙이고 비운다 */
  private lastSetupLine: number | null = null;

  constructor() {
    super("MicroPython");
    this.INDENT = "    ";
    Object.assign(this.forBlock, pythonGenerator.forBlock);
  }

  override init(workspace: Blockly.Workspace): void {
    super.init(workspace);
    delete this.definitions_["variables"];
    this.setupLines = [];
    this.setupComments.clear();
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

    const body = code.replace(/\n+$/, "");
    const sections: string[] = [];
    const setup = this.setupLines.map((line, i) => (this.setupComments.has(i) ? `${line}  # ${this.setupComments.get(i)}` : line));
    if (setup.length) sections.push(setup.join("\n"));
    const functions = [...helpers, ...defs];
    if (functions.length) sections.push(functions.join("\n\n\n"));
    if (body) sections.push(body);
    const text = sections.join(sections.length > 1 && functions.length ? "\n\n\n" : "\n\n");
    const imports = collectImports([this.setupLines.join("\n"), ...functions, body].join("\n"));
    const out = (imports.length ? imports.join("\n") + "\n\n" : "") + text;
    return out.trim() ? out.replace(/\n*$/, "\n") : "";
  }

  override scrub_(block: Blockly.Block, code: string, thisOnly = false): string {
    // 여러 줄 코멘트는 한 줄로 합친다 (남은 줄이 코드로 읽히지 않도록)
    const comment = (block.getCommentText() ?? "").replace(/\s*\n\s*/g, " ").trim();
    const setupLine = this.lastSetupLine;
    this.lastSetupLine = null;
    // 준비 블록은 코드 대신 setupLines 에 줄을 넣으므로 코멘트도 그 첫 줄로 보낸다
    if (comment && !code && setupLine !== null && !this.setupComments.has(setupLine)) this.setupComments.set(setupLine, comment);
    if (comment && code && !block.outputConnection) {
      const nl = code.indexOf("\n");
      code = nl >= 0 ? `${code.slice(0, nl)}  # ${comment}${code.slice(nl)}` : `${code}  # ${comment}`;
    }
    const next = block.nextConnection?.targetBlock();
    return thisOnly || !next ? code : code + this.blockToCode(next);
  }
}
