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
  ultrasonicFolded = false;
  oledFolded = false;
  echoPin = 12;

  constructor(text: string) { this.src = new Source(text); }

  varId(name: string): string {
    if (!this.variables.has(name)) this.variables.set(name, `var_${name}`);
    return this.variables.get(name)!;
  }
  hasVar(name: string): boolean { return this.variables.has(name); }

  markUnparsed(node: SyntaxNode, text = this.src.slice(node)): void {
    this.unparsed.push({ line: this.src.lineOf(node.from), text });
  }
}
