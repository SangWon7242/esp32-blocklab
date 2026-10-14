import * as Blockly from "blockly";
import { textColourOn } from "@/lib/contrast";
import { categoryIconSvg } from "./icons";

/** 고르지 않은 타일의 이름 글자색 (진회색) */
const IDLE_TEXT = "#374151";

/**
 * 엔트리식 카테고리 타일: 아이콘(카테고리 색) 위, 이름 아래로 세로로 쌓고, 고르면 타일 전체를 카테고리 색으로
 * 채우고 아이콘·이름을 그 색 위에서 잘 읽히는 색(어두운 색 위 흰색, LED 노랑·계산·흐름·핀처럼 밝은 색 위 진한 색)으로. 왼쪽 색 띠(Blockly 기본)는 그리지 않는다. 모양은 src/index.css 의 .entryCategory*.
 * 카테고리 정의의 icon 키(src/blocks/icons.ts 의 id)가 없거나 모르는 id 면 아이콘 없이 이름만.
 */
export class EntryToolboxCategory extends Blockly.ToolboxCategory {
  private selected_ = false;

  protected override createRowContainer_(): HTMLDivElement {
    const row = super.createRowContainer_();
    row.classList.add("entryCategoryRow");
    return row;
  }

  protected override createRowContentsContainer_(): HTMLDivElement {
    const contents = super.createRowContentsContainer_();
    contents.classList.add("entryCategoryContents");
    return contents;
  }

  /** Blockly 의 접기 화살표(blocklyToolboxCategoryIcon, 숨김) 대신 lucide 아이콘을 넣는다 */
  protected override createIconDom_(): Element {
    const span = document.createElement("span");
    span.className = "entryCategoryIcon";
    const id = (this.toolboxItemDef_ as { icon?: unknown }).icon;
    const svg = typeof id === "string" ? categoryIconSvg(id) : null;
    if (svg) span.innerHTML = svg;
    else span.hidden = true;
    return span;
  }

  protected override createLabelDom_(name: string): Element {
    const label = super.createLabelDom_(name);
    label.classList.add("entryCategoryLabel");
    return label;
  }

  /** 기본은 왼쪽 8px 색 띠. 엔트리 타일은 띠 없이 아이콘을 카테고리 색으로 칠한다 (refreshTheme 도 여기로 온다) */
  protected override addColourBorder_(_colour: string): void {
    this.paint_();
  }

  override setSelected(isSelected: boolean): void {
    // 기본 동작: 배경을 카테고리 색으로, blocklyToolboxSelected 클래스, aria-selected
    super.setSelected(isSelected);
    this.selected_ = isSelected;
    this.paint_();
  }

  private paint_(): void {
    const row = this.rowDiv_;
    if (!row) return;
    const colour = this.colour_ || "#57e";
    const selectedText = textColourOn(colour);
    row.style.backgroundColor = this.selected_ ? colour : "";
    row.style.color = this.selected_ ? selectedText : IDLE_TEXT;
    if (this.iconDom_ instanceof HTMLElement) this.iconDom_.style.color = this.selected_ ? selectedText : colour;
  }
}

let registered = false;

/** 툴박스의 기본 카테고리(kind: "category")를 EntryToolboxCategory 로 바꾼다. 여러 번 불러도 한 번만 등록한다 */
export function registerEntryToolbox(): void {
  if (registered) return;
  Blockly.registry.register(Blockly.registry.Type.TOOLBOX_ITEM, Blockly.ToolboxCategory.registrationName, EntryToolboxCategory, true);
  registered = true;
}
