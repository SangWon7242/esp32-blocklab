import * as Blockly from "blockly";

type Item = Blockly.utils.toolbox.FlyoutItemInfo;
type BlockItem = Blockly.utils.toolbox.BlockInfo;

/**
 * 변수 카테고리 꾸러미: Blockly 기본(변수 만들기 버튼 → 정하기 → 변수들) 에 "만큼 바꾸기"·"전역 변수 쓰기" 를 정하기 바로 뒤에 끼운다.
 * 변수가 하나도 없으면 기본처럼 버튼만. 바꾸기·전역 변수 블록은 정하기 블록과 같은 변수(가장 최근에 만든 변수)를 가리킨다.
 * (내장 math_change 는 registerBlocks 가 지웠으므로 기본 목록에는 바꾸기 블록이 없다)
 */
export function variableFlyout(workspace: Blockly.WorkspaceSvg): Item[] {
  const items = Blockly.Variables.flyoutCategory(workspace);
  const at = items.findIndex((i) => i.kind === "block" && (i as BlockItem).type === "variables_set");
  if (at < 0 || !Blockly.Blocks["var_change"]) return items;
  const set = items[at] as BlockItem;
  const change: BlockItem = {
    kind: "block",
    type: "var_change",
    gap: 20,
    fields: structuredClone(set.fields),
    inputs: { DELTA: { shadow: { type: "math_number", fields: { NUM: 1 } } } },
  };
  // 함수 안에서 바깥 변수를 바꿀 때 쓰는 전역 변수 쓰기(global)는 바꾸기 바로 뒤
  const extra: BlockItem[] = [change];
  if (Blockly.Blocks["var_global"]) {
    change.gap = 8;
    extra.push({ kind: "block", type: "var_global", gap: 20, fields: structuredClone(set.fields) });
  }
  // 정하기·바꾸기(·전역 변수)는 붙여 보이고, 변수 값 블록들 앞에서 띄운다
  set.gap = 8;
  return [...items.slice(0, at + 1), ...extra, ...items.slice(at + 1)];
}

/** 작업판의 VARIABLE 꾸러미를 variableFlyout 으로 바꾼다 (inject 뒤에 부른다) */
export function registerVariableFlyout(workspace: Blockly.WorkspaceSvg): void {
  workspace.registerToolboxCategoryCallback("VARIABLE", variableFlyout);
}
