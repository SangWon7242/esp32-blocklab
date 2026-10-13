import { parser } from "@lezer/python";
import type { SyntaxNode } from "@lezer/common";
import { ParseContext } from "./context";
import { RE_I2C_SETUP, RE_OLED_SETUP, RE_PIN_SETUP, RE_PWM_SETUP, RE_FREQ, RE_DUTY, STANDARD_GET_DISTANCE, STANDARD_SHOW, functionParts, isStandardBody } from "./patterns";
import { convertStatements } from "./statements";
import { children } from "./tree";
import type { BlockJson, ParseResult, WorkspaceJson } from "./types";

export { normalizeCode } from "./normalize";
export type { BlockJson, ParseResult, UnparsedItem, WorkspaceJson } from "./types";

/** 대입·매개변수로 쓰인 이름을 모두 변수로 등록하고, 핀·PWM·함수 표와 접기 여부를 정한다 */
function survey(script: SyntaxNode, ctx: ParseContext): void {
  const walk = (node: SyntaxNode) => {
    if (node.name === "AssignStatement") {
      const kids = children(node);
      if (kids[0]?.name === "VariableName" && ctx.src.slice(kids[1]) === "=") ctx.varId(ctx.src.slice(kids[0]));
    }
    if (node.name === "FunctionDefinition") {
      const { name, params, body } = functionParts(node, ctx);
      params.forEach((p) => ctx.varId(p));
      const stmts = body ? children(body).filter((k) => k.name !== ":" && k.name !== "Comment") : [];
      ctx.functions.set(name, { params, returns: stmts[stmts.length - 1]?.name === "ReturnStatement" });
    }
    for (const c of children(node)) walk(c);
  };
  walk(script);

  const top = children(script).filter((n) => n.name !== "Comment");
  const texts = top.map((n) => ctx.src.slice(n).trim());
  let hasTrig = false, hasEcho = false, hasI2c = false, hasOled = false, stdDistance = false, stdShow = false;
  top.forEach((node, i) => {
    const pin = RE_PIN_SETUP.exec(texts[i]);
    if (pin) {
      ctx.pins.add(pin[1]);
      if (pin[1] === "trig" && pin[3] === "OUT") hasTrig = true;
      if (pin[1] === "echo" && pin[3] === "IN") { hasEcho = true; ctx.echoPin = Number(pin[2]); }
    }
    const pwm = RE_PWM_SETUP.exec(texts[i]);
    if (pwm) {
      const freq = RE_FREQ.exec(texts[i + 1] ?? "");
      const duty = RE_DUTY.exec(texts[i + 2] ?? "");
      if (freq?.[1] === pwm[1] && freq[2] === "50" && duty?.[1] === pwm[1] && duty[2] === "1638") ctx.servos.add(pwm[1]);
      else ctx.pwms.add(pwm[1]);
    }
    if (RE_I2C_SETUP.test(texts[i])) hasI2c = true;
    if (RE_OLED_SETUP.test(texts[i])) hasOled = true;
    if (node.name === "FunctionDefinition") {
      const { name, params, body } = functionParts(node, ctx);
      if (name === "get_distance" && params.length === 0 && body && isStandardBody(body, ctx, STANDARD_GET_DISTANCE)) stdDistance = true;
      if (name === "show" && params.join(",") === "a,b" && body && isStandardBody(body, ctx, STANDARD_SHOW)) stdShow = true;
    }
  });
  ctx.ultrasonicFolded = hasTrig && hasEcho && stdDistance;
  ctx.oledFolded = hasI2c && hasOled && stdShow;
  if (ctx.ultrasonicFolded) ctx.functions.delete("get_distance");
  if (ctx.oledFolded) ctx.functions.delete("show");
}

export function codeToBlocks(code: string): ParseResult {
  const tree = parser.parse(code);
  const ctx = new ParseContext(code);

  let errorAt = -1;
  tree.iterate({ enter(n) { if (errorAt < 0 && n.type.isError) { errorAt = n.from; } } });
  if (errorAt >= 0) return { ok: false, error: { line: ctx.src.lineOf(errorAt), message: "문법 오류가 있어요. 이 줄을 다시 읽어 보세요." } };

  const script = tree.topNode;
  survey(script, ctx);
  const { blocks, tops } = convertStatements(children(script), ctx, true);

  const start: BlockJson = { type: "start_program", x: 40, y: 40 };
  if (blocks.length) {
    for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
    start.inputs = { BODY: { block: blocks[0] } };
  }
  tops.forEach((t, i) => { t.x = 40; t.y = 40 + 400 * (i + 1); });

  const json = {
    variables: [...ctx.variables.entries()].map(([name, id]) => ({ name, id })),
    blocks: { languageVersion: 0, blocks: [...tops, start] },
  } as unknown as WorkspaceJson;
  return { ok: true, json, unparsed: ctx.unparsed };
}
