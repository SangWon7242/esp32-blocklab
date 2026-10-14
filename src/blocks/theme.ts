import * as Blockly from "blockly";
import { CATEGORY_COLORS, CATEGORY_IDS, ENTRY_COLORS } from "./colors";

const style = (c: { primary: string; secondary: string; tertiary: string }) => ({
  colourPrimary: c.primary,
  colourSecondary: c.secondary,
  colourTertiary: c.tertiary,
});

export const entryTheme = Blockly.Theme.defineTheme("entry", {
  name: "entry",
  base: Blockly.Themes.Zelos,
  blockStyles: {
    start_blocks: style(ENTRY_COLORS.START),
    loop_blocks: style(ENTRY_COLORS.FLOW),
    logic_blocks: style(ENTRY_COLORS.JUDGE),
    math_blocks: style(ENTRY_COLORS.CALC),
    text_blocks: style(ENTRY_COLORS.CALC),
    variable_blocks: style(ENTRY_COLORS.VARIABLE),
    variable_dynamic_blocks: style(ENTRY_COLORS.VARIABLE),
    procedure_blocks: style(ENTRY_COLORS.FUNC),
    hardware_blocks: style(ENTRY_COLORS.HARDWARE),
    code_blocks: style(ENTRY_COLORS.CODE),
  },
  // 카테고리마다 <id>_category (start_category … input_category, code_category) — 카테고리 열 타일 색
  categoryStyles: Object.fromEntries(CATEGORY_IDS.map((id) => [`${id}_category`, { colour: CATEGORY_COLORS[id].primary }])),
  componentStyles: {
    workspaceBackgroundColour: "#f6f7f9",
    toolboxBackgroundColour: "#ffffff",
    toolboxForegroundColour: "#1f2937",
    flyoutBackgroundColour: "#f8f9fb",
    flyoutOpacity: 1,
    scrollbarColour: "#cbd5e1",
    insertionMarkerColour: "#1f2937",
    insertionMarkerOpacity: 0.3,
  },
  fontStyle: { family: '"Pretendard Variable", Pretendard, sans-serif', weight: "500", size: 12 },
});
