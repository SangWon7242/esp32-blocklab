import { describe, expect, it, beforeAll } from "vitest";
import * as Blockly from "blockly";
import { FieldMultilineInput } from "@blockly/field-multilineinput";
import { BUILTIN_BLOCK_TYPES, CUSTOM_BLOCK_TYPES, entryTheme, registerBlocks, registerVariableFlyout, toolbox, variableFlyout } from "./index";
import { CATEGORY_COLORS, CATEGORY_IDS, type CategoryId } from "./colors";
import { DEVICES } from "@/devices/registry";

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
    expect(Blockly.Msg.VARIABLES_SET).toBe("%1 을(를) %2 로 정하기");
    expect(Blockly.Msg.CONTROLS_REPEAT_TITLE).toBe("%1회 반복"); // 로케일이 적용됐다는 표식
  });
});

describe("테마와 툴박스", () => {
  it("엔트리 색을 가진 블록 스타일이 있다", () => {
    expect(entryTheme.blockStyles.start_blocks.colourPrimary).toBe("#00b400");
    expect(entryTheme.blockStyles.loop_blocks.colourPrimary).toBe("#19baea");
    expect(entryTheme.blockStyles.logic_blocks.colourPrimary).toBe("#4562f5");
    expect(entryTheme.blockStyles.code_blocks.colourPrimary).toBe("#8aa3b2");
  });

  it("장치 블록(준비·명령·값)은 테마 스타일이 아니라 자기 장치의 colour 를 쓴다", () => {
    const ws = new Blockly.Workspace();
    for (const d of DEVICES) {
      for (const s of [...(d.setup ? [d.setup] : []), ...d.actions, ...d.values]) {
        const block = ws.newBlock(s.blockType);
        expect(block.getStyleName(), s.blockType).toBe("");
        expect(block.getColour().toLowerCase(), s.blockType).toBe(d.colour);
      }
    }
    // 같은 카테고리라도 장치가 다르면 블록 색이 다르다 (조도 센서 준비 ≠ 가변저항 준비 ≠ 초음파)
    const colour = (t: string) => ws.newBlock(t).getColour();
    expect(new Set([colour("dev_light_setup"), colour("dev_knob_setup"), colour("esp_ultrasonic_setup")]).size).toBe(3);
    // 다른 카테고리에도 보여 주는 블록은 원래 장치 색: LED 카테고리의 핀 출력 블록 = 핀 색
    expect(colour("esp_pin_setup").toLowerCase()).toBe(CATEGORY_COLORS.pin.primary);
    ws.dispose();
  });

  it("카테고리마다 자기 색 스타일과 아이콘 id 가 있고, 16개 색은 모두 다르다", () => {
    const cats = (toolbox as { contents: { name: string; categorystyle: string; icon?: string }[] }).contents;
    expect(cats.map((c) => c.icon)).toEqual(CATEGORY_IDS);
    for (const c of cats) {
      expect(c.categorystyle, c.name).toBe(`${c.icon}_category`);
      expect(entryTheme.categoryStyles[c.categorystyle]?.colour, c.name).toBe(CATEGORY_COLORS[c.icon as CategoryId].primary);
    }
    const primaries = CATEGORY_IDS.map((id) => CATEGORY_COLORS[id].primary.toLowerCase());
    expect(new Set(primaries).size).toBe(16);
  });

  it("카테고리 순서가 엔트리와 같다", () => {
    const names = (toolbox as { contents: { name: string }[] }).contents.map((c) => c.name);
    expect(names).toEqual(["시작", "흐름", "판단", "계산", "변수", "리스트", "함수", "핀", "LED", "버튼·스위치", "센서", "소리", "모터", "화면", "입력장치", "코드"]);
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

describe("계획 6 판단·계산 블록", () => {
  const ws = () => new Blockly.Workspace();
  it("칸 이름과 출력 형식이 약속과 같다", () => {
    const w = ws();
    const spec: [string, string[], string | null][] = [
      ["judge_between", ["A", "LOW", "HIGH"], "Boolean"],
      ["judge_contains", ["CONTAINER", "ITEM"], "Boolean"],
      ["calc_random", ["A", "B"], "Number"],
      ["calc_round", ["X"], "Number"],
      ["calc_minmax", ["A", "B"], "Number"],
      ["calc_len", ["X"], "Number"],
      ["calc_item", ["X", "INDEX"], null],
      ["calc_ticks", [], "Number"],
      ["calc_elapsed", ["X"], "Number"],
      ["calc_map", ["X", "A", "B", "C", "D"], "Number"],
    ];
    for (const [type, inputs, output] of spec) {
      const b = w.newBlock(type);
      expect(b.inputList.filter((i) => i.connection).map((i) => i.name), type).toEqual(inputs);
      expect(b.outputConnection?.getCheck() ?? null, type).toEqual(output === null ? null : [output]);
    }
    expect(w.newBlock("calc_round").getFieldValue("OP")).toBe("ROUND");
    expect(w.newBlock("calc_minmax").getFieldValue("OP")).toBe("MAX");
    w.dispose();
  });
  it("계산 블록에 ^(POW) 가 있다", () => {
    const op = ws().newBlock("calc_arith").getField("OP") as Blockly.FieldDropdown;
    expect(op.getOptions(false).map((o) => o[1])).toContain("POW");
  });
  it("n번째 항목 문구에 (0부터) 가 있다", () => {
    const b = ws().newBlock("calc_item");
    expect(b.inputList.flatMap((i) => i.fieldRow.map((f) => f.getText())).join(" ")).toContain("(0부터)");
  });
  it("툴박스 판단·계산 카테고리에 새 블록이 있다", () => {
    const cat = (name: string) => (toolbox as { contents: { name: string; contents?: { type?: string }[] }[] }).contents.find((c) => c.name === name)!.contents!.map((b) => b.type);
    expect(cat("판단")).toEqual(expect.arrayContaining(["judge_between", "judge_contains"]));
    expect(cat("계산")).toEqual(expect.arrayContaining(["calc_random", "calc_round", "calc_minmax", "calc_len", "calc_item", "calc_ticks", "calc_elapsed", "calc_map"]));
  });
});

describe("계획 6 변수·리스트·흐름 블록", () => {
  const ws = () => new Blockly.Workspace();
  /** 버튼 콜백만 무시하는 대리 작업판 (flyoutCategory 는 그려진 작업판의 registerButtonCallback 을 부른다) */
  const fakeSvg = (w: Blockly.Workspace) => Object.assign(Object.create(w), { registerButtonCallback() {} }) as Blockly.WorkspaceSvg;

  it("칸 이름·변수 칸 기본 이름·출력 형식이 약속과 같다", () => {
    const w = ws();
    const spec: [string, string[], string | null, string][] = [
      ["var_change", ["DELTA"], null, "count"],
      ["list_create", [], null, "items"],
      ["list_create_from", [], null, "items"],
      ["list_append", ["V"], null, "items"],
      ["list_insert", ["I", "V"], null, "items"],
      ["list_remove_at", ["I"], null, "items"],
      ["list_remove_value", ["V"], null, "items"],
      ["list_clear", [], null, "items"],
      ["list_set", ["I", "V"], null, "items"],
      ["list_index", ["V"], "Number", "items"],
      ["flow_for_each", ["LIST", "DO"], null, "item"],
      ["flow_for_range", ["FROM", "TO", "DO"], null, "n"],
      ["flow_for_range_step", ["FROM", "TO", "STEP", "DO"], null, "n"],
    ];
    for (const [type, inputs, output, varName] of spec) {
      const b = w.newBlock(type);
      expect(b.inputList.filter((i) => i.connection).map((i) => i.name), type).toEqual(inputs);
      expect(b.outputConnection?.getCheck() ?? null, type).toEqual(output === null ? null : [output]);
      expect((b.getField("VAR") as Blockly.FieldVariable).getVariable()?.getName(), type).toBe(varName);
    }
    expect(w.newBlock("list_create_from").getFieldValue("ITEMS")).toBe("1, 2, 3");
    for (const type of ["flow_break", "flow_continue"]) {
      const b = w.newBlock(type);
      expect(b.previousConnection && b.nextConnection, type).toBeTruthy();
      expect(b.inputList.filter((i) => i.connection), type).toEqual([]);
    }
    w.dispose();
  });

  it("번째·위치 블록 문구에 (0부터) 가 있다", () => {
    const w = ws();
    for (const type of ["list_insert", "list_remove_at", "list_set", "list_index"]) {
      const b = w.newBlock(type);
      expect(b.inputList.flatMap((i) => i.fieldRow.map((f) => f.getText())).join(" "), type).toContain("(0부터)");
    }
    w.dispose();
  });

  it("스타일: 리스트 블록은 list_blocks(리스트 카테고리 색), 만큼 바꾸기는 변수, 새 반복은 흐름", () => {
    const w = ws();
    expect(entryTheme.blockStyles.list_blocks.colourPrimary).toBe(CATEGORY_COLORS.list.primary);
    for (const type of ["list_create", "list_append", "list_index", "list_reversed"]) expect(w.newBlock(type).getStyleName(), type).toBe("list_blocks");
    expect(w.newBlock("var_change").getStyleName()).toBe("variable_blocks");
    for (const type of ["flow_for_each", "flow_for_range", "flow_for_range_step", "flow_break", "flow_continue"]) expect(w.newBlock(type).getStyleName(), type).toBe("loop_blocks");
    w.dispose();
  });

  it("툴박스: 리스트 카테고리는 변수와 함수 사이, 리스트 블록과 공용 블록(항목·길이·들어 있는가·각 항목 반복)", () => {
    const cats = (toolbox as { contents: { name: string; icon?: string; contents?: { type?: string }[] }[] }).contents;
    const at = cats.findIndex((c) => c.name === "리스트");
    expect(cats[at - 1].name).toBe("변수");
    expect(cats[at + 1].name).toBe("함수");
    expect(cats[at].icon).toBe("list");
    expect(cats[at].contents!.map((b) => b.type)).toEqual([
      "list_create", "list_create_from", "list_append", "list_insert", "list_remove_at", "list_remove_value", "list_clear", "list_set",
      "calc_item", "calc_len", "list_index", "list_reversed", "judge_contains", "flow_for_each",
    ]);
    const flow = cats.find((c) => c.name === "흐름")!.contents!.map((b) => b.type);
    expect(flow).toEqual(expect.arrayContaining(["flow_for_range", "flow_for_each", "flow_break", "flow_continue", "flow_repeat_n"]));
    // 기다리기 블록 다음, 새 반복 블록 앞에 "반복 더 보기" 글자 표시
    const flowItems = cats.find((c) => c.name === "흐름")!.contents! as { kind?: string; type?: string; text?: string }[];
    const labelAt = flowItems.findIndex((b) => b.kind === "label");
    expect(flowItems[labelAt]?.text).toBe("반복 더 보기");
    expect(flowItems[labelAt - 1].type).toBe("flow_wait_us");
    expect(flowItems[labelAt + 1].type).toBe("flow_for_range");
  });

  it("변수 꾸러미: 변수가 있으면 버튼 → 정하기 → 만큼 바꾸기(같은 변수, 숫자 1) → 변수 값들", () => {
    const w = ws();
    w.getVariableMap().createVariable("a");
    w.getVariableMap().createVariable("b");
    const items = variableFlyout(fakeSvg(w)) as { kind: string; type?: string; fields?: { VAR?: { name?: string } }; inputs?: unknown; callbackkey?: string }[];
    expect(items.map((i) => i.type ?? i.kind)).toEqual(["button", "variables_set", "var_change", "variables_get", "variables_get"]);
    expect(items[0].callbackkey).toBe("CREATE_VARIABLE");
    // 정하기·바꾸기는 가장 최근에 만든 변수
    expect(items[1].fields?.VAR?.name).toBe("b");
    expect(items[2].fields?.VAR?.name).toBe("b");
    expect(items[2].inputs).toEqual({ DELTA: { shadow: { type: "math_number", fields: { NUM: 1 } } } });
    w.dispose();
  });

  it("registerVariableFlyout 은 작업판의 VARIABLE 꾸러미 콜백을 variableFlyout 으로 바꾼다", () => {
    const calls: [string, unknown][] = [];
    registerVariableFlyout({ registerToolboxCategoryCallback: (key: string, fn: unknown) => calls.push([key, fn]) } as unknown as Blockly.WorkspaceSvg);
    expect(calls).toEqual([["VARIABLE", variableFlyout]]);
  });

  it("변수 꾸러미: 변수가 없으면 변수 만들기 버튼만", () => {
    const w = ws();
    const items = variableFlyout(fakeSvg(w)) as { kind: string }[];
    expect(items.map((i) => i.kind)).toEqual(["button"]);
    w.dispose();
  });
});

describe("최종 리뷰", () => {
  it("C3 변수 꾸러미가 깨진 코드를 내는 math_change·procedures_ifreturn 을 내놓지 않는다", () => {
    expect(Blockly.Blocks.math_change).toBeUndefined();
    expect(Blockly.Blocks.procedures_ifreturn).toBeUndefined();
  });
  it("C3 Blockly 기본 변수 목록에는 정하기·값만 있다 (만큼 바꾸기는 variableFlyout 이 var_change 로 끼운다)", () => {
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

describe("장치 글 칸 검사 (I2C 주소·핀 목록)", () => {
  const cases: [type: string, field: string, good: string[], bad: string[]][] = [
    ["dev_lcd_setup", "ADDR", ["0x27", "0x3F", "0x8"], ["3f", "0x", "0x123", "27", "0x3g", ""]],
    ["dev_rfid_setup", "ADDR", ["0x28"], ["28", "0xzz"]],
    ["dev_flow_setup", "PINS", ["18, 5, 14", "2", "1,2 ,3"], ["a, b", "1,", ", 1", "1 2", ""]],
  ];
  for (const [type, field, good, bad] of cases) {
    it(`${type}.${field} 는 맞는 글만 받는다`, () => {
      const ws = new Blockly.Workspace();
      const f = ws.newBlock(type).getField(field)!;
      for (const g of good) {
        f.setValue(g);
        expect(f.getValue(), g).toBe(g);
      }
      const last = good[good.length - 1];
      for (const b of bad) {
        f.setValue(b);
        expect(f.getValue(), b).toBe(last);
      }
      ws.dispose();
    });
  }

  it("불러온 값은 그대로 둔다 (코드에서 온 0x123 같은 주소도 블록과 코드가 어긋나지 않게)", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load({
      blocks: { languageVersion: 0, blocks: [{ type: "dev_lcd_setup", fields: { SDA: 21, SCL: 22, ADDR: "0x123" } }] },
    }, ws);
    expect(ws.getBlocksByType("dev_lcd_setup", false)[0].getFieldValue("ADDR")).toBe("0x123");
    ws.dispose();
  });
});
