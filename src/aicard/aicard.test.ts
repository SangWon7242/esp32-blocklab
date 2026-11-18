import { beforeAll, describe, expect, it } from "vitest";
import * as Blockly from "blockly";
import { aiCardToolbox, registerBlocks } from "@/blocks";
import { aiCardJsonToCode, workspaceJsonToCode } from "@/codegen";
import { lint } from "@/lint";
import { codeToBlocks } from "@/parser";
import type { BlockJson, WorkspaceJson } from "@/parser/types";
import { AI_CARD_IDS, aiCardStarterCode, checkAiCardCode } from "./cards";
import { aiCardBlocksFromCode, aiCardIssues } from "./program";

beforeAll(() => registerBlocks());

/** 코드 → 블록 → 코드 */
function roundTrip(code: string): { json: WorkspaceJson; out: string } {
  const r = aiCardBlocksFromCode(code);
  if (!r.ok) throw new Error(`파싱 실패 ${r.line}: ${r.message}`);
  return { json: r.json, out: aiCardJsonToCode(r.json) };
}

const tops = (json: WorkspaceJson) => json.blocks.blocks as BlockJson[];

/** 블록 JSON 안의 모든 블록 type (깊이 우선) */
function types(b: BlockJson | undefined, out: string[] = []): string[] {
  if (!b) return out;
  out.push(b.type);
  for (const input of Object.values(b.inputs ?? {})) types(input.block, out);
  types(b.next?.block, out);
  return out;
}

const FOUR = [
  "def on_card(card):",
  '    if card == "red":',
  "        set_color(255, 0, 0)",
  '    elif card == "yellow":',
  "        set_color(255, 255, 0)",
  '    elif card == "green":',
  "        set_color(0, 255, 0)",
  '    elif card == "blue":',
  "        set_color(0, 0, 255)",
  "",
].join("\n");

describe("AI 카드 시작 뼈대·카드 id", () => {
  it("시작 뼈대는 빨강 한 줄이다", () => {
    expect(aiCardStarterCode()).toBe('def on_card(card):\n    if card == "red":\n        set_color(255, 0, 0)\n');
    expect(AI_CARD_IDS).toEqual(["red", "yellow", "green", "blue", "purple", "none"]);
  });
});

describe("AI 카드 블록 → 코드", () => {
  it("이벤트 블록 + 판단 + RGB 색 블록이 on_card 하나만 낸다 (set_color 정의·PWM 준비·import 없음)", () => {
    const json = {
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: "aicard_on_card", x: 0, y: 0,
          inputs: { BODY: { block: {
            type: "controls_if",
            inputs: {
              IF0: { block: { type: "logic_compare", fields: { OP: "EQ" }, inputs: { A: { block: { type: "aicard_card" } }, B: { block: { type: "aicard_name", fields: { CARD: "red" } } } } } },
              DO0: { block: { type: "dev_rgb_colour", fields: { COLOUR: "#ff0000" } } },
            },
          } } },
        }],
      },
    };
    expect(aiCardJsonToCode(json)).toBe(aiCardStarterCode());
  });

  it("빈 이벤트 블록은 pass", () => {
    expect(aiCardJsonToCode({ blocks: { languageVersion: 0, blocks: [{ type: "aicard_on_card" }] } })).toBe("def on_card(card):\n    pass\n");
  });

  it("기본 생성기(자유 코딩)는 RGB 블록에 set_color 정의를 함께 만든다 — AI 카드 생성기만 호스트 것을 쓴다", () => {
    const r = aiCardBlocksFromCode(aiCardStarterCode());
    if (!r.ok) throw new Error("parse");
    const plain = workspaceJsonToCode(r.json);
    expect(plain).toContain("def set_color(r, g, b):");
    expect(plain).toContain("def on_card(card):");
    expect(aiCardJsonToCode(r.json)).not.toContain("def set_color");
  });
});

describe("AI 카드 코드 ↔ 블록 왕복", () => {
  it("시작 뼈대: 이벤트 블록·AI 가 본 카드·카드 이름·RGB 색 블록으로 돌아온다", () => {
    const { json, out } = roundTrip(aiCardStarterCode());
    expect(out).toBe(aiCardStarterCode());
    expect(tops(json).map((b) => b.type)).toEqual(["aicard_on_card"]);
    expect(types(tops(json)[0])).toEqual(["aicard_on_card", "controls_if", "logic_compare", "aicard_card", "aicard_name", "dev_rgb_colour"]);
    expect(json.variables).toEqual([]);
  });

  it("네 색 if/elif 사슬", () => {
    const { json, out } = roundTrip(FOUR);
    expect(out).toBe(FOUR);
    const ifBlock = tops(json)[0].inputs?.BODY?.block;
    expect(ifBlock?.type).toBe("controls_if");
    expect(ifBlock?.extraState).toEqual({ elseIfCount: 3 });
    expect(types(ifBlock).filter((t) => t === "aicard_name")).toHaveLength(4);
    expect(types(ifBlock).filter((t) => t === "dev_rgb_colour")).toHaveLength(4);
  });

  it("보라 set_color(255, 0, 255) 와 else: set_color(0, 0, 0)", () => {
    const code = [
      "def on_card(card):",
      '    if card == "purple":',
      "        set_color(255, 0, 255)",
      "    else:",
      "        set_color(0, 0, 0)",
      "",
    ].join("\n");
    const { json, out } = roundTrip(code);
    expect(out).toBe(code);
    const ifBlock = tops(json)[0].inputs?.BODY?.block;
    expect(ifBlock?.extraState).toEqual({ hasElse: true });
    expect(ifBlock?.inputs?.DO0?.block?.fields).toEqual({ COLOUR: "#ff00ff" });
    expect(ifBlock?.inputs?.ELSE?.block?.fields).toEqual({ COLOUR: "#000000" });
  });

  it("반복 안에서 time.sleep 으로 깜빡이기 (import time 이 붙는다)", () => {
    const code = [
      "import time",
      "",
      "def on_card(card):",
      '    if card == "blue":',
      "        for i in range(3):",
      "            set_color(0, 0, 255)",
      "            time.sleep(0.3)",
      "            set_color(0, 0, 0)",
      "            time.sleep(0.3)",
      '    elif card == "none":',
      "        set_color(0, 0, 0)",
      "",
    ].join("\n");
    const { json, out } = roundTrip(code);
    expect(out).toBe(code);
    const t = types(tops(json)[0]);
    expect(t).toContain("flow_repeat_n");
    expect(t.filter((x) => x === "flow_wait")).toHaveLength(2);
    expect(t).not.toContain("code_stmt");
  });

  it("숫자를 식으로 섞으면 숫자 set_color 블록 (dev_rgb_set)", () => {
    const code = "def on_card(card):\n    if card == \"green\":\n        set_color(0, 255 // 2, 0)\n";
    const { json, out } = roundTrip(code);
    expect(out).toBe(code);
    expect(types(tops(json)[0])).toContain("dev_rgb_set");
  });

  it("기본 파서(호스트 장치 없음)에서도 def on_card(card): 는 이벤트 블록이다. set_color 는 코드로 남는다", () => {
    const r = codeToBlocks(aiCardStarterCode());
    if (!r.ok) throw new Error("parse");
    const t = (r.json.blocks.blocks as BlockJson[]).flatMap((b) => types(b));
    expect(t).toContain("aicard_on_card");
    expect(t).not.toContain("dev_rgb_colour");
  });

  it("on_card 밖의 \"red\" 글자와 card 변수는 그냥 글자·변수 블록", () => {
    const r = aiCardBlocksFromCode('card = "red"\nprint(card)\n');
    if (!r.ok) throw new Error("parse");
    const t = tops(r.json).flatMap((b) => types(b));
    expect(t).not.toContain("aicard_name");
    expect(t).not.toContain("aicard_card");
  });

  it("작업판에 그대로 올릴 수 있다 (연결 형식 검사 통과)", () => {
    const { json } = roundTrip(FOUR);
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(json, ws);
    expect(ws.getAllBlocks(false).filter((b) => b.type === "aicard_name")).toHaveLength(4);
    ws.dispose();
  });
});

describe("AI 카드 검사", () => {
  it("on_card 가 꼭 하나일 때만 ok", () => {
    expect(checkAiCardCode(aiCardStarterCode())).toEqual({ ok: true });
    expect(checkAiCardCode(FOUR).ok).toBe(true);
    expect(checkAiCardCode("")).toMatchObject({ ok: false, reason: "missing" });
    expect(checkAiCardCode('set_color(255, 0, 0)\n')).toMatchObject({ ok: false, reason: "missing" });
    expect(checkAiCardCode("def on_card(card):\n    pass\n\n\ndef on_card(card):\n    pass\n")).toMatchObject({ ok: false, reason: "duplicate", line: 5 });
    expect(checkAiCardCode("def on_card():\n    pass\n")).toMatchObject({ ok: false, reason: "params" });
    expect(checkAiCardCode("def on_card(card)\n    pass\n")).toMatchObject({ ok: false, reason: "syntax" });
  });

  it("코드의 둘째 on_card 는 이벤트 블록이 되지 않고 코드로 남는다", () => {
    const r = aiCardBlocksFromCode("def on_card(card):\n    pass\n\n\ndef on_card(card):\n    set_color(1, 2, 3)\n");
    if (!r.ok) throw new Error("parse");
    expect(tops(r.json).filter((b) => b.type === "aicard_on_card")).toHaveLength(1);
  });

  it("작업판에 이벤트 블록이 둘이면 검사가 둘째를 오류로 가리킨다", () => {
    const json = { blocks: { blocks: [{ type: "aicard_on_card", id: "a" }, { type: "aicard_on_card", id: "b" }] } };
    const dup = lint(json, null).filter((i) => i.id === "aicard-duplicate");
    expect(dup).toHaveLength(1);
    expect(dup[0]).toMatchObject({ level: "error", blockId: "b" });
    expect(aiCardIssues(json, null).map((i) => i.id)).toContain("aicard-duplicate");
  });

  it("AI 카드 검사: 시작 블록·RGB 준비는 묻지 않고, 이벤트 블록이 없으면 오류", () => {
    const r = aiCardBlocksFromCode(aiCardStarterCode());
    if (!r.ok) throw new Error("parse");
    expect(aiCardIssues(r.json, null)).toEqual([]);
    expect(aiCardIssues({ blocks: { blocks: [] } }, null).map((i) => i.id)).toEqual(["aicard-missing"]);
    // 이벤트 블록 밖에 떨어진 RGB 블록
    const orphan = aiCardIssues({ blocks: { blocks: [{ type: "aicard_on_card" }, { type: "dev_rgb_colour", id: "x", fields: { COLOUR: "#ff0000" } }] } }, null);
    expect(orphan.find((i) => i.id === "orphan")?.ko).toContain("AI 가 카드를 보면");
  });
});

describe("AI 카드 툴박스", () => {
  const walk = (def: unknown): { categories: string[]; types: string[] } => {
    const categories: string[] = [];
    const out: string[] = [];
    const visit = (items: unknown[]) => {
      for (const item of items as { kind?: string; type?: string; name?: string; contents?: unknown[]; inputs?: Record<string, { block?: BlockJson }> }[]) {
        if (item.kind === "category" && item.name) categories.push(item.name);
        if (item.kind === "block" && item.type) {
          out.push(item.type);
          for (const input of Object.values(item.inputs ?? {})) types(input.block, out);
        }
        if (item.contents) visit(item.contents);
      }
    };
    visit((def as { contents: unknown[] }).contents);
    return { categories, types: out };
  };

  it("basic: AI 카드 · 판단 · 불빛만", () => {
    const { categories, types: t } = walk(aiCardToolbox("basic"));
    expect(categories).toEqual(["AI 카드", "판단", "불빛"]);
    expect(t).toContain("aicard_on_card");
    expect(t).toContain("dev_rgb_colour");
    expect(t).not.toContain("flow_wait");
    expect(t).not.toContain("dev_rgb_set");
  });

  it("full: 흐름 · 계산 · 숫자 set_color 도", () => {
    const { categories, types: t } = walk(aiCardToolbox("full"));
    expect(categories).toEqual(["AI 카드", "판단", "불빛", "흐름", "계산"]);
    for (const type of ["flow_wait", "flow_repeat_n", "dev_rgb_set", "calc_arith"]) expect(t).toContain(type);
    for (const type of t) expect(Blockly.Blocks[type], type).toBeDefined();
  });
});
