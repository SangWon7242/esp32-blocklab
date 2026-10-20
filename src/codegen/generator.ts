import * as Blockly from "blockly";
import { PythonGenerator, pythonGenerator } from "blockly/python";
import { PYTHON_KEYWORDS } from "@/blocks/names";
import { HELPER_MARK } from "@/devices/specs/common";
import { collectImports, hoistImports } from "./imports";
import { buildLineMap, countLines, emptyLineMap, isMarksOnly, leadingMarkLength, marksToTags, shiftLineMap, STATEMENT_MARK, stripTags, tagLine, tagLines, type LineMap } from "./linemap";

type SplitComment = { above: string[]; trailing: string | null };

/** 파서가 `|` 로 시작하는 원문 윗줄 앞에 붙인 역슬래시 (`\|`, `\\|` …). 하나를 떼면 원문이 된다 */
const ESCAPED_PIPE = /^\\+\|/;
const unescapeLine = (line: string) => (ESCAPED_PIPE.test(line) ? line.slice(1) : line);

/**
 * 블록 코멘트를 문장 위 주석 줄(above)과 줄 끝 주석(trailing)으로 나눈다.
 * - `|` 로 시작하는 줄이 하나라도 있으면(파서가 만든 꼴): `|` 줄은 줄 끝 주석, 나머지는 위 주석 줄.
 *   `|` 뒤가 비었으면 줄 끝 주석 없음 (위 주석 한 줄만 있던 문장).
 * - 아니면(작업판에서 친 코멘트): 한 줄이면 줄 끝 주석, 여러 줄이면 모두 위 주석 줄.
 * - `\|` 로 시작하는 줄은 `|` 로 시작하는 위 주석 줄 (파서 escapeCommentLine 과 짝). 역슬래시 하나를 뗀다.
 */
export function splitComment(text: string): SplitComment {
  const lines = text.split("\n").map((l) => l.replace(/\s+$/, ""));
  if (lines.some((l) => l.startsWith("|"))) {
    const trailing = lines.filter((l) => l.startsWith("|")).map((l) => l.slice(1).trim()).filter(Boolean).join(" ");
    return { above: lines.filter((l) => !l.startsWith("|")).map(unescapeLine), trailing: trailing || null };
  }
  const filled = lines.filter((l) => l.trim());
  if (filled.length <= 1 && !ESCAPED_PIPE.test(filled[0] ?? "")) return { above: [], trailing: filled[0]?.trim() || null };
  return { above: lines.slice(lines.findIndex((l) => l.trim()), lines.findLastIndex((l) => l.trim()) + 1).map(unescapeLine), trailing: null };
}

const commentLine = (text: string) => (text ? `# ${text}` : "#");

/** 도우미 호출 표시 (HELPER_MARK 로 싼 이름). helperCall 이 붙이고 finish 가 지운다 */
const HELPER_CALL = new RegExp(`${HELPER_MARK}(\\w+)${HELPER_MARK}`, "g");

/**
 * 수업 저장소 코드 모양을 내는 MicroPython 생성기.
 * - 들여쓰기 4칸, 변수 `= None` 선언 없음
 * - 준비(setup) 블록은 setupLines 에 모아 코드 맨 위(import 바로 아래)에 둔다
 * - 도우미 함수(provideFunction_, 같은 이름의 사용자 함수 블록이 없을 때만) → 사용자 함수(procedures) → 본문 순서
 * - 블록 코멘트는 문장 위 `# ...` 줄과 줄 끝 `# ...` 로 (splitComment). 준비 블록은 끌어올린 첫 줄에,
 *   시작 블록 코멘트는 파일 맨 위 머리말로
 */
export class MicroPythonGenerator extends PythonGenerator {
  setupLines: string[] = [];
  /** setupLines 중 도우미를 부르는 준비 줄 번호 (SetupSpec.afterHelpers). finish 가 함수 정의 뒤, 본문 앞에 둔다 */
  private lateSetup = new Set<number>();
  /** setupLines 번호 → 그 줄 위·끝에 붙일 준비 블록 코멘트 */
  private setupComments = new Map<number, SplitComment>();
  /** 시작 블록 코멘트: 파일 맨 위(import 보다 위) 주석 줄 */
  private headerLines: string[] = [];
  /** 방금 생성한 준비 블록이 넣은(또는 이미 있던) 첫 줄 번호. scrub_ 가 코멘트를 붙이고 비운다 */
  private lastSetupLine: number | null = null;

  /**
   * 코드 지도 모드. 켜면 명령 블록 코드 앞에 블록 id 표식 줄(STATEMENT_PREFIX)을 넣고, finish 가 표식을 걷어 내며
   * 지도(lastMap)를 만든다. 내놓는 코드는 꺼졌을 때와 같은 글자열이다. workspaceToCodeWithMap 만 켠다.
   */
  withMap = false;
  /** 마지막 workspaceToCode 의 코드 지도 (withMap 일 때만) */
  lastMap: LineMap | null = null;
  /** finish 가 만든 코드와 지도. workspaceToCode 가 마지막 공백 다듬기에 맞춰 줄 번호를 고친다 */
  private finished: { code: string; map: LineMap } | null = null;
  /** 준비 줄 장부: setupLines 번호 → 그 줄을 낸 준비 블록 id 들 */
  private setupOwners: string[][] = [];
  /** 도우미 장부: provideHelper 이름 → 그 도우미를 준비한 블록 id 들 */
  private helperOwners = new Map<string, string[]>();

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
    this.lateSetup.clear();
    this.setupComments.clear();
    this.headerLines = [];
    this.lastSetupLine = null;
    this.STATEMENT_PREFIX = this.withMap ? STATEMENT_MARK : null;
    this.lastMap = null;
    this.finished = null;
    this.setupOwners = [];
    this.helperOwners.clear();
  }

  /** 준비 블록이 부르는 함수. 같은 줄은 한 번만 넣는다. 넣은(또는 이미 있던) 줄 번호들을 돌려준다 */
  addSetup(...lines: string[]): number[] {
    return lines.map((line, i) => {
      let at = this.setupLines.indexOf(line);
      if (at < 0) at = this.setupLines.push(line) - 1;
      if (i === 0) this.lastSetupLine = at;
      return at;
    });
  }

  /** 이 준비 줄들(addSetup 이 돌려준 번호)은 도우미를 부르므로 함수 정의 뒤에 둔다 */
  markLateSetup(indices: number[]): void {
    for (const i of indices) this.lateSetup.add(i);
  }

  /** 준비 줄 번호들을 [맨 위에 둘 것, 함수 정의 뒤에 둘 것] 으로 */
  private splitSetup(): [number[], number[]] {
    const all = this.setupLines.map((_, i) => i);
    return [all.filter((i) => !this.lateSetup.has(i)), all.filter((i) => this.lateSetup.has(i))];
  }

  /** 준비 블록 장부: 이 블록이 낸 준비 줄들 (addSetup 이 돌려준 번호) */
  noteSetupBlock(blockId: string, indices: number[]): void {
    for (const i of indices) {
      const owners = (this.setupOwners[i] ??= []);
      if (!owners.includes(blockId)) owners.push(blockId);
    }
  }
  /** 도우미 장부: 이 준비 블록이 provideHelper(name) 를 불렀다 */
  noteHelperOwner(name: string, blockId: string): void {
    const owners = this.helperOwners.get(name) ?? [];
    if (!owners.includes(blockId)) this.helperOwners.set(name, [...owners, blockId]);
  }
  /**
   * 블록 표식 줄 (지도 모드가 아니면 ""). 스스로 코드를 definitions_ 에 넣는 함수 정의 블록은 Blockly 가 표식을 붙이지
   * 않으므로 직접 넣는다. indent 는 그 표식이 열 구역의 들여쓰기 (return 줄처럼 몸통 블록 뒤에 오는 줄).
   */
  markFor(block: Blockly.Block, indent = ""): string {
    return this.withMap && this.STATEMENT_PREFIX ? indent + this.injectId(this.STATEMENT_PREFIX, block) : "";
  }

  /** 작업판 → 코드와 코드 지도. 코드는 workspaceToCode 와 같은 글자열 */
  workspaceToCodeWithMap(workspace: Blockly.Workspace): { code: string; map: LineMap } {
    this.withMap = true;
    try {
      const code = this.workspaceToCode(workspace);
      return { code, map: this.lastMap ?? emptyLineMap() };
    } finally {
      this.withMap = false;
      this.STATEMENT_PREFIX = null;
    }
  }

  override workspaceToCode(workspace?: Blockly.Workspace): string {
    const code = super.workspaceToCode(workspace);
    if (this.withMap && this.finished) {
      // CodeGenerator 가 finish 뒤에 맨 앞 빈 줄·맨 끝 공백 줄을 지운다. 지운 만큼 줄 번호를 옮긴다
      const leading = /^\s+\n/.exec(this.finished.code)?.[0].split("\n").length ?? 1;
      this.lastMap = shiftLineMap(this.finished.map, -(leading - 1), countLines(code));
    }
    this.finished = null;
    return code;
  }

  /**
   * 내용 없이 표식만 남은 명령 블록 코드(준비 블록·빈 시작 블록)는 "" 로 돌려준다. 표식이 있다고 빈 몸통이 비지 않은
   * 것으로 보이면 `|| PASS` 가 빠지고, 최상위 블록 사이 빈 줄 수가 달라진다 (표식 없는 코드와 글자 하나까지 같아야 한다).
   * 준비 블록의 줄은 장부로 지도에 넣으므로 표식이 필요 없다.
   */
  override blockToCode(block: Blockly.Block | null, opt_thisOnly?: boolean): string | [string, number] {
    const code = super.blockToCode(block, opt_thisOnly);
    return this.withMap && typeof code === "string" && isMarksOnly(code) ? "" : code;
  }

  /** 내장 반복 블록이 몸통 끝에 넣는 반복 블록 표식은 빼다 (빈 몸통의 pass 가 빠지고, 몸통 마지막 줄이 반복 블록 것이 된다) */
  override addLoopTrap(branch: string, block: Blockly.Block): string {
    const prefix = this.STATEMENT_PREFIX;
    this.STATEMENT_PREFIX = null;
    try {
      return super.addLoopTrap(branch, block);
    } finally {
      this.STATEMENT_PREFIX = prefix;
    }
  }

  /**
   * 사용자 함수 이름은 그대로 쓴다 (키워드·파이썬 이름이 아닌 글만 Blockly 처럼 바꾼다). Blockly 는 변수와 함수 이름이 겹치면 함수를
   * stop2 처럼 바꾸는데, 수업 코드는 get_distance 안의 지역 변수 stop 과 모터 함수 stop() 을 함께 쓴다 (31장 안전 선풍기).
   * 도우미는 같은 이름의 함수 블록이 있으면 만들지 않으므로(toCodegen.ts) 도우미와도 겹치지 않는다.
   */
  override getProcedureName(name: string): string {
    return /^[A-Za-z_]\w*$/.test(name) && !PYTHON_KEYWORDS.includes(name) ? name : super.getProcedureName(name);
  }

  // definitions_ / provideFunction_ / scrub_ 는 protected 라서 forBlock.ts 가 쓸 공개 창구를 둔다
  setDefinition(name: string, code: string): void { this.definitions_[name] = code; }
  provideHelper(name: string, lines: string[]): string { return this.provideFunction_(name, lines); }
  /**
   * 장치 도우미를 부르는 코드에 쓸 이름 자리. provideFunction_ 은 학생 변수(또는 꺼 둔 같은 이름의 함수 블록)와 겹치면 도우미를
   * stop2 처럼 다른 이름으로 정의하는데, 그 이름은 그 도우미를 처음 부르는 블록을 만들 때에야 정해진다 (함수 정의 안의 블록이
   * 먼저 만들어질 수 있다). 그래서 표시만 남겨 두고 finish 가 실제로 정의된 이름(functionNames_)으로 바꾼다.
   * 정의되지 않았으면(같은 이름의 학생 함수 블록이 도우미일 때) 원래 이름.
   */
  helperCall(name: string): string { return `${HELPER_MARK}${name}${HELPER_MARK}`; }
  private resolveHelperCalls(text: string): string {
    return text.replace(HELPER_CALL, (_, name: string) => this.functionNames_[name] ?? name);
  }
  scrubBlock(block: Blockly.Block, code: string): string { return this.scrub_(block, code, true); }

  /**
   * 블록 하나(뒤에 이어진 블록은 빼고, 몸통 안 블록은 넣어)가 내는 코드. 블록 사전·블록 설명 팝업용.
   * 준비 블록이 모은 준비 줄과 도우미·사용자 함수 정의도 그 블록이 낸 것이므로 앞에 붙인다 (finish 와 같은 순서:
   * 준비 줄 → 도우미 함수 → 사용자 함수 → 블록 코드). import 는 넣지 않는다. 값 블록이면 식 하나.
   * 도우미 호출 표시는 finish 와 같이 정의된 이름으로 바꾼다. 지도 모드가 아닐 때만 부른다 (표식 줄이 없다).
   */
  blockSnippet(block: Blockly.Block): string {
    this.init(block.workspace);
    try {
      const out = this.blockToCode(block, true);
      const code = (Array.isArray(out) ? out[0] : out).replace(/\n+$/, "");
      const helpers: string[] = [];
      const defs: string[] = [];
      for (const [name, def] of Object.entries(this.definitions_)) {
        if (/^(from\s+\S+\s+)?import\s+\S+/.test(def)) continue;
        (name.startsWith("%") ? defs : helpers).push(def.replace(/\n+$/, ""));
      }
      const [early, late] = this.splitSetup().map((ix) => ix.map((i) => this.setupLines[i]).join("\n"));
      const sections = [early, ...helpers, ...defs, late, code].filter((s) => s.trim());
      return this.resolveHelperCalls(sections.join("\n\n"));
    } finally {
      this.isInitialized = false;
      this.nameDB_?.reset();
    }
  }

  override finish(code: string): string {
    const mapped = this.withMap;
    // 지도 모드: 표식 줄을 줄 끝 꼬리표로 바꾼다. 꼬리표는 줄과 함께 움직이므로 아래 조립(import 끌어올리기, 빈 줄 다듬기)이
    // 꺼졌을 때와 똑같이 돌고, 맨 끝에 buildLineMap 이 걷어 낸다. 꼬리표가 import 계산에 끼지 않게 stripTags 로 본다.
    code = this.resolveHelperCalls(code);
    if (mapped) code = marksToTags(code);
    const helpers: string[] = [];
    const defs: string[] = [];
    for (const name of Object.keys(this.definitions_)) {
      let def = this.resolveHelperCalls(this.definitions_[name]);
      if (/^(from\s+\S+\s+)?import\s+\S+/.test(def)) continue; // import 는 collectImports 가 다시 계산
      // 사용자 함수는 defGenerator 가 넣은 표식으로, 도우미 함수는 그것을 준비한 블록 장부로
      if (mapped) def = name.startsWith("%") ? marksToTags(def) : tagLines(def, this.helperOwners.get(name) ?? []);
      (name.startsWith("%") ? defs : helpers).push(def.replace(/\n+$/, ""));
    }
    this.isInitialized = false;
    this.nameDB_?.reset();

    const functions = [...helpers, ...defs];
    const setupText = this.setupLines.map((line) => this.resolveHelperCalls(line));
    const generated = collectImports(stripTags([setupText.join("\n"), ...functions, code].join("\n")));
    const { imports, body: rest } = hoistImports(code, generated, stripTags);
    const body = rest.replace(/\n+$/, "");
    const sections: string[] = [];
    const setupLine = (i: number) => {
      const line = setupText[i];
      const tag = (l: string) => (mapped ? tagLine(l, this.setupOwners[i] ?? []) : l);
      const c = this.setupComments.get(i);
      return c ? [...c.above.map(commentLine), c.trailing ? `${line}  # ${c.trailing}` : line].map(tag).join("\n") : tag(line);
    };
    const [early, late] = this.splitSetup().map((ix) => ix.map(setupLine));
    if (early.length) sections.push(early.join("\n"));
    if (functions.length) sections.push(functions.join("\n\n\n"));
    // 도우미를 부르는 준비 줄(ip = wifi_connect(…))은 함수 정의 뒤, 본문 바로 위 (빈 줄 하나를 두고 본문)
    const lateText = late.join("\n");
    if (lateText && body) sections.push(`${lateText}\n\n${body}`);
    else if (lateText || body) sections.push(lateText || body);
    const text = sections.join(sections.length > 1 && functions.length ? "\n\n\n" : "\n\n");
    const header = this.headerLines.length ? this.headerLines.map(commentLine).join("\n") + "\n\n" : "";
    const out = header + (imports.length ? imports.join("\n") + "\n\n" : "") + text;
    const final = out.trim() ? out.replace(/\n*$/, "\n") : "";
    if (!mapped) return final;
    this.finished = buildLineMap(final);
    return this.finished.code;
  }

  override scrub_(block: Blockly.Block, code: string, thisOnly = false): string {
    const text = block.getCommentText() ?? "";
    // 시작 블록 코멘트는 파일 머리말. 줄마다 맨 위 주석 줄로 (| 표시는 떼고, \| 는 | 로 되돌린다)
    if (block.type === "start_program") {
      this.headerLines = text.trim() ? text.split("\n").map((l) => (ESCAPED_PIPE.test(l) ? l.slice(1) : l.replace(/^\|/, "")).replace(/\s+$/, "")) : [];
      return code;
    }
    // 지도 모드의 표식 줄은 떼어 두고 문장 코드만 다룬다: 표식 → 위 주석 줄 → 문장(줄 끝 주석) 순서가 되어 주석 줄도 그 블록 것이 된다
    const markLength = this.withMap ? leadingMarkLength(code) : 0;
    const mark = code.slice(0, markLength);
    code = code.slice(markLength);
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
    code = mark + code;
    const next = block.nextConnection?.targetBlock();
    return thisOnly || !next ? code : code + this.blockToCode(next);
  }
}
