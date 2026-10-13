import { describe, expect, it, beforeAll } from "vitest";
import * as Blockly from "blockly";
import { FieldMultilineInput } from "@blockly/field-multilineinput";
import { BUILTIN_BLOCK_TYPES, CUSTOM_BLOCK_TYPES, entryTheme, registerBlocks, toolbox } from "./index";

beforeAll(() => {
  registerBlocks();
  registerBlocks(); // 두 번 불러도 오류가 없어야 한다
});

describe("블록 정의", () => {
  it("커스텀 블록이 모두 등록된다", () => {
    for (const type of CUSTOM_BLOCK_TYPES) expect(Blockly.Blocks[type], type).toBeDefined();
  });

  it("헤드리스 작업판에서 모든 블록을 만들 수 있다", () => {
    const ws = new Blockly.Workspace();
    for (const type of [...CUSTOM_BLOCK_TYPES, ...BUILTIN_BLOCK_TYPES]) {
      const block = ws.newBlock(type);
      expect(block.type).toBe(type);
    }
    ws.dispose();
  });

  it("필드 이름이 약속과 같다", () => {
    const ws = new Blockly.Workspace();
    const pin = ws.newBlock("esp_pin_setup");
    expect(pin.getField("PIN")).toBeTruthy();
    expect(pin.getField("MODE")).toBeTruthy();
    expect(pin.getField("VAR")).toBeTruthy();
    expect(pin.getFieldValue("MODE")).toBe("OUT");
    const arith = ws.newBlock("calc_arith");
    expect(arith.getInput("A")).toBeTruthy();
    expect(arith.getInput("B")).toBeTruthy();
    expect(arith.getFieldValue("OP")).toBe("ADD");
    const start = ws.newBlock("start_program");
    expect(start.getInput("BODY")).toBeTruthy();
    expect(start.previousConnection).toBeNull();
    ws.dispose();
  });

  it("만약 블록은 흐름 색(loop_blocks)이다", () => {
    const ws = new Blockly.Workspace();
    expect(ws.newBlock("controls_if").getStyleName()).toBe("loop_blocks");
    ws.dispose();
  });

  it("반복 블록은 조건이 먼저, 모드 선택이 뒤에 온다", () => {
    const ws = new Blockly.Workspace();
    const loop = ws.newBlock("controls_whileUntil");
    expect(loop.getFieldValue("MODE")).toBe("WHILE");
    expect(loop.getInput("BOOL")).toBeTruthy();
    expect(loop.getInput("DO")).toBeTruthy();
    expect(loop.inputList[0].name).toBe("BOOL");
    ws.dispose();
  });

  it("한국어 문구가 엔트리 표현으로 바뀐다", () => {
    expect(Blockly.Msg.CONTROLS_IF_MSG_THEN).toBe("이라면");
    expect(Blockly.Msg.CONTROLS_IF_MSG_ELSE).toBe("아니면");
    expect(Blockly.Msg.VARIABLES_SET).toBe("%1 를 %2 로 정하기");
    expect(Blockly.Msg.CONTROLS_REPEAT_TITLE).toBe("%1회 반복"); // 로케일이 적용됐다는 표식
  });
});

describe("테마와 툴박스", () => {
  it("엔트리 색을 가진 블록 스타일이 있다", () => {
    expect(entryTheme.blockStyles.start_blocks.colourPrimary).toBe("#00b400");
    expect(entryTheme.blockStyles.loop_blocks.colourPrimary).toBe("#19baea");
    expect(entryTheme.blockStyles.logic_blocks.colourPrimary).toBe("#4562f5");
    expect(entryTheme.blockStyles.hardware_blocks.colourPrimary).toBe("#00b6b1");
    expect(entryTheme.blockStyles.code_blocks.colourPrimary).toBe("#8aa3b2");
  });

  it("카테고리 순서가 엔트리와 같다", () => {
    const names = (toolbox as { contents: { name: string }[] }).contents.map((c) => c.name);
    expect(names).toEqual(["시작", "흐름", "판단", "계산", "변수", "함수", "핀", "LED", "버튼·스위치", "센서", "소리", "모터", "화면", "입력장치", "코드"]);
  });

  it("툴박스의 모든 블록 type이 정의돼 있다", () => {
    const types: string[] = [];
    const walk = (items: unknown[]): void => {
      for (const item of items as { kind?: string; type?: string; contents?: unknown[] }[]) {
        if (item.kind === "block" && item.type) types.push(item.type);
        if (item.contents) walk(item.contents);
      }
    };
    walk((toolbox as { contents: unknown[] }).contents);
    expect(types.length).toBeGreaterThan(20);
    for (const type of types) expect(Blockly.Blocks[type], type).toBeDefined();
  });
});

describe("최종 리뷰", () => {
  it("C3 변수 꾸러미가 깨진 코드를 내는 math_change·procedures_ifreturn 을 내놓지 않는다", () => {
    expect(Blockly.Blocks.math_change).toBeUndefined();
    expect(Blockly.Blocks.procedures_ifreturn).toBeUndefined();
  });
  it("C3 변수 꾸러미에는 변수 만들기·정하기·값만 있다", () => {
    const ws = new Blockly.Workspace();
    ws.getVariableMap().createVariable("x");
    // flyoutCategory 가 버튼 뒤에 붙이는 블록 목록 (math_change 를 넣을지 묻는 includeChangeBlocks = true 그대로)
    const items = Blockly.Variables.jsonFlyoutCategoryBlocks(ws, ws.getVariableMap().getVariablesOfType(""), true) as { type?: string }[];
    expect(items.map((i) => i.type)).toEqual(["variables_set", "variables_get"]);
    ws.dispose();
  });
  it("I7 코드 블록(문장)은 여러 줄 칸, 코드 식은 한 줄 칸", () => {
    const ws = new Blockly.Workspace();
    expect(ws.newBlock("code_stmt").getField("CODE")).toBeInstanceOf(FieldMultilineInput);
    expect(ws.newBlock("code_expr").getField("CODE")).not.toBeInstanceOf(FieldMultilineInput);
    ws.dispose();
  });
});

describe("함수 이름 검사", () => {
  for (const type of ["procedures_defnoreturn", "procedures_defreturn"]) {
    it(`${type} 이름 칸은 파이썬에서 쓸 수 있는 이름만 받는다`, () => {
      const ws = new Blockly.Workspace();
      const def = ws.newBlock(type);
      const name = def.getField("NAME")!;
      name.setValue("blink");
      expect(name.getValue()).toBe("blink");
      for (const bad of ["함수", "while", "print", "2go", ""]) {
        name.setValue(bad);
        expect(name.getValue(), bad).toBe("blink");
      }
      name.setValue("blink2");
      expect(name.getValue()).toBe("blink2");
      ws.dispose();
    });
  }

  it("이름을 바꾸면 호출 블록도 따라 바뀐다 (Blockly 의 원래 이름 바꾸기는 그대로)", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load({
      blocks: { languageVersion: 0, blocks: [
        { type: "procedures_defnoreturn", fields: { NAME: "blink" } },
        { type: "procedures_callnoreturn", y: 200, extraState: { name: "blink" } },
      ] },
    }, ws);
    const def = ws.getBlocksByType("procedures_defnoreturn", false)[0];
    def.getField("NAME")!.setValue("flash");
    expect(ws.getBlocksByType("procedures_callnoreturn", false)[0].getFieldValue("NAME")).toBe("flash");
    ws.dispose();
  });

  it("불러온 함수 이름은 그대로 둔다 (코드에서 온 show·get_distance 같은 사용자 함수)", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load({
      blocks: { languageVersion: 0, blocks: [{ type: "procedures_defnoreturn", fields: { NAME: "show" } }] },
    }, ws);
    expect(ws.getBlocksByType("procedures_defnoreturn", false)[0].getFieldValue("NAME")).toBe("show");
    ws.dispose();
  });
});
