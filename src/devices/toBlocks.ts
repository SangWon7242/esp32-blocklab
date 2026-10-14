import { DEVICES, DEVICE_CATEGORIES } from "./registry";
import type { DeviceSpec, Part } from "./types";

/** 정의되지 않은 키를 뺀다 (블록 JSON 을 손으로 쓴 것과 같게) */
const defined = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function arg(p: Part): Record<string, unknown> {
  switch (p.kind) {
    case "pin": return { type: "field_number", name: p.name, value: p.default, min: 0, max: 39, precision: 1 };
    case "var": return { type: "field_variable", name: p.name, variable: p.default };
    case "number": return defined({ type: "field_number", name: p.name, value: p.default, min: p.min, max: p.max, precision: p.precision ?? 1 });
    case "dropdown": return { type: "field_dropdown", name: p.name, options: p.options };
    case "text": return { type: "field_input", name: p.name, text: p.default };
    case "colour": return { type: "field_colour", name: p.name, colour: p.default };
    case "value": return { type: "input_value", name: p.name, ...(p.check ? { check: p.check } : {}) };
  }
}

/**
 * 값 입력이 둘 이상이면 한 줄로 놓는다. 그 밖에는 inputsInline 을 적지 않아 Blockly 가 정하게 둔다
 * (예전 손으로 쓴 정의와 같은 모양: `%1 출력하기` 는 Blockly 기본값으로 한 줄이 된다).
 */
const inline = (parts: Part[]) => (parts.filter((p) => p.kind === "value").length >= 2 ? { inputsInline: true } : {});
const args = (parts: Part[]) => (parts.length ? { args0: parts.map(arg) } : {});

/**
 * 모든 장치 블록의 Blockly JSON 정의. 색은 테마 스타일이 아니라 장치마다의 colour (Zelos 가 밝은·어두운 색을 만든다).
 * 다른 카테고리에도 보여 주는 블록(alsoIn·extraToolbox)도 블록 종류에 붙은 원래 장치 색 그대로다.
 */
export function deviceBlockDefinitions(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const d of DEVICES) {
    const stmt = { previousStatement: null, nextStatement: null, colour: d.colour };
    if (d.setup) out.push({ type: d.setup.blockType, message0: d.setup.message, ...args(d.setup.parts), ...stmt, tooltip: d.setup.tooltip });
    for (const a of d.actions) out.push({ type: a.blockType, message0: a.message, ...args(a.parts), ...inline(a.parts), ...stmt, tooltip: a.tooltip });
    for (const v of d.values) out.push({ type: v.blockType, message0: v.message, ...args(v.parts), ...inline(v.parts), output: v.output, colour: d.colour, tooltip: v.tooltip });
  }
  return out;
}

/**
 * 맞는 글만 받아야 하는 글 칸(text part 의 validate): 블록 type·칸 이름·정규식.
 * field_input JSON 은 검사 함수를 실을 수 없으므로 src/blocks/index.ts 가 블록 init 에서 칸에 단다.
 */
export function textFieldValidators(): { blockType: string; field: string; pattern: RegExp }[] {
  return DEVICES.flatMap((d) => [...(d.setup ? [d.setup] : []), ...d.actions, ...d.values]).flatMap((s) =>
    s.parts.flatMap((p) => (p.kind === "text" && p.validate ? [{ blockType: s.blockType, field: p.name, pattern: p.validate }] : [])),
  );
}

export type ToolboxItem = { kind: "label"; text: string } | { kind: "block"; type: string; fields?: Record<string, unknown>; inputs?: Record<string, unknown> };
/** icon: 카테고리 열 아이콘 id (src/blocks/icons.ts, 장치 카테고리 id 와 같다) */
export type ToolboxCategory = { kind: "category"; name: string; categorystyle: string; icon: string; contents: ToolboxItem[] };

const allParts = new Map(DEVICES.flatMap((d) => [...(d.setup ? [d.setup] : []), ...d.actions, ...d.values]).map((s) => [s.blockType, s.parts]));

/** 툴박스 항목: 값 입력에는 shadow 로 기본값을 끼운다. fields 를 주면 그 필드 기본값만 바꾼다 (변수 필드는 이름으로) */
function entry(blockType: string, fields: Record<string, string> = {}): ToolboxItem {
  const parts = allParts.get(blockType) ?? [];
  const inputs: Record<string, unknown> = {};
  for (const p of parts) {
    if (p.kind !== "value" || p.shadow === undefined) continue;
    inputs[p.name] = typeof p.shadow === "number" ? { shadow: { type: "math_number", fields: { NUM: p.shadow } } } : { shadow: { type: "text", fields: { TEXT: p.shadow } } };
  }
  const fieldValues: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(fields)) fieldValues[name] = parts.find((p) => p.name === name)?.kind === "var" ? { name: value } : value;
  return {
    kind: "block", type: blockType,
    ...(Object.keys(fieldValues).length ? { fields: fieldValues } : {}),
    ...(Object.keys(inputs).length ? { inputs } : {}),
  };
}

function deviceItems(d: DeviceSpec): ToolboxItem[] {
  return [
    { kind: "label", text: d.label },
    ...(d.setup ? [entry(d.setup.blockType)] : []),
    ...d.actions.map((a) => entry(a.blockType)),
    ...d.values.map((v) => entry(v.blockType)),
    ...(d.extraToolbox ?? []).map((x) => entry(x.blockType, x.fields)),
  ];
}

/** 카테고리 안의 장치를 toolboxOrder 순으로 (같거나 없으면 DEVICES 순서 그대로; 없는 것은 뒤로) */
const byToolboxOrder = (ds: DeviceSpec[]): DeviceSpec[] =>
  ds.map((d, i) => ({ d, i }))
    .sort((a, b) => (a.d.toolboxOrder ?? Infinity) - (b.d.toolboxOrder ?? Infinity) || a.i - b.i)
    .map((x) => x.d);

/** 하드웨어 카테고리 8개 (DEVICE_CATEGORIES 순). 장치가 없는 카테고리는 빈 채로 둔다 */
export function deviceToolboxCategories(): ToolboxCategory[] {
  return DEVICE_CATEGORIES.map((c) => ({
    kind: "category", name: c.label, categorystyle: `${c.id}_category`, icon: c.id,
    contents: byToolboxOrder(DEVICES.filter((d) => d.category === c.id || d.alsoIn?.includes(c.id))).flatMap(deviceItems),
  }));
}
