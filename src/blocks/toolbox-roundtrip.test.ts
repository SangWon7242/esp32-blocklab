import { describe, expect, it } from "vitest";
import * as Blockly from "blockly";
import { workspaceJsonToCode, type WorkspaceJson } from "@/codegen";
import { codeToBlocks } from "@/parser";
import { registerBlocks, toolbox } from "./index";
import { findActionByBlock, findValueByBlock } from "@/devices/registry";

type B = Record<string, unknown> & { type: string };

// 블록 목록을 테스트 수집 단계에서 만들므로 beforeAll 보다 먼저 등록한다
registerBlocks();

/** 툴박스(정적 카테고리)의 블록 항목을 모두 */
function staticEntries(): B[] {
  const out: B[] = [];
  const walk = (items: unknown[]): void => {
    for (const item of items as Record<string, unknown>[]) {
      if (item.kind === "block") {
        const { kind: _kind, gap: _gap, ...rest } = item;
        out.push(rest as B);
      }
      if (Array.isArray(item.contents)) walk(item.contents);
    }
  };
  walk((toolbox as { contents: unknown[] }).contents);
  return out;
}

/**
 * 변수·함수 꾸러미(custom: VARIABLE / PROCEDURE)가 내놓는 블록. 버튼 콜백을 등록하는
 * flyoutCategory 는 그려진 작업판이 필요하므로, 같은 목록을 만드는 jsonFlyoutCategoryBlocks 와
 * 버튼만 무시하는 대리 작업판으로 꺼낸다.
 */
function dynamicEntries(): B[] {
  const ws = new Blockly.Workspace();
  ws.getVariableMap().createVariable("x");
  const vars = Blockly.Variables.jsonFlyoutCategoryBlocks(ws, ws.getVariableMap().getVariablesOfType(""), true) as unknown as B[];
  Blockly.serialization.workspaces.load(
    {
      blocks: {
        languageVersion: 0,
        blocks: [
          { type: "procedures_defnoreturn", fields: { NAME: "blink" } },
          { type: "procedures_defreturn", fields: { NAME: "twice" }, inputs: { RETURN: { block: { type: "math_number", fields: { NUM: 2 } } } } },
        ],
      },
    },
    ws,
  );
  const fake = Object.assign(Object.create(ws), { registerButtonCallback() {} }) as Blockly.WorkspaceSvg;
  const procs = (Blockly.Procedures.flyoutCategory(fake) as unknown as Record<string, unknown>[]).filter((i) => i.kind === "block") as B[];
  ws.dispose();
  return [...vars, ...procs].map(({ kind: _kind, gap: _gap, ...rest }) => rest as B);
}

const defOf: Record<string, B> = {
  blink: { type: "procedures_defnoreturn", fields: { NAME: "blink" } },
  twice: { type: "procedures_defreturn", fields: { NAME: "twice" }, inputs: { RETURN: { block: { type: "math_number", fields: { NUM: 2 } } } } },
};
const setup = (type: string, fields: Record<string, unknown> = {}): B => ({ type, fields });

/** 블록이 다시 블록으로 돌아오려면 앞에 있어야 하는 준비 블록 (핀 이름·변수·함수 정의) */
function prerequisites(entry: B): { body: B[]; tops: B[] } {
  const varName = (entry.fields as { VAR?: { name?: string } } | undefined)?.VAR?.name;
  switch (entry.type) {
    case "esp_pin_write": return { body: [setup("esp_pin_setup", { VAR: { name: varName ?? "led" } })], tops: [] };
    case "esp_pin_read": return { body: [setup("esp_pin_setup", { VAR: { name: "echo" }, MODE: "IN", PIN: 12 })], tops: [] };
    case "esp_servo_door": return { body: [setup("esp_servo_setup", { VAR: { name: "servo" } })], tops: [] };
    case "esp_pwm_duty": return { body: [setup("esp_pwm_setup", { VAR: { name: "pwm" } })], tops: [] };
    case "esp_distance": return { body: [setup("esp_ultrasonic_setup")], tops: [] };
    case "esp_oled_show": return { body: [setup("esp_oled_setup")], tops: [] };
    case "variables_get": return { body: [{ type: "variables_set", fields: { VAR: { name: varName ?? "x" } } }], tops: [] };
    case "procedures_callnoreturn":
    case "procedures_callreturn": {
      const name = (entry.extraState as { name: string }).name;
      return { body: [], tops: [defOf[name]] };
    }
    default: return { body: deviceSetup(entry.type, varName), tops: [] };
  }
}

/** 장치 명령·값 블록: 그 장치의 준비 블록 (변수 칸은 같은 이름으로). 준비가 없는 LED 는 출력 핀 준비 */
function deviceSetup(type: string, varName: string | undefined): B[] {
  const device = (findActionByBlock(type) ?? findValueByBlock(type))?.device;
  if (!device || device.id === "print") return [];
  const s = device.setup;
  if (!s) return [setup("esp_pin_setup", { VAR: { name: varName ?? "led" } })];
  return [setup(s.blockType, s.parts.some((p) => p.kind === "var") && varName ? { VAR: { name: varName } } : {})];
}

/** 문장 블록은 시작 블록 안에, 값 블록은 print 안에, 머리 블록(시작·함수 정의)은 맨 위에 */
function programFor(entry: B): WorkspaceJson {
  const probe = new Blockly.Workspace();
  const b = probe.newBlock(entry.type);
  const kind = b.outputConnection ? "value" : b.previousConnection ? "statement" : "top";
  probe.dispose();
  const { body, tops } = prerequisites(entry);
  let stack = [...body];
  if (kind === "statement") stack.push(entry);
  if (kind === "value") stack.push({ type: "esp_print", inputs: { VALUE: { block: entry } } });
  stack = stack.map((x) => ({ ...x }));
  for (let i = 0; i < stack.length - 1; i++) stack[i].next = { block: stack[i + 1] };
  const start: B = { type: "start_program", x: 0, y: 0, ...(stack[0] ? { inputs: { BODY: { block: stack[0] } } } : {}) };
  const topBlocks = entry.type === "start_program" ? [start] : [...tops, ...(kind === "top" ? [entry] : []), start];
  return { blocks: { languageVersion: 0, blocks: topBlocks.map((t, i) => ({ x: 0, y: 200 * i, ...t })) } } as unknown as WorkspaceJson;
}

describe("툴박스의 모든 블록: 블록 → 코드 → 블록", () => {
  const entries = [...staticEntries(), ...dynamicEntries()];

  it("정적·변수·함수 꾸러미 블록을 모두 모았다", () => {
    const types = new Set(entries.map((e) => e.type));
    for (const t of ["start_program", "code_stmt", "esp_oled_show", "variables_set", "variables_get", "procedures_defnoreturn", "procedures_callreturn"]) expect(types, t).toContain(t);
  });

  for (const entry of entries) {
    it(`${entry.type}${entry.extraState ? " " + JSON.stringify(entry.extraState) : ""}`, () => {
      const code = workspaceJsonToCode(programFor(entry));
      const r = codeToBlocks(code);
      expect(r.ok, code).toBe(true);
      if (r.ok) expect(r.unparsed, code).toEqual([]);
    });
  }
});
