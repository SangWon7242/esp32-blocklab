import * as Blockly from "blockly";
import { iconColourOn, textColourOn } from "@/lib/contrast";
import { categoryIconSvg } from "./icons";

/** 고르지 않은 타일의 이름 글자색 (진회색) */
const IDLE_TEXT = "#374151";

/**
 * 엔트리식 카테고리 타일: 아이콘(카테고리 색, 흰 바탕에서 3:1 이 안 되면 어둡게) 위, 이름 아래로 세로로 쌓고, 고르면 타일 전체를 카테고리 색으로
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
    const colour = this.colour_ || "#5577ee";
    const selectedText = textColourOn(colour);
    row.style.backgroundColor = this.selected_ ? colour : "";
    row.style.color = this.selected_ ? selectedText : IDLE_TEXT;
    // 고르지 않은 타일의 아이콘은 흰 열 위에서 3:1 이 되도록 (LED 노랑·계산·흐름처럼 밝은 색은 어둡게)
    if (this.iconDom_ instanceof HTMLElement) this.iconDom_.style.color = this.selected_ ? selectedText : iconColourOn(colour);
  }
}

/** 블록 팔레트(flyout)가 작업판에서 차지해도 되는 몫. 나머지는 블록을 끌어다 놓을 자리로 남긴다 */
export const FLYOUT_MAX_SHARE = 0.7;
/** 팔레트 폭의 아래 한계 (작업판이 아주 좁아도 이만큼은) */
export const FLYOUT_MIN_WIDTH = 240;

/**
 * 팔레트 폭: Blockly 는 가장 넓은 블록에 맞춰 늘리는데, 몸통이 채워진 함수 블록(센서의 ntc_temperature 등)은 수백 px 이라
 * 팔레트가 작업판보다 넓어지고 세로 스크롤바가 작업판 밖으로 밀려 보이지도 잡히지도 않았다. 작업판 안(available 의 70%)으로 줄인다.
 * 넓은 블록은 오른쪽이 잘려 보이지만 그대로 끌어 쓸 수 있다.
 */
export function clampFlyoutWidth(natural: number, available: number): number {
  if (!(available > 0)) return natural;
  const max = Math.max(Math.min(FLYOUT_MIN_WIDTH, available), available * FLYOUT_MAX_SHARE);
  return Math.min(natural, max);
}

/** 폭을 작업판 안으로 줄이는 세로 팔레트 (스크롤바가 늘 보이는 자리에 온다) */
export class ClampedVerticalFlyout extends Blockly.VerticalFlyout {
  protected override reflowInternal_(): void {
    super.reflowInternal_();
    const target = this.targetWorkspace;
    const svgWidth = target.getMetricsManager().getSvgMetrics().width;
    const available = svgWidth - (target.getToolbox()?.getWidth() ?? 0);
    const width = clampFlyoutWidth(this.width_, available);
    if (width === this.width_) return;
    this.width_ = width;
    this.position();
    target.resizeContents();
    target.recordDragTargets();
  }
}

let registered = false;

/** 툴박스의 기본 카테고리(kind: "category")를 EntryToolboxCategory 로, 세로 팔레트를 ClampedVerticalFlyout 으로 바꾼다. 여러 번 불러도 한 번만 등록한다 */
export function registerEntryToolbox(): void {
  if (registered) return;
  Blockly.registry.register(Blockly.registry.Type.TOOLBOX_ITEM, Blockly.ToolboxCategory.registrationName, EntryToolboxCategory, true);
  Blockly.registry.register(Blockly.registry.Type.FLYOUTS_VERTICAL_TOOLBOX, Blockly.registry.DEFAULT, ClampedVerticalFlyout, true);
  registered = true;
}
