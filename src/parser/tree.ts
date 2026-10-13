import type { SyntaxNode } from "@lezer/common";

export class Source {
  readonly text: string;
  constructor(text: string) { this.text = text; }
  slice(node: SyntaxNode): string { return this.text.slice(node.from, node.to); }
  /** 1-based 줄 번호 */
  lineOf(pos: number): number { return this.text.slice(0, pos).split("\n").length; }
  /** 복합문 전체 텍스트를 첫 줄 들여쓰기 기준으로 내어쓴다 */
  dedent(node: SyntaxNode): string {
    const lineStart = this.text.lastIndexOf("\n", node.from - 1) + 1;
    const indent = node.from - lineStart;
    return this.slice(node).split("\n").map((l, i) => (i === 0 ? l : l.slice(Math.min(indent, l.length - l.trimStart().length)))).join("\n");
  }
}

export function children(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let c = node.firstChild; c; c = c.nextSibling) out.push(c);
  return out;
}

const TOKEN_NAMES = new Set(["(", ")", ",", ":", ".", "=", "AssignOp", "ArithOp", "CompareOp", "and", "or", "not", "in", "for", "while", "if", "elif", "else", "def", "return", "import", "from", "pass", "Comment"]);

/** 토큰(괄호·쉼표·키워드·주석)을 뺀 자식 노드 */
export function operands(node: SyntaxNode): SyntaxNode[] {
  return children(node).filter((c) => !TOKEN_NAMES.has(c.name));
}

/** Body 안의 문장 노드(':' 와 주석 제외) */
export function bodyStatements(body: SyntaxNode): SyntaxNode[] {
  return children(body).filter((c) => c.name !== ":" && c.name !== "Comment");
}
