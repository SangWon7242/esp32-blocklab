import * as Blockly from "blockly";
import { applyKoreanMessages } from "./messages";
import { startBlocks } from "./definitions/start";
import { flowBlocks } from "./definitions/flow";
import { calcBlocks } from "./definitions/calc";
import { esp32Blocks } from "./definitions/esp32";
import { codeBlocks } from "./definitions/code";

export { entryTheme } from "./theme";
export { toolbox } from "./toolbox";

const definitions = [...startBlocks, ...flowBlocks, ...calcBlocks, ...esp32Blocks, ...codeBlocks];

export const CUSTOM_BLOCK_TYPES: readonly string[] = definitions.map((d) => d.type as string);

export const BUILTIN_BLOCK_TYPES: readonly string[] = [
  "controls_if", "controls_whileUntil", "logic_compare", "logic_operation", "logic_negate", "logic_boolean",
  "math_number", "text", "variables_set", "variables_get",
  "procedures_defnoreturn", "procedures_defreturn", "procedures_callnoreturn", "procedures_callreturn",
];

let registered = false;

/** 로케일을 적용하고 커스텀 블록을 정의한다. 여러 번 불러도 안전하다. */
export function registerBlocks(): void {
  if (registered) return;
  applyKoreanMessages();
  Blockly.defineBlocksWithJsonArray(definitions);
  registered = true;
}
