import { parser } from "@lezer/python";
import type { SyntaxNode } from "@lezer/common";
import { ParseContext } from "./context";
import { allActionHelpers } from "@/devices/registry";
import { functionParts, returnsValue } from "./patterns";
import { isStandardHelper, matchSetupAt, namesDefinedBy } from "./devices";
import { escapeCommentLine, withComment } from "./builders";
import { convertStatements } from "./statements";
import { children } from "./tree";
import type { BlockJson, ParseResult, WorkspaceJson } from "./types";

export { normalizeCode } from "./normalize";
export type { BlockJson, ParseResult, UnparsedItem, WorkspaceJson } from "./types";

/**
 * 대입·매개변수로 쓰인 이름을 모두 변수로 등록하고, 함수 표를 만들고, 레지스트리의 준비 선언으로 장치 변수(ctx.devices)를 정하고,
 * 장치 블록의 짧은 도우미 중 표준 몸통으로 정의된 것(ctx.standardHelpers)을 찾는다. 도우미 def 도 함수 표에 그대로 둔다
 * (숨기지 않고 함수 정의 블록이 된다).
 */
function survey(script: SyntaxNode, ctx: ParseContext): void {
  const walk = (node: SyntaxNode) => {
    if (node.name === "AssignStatement") {
      const kids = children(node);
      if (kids[0]?.name === "VariableName" && ctx.src.slice(kids[1]) === "=") ctx.varId(ctx.src.slice(kids[0]));
    }
    if (node.name === "FunctionDefinition") functionParts(node, ctx).params.forEach((p) => ctx.varId(p));
    // for 반복 변수 (for item in items: / for x in range(…):) 도 값이 정해지는 이름
    if (node.name === "ForStatement") {
      const kids = children(node);
      if (kids[0]?.name === "for" && kids[1]?.name === "VariableName" && kids[2]?.name === "in") ctx.varId(ctx.src.slice(kids[1]));
    }
    // 부르는 함수 이름 (준비의 foldOnlyWith: flow_leds 를 부를 때만 pins = [...] 를 흐르는 LED 준비로)
    if (node.name === "CallExpression") {
      const callee = node.firstChild;
      if (callee?.name === "VariableName") ctx.calledNames.add(ctx.src.slice(callee));
    }
    for (const c of children(node)) walk(c);
  };
  walk(script);

  const top = children(script).filter((n) => n.name !== "Comment");
  // 함수 블록은 맨 바깥 def 만. 안쪽 def 는 code_stmt 로 남으니 등록하지 않는다.
  // 같은 이름의 def 가 또 나오면 뒤의 것은 code_stmt 로 남긴다 (블록 정의는 맨 위로 올라가므로 순서가 바뀌면 뜻이 바뀐다).
  // 기본값·*args·여러 값 return 이 있는 def 도 code_stmt 로 남으므로 함수 표에 올리지 않는다 (호출도 코드 블록이 된다).
  // 도우미 비교용으로 기본값·*args 가 있는 def 도 몸통을 둔다. 함수 표에는 simple 만
  const defs = new Map<string, { paramText: string; body: SyntaxNode | null }>();
  for (const node of top) {
    if (node.name !== "FunctionDefinition") continue;
    const { name, params, paramText, body, simple } = functionParts(node, ctx);
    if (defs.has(name)) { ctx.duplicateDefs.add(node.from); continue; }
    defs.set(name, { paramText, body });
    ctx.calledNames.add(name);
    if (simple) ctx.functions.set(name, { params, returns: returnsValue(body) });
  }
  // 장치 블록이 부르는 짧은 도우미(get_distance·show …) 중 표준 몸통의 최상위 def 로 있는 것: 그 호출이 장치 블록으로 돌아온다
  for (const h of allActionHelpers()) if (ctx.functions.has(h.name) && isStandardHelper(h, defs.get(h.name), ctx)) ctx.standardHelpers.add(h.name);

  // 문장 변환과 같은 순서로 준비 줄을 접어 보며 장치 변수를 미리 등록한다 (몸통 안의 메서드 호출이 쓴다)
  const texts = top.map((n) => ctx.src.slice(n).trim());
  for (let i = 0; i < texts.length; ) {
    const m = matchSetupAt(texts, i, ctx);
    if (!m) { i++; continue; }
    ctx.registerDevice(m.vars, m.spec.device.id, m.spec.kind);
    i += m.consumed;
  }

  // 제자리 준비(esp_pin_setup_var)는 몸통 안에도 있으므로 모든 문장을 보며 그 줄이 만드는 이름을 장치 변수로 등록한다
  // (반복 안의 led = Pin(pin, Pin.OUT) 뒤 led.value(1) 이 핀 켜기 블록이 되게)
  const visit = (node: SyntaxNode) => {
    if (node.name === "AssignStatement") {
      const text = ctx.src.slice(node).trim();
      const m = matchSetupAt([text], 0, ctx, true);
      if (m) ctx.registerDevice(m.vars, m.spec.device.id, m.spec.kind);
      // 학생 변수에 값을 정하는 명령(요청 받기의 conn·path·query): 접히든 코드로 남든 그 이름은 값이 정해진 변수다
      for (const name of namesDefinedBy(text)) if (!ctx.devices.has(name)) ctx.varId(name);
    }
    for (const c of children(node)) visit(c);
  };
  visit(script);
}

/** 앞에 코드 없이 주석만 있는 줄들 (위치 순). `#` 와 그 뒤 공백 하나, 끝 공백을 뗀 글 */
function commentOnlyLines(script: SyntaxNode, ctx: ParseContext): { from: number; text: string }[] {
  const out: { from: number; text: string }[] = [];
  script.toTree().iterate({
    enter(n) {
      if (n.name !== "Comment") return;
      const lineStart = ctx.src.text.lastIndexOf("\n", n.from - 1) + 1;
      if (ctx.src.text.slice(lineStart, n.from).trim()) return;
      out.push({ from: n.from, text: ctx.src.text.slice(n.from, n.to).replace(/^#\s?/, "").replace(/\s+$/, "") });
    },
  });
  return out;
}

/** 블록이 실제로 가리키는 변수 id: `{ id }` 꼴 필드 값과 함수 정의의 매개변수 id */
function usedVariableIds(roots: BlockJson[]): Set<string> {
  const ids = new Set<string>();
  const visit = (b: BlockJson | undefined): void => {
    if (!b) return;
    for (const v of Object.values(b.fields ?? {})) {
      if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") ids.add((v as { id: string }).id);
    }
    const params = (b.extraState as { params?: unknown } | undefined)?.params;
    if (Array.isArray(params)) for (const p of params) if (p && typeof p === "object" && typeof p.id === "string") ids.add(p.id);
    for (const input of Object.values(b.inputs ?? {})) { visit(input.block); visit(input.shadow); }
    visit(b.next?.block);
  };
  roots.forEach(visit);
  return ids;
}

export function codeToBlocks(code: string): ParseResult {
  const tree = parser.parse(code);
  const ctx = new ParseContext(code);

  let errorAt = -1;
  tree.iterate({ enter(n) { if (errorAt < 0 && n.type.isError) { errorAt = n.from; } } });
  if (errorAt >= 0) return { ok: false, error: { line: ctx.src.lineOf(errorAt), message: "문법 오류가 있어요. 이 줄을 다시 읽어 보세요." } };

  const script = tree.topNode;
  survey(script, ctx);
  ctx.setCommentLines(commentOnlyLines(script, ctx));
  const { blocks, tops } = convertStatements(children(script), ctx, true);

  const start: BlockJson = withComment({ type: "start_program", x: 40, y: 40 }, ctx.header.length ? ctx.header.map(escapeCommentLine).join("\n") : null);
  if (blocks.length) {
    for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
    start.inputs = { BODY: { block: blocks[0] } };
  }
  // 함수 블록은 시작 블록 오른쪽에 나란히 (아래로 쌓으면 긴 프로그램과 겹친다)
  tops.forEach((t, i) => { t.x = 40 + 520 * (i + 1); t.y = 40; });

  // 접힌 함수 몸통이나 접힌 준비 줄에서만 쓰인 이름은 변수 목록에 남기지 않는다
  const used = usedVariableIds([...tops, start]);
  const json = {
    variables: [...ctx.variables.entries()].filter(([, id]) => used.has(id)).map(([name, id]) => ({ name, id })),
    blocks: { languageVersion: 0, blocks: [...tops, start] },
  } as unknown as WorkspaceJson;
  return { ok: true, json, unparsed: ctx.unparsed };
}
