import type * as Blockly from "blockly";
import { Order } from "blockly/python";
import type { MicroPythonGenerator } from "@/codegen/generator";
import { actionHelpersOf, DEVICES, setupsOf } from "./registry";
import type { HelperSpec, Part, Values } from "./types";
import { LEADING_ASSIGN } from "./specs/common";

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

/**
 * 도우미 이름이 사용자 함수·변수와 겹쳐 다른 이름(stop2)으로 정의될 때를 위해, 코드 템플릿이 내는 도우미 호출을
 * 생성기의 helperCall 표시로 바꾼다 (finish 가 실제 이름으로 되돌린다).
 * 장치 명령·값 템플릿은 도우미를 늘 맨 앞에서 부른다(devices.test.ts 불변식). 그래서 맨 앞만 보면 되고,
 * 템플릿에 끼워진 값 입력 코드(학생 함수 호출일 수 있다)는 건드리지 않는다.
 */
function markLeadingHelper(code: string, helpers: string[], gen: MicroPythonGenerator): string {
  // 이름들에 담는 꼴(`ip = wifi_connect(…)`, `conn, path, query = web_accept(server)`)이면 = 뒤가 맨 앞이다
  const prefix = LEADING_ASSIGN.exec(code)?.[0] ?? "";
  const rest = code.slice(prefix.length);
  const h = helpers.find((name) => rest.startsWith(`${name}(`));
  return h ? prefix + gen.helperCall(h) + rest.slice(h.length) : code;
}

/**
 * 맨 앞이 아닌 자리에서 부르는 선택 도우미 (`web_send(conn, web_page(…))` 의 web_page). 템플릿에서 선택 도우미 호출은
 * 값 칸보다 앞에 오므로(devices.test.ts 불변식) 처음 나온 것 하나만 표시한다.
 */
function markActionHelper(code: string, helper: string, gen: MicroPythonGenerator): string {
  if (code.includes(gen.helperCall(helper))) return code;
  return code.replace(new RegExp(String.raw`(?<![\w.])${helper}\(`), `${gen.helperCall(helper)}(`);
}

/** 도우미 본문 안에서 같은 준비의 다른 도우미를 부르는 곳 (show_digit → hc595_shift) */
function markHelperCalls(line: string, helpers: string[], gen: MicroPythonGenerator): string {
  return helpers.reduce((l, name) => l.replace(new RegExp(String.raw`(?<![\w.])${name}\(`, "g"), `${gen.helperCall(name)}(`), line);
}

/** 도우미 함수 정의 줄. provideFunction_ 은 앞쪽 공백 2칸을 INDENT(4칸)로 바꾸므로 도우미 본문은 2칸 단위로 적는다 */
function provide(G: MicroPythonGenerator, h: HelperSpec, helpers: string[], blockId: string): void {
  G.provideHelper(h.name, [`def ${G.FUNCTION_NAME_PLACEHOLDER_}(${h.params}):`, ...h.body.map((l) => "  " + markHelperCalls(l, helpers, G))]);
  // 코드 지도 장부: 도우미 함수 줄은 그것을 준비한(준비 블록) 또는 부른(선택 도우미의 명령 블록) 블록 것
  G.noteHelperOwner(h.name, blockId);
}

/** 레지스트리의 모든 장치 블록 생성기를 등록한다 */
export function registerDeviceGenerators(gen: MicroPythonGenerator): void {
  for (const d of DEVICES) {
    // 이 장치의 도우미 이름: 준비 블록 도우미 + 명령 블록의 선택 도우미 (호출 표시를 붙일 이름들)
    const helpers = [...setupsOf(d).flatMap((s) => s.helpers ?? []), ...actionHelpersOf(d)].map((h) => h.name);
    for (const s of setupsOf(d)) {
      gen.forBlock[s.blockType] = (block, g) => {
        const G = g as MicroPythonGenerator;
        const lines = s.lines(readValues(block, G, s.parts));
        // 제자리 준비(반복 안의 `led = Pin(pin, Pin.OUT)`)는 보통 명령처럼 블록 자리에 쓴다
        if (s.inPlace) return `${lines.join("\n")}\n`;
        // 코드 지도 장부: 준비 줄과 도우미 함수는 끌어올려지므로 표식 대신 이 블록 id 를 적어 둔다.
        // 도우미를 부르는 준비 줄(`ip = wifi_connect(…)`)은 함수 정의 뒤에 둔다
        const marked = s.afterHelpers ? lines.map((l) => markLeadingHelper(l, helpers, G)) : lines;
        const at = G.addSetup(...marked);
        G.noteSetupBlock(block.id, at);
        if (s.afterHelpers) G.markLateSetup(at);
        for (const h of s.helpers ?? []) provide(G, h, helpers, block.id);
        return "";
      };
    }
    for (const a of d.actions) {
      gen.forBlock[a.blockType] = (block, g) => {
        const G = g as MicroPythonGenerator;
        // 선택 도우미는 이 블록이 쓰일 때만 정의한다 (같은 이름은 provideFunction_ 이 한 번만 넣는다)
        if (a.helper) provide(G, a.helper, helpers, block.id);
        const code = markLeadingHelper(a.code(readValues(block, G, a.parts)), helpers, G);
        return `${a.helper ? markActionHelper(code, a.helper.name, G) : code}\n`;
      };
    }
    for (const v of d.values) {
      gen.forBlock[v.blockType] = (block, g) => {
        const G = g as MicroPythonGenerator;
        return [markLeadingHelper(v.code(readValues(block, G, v.parts)), helpers, G), v.order ?? Order.FUNCTION_CALL];
      };
    }
  }
}
