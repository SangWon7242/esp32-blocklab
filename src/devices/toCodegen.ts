import type * as Blockly from "blockly";
import { Order } from "blockly/python";
import type { MicroPythonGenerator } from "@/codegen/generator";
import { DEVICES } from "./registry";
import type { Part, Values } from "./types";

/** 블록의 필드·입력을 코드 템플릿 값으로. 변수 필드는 파이썬 이름, 값 입력은 생성 코드(빈 칸은 check 유무에 따라 0 또는 "") */
function readValues(block: Blockly.Block, gen: MicroPythonGenerator, parts: Part[]): Values {
  const v: Values = {};
  for (const p of parts) {
    if (p.kind === "var") v[p.name] = gen.getVariableName(block.getFieldValue(p.name));
    else if (p.kind === "value") v[p.name] = gen.valueToCode(block, p.name, Order.NONE) || (p.check ? "0" : '""');
    else v[p.name] = String(block.getFieldValue(p.name));
  }
  return v;
}

/** 레지스트리의 모든 장치 블록 생성기를 등록한다 */
export function registerDeviceGenerators(gen: MicroPythonGenerator): void {
  for (const d of DEVICES) {
    if (d.setup) {
      const s = d.setup;
      gen.forBlock[s.blockType] = (block, g) => {
        const G = g as MicroPythonGenerator;
        G.addSetup(...s.lines(readValues(block, G, s.parts)));
        // provideFunction_ 은 앞쪽 공백 2칸을 INDENT(4칸)로 바꾸므로 도우미 본문은 2칸 단위로 적는다
        for (const h of s.helpers ?? []) G.provideHelper(h.name, [`def ${G.FUNCTION_NAME_PLACEHOLDER_}(${h.params}):`, ...h.body.map((l) => "  " + l)]);
        return "";
      };
    }
    for (const a of d.actions) gen.forBlock[a.blockType] = (block, g) => `${a.code(readValues(block, g as MicroPythonGenerator, a.parts))}\n`;
    for (const v of d.values) gen.forBlock[v.blockType] = (block, g) => [v.code(readValues(block, g as MicroPythonGenerator, v.parts)), v.order ?? Order.FUNCTION_CALL];
  }
}
