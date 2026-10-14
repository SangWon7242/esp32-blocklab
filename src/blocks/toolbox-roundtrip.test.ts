import { describe, expect, it } from "vitest";
import * as Blockly from "blockly";
import { workspaceJsonToCode, type WorkspaceJson } from "@/codegen";
import { codeToBlocks } from "@/parser";
import { registerBlocks, toolbox, variableFlyout } from "./index";
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
 * flyoutCategory 는 그려진 작업판이 필요하므로, 버튼만 무시하는 대리 작업판으로 꺼낸다.
 * 변수 꾸러미는 작업판이 쓰는 variableFlyout (정하기 · 만큼 바꾸기 · 변수 값).
 */
function dynamicEntries(): B[] {
  const ws = new Blockly.Workspace();
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
  // load 가 작업판(변수 포함)을 비우므로 변수는 그 뒤에 만든다
  ws.getVariableMap().createVariable("x");
  const fake = Object.assign(Object.create(ws), { registerButtonCallback() {} }) as Blockly.WorkspaceSvg;
  const vars = (variableFlyout(fake) as unknown as Record<string, unknown>[]).filter((i) => i.kind === "block") as B[];
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
    case "variables_get":
    case "var_change": return { body: [{ type: "variables_set", fields: { VAR: { name: varName ?? "x" } } }], tops: [] };
    case "list_create":
    case "list_create_from": return { body: [], tops: [] };
    case "procedures_callnoreturn":
    case "procedures_callreturn": {
      const name = (entry.extraState as { name: string }).name;
      return { body: [], tops: [defOf[name]] };
    }
    default:
      // 리스트 블록(변수 칸 items)·리스트 변수를 끼운 블록(n번째 항목·길이·들어 있는가·각 항목 반복)은 그 리스트를 먼저 만든다
      if (entry.type.startsWith("list_") || readsVariable(entry, "items")) return { body: [listOf("items")], tops: [] };
      return { body: deviceSetup(entry.type, varName), tops: [] };
  }
}

const listOf = (name: string): B => ({ type: "list_create_from", fields: { VAR: { name }, ITEMS: "1, 2, 3" } });

/** 블록의 입력 아래 어딘가에 그 이름의 variables_get 이 있는지 */
function readsVariable(node: unknown, name: string): boolean {
  if (!node || typeof node !== "object") return false;
  const o = node as Record<string, unknown>;
  if (o.type === "variables_get" && (o.fields as { VAR?: { name?: string } } | undefined)?.VAR?.name === name) return true;
  return Object.values(o).some((v) => readsVariable(v, name));
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

describe("툴박스의 모든 블록: 블록 → 코드 → 블록 → 같은 코드", () => {
  const entries = [...staticEntries(), ...dynamicEntries()];

  it("정적·변수·함수 꾸러미 블록을 모두 모았다", () => {
    const types = new Set(entries.map((e) => e.type));
    for (const t of ["start_program", "code_stmt", "esp_oled_show", "variables_set", "var_change", "variables_get", "procedures_defnoreturn", "procedures_callreturn", "list_append", "flow_for_each"]) expect(types, t).toContain(t);
  });

  for (const entry of entries) {
    it(`${entry.type}${entry.extraState ? " " + JSON.stringify(entry.extraState) : ""}`, () => {
      const code = workspaceJsonToCode(programFor(entry));
      const r = codeToBlocks(code);
      expect(r.ok, code).toBe(true);
      if (!r.ok) return;
      expect(r.unparsed, code).toEqual([]);
      // 되돌린 블록으로 다시 만든 코드가 글자까지 같아야 한다 (왕복이 고정점)
      expect(workspaceJsonToCode(r.json)).toBe(code);
    });
  }
});
