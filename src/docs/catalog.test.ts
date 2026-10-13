import { beforeAll, describe, expect, it } from "vitest";
import * as Blockly from "blockly";
import { registerBlocks, toolbox } from "@/blocks";
import { codeToBlocks } from "@/parser";
import { findDoc, getCatalog, searchDocs } from "./catalog";

/** 변수·함수 꾸러미(custom 카테고리)에 나오는 내장 블록 */
const CUSTOM_CATEGORY_TYPES = [
  "variables_get", "variables_set", "math_change",
  "procedures_defnoreturn", "procedures_defreturn", "procedures_callnoreturn", "procedures_callreturn", "procedures_ifreturn",
];

/** 코드 블록의 예시는 바로 그 코드 블록이 되는 코드이다 (블록으로 바꾸지 못한 코드를 담는 블록) */
const FALLBACK_BLOCKS = new Set(["code_stmt", "code_expr"]);

/** 시작·함수 정의 블록은 그 블록 하나만으로는 코드가 없을 수 있다 */
const EMPTY_CODE_OK = new Set(["start_program", "procedures_defnoreturn", "procedures_defreturn"]);

type ToolboxNode = { kind: string; type?: string; name?: string; contents?: ToolboxNode[] };
const categories = (toolbox as unknown as { contents: ToolboxNode[] }).contents.filter((c) => c.kind === "category");
const toolboxTypes = [...new Set(categories.flatMap((c) => (c.contents ?? []).filter((i) => i.kind === "block").map((i) => i.type!)))];
/** registerBlocks 가 꾸러미에서 뺀 블록(math_change·procedures_ifreturn)은 학생이 볼 수 없으니 사전에도 없다 */
const availableCustomTypes = () => CUSTOM_CATEGORY_TYPES.filter((t) => Blockly.Blocks[t]);
const allTypes = () => [...toolboxTypes, ...availableCustomTypes()];

const titleText = (type: string) => findDoc(type)!.title.map((p) => p.text).join(" ");

/** 블록 JSON 을 재귀로 훑어 블록 종류를 모은다 */
function blockTypes(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => blockTypes(n, out));
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.type === "string") out.push(o.type);
    Object.values(o).forEach((v) => blockTypes(v, out));
  }
  return out;
}

// registerBlocks 가 꾸러미에서 블록을 지운 뒤에 목록을 본다
beforeAll(() => registerBlocks());

describe("블록 사전 카탈로그", () => {
  it("툴박스의 모든 블록과 변수·함수 블록에 설명이 있다", () => {
    const types = allTypes();
    expect(types.length).toBeGreaterThan(50);
    for (const type of types) {
      const doc = findDoc(type);
      expect(doc, type).toBeDefined();
      expect(doc!.concept.length, type).toBeGreaterThanOrEqual(20);
      expect(doc!.example.title.trim().length, type).toBeGreaterThan(0);
      expect(doc!.example.code.trim().length, type).toBeGreaterThan(0);
    }
  });

  it("꾸러미에서 뺀 블록은 사전에도 없다", () => {
    for (const type of CUSTOM_CATEGORY_TYPES) if (!Blockly.Blocks[type]) expect(findDoc(type), type).toBeUndefined();
  });

  it("모든 툴박스 블록이 카탈로그에 있다", () => {
    for (const type of allTypes()) expect(findDoc(type), type).toBeDefined();
  });

  it("제목에 %n 자리가 남지 않고 비지 않는다", () => {
    for (const type of allTypes()) {
      const text = titleText(type);
      expect(text, type).not.toMatch(/%\d/);
      expect(text.trim().length, type).toBeGreaterThan(0);
    }
  });

  it("블록 하나의 코드가 비지 않는다", () => {
    for (const type of allTypes()) {
      if (EMPTY_CODE_OK.has(type)) continue;
      expect(findDoc(type)!.code.trim().length, type).toBeGreaterThan(0);
    }
  });

  it("블록 코드에 표시 문자가 남지 않는다", () => {
    for (const type of allTypes()) expect(findDoc(type)!.code, type).not.toMatch(/[-]/);
  });

  it("예시 코드가 코드 블록 없이 블록으로 돌아간다", () => {
    for (const type of allTypes()) {
      if (FALLBACK_BLOCKS.has(type)) continue;
      const result = codeToBlocks(findDoc(type)!.example.code);
      expect(result.ok, type).toBe(true);
      if (!result.ok) continue;
      expect(result.unparsed, type).toEqual([]);
      const types = blockTypes(result.json);
      expect(types, `${type}\n${findDoc(type)!.example.code}`).not.toContain("code_stmt");
      expect(types, `${type}\n${findDoc(type)!.example.code}`).not.toContain("code_expr");
    }
  });

  it("코드 블록의 예시는 그 코드 블록이 된다", () => {
    for (const type of FALLBACK_BLOCKS) {
      const result = codeToBlocks(findDoc(type)!.example.code);
      expect(result.ok, type).toBe(true);
      if (result.ok) expect(blockTypes(result.json), type).toContain(type);
    }
  });

  it("대표 블록의 제목과 코드", () => {
    expect(findDoc("flow_wait")!.code).toBe("time.sleep(1)");
    expect(findDoc("esp_pin_setup")!.code).toBe("led = Pin(26, Pin.OUT)");
    expect(findDoc("math_number")!.code).toBe("0");
    expect(findDoc("dev_led_blink")!.title).toEqual([
      { kind: "slot", text: "led" }, { kind: "text", text: "을(를)" }, { kind: "slot", text: "0.5" },
      { kind: "text", text: "초 간격으로" }, { kind: "slot", text: "3" }, { kind: "text", text: "번 깜빡이기" },
    ]);
    expect(findDoc("esp_pin_setup")!.category).toEqual({ id: "pin", name: "핀", colour: "#00b6b1" });
    expect(findDoc("flow_wait")!.category).toEqual({ id: "flow", name: "흐름", colour: "#19baea" });
    expect(findDoc("flow_wait")!.tooltip).toBe("time.sleep(초)");
  });

  it("같은 종류가 다른 모양으로 또 나오면 variants 에 둔다", () => {
    const doc = findDoc("controls_if")!;
    expect(doc.variants?.length).toBe(1);
    expect(doc.variants![0].map((p) => p.text).join(" ")).toContain("아니면");
    // 핀 출력 블록은 LED 카테고리에도 같은 모양으로 나온다: 같은 제목은 variants 에 넣지 않는다
    expect(findDoc("esp_pin_setup")!.variants).toBeUndefined();
  });

  it("검색: 공백으로 나눈 낱말이 모두 들어 있는 블록", () => {
    expect(searchDocs("깜빡").map((d) => d.type)).toContain("dev_led_blink");
    expect(searchDocs("duty").map((d) => d.type)).toContain("dev_pwm_duty10");
    expect(searchDocs("DUTY").map((d) => d.type)).toContain("dev_pwm_duty10");
    expect(searchDocs("led 깜빡").map((d) => d.type)).toContain("dev_led_blink");
    expect(searchDocs("깜빡 없는낱말")).toEqual([]);
  });

  it("카테고리 순서가 툴박스 순서와 같다", () => {
    expect(getCatalog().map((c) => c.name)).toEqual([
      "시작", "흐름", "판단", "계산", "변수", "함수", "핀", "LED", "버튼·스위치", "센서", "소리", "모터", "화면", "입력장치", "코드",
    ]);
    expect(getCatalog().map((c) => c.name)).toEqual(categories.map((c) => c.name));
  });

  it("카탈로그는 한 번 만들어 둔다", () => {
    expect(getCatalog()).toBe(getCatalog());
  });
});
