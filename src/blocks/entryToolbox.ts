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

/**
 * 가로·세로 스크롤바 한 쌍인데, 넘치는 쪽만 보인다.
 * Blockly 는 짝 지은 스크롤바를 내용이 다 보여도 숨기지 않는다 (홀로 쓰는 스크롤바만 스스로 숨긴다). 그래서 크기를 다시 잴 때마다 쪽마다 정한다.
 */
export class AutoHideScrollbarPair extends Blockly.ScrollbarPair {
  private readonly ws: Blockly.WorkspaceSvg;

  constructor(ws: Blockly.WorkspaceSvg, addHorizontal?: boolean, addVertical?: boolean, cls?: string, margin?: number) {
    super(ws, addHorizontal, addVertical, cls, margin);
    this.ws = ws;
  }

  override resize(): void {
    super.resize();
    const m = this.ws.getMetrics();
    // 반올림 차이로 1px 안쪽 넘침은 넘침으로 보지 않는다
    this.hScroll?.setVisibleInternal(m.scrollWidth > m.viewWidth + 1);
    this.vScroll?.setVisibleInternal(m.scrollHeight > m.viewHeight + 1);
  }
}

/** 팔레트가 열려 있는 동안 작업판(주입 칸)에 붙이는 class. src/index.css 가 이때 작업판 가로 스크롤바를 숨긴다 */
export const FLYOUT_OPEN_CLASS = "blocklabFlyoutOpen";

/**
 * 폭을 작업판 안으로 줄이고, 넘치는 넓은 블록은 가로로도 스크롤하는 세로 팔레트.
 * Blockly 의 세로 팔레트는 세로 스크롤바만 만든다. 폭을 줄이면 넓은 함수 블록의 오른쪽 끝을 볼 수 없으므로 가로 스크롤바를 더하고
 * (팔레트 metrics 는 이미 내용 폭을 알려 준다), 가로 휠·Shift+휠로도 옮긴다.
 * 팔레트 아래쪽 가로 스크롤바가 작업판 가로 스크롤바와 겹치므로, 열려 있는 동안 작업판 쪽을 숨긴다(FLYOUT_OPEN_CLASS).
 */
export class ClampedVerticalFlyout extends Blockly.VerticalFlyout {
  override init(targetWorkspace: Blockly.WorkspaceSvg): void {
    super.init(targetWorkspace);
    // 기본(세로만) 스크롤바를 가로·세로 둘 다로 바꾼다. 보이고 숨기는 것은 팔레트(updateDisplay)가 그대로 맡는다
    this.workspace_.scrollbar?.dispose();
    this.workspace_.scrollbar = new AutoHideScrollbarPair(this.workspace_, true, true, "blocklyFlyoutScrollbar", this.SCROLLBAR_MARGIN);
    this.workspace_.scrollbar.setContainerVisible(this.isVisible());
  }

  override show(flyoutDef: Blockly.utils.toolbox.FlyoutDefinition | string): void {
    super.show(flyoutDef);
    this.targetWorkspace.getInjectionDiv()?.classList.add(FLYOUT_OPEN_CLASS);
  }

  override hide(): void {
    super.hide();
    this.targetWorkspace?.getInjectionDiv()?.classList.remove(FLYOUT_OPEN_CLASS);
  }

  /** 세로 팔레트의 setMetrics_ 는 y 만 본다. 가로 스크롤바가 움직인 x 도 반영한다 */
  protected override setMetrics_(xyRatio: { x?: number; y?: number }): void {
    if (!this.isVisible()) return;
    const mm = this.workspace_.getMetricsManager();
    const scroll = mm.getScrollMetrics();
    const view = mm.getViewMetrics();
    const abs = mm.getAbsoluteMetrics();
    if (typeof xyRatio.x === "number") this.workspace_.scrollX = -(scroll.left + (scroll.width - view.width) * xyRatio.x);
    if (typeof xyRatio.y === "number") this.workspace_.scrollY = -(scroll.top + (scroll.height - view.height) * xyRatio.y);
    this.workspace_.translate(this.workspace_.scrollX + abs.left, this.workspace_.scrollY + abs.top);
  }

  /** 가로 휠(트랙패드 옆으로 밀기)이나 Shift+휠은 가로로, 나머지는 원래대로 세로로 */
  protected override wheel_(e: WheelEvent): void {
    const delta = Blockly.browserEvents.getScrollDeltaPixels(e);
    const dx = e.shiftKey ? delta.x || delta.y : delta.x;
    if (dx) {
      const mm = this.workspace_.getMetricsManager();
      this.workspace_.scrollbar?.setX(mm.getViewMetrics().left - mm.getScrollMetrics().left + dx);
    }
    if (!e.shiftKey && delta.y) {
      super.wheel_(e);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  }

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
