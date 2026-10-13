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

/** 모든 장치 블록의 Blockly JSON 정의 */
export function deviceBlockDefinitions(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const stmt = { previousStatement: null, nextStatement: null, style: "hardware_blocks" };
  for (const d of DEVICES) {
    if (d.setup) out.push({ type: d.setup.blockType, message0: d.setup.message, ...args(d.setup.parts), ...stmt, tooltip: d.setup.tooltip });
    for (const a of d.actions) out.push({ type: a.blockType, message0: a.message, ...args(a.parts), ...inline(a.parts), ...stmt, tooltip: a.tooltip });
    for (const v of d.values) out.push({ type: v.blockType, message0: v.message, ...args(v.parts), ...inline(v.parts), output: v.output, style: "hardware_blocks", tooltip: v.tooltip });
  }
  return out;
}

export type ToolboxItem = { kind: "label"; text: string } | { kind: "block"; type: string; fields?: Record<string, unknown>; inputs?: Record<string, unknown> };
export type ToolboxCategory = { kind: "category"; name: string; categorystyle: string; contents: ToolboxItem[] };

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
    kind: "category", name: c.label, categorystyle: "hardware_category",
    contents: byToolboxOrder(DEVICES.filter((d) => d.category === c.id || d.alsoIn?.includes(c.id))).flatMap(deviceItems),
  }));
}
