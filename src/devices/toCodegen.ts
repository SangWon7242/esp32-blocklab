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
 * 도우미 이름이 학생 변수(또는 꺼 둔 같은 이름의 함수 블록)와 겹쳐 다른 이름(stop2)으로 정의될 때를 위해, 코드 템플릿이 내는 도우미 호출을
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

/** 도우미 본문 안에서 같은 장치의 다른 도우미를 부르는 곳 (show_digit → hc595_shift) */
function markHelperCalls(line: string, helpers: string[], gen: MicroPythonGenerator): string {
  return helpers.reduce((l, name) => l.replace(new RegExp(String.raw`(?<![\w.])${name}\(`, "g"), `${gen.helperCall(name)}(`), line);
}

/** 도우미 매개변수 수 (`r, g, b` → 3) */
const arity = (params: string): number => params.split(",").map((p) => p.trim()).filter(Boolean).length;

/**
 * 작업판에서 이 도우미로 쓸 학생 함수 정의 블록: 이름이 같고, 켜져 있고, 매개변수 수가 같고, 값 블록(get_distance())이 부르면
 * 값을 돌려주는 함수(procedures_defreturn)인 것. 있으면 그 블록이 도우미다: 생성기는 명세 몸통의 def 를 만들지 않고 장치 블록은
 * 그 함수를 부른다 (수업 코드의 get_distance 를 함수 블록으로 보이고 고칠 수 있게). 이름만 같고 꼴이 다르면(7장 forward() 처럼
 * 매개변수가 없는 학생 함수) 그 함수를 부르면 실행 오류가 나므로 쓰지 않는다 — 명세 도우미를 겹치지 않는 이름(forward2)으로 만든다.
 */
function userHelperFunction(workspace: Blockly.Workspace, h: HelperSpec, needsValue: boolean): Blockly.Block | undefined {
  return workspace.getTopBlocks(false).find((b) =>
    (b.type === "procedures_defreturn" || (!needsValue && b.type === "procedures_defnoreturn")) &&
    b.isEnabled() && b.getFieldValue("NAME") === h.name && b.getVarModels().length === arity(h.params));
}

/**
 * 장치 블록이 부르는 짧은 도우미 함수 정의 줄. 작업판에 그 도우미로 쓸 학생 함수 블록이 있으면 만들지 않고, 호출은 그 함수의
 * 코드 이름(변수와 겹쳐 바뀐 이름일 수 있다)을 쓴다. 도우미끼리 부르는 것(show_digit → hc595_shift)은 같은 장치의 같은 이름 도우미로 본다.
 * provideFunction_ 은 앞쪽 공백 2칸을 INDENT(4칸)로 바꾸므로 도우미 본문은 2칸 단위로 적는다
 */
function provide(G: MicroPythonGenerator, block: Blockly.Block, h: HelperSpec, helpers: string[], needsValue: boolean): void {
  const own = userHelperFunction(block.workspace, h, needsValue);
  if (own) {
    G.useUserHelper(h.name);
    return;
  }
  G.provideHelper(h.name, [`def ${G.FUNCTION_NAME_PLACEHOLDER_}(${h.params}):`, ...h.body.map((l) => "  " + markHelperCalls(l, helpers, G))]);
  // 코드 지도 장부: 도우미 함수 줄은 그것을 부른 장치 블록 것
  G.noteHelperOwner(h.name, block.id);
}

/** 레지스트리의 모든 장치 블록 생성기를 등록한다 */
export function registerDeviceGenerators(gen: MicroPythonGenerator): void {
  for (const d of DEVICES) {
    // 이 장치의 도우미 이름 (호출 표시를 붙일 이름들)
    const helpers = actionHelpersOf(d).map((h) => h.name);
    for (const s of setupsOf(d)) {
      gen.forBlock[s.blockType] = (block, g) => {
        const G = g as MicroPythonGenerator;
        const lines = s.lines(readValues(block, G, s.parts));
        // 제자리 준비(반복 안의 `led = Pin(pin, Pin.OUT)`)는 보통 명령처럼 블록 자리에 쓴다
        if (s.inPlace) return `${lines.join("\n")}\n`;
        // 코드 지도 장부: 준비 줄은 끌어올려지므로 표식 대신 이 블록 id 를 적어 둔다.
        // 기다리는 준비 줄(`ip = wifi_connect(…)`)은 함수 정의 뒤에 둔다
        const at = G.addSetup(...lines);
        G.noteSetupBlock(block.id, at);
        if (s.afterHelpers) G.markLateSetup(at);
        return "";
      };
    }
    for (const a of d.actions) {
      gen.forBlock[a.blockType] = (block, g) => {
        const G = g as MicroPythonGenerator;
        // 도우미는 이 블록이 쓰일 때만 정의한다 (같은 이름은 provideFunction_ 이 한 번만 넣는다)
        for (const h of a.helpers ?? []) provide(G, block, h, helpers, false);
        return `${markLeadingHelper(a.code(readValues(block, G, a.parts)), helpers, G)}\n`;
      };
    }
    for (const v of d.values) {
      gen.forBlock[v.blockType] = (block, g) => {
        const G = g as MicroPythonGenerator;
        // 값 블록이 바로 부르는 도우미(맨 뒤)는 값을 돌려줘야 한다. 그 앞의 것(다른 도우미가 부르는 것)은 명령으로 불린다
        (v.helpers ?? []).forEach((h, i, all) => provide(G, block, h, helpers, i === all.length - 1));
        return [markLeadingHelper(v.code(readValues(block, G, v.parts)), helpers, G), v.order ?? Order.FUNCTION_CALL];
      };
    }
  }
}
