/**
 * 블록 사전 카탈로그: 툴박스(src/blocks/toolbox.ts)와 변수·함수 꾸러미의 블록마다 제목·그 블록의 코드를
 * 헤드리스 작업판에서 뽑고, 손으로 쓴 설명(content)을 합친다. 처음 쓸 때 한 번 만들어 둔다.
 */
import * as Blockly from "blockly";
import { entryTheme, registerBlocks, toolbox } from "@/blocks";
import { blockSnippet } from "@/codegen";
import { DEVICE_CATEGORIES } from "@/devices/registry";
import { CONTENT } from "./content";
import type { BlockContent, BlockDoc, DocCategory, TitlePart } from "./types";

export type { BlockContent, BlockDoc, DocCategory, TitlePart } from "./types";

/** 툴박스 블록 항목 (Blockly.serialization.blocks.append 가 받는 꼴) */
type BlockItem = { kind: "block"; type: string; fields?: Record<string, unknown>; inputs?: Record<string, unknown>; extraState?: unknown };
type CategoryItem = { kind: "category"; name: string; categorystyle: string; custom?: string; contents?: { kind: string }[] };

const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });

/**
 * 변수·함수 꾸러미(custom 카테고리)의 블록. 꾸러미는 작업판에서 그때그때 만들어지므로 고정 목록으로 둔다.
 * 호출 블록은 같은 작업판에 그 함수 정의(before)를 먼저 둔다. registerBlocks 가 꾸러미에서 뺀 블록
 * (procedures_ifreturn)은 정의가 없어 건너뛴다. 변수 꾸러미의 만큼 바꾸기는 내장 math_change 대신 var_change (variableFlyout).
 */
const CUSTOM_ITEMS: Record<string, { item: BlockItem; before?: BlockItem }[]> = {
  VARIABLE: [
    { item: { kind: "block", type: "variables_set", fields: { VAR: { name: "count" } }, inputs: { VALUE: num(0) } } },
    { item: { kind: "block", type: "var_change", fields: { VAR: { name: "count" } }, inputs: { DELTA: num(1) } } },
    { item: { kind: "block", type: "variables_get", fields: { VAR: { name: "count" } } } },
  ],
  PROCEDURE: [
    { item: { kind: "block", type: "procedures_defnoreturn", fields: { NAME: "my_func" } } },
    { item: { kind: "block", type: "procedures_defreturn", fields: { NAME: "my_func" } } },
    { item: { kind: "block", type: "procedures_ifreturn" } },
    {
      item: { kind: "block", type: "procedures_callnoreturn", extraState: { name: "my_func" } },
      before: { kind: "block", type: "procedures_defnoreturn", fields: { NAME: "my_func" } },
    },
    {
      item: { kind: "block", type: "procedures_callreturn", extraState: { name: "my_func" } },
      before: { kind: "block", type: "procedures_defreturn", fields: { NAME: "my_func" } },
    },
  ],
};

/** 카테고리 id: 하드웨어 카테고리는 장치 카테고리 id(pin·led…), 나머지는 스타일 이름에서 (flow_category → flow) */
function categoryId(c: CategoryItem): string {
  return DEVICE_CATEGORIES.find((d) => d.label === c.name)?.id ?? c.categorystyle.replace(/_category$/, "");
}

function categoryColour(style: string): string {
  const colour = entryTheme.categoryStyles[style]?.colour;
  return typeof colour === "string" ? colour : "";
}

/**
 * 블록 그림에서 보이는 글을 위에서부터 읽어 제목 조각으로. 고정 글은 text, 바꿀 수 있는 칸은 slot.
 * 사전은 툴박스 그대로의 블록에, 설명 팝업은 학생이 우클릭한 블록(지금 값)에 쓴다
 */
export function titleOfBlock(block: Blockly.Block): TitlePart[] {
  const parts: TitlePart[] = [];
  for (const input of block.inputList) {
    if (!input.isVisible()) continue;
    for (const field of input.fieldRow) {
      if (!field.isVisible() || field instanceof Blockly.FieldImage) continue;
      const text = field.getText();
      if (field instanceof Blockly.FieldLabel) {
        if (text.trim()) parts.push({ kind: "text", text: text.trim() });
      } else parts.push({ kind: "slot", text });
    }
    if (input.type === Blockly.inputs.inputTypes.VALUE) parts.push({ kind: "slot", text: slotText(input.connection?.targetBlock() ?? null) });
  }
  return parts;
}

/** 값 칸의 글: 끼워진 블록(그림자 숫자·글자)의 칸 글. 비었으면 "" */
function slotText(block: Blockly.Block | null): string {
  if (!block) return "";
  return block.inputList
    .flatMap((i) => i.fieldRow)
    .filter((f) => !(f instanceof Blockly.FieldImage) && !(f instanceof Blockly.FieldLabel))
    .map((f) => f.getText())
    .join(" ");
}

type Built = { title: TitlePart[]; code: string; tooltip: string; colour: string };

/**
 * 블록이 작업판에 그려지는 색. 테마 스타일을 쓰는 블록(흐름·판단…)은 헤드리스 작업판이 스타일을 칠하지 않으므로
 * (getColour 가 #000000) entryTheme 의 그 스타일 primary 를, 장치 블록처럼 colour 를 직접 가진 블록은 getColour() 를.
 */
export function blockColour(block: Blockly.Block): string {
  const style = block.getStyleName();
  const primary = style ? entryTheme.blockStyles[style]?.colourPrimary : undefined;
  return (primary ?? block.getColour()).toLowerCase();
}

/** 헤드리스 작업판에 툴박스 항목 그대로 블록 하나를 만들어 제목·코드·도움말을 뽑는다 */
function buildBlock(item: BlockItem, before?: BlockItem): Built {
  const ws = new Blockly.Workspace();
  // 버리는 작업판이라 이벤트를 쌓지 않는다 (나중에 비동기로 도는 이벤트가 이미 지운 작업판을 찾지 않게)
  Blockly.Events.disable();
  try {
    const state = (i: BlockItem) => ({ type: i.type, fields: i.fields, inputs: i.inputs, extraState: i.extraState }) as Blockly.serialization.blocks.State;
    if (before) Blockly.serialization.blocks.append(state(before), ws);
    const block = Blockly.serialization.blocks.append(state(item), ws);
    return { title: titleOfBlock(block), code: blockSnippet(block), tooltip: Blockly.Tooltip.getTooltipOfObject(block), colour: blockColour(block) };
  } finally {
    ws.dispose();
    Blockly.Events.enable();
  }
}

/**
 * 대비책: 설명(content)이 없는 블록은 도움말을 개념 자리에 두고 예시는 비운다.
 * 새 블록을 넣으면 src/docs/content 에 설명을 쓴다 (catalog.test.ts 가 빠진 설명을 잡는다)
 */
const fallbackContent = (tooltip: string): BlockContent => ({ concept: tooltip, example: { title: "", code: "" } });

const sameTitle = (a: TitlePart[], b: TitlePart[]) => a.length === b.length && a.every((p, i) => p.kind === b[i].kind && p.text === b[i].text);

function buildCatalog(): DocCategory[] {
  registerBlocks();
  const byType = new Map<string, BlockDoc>();
  const out: DocCategory[] = [];
  const cats = (toolbox as unknown as { contents: CategoryItem[] }).contents.filter((c) => c.kind === "category");
  for (const c of cats) {
    const category = { id: categoryId(c), name: c.name, colour: categoryColour(c.categorystyle) };
    const entries = c.custom
      ? (CUSTOM_ITEMS[c.custom] ?? []).filter((e) => Blockly.Blocks[e.item.type])
      : (c.contents ?? []).filter((i): i is BlockItem => i.kind === "block").map((item) => ({ item, before: undefined }));
    const blocks: BlockDoc[] = [];
    for (const { item, before } of entries) {
      const built = buildBlock(item, before);
      const seen = byType.get(item.type);
      if (seen) {
        // 같은 종류의 다른 모양 (만약-아니면, 다른 장치 이름의 읽기 블록). 같은 모양(다른 카테고리에 또 보여 주는 것)은 넣지 않는다
        const known = [seen.title, ...(seen.variants ?? [])];
        if (!known.some((t) => sameTitle(t, built.title))) seen.variants = [...(seen.variants ?? []), built.title];
        continue;
      }
      const doc: BlockDoc = { type: item.type, category, ...built, ...(CONTENT[item.type] ?? fallbackContent(built.tooltip)) };
      byType.set(item.type, doc);
      blocks.push(doc);
    }
    out.push({ ...category, blocks });
  }
  return out;
}

let catalog: DocCategory[] | null = null;
let index: Map<string, BlockDoc> | null = null;

/** 툴박스 순서의 카테고리별 블록 설명 (한 번 만들어 둔다) */
export function getCatalog(): DocCategory[] {
  catalog ??= buildCatalog();
  return catalog;
}

export function findDoc(type: string): BlockDoc | undefined {
  index ??= new Map(getCatalog().flatMap((c) => c.blocks.map((b) => [b.type, b] as const)));
  return index.get(type);
}

const searchText = (d: BlockDoc) =>
  [...d.title.map((p) => p.text), ...(d.variants ?? []).flat().map((p) => p.text), d.code, d.concept, d.tooltip].join("\n").toLowerCase();

/** 공백으로 나눈 낱말이 모두 제목·코드·개념·도움말 어딘가에 들어 있는 블록 (대소문자 무시, 툴박스 순서). 빈 검색은 모두 */
export function searchDocs(query: string): BlockDoc[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const all = getCatalog().flatMap((c) => c.blocks);
  return words.length ? all.filter((d) => {
    const text = searchText(d);
    return words.every((w) => text.includes(w));
  }) : all;
}
