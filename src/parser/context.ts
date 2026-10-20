import type { SyntaxNode } from "@lezer/common";
import { Source } from "./tree";
import type { UnparsedItem } from "./types";

export type FunctionInfo = { params: string[]; returns: boolean };

/** 한 번 파싱하는 동안의 상태: 변수·장치·함수 표와 접기 여부 */
export class ParseContext {
  /** 지금 노드 위치가 가리키는 글. 접힌 명령의 값 조각을 다시 파싱하는 동안(withSource)만 바뀐다 */
  src: Source;
  readonly variables = new Map<string, string>();
  /** 장치 변수 이름 → 어느 장치의 어떤 종류인지 (메서드 패턴이 objKind 로 맞춘다) */
  readonly devices = new Map<string, { deviceId: string; kind: string }>();
  /**
   * 장치 블록의 짧은 도우미(ActionSpec.helpers) 중 코드에 같은 이름·매개변수·표준 몸통의 최상위 def 가 있는 이름.
   * 그 도우미를 부르는 장치 블록의 호출 꼴이 켜진다 (def 는 숨기지 않고 함수 정의 블록이 된다)
   */
  readonly standardHelpers = new Set<string>();
  /** 코드의 최상위 def 이름과 어디서든 `name(…)` 으로 부르는 이름. 준비의 foldOnlyWith 가 본다 */
  readonly calledNames = new Set<string>();
  /** 코드에 이름(VariableName)이 나온 횟수. 준비 줄의 대입 한 번뿐이면 그 이름은 다른 데서 쓰이지 않는다 (foldOnlyWith) */
  readonly nameCounts = new Map<string, number>();
  readonly functions = new Map<string, FunctionInfo>();
  readonly unparsed: UnparsedItem[] = [];
  /** 같은 이름이 앞에 이미 있는 맨 바깥 def 의 시작 위치. code_stmt 로 남긴다 */
  readonly duplicateDefs = new Set<number>();
  /** 파일 머리말: 첫 문장이 import 일 때 그 위 주석 줄. 시작 블록 코멘트가 된다 */
  readonly header: string[] = [];
  /** 주석만 있는 줄들(위치 순). takeLeading 이 앞에서부터 하나씩 가져간다 */
  private commentLines: { from: number; text: string }[] = [];
  private commentIndex = 0;
  /** withSource 동안 조각의 1번 줄이 원문의 몇 번째 줄 다음인지 */
  private lineBase = 0;

  constructor(text: string) { this.src = new Source(text); }

  varId(name: string): string {
    if (!this.variables.has(name)) this.variables.set(name, `var_${name}`);
    return this.variables.get(name)!;
  }
  hasVar(name: string): boolean { return this.variables.has(name); }

  registerDevice(names: string[], deviceId: string, kind: string): void {
    for (const n of names) { this.devices.set(n, { deviceId, kind }); this.varId(n); }
  }

  /** text 를 지금 글로 삼아 fn 을 부른다. 그 안의 markUnparsed 는 원문 line 번째 줄을 가리킨다 */
  withSource<T>(text: string, line: number, fn: () => T): T {
    const [src, base] = [this.src, this.lineBase];
    this.src = new Source(text);
    this.lineBase = base + line - 1;
    try { return fn(); } finally { this.src = src; this.lineBase = base; }
  }

  /** 주석만 있는 줄을 등록한다 (`#` 와 그 뒤 공백 하나를 뗀 내용) */
  setCommentLines(lines: { from: number; text: string }[]): void {
    this.commentLines = lines;
    this.commentIndex = 0;
  }

  /** 아직 아무 문장도 가져가지 않은, pos 앞의 주석 줄들. 문장을 위에서부터 차례로 바꾸며 부른다 */
  takeLeading(pos: number): string[] {
    const out: string[] = [];
    while (this.commentIndex < this.commentLines.length && this.commentLines[this.commentIndex].from < pos) out.push(this.commentLines[this.commentIndex++].text);
    return out;
  }

  /** pos 앞의 주석 줄을 버린다 (code_stmt 원문에 이미 들었거나, 접혀서 다시 만들어지는 문장 안의 주석) */
  skipComments(pos: number): void {
    this.takeLeading(pos);
  }

  markUnparsed(node: SyntaxNode, text = this.src.slice(node)): void {
    this.unparsed.push({ line: this.lineBase + this.src.lineOf(node.from), text });
  }
}
