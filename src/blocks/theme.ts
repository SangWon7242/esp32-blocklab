import * as Blockly from "blockly";
import { ENTRY_COLORS } from "./colors";

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
  categoryStyles: {
    start_category: { colour: ENTRY_COLORS.START.primary },
    flow_category: { colour: ENTRY_COLORS.FLOW.primary },
    judge_category: { colour: ENTRY_COLORS.JUDGE.primary },
    calc_category: { colour: ENTRY_COLORS.CALC.primary },
    variable_category: { colour: ENTRY_COLORS.VARIABLE.primary },
    func_category: { colour: ENTRY_COLORS.FUNC.primary },
    hardware_category: { colour: ENTRY_COLORS.HARDWARE.primary },
    code_category: { colour: ENTRY_COLORS.CODE.primary },
  },
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
