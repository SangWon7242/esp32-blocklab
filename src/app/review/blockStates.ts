import type { BlockJson } from "@/parser/types";

/*
 * 저장된 작업판 JSON 을 "블록 하나씩 그리는" 꼴로. renderBlockSvg 는 블록 하나의 직렬화 JSON 을 받으므로
 * 맨 위 블록들을 꺼내고, 변수 칸({id} 만 적힌 것 — codeToBlocks 가 내는 꼴)에 작업판 변수 표의 이름을 채운다
 * (숨긴 작업판에는 그 변수가 없어 이름이 있어야 그릴 수 있다). Blockly 없이 JSON 만 다룬다.
 */

type Variable = { id?: string; name?: string; type?: string };

/** 작업판 JSON({blocks:{blocks}}), 블록 배열, 블록 하나 중 무엇이든 맨 위 블록 목록으로 */
export function topBlocks(json: unknown): BlockJson[] {
  if (!json || typeof json !== "object") return [];
  if (Array.isArray(json)) return json.filter(isBlock);
  const ws = (json as { blocks?: { blocks?: unknown } }).blocks;
  if (ws && Array.isArray(ws.blocks)) return ws.blocks.filter(isBlock);
  return isBlock(json) ? [json] : [];
}

const isBlock = (b: unknown): b is BlockJson => !!b && typeof b === "object" && typeof (b as BlockJson).type === "string";

/** 작업판 변수 표 (id → {name, type}) */
function variableTable(json: unknown): Map<string, Variable> {
  const map = new Map<string, Variable>();
  const vars = (json as { variables?: unknown } | null)?.variables;
  if (Array.isArray(vars)) for (const v of vars as Variable[]) if (v?.id) map.set(v.id, v);
  return map;
}

/** 변수 칸 값이 {id} 만이면 이름·종류를 채운다. 이름을 모르면 그대로 둔다 */
function fillVariable(value: unknown, vars: ReadonlyMap<string, Variable>): unknown {
  if (!value || typeof value !== "object") return value;
  const v = value as Variable;
  if (v.name !== undefined || v.id === undefined) return value;
  const found = vars.get(v.id);
  return found?.name !== undefined ? { id: v.id, name: found.name, type: found.type ?? "" } : value;
}

function fillBlock(block: BlockJson, vars: ReadonlyMap<string, Variable>): BlockJson {
  const out: BlockJson = { ...block };
  if (block.fields) out.fields = Object.fromEntries(Object.entries(block.fields).map(([k, v]) => [k, fillVariable(v, vars)]));
  if (block.inputs) {
    out.inputs = Object.fromEntries(Object.entries(block.inputs).map(([name, input]) => [name, {
      ...(input.block ? { block: fillBlock(input.block, vars) } : {}),
      ...(input.shadow ? { shadow: fillBlock(input.shadow, vars) } : {}),
    }]));
  }
  if (block.next?.block) out.next = { block: fillBlock(block.next.block, vars) };
  return out;
}

/** 그릴 맨 위 블록들 (변수 이름을 채운 복사본). 비어 있으면 [] */
export function topBlockStates(blocksJson: unknown): BlockJson[] {
  const vars = variableTable(blocksJson);
  return topBlocks(blocksJson).map((b) => fillBlock(b, vars));
}
