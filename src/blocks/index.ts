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
  "controls_if", "logic_compare", "logic_operation", "logic_negate", "logic_boolean",
  "math_number", "text", "variables_set", "variables_get",
  "procedures_defnoreturn", "procedures_defreturn", "procedures_callnoreturn", "procedures_callreturn",
];

let registered = false;

/** 로케일을 적용하고 커스텀 블록을 정의한다. 여러 번 불러도 안전하다. */
export function registerBlocks(): void {
  if (registered) return;
  applyKoreanMessages();
  // 내장 controls_whileUntil 을 같은 이름의 엔트리식 정의로 바꾼다 (덮어쓰기 경고 방지)
  delete Blockly.Blocks["controls_whileUntil"];
  Blockly.defineBlocksWithJsonArray(definitions);
  // 엔트리는 "만약"도 흐름(하늘색) 블록이다
  for (const type of ["controls_if", "controls_ifelse"]) {
    const def = Blockly.Blocks[type];
    const originalInit = def.init;
    def.init = function (this: Blockly.Block) {
      originalInit.call(this);
      this.setStyle("loop_blocks");
    };
  }
  registered = true;
}
