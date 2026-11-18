import type * as Blockly from "blockly";

/*
 * 행사용 AiCardEditor 의 툴박스 (lib-v1.7.0). 기본 툴박스(toolbox.ts)와 같은 엔트리식 카테고리 타일을 쓰고 블록만 고른다.
 * - basic: AI 카드 + 판단(만약·아니면 만약, 같은가) + RGB 색 블록
 * - full:  basic + 흐름(기다리기·반복) + 계산 + 숫자로 정하는 set_color(r, g, b)
 * RGB 블록은 호스트가 보드에 올려 둔 set_color 를 부른다 (AiCardEditor 의 생성기는 set_color 정의·PWM 준비를 만들지 않는다).
 */

export type AiCardToolboxLevel = "basic" | "full";

const block = (type: string, extra: Record<string, unknown> = {}) => ({ kind: "block", type, ...extra });
const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
const card = () => ({ block: { type: "aicard_card" } });
const name = (id: string) => ({ block: { type: "aicard_name", fields: { CARD: id } } });
/** card == "<id>" 판단 블록 (만약 칸에 미리 끼운다) */
const isCard = (id: string) => ({ block: { type: "logic_compare", fields: { OP: "EQ" }, inputs: { A: card(), B: name(id) } } });
const colour = (hex: string) => block("dev_rgb_colour", { fields: { COLOUR: hex } });

/** 카드 색 그대로의 불빛 (빨강·노랑·초록·파랑·보라·끄기) */
const COLOURS = ["#ff0000", "#ffff00", "#00ff00", "#0000ff", "#ff00ff", "#000000"];

export function aiCardToolbox(level: AiCardToolboxLevel = "basic"): Blockly.utils.toolbox.ToolboxDefinition {
  const full = level === "full";
  const contents: unknown[] = [
    {
      kind: "category",
      name: "AI 카드",
      categorystyle: "aicard_category",
      icon: "aicard",
      contents: [block("aicard_on_card"), block("aicard_card"), block("aicard_name", { fields: { CARD: "red" } }), block("logic_compare", { inputs: { A: card(), B: name("yellow") } })],
    },
    {
      kind: "category",
      name: "판단",
      categorystyle: "judge_category",
      icon: "judge",
      contents: [
        block("controls_if", { inputs: { IF0: isCard("red") } }),
        block("controls_if", { extraState: { elseIfCount: 1 }, inputs: { IF0: isCard("red"), IF1: isCard("yellow") } }),
        block("controls_if", { extraState: { hasElse: true }, inputs: { IF0: isCard("none") } }),
        block("logic_compare", { inputs: { A: card(), B: name("green") } }),
        ...(full ? [block("logic_operation"), block("logic_negate")] : []),
      ],
    },
    {
      kind: "category",
      name: "불빛",
      categorystyle: "led_category",
      icon: "led",
      contents: [
        ...COLOURS.map(colour),
        ...(full ? [{ kind: "label", text: "숫자로 섞기 (0~255)" }, block("dev_rgb_set", { inputs: { R: num(255), G: num(0), B: num(255) } })] : []),
      ],
    },
  ];
  if (full) {
    contents.push(
      {
        kind: "category",
        name: "흐름",
        categorystyle: "flow_category",
        icon: "flow",
        contents: [
          block("flow_wait", { inputs: { SEC: num(0.5) } }),
          block("flow_repeat_n", { inputs: { TIMES: num(3) } }),
          block("flow_wait_ms", { inputs: { MS: num(200) } }),
        ],
      },
      {
        kind: "category",
        name: "계산",
        categorystyle: "calc_category",
        icon: "calc",
        contents: [
          block("math_number", { fields: { NUM: 0 } }),
          block("calc_arith", { inputs: { A: num(255), B: num(2) } }),
          block("calc_random", { inputs: { A: num(0), B: num(255) } }),
        ],
      },
    );
  }
  // icon·label 은 Blockly 정의에 없는 칸이라 unknown 을 거친다 (toolbox.ts 와 같다)
  return { kind: "categoryToolbox", contents } as unknown as Blockly.utils.toolbox.ToolboxDefinition;
}
