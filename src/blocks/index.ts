import * as Blockly from "blockly";
import { registerFieldMultilineInput } from "@blockly/field-multilineinput";
import { applyKoreanMessages } from "./messages";
import { startBlocks } from "./definitions/start";
import { flowBlocks } from "./definitions/flow";
import { calcBlocks } from "./definitions/calc";
import { esp32Blocks } from "./definitions/esp32";
import { codeBlocks } from "./definitions/code";

export { entryTheme } from "./theme";
export { toolbox } from "./toolbox";
export { isValidPythonName, PYTHON_KEYWORDS, VARIABLE_NAME_HINT } from "./names";

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
  // code_stmt 의 여러 줄 칸 (field_multilinetext)
  registerFieldMultilineInput();
  // 변수·함수 꾸러미는 꺼낼 때마다 Blockly.Blocks 에 이 블록이 있는지 본다. 지우면 꾸러미에 나오지 않는다.
  // math_change 는 `x = (x if isinstance(x, Number) else 0) + 1` 처럼 수업 코드에 없는 꼴을 내고,
  // procedures_ifreturn 은 함수 밖에서 깨진 코드를 낸다. 둘 다 코드 → 블록으로 돌아오지 않는다.
  delete Blockly.Blocks["math_change"];
  delete Blockly.Blocks["procedures_ifreturn"];
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
