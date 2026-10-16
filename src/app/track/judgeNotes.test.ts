import { beforeAll, describe, expect, it } from "vitest";
import { registerBlocks } from "@/blocks";
import { workspaceJsonToCode } from "@/codegen";
import { codeToBlocks } from "@/parser";
import { judgeNotes, lintWarnings } from "./judgeNotes";

/*
 * 통과한 판정에 덧붙이는 주의를 실제 파서·생성기·검사로 모아 본다 (node, Blockly 헤드리스).
 */

beforeAll(() => registerBlocks());

const blink = "from machine import Pin\nimport time\n\nled = Pin(26, Pin.OUT)\n\nwhile True:\n    led.value(1)\n    time.sleep(2)\n    led.value(0)\n    time.sleep(1)\n";
const busy = "from machine import Pin\n\nled = Pin(26, Pin.OUT)\n\nwhile True:\n    led.value(1)\n";

describe("judgeNotes", () => {
  it("바른 깜빡이기 코드는 주의가 없다", () => {
    expect(judgeNotes({ program: { code: blink }, rules: [] })).toEqual([]);
  });

  it("코드 모드(blocksJson 없음): 기다리기 없는 반복은 검사 warning 문장(ko)을 낸다", () => {
    expect(judgeNotes({ program: { code: busy }, rules: [] })).toEqual(["반복 안에 기다리기가 없으면 보드가 바빠져요"]);
  });

  it("블록 모드: 작업판이 낸 코드와 같으면 작업판 JSON 을 검사한다", () => {
    const r = codeToBlocks(busy);
    if (!r.ok) throw new Error("파싱 실패");
    const code = workspaceJsonToCode(r.json);
    expect(lintWarnings({ code, blocksJson: r.json })).toEqual(["반복 안에 기다리기가 없으면 보드가 바빠져요"]);
  });

  it("코드가 작업판과 다르면(코드 모드에서 고침) 판정한 코드를 블록으로 바꿔 검사한다", () => {
    const r = codeToBlocks(busy);
    if (!r.ok) throw new Error("파싱 실패");
    // 낡은 작업판은 기다리기가 없지만 지금 코드에는 있다 → 주의 없음
    expect(lintWarnings({ code: blink, blocksJson: r.json })).toEqual([]);
  });

  it("문법 오류 코드는 주의 없이 빈 목록", () => {
    expect(lintWarnings({ code: "while True\n    x = (\n" })).toEqual([]);
  });

  it("준비만 한 장치와 시작 코드 그대로를 덧붙이고, 겹치는 문장은 하나만", () => {
    const code = `${blink}buzzer = PWM(Pin(25))\n`;
    const notes = judgeNotes({ program: { code }, startCode: code, rules: [{ codeMatches: "x", fail: "x?" }] });
    expect(notes).toEqual([
      "buzzer 는 준비만 하고 쓰지 않았어요. 이 장치가 필요한가요?",
      "시작 코드를 바꾸지 않았어요. 지시문이 바꾸라고 한 줄은 어디인가요?",
    ]);
    // 시작 코드가 없으면(디버깅 증상) "바꾸지 않았어요" 는 보지 않는다
    expect(judgeNotes({ program: { code }, rules: [] })).toHaveLength(1);
  });
});
