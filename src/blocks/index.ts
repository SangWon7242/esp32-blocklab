import * as Blockly from "blockly";
import { registerFieldMultilineInput } from "@blockly/field-multilineinput";
import { registerFieldColour } from "@blockly/field-colour";
import { applyKoreanMessages } from "./messages";
import { startBlocks } from "./definitions/start";
import { flowBlocks } from "./definitions/flow";
import { calcBlocks } from "./definitions/calc";
import { codeBlocks } from "./definitions/code";
import { isValidPythonName } from "./names";
import { deviceBlockDefinitions } from "@/devices/toBlocks";

export { entryTheme } from "./theme";
export { toolbox } from "./toolbox";
export { FUNCTION_NAME_HINT, isProgramName, isValidPythonName, PROGRAM_NAME_HINT, PYTHON_KEYWORDS, VARIABLE_NAME_HINT } from "./names";

const definitions = [...startBlocks, ...flowBlocks, ...calcBlocks, ...deviceBlockDefinitions(), ...codeBlocks];

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
  // RGB LED 색 칸 (field_colour)
  registerFieldColour();
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
  // 함수 이름 칸은 직접 고치는 글 칸이라 이름 창(namePrompt)을 거치지 않는다. 칸에 같은 이름 검사를 단다
  for (const type of ["procedures_defnoreturn", "procedures_defreturn"]) {
    const def = Blockly.Blocks[type];
    const originalInit = def.init;
    def.init = function (this: Blockly.Block) {
      originalInit.call(this);
      const name = this.getField("NAME") as Blockly.Field<string> | null;
      if (name) guardProcedureName(name);
    };
  }
  registered = true;
}

/**
 * 함수 이름 칸에 파이썬 이름 검사를 단다. 한글 이름·키워드는 생성기가 다른 이름으로 바꿔 써서 코드와 블록이
 * 어긋나고, print·show 처럼 프로그램이 쓰는 이름은 덮으면 생성 코드가 깨진다. 통과하면 Blockly 의 원래 검사
 * (Procedures.rename: 겹치는 이름 피하기, 호출 블록 이름 바꾸기)를 그대로 부른다.
 * 저장된 작업판·코드에서 온 이름(loadState)은 막지 않는다: 코드의 `def show(a, b):` 같은 사용자 함수가
 * 기본 이름으로 바뀌면 호출 블록과 어긋난다.
 */
function guardProcedureName(field: Blockly.Field<string>): void {
  const original = field.getValidator();
  let loading = false;
  const loadState = field.loadState.bind(field);
  field.loadState = (state: unknown) => {
    loading = true;
    try {
      loadState(state);
    } finally {
      loading = false;
    }
  };
  field.setValidator(function (this: Blockly.Field<string>, value: string) {
    if (!loading && !isValidPythonName(value.trim())) return null;
    return original ? original.call(this, value) : value;
  });
}
