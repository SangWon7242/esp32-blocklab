import type { SyntaxNode } from "@lezer/common";
import { Source } from "./tree";
import type { UnparsedItem } from "./types";

export type FunctionInfo = { params: string[]; returns: boolean };

/** 한 번 파싱하는 동안의 상태: 변수·핀·PWM·함수 표와 접기 여부 */
export class ParseContext {
  readonly src: Source;
  readonly variables = new Map<string, string>();
  readonly pins = new Set<string>();
  readonly pwms = new Set<string>();
  readonly servos = new Set<string>();
  readonly functions = new Map<string, FunctionInfo>();
  readonly unparsed: UnparsedItem[] = [];
  /** 같은 이름이 앞에 이미 있는 맨 바깥 def 의 시작 위치. code_stmt 로 남긴다 */
  readonly duplicateDefs = new Set<number>();
  /** 파일 머리말: 첫 문장이 import 일 때 그 위 주석 줄. 시작 블록 코멘트가 된다 */
  readonly header: string[] = [];
  /** 주석만 있는 줄들(위치 순). takeLeading 이 앞에서부터 하나씩 가져간다 */
  private commentLines: { from: number; text: string }[] = [];
  private commentIndex = 0;
  ultrasonicFolded = false;
  oledFolded = false;
  echoPin = 12;

  constructor(text: string) { this.src = new Source(text); }

  varId(name: string): string {
    if (!this.variables.has(name)) this.variables.set(name, `var_${name}`);
    return this.variables.get(name)!;
  }
  hasVar(name: string): boolean { return this.variables.has(name); }

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
    this.unparsed.push({ line: this.src.lineOf(node.from), text });
  }
}
