/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import * as Blockly from "blockly";
import { registerBlocks } from "@/blocks";
import { codeToBlocks } from "@/parser";
import { SAMPLE_CODE } from "@/app/lab/sample";
import { generateCode, generateCodeWithMap, workspaceJsonToCode, workspaceJsonToCodeWithMap, type WorkspaceJson } from "./index";
import { buildLineMap, MARK, marksToTags, shiftLineMap, tagLine, type LineMap } from "./linemap";

beforeAll(() => registerBlocks());

type B = Record<string, unknown>;
const num = (n: number): B => ({ type: "math_number", fields: { NUM: n } });
const v = (name: string) => ({ id: `var_${name}` });
const comment = (text: string) => ({ comment: { text, pinned: false, height: 80, width: 160 } });

function chain(blocks: B[]): B {
  const copies = blocks.map((b) => ({ ...b }));
  for (let i = 0; i < copies.length - 1; i++) copies[i].next = { block: copies[i + 1] };
  return copies[0];
}
function program(body: B[], extra: { tops?: B[]; vars?: string[] } = {}): WorkspaceJson {
  return {
    variables: (extra.vars ?? []).map((name) => ({ name, id: `var_${name}` })),
    blocks: { languageVersion: 0, blocks: [...(extra.tops ?? []), { type: "start_program", id: "start", x: 0, y: 0, inputs: { BODY: { block: chain(body) } } }] },
  } as unknown as WorkspaceJson;
}
const pinSetup = (id: string, name: string, pin: number): B => ({ type: "esp_pin_setup", id, fields: { PIN: pin, MODE: "OUT", VAR: v(name) } });
const pinWrite = (id: string, name: string, value: 0 | 1): B => ({ type: "esp_pin_write", id, fields: { VAR: v(name), VALUE: String(value) } });
const wait = (id: string, sec: number): B => ({ type: "flow_wait", id, inputs: { SEC: { block: num(sec) } } });
const forever = (id: string, body: B[]): B => ({ type: "flow_repeat_forever", id, inputs: { DO: { block: chain(body) } } });

/** 코드에서 text 와 똑같은 줄(앞뒤 공백 무시)의 번호들 (1부터) */
function linesOf(code: string, text: string): number[] {
  return code.split("\n").flatMap((l, i) => (l.trim() === text ? [i + 1] : []));
}
const lineOf = (code: string, text: string) => {
  const found = linesOf(code, text);
  expect(found, `"${text}" 줄 하나`).toHaveLength(1);
  return found[0];
};
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** 지도의 두 방향이 서로 맞고 줄 번호가 코드 안에 있는지 */
function expectConsistent(code: string, map: LineMap) {
  const total = code.split("\n").length - (code.endsWith("\n") ? 1 : 0);
  for (const [line, id] of Object.entries(map.lineToBlock)) {
    const n = Number(line);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(total);
    expect(map.blockToLines[id]).toContain(n);
  }
  for (const lines of Object.values(map.blockToLines)) {
    expect([...lines].sort((a, b) => a - b)).toEqual(lines);
    for (const n of lines) expect(map.lineToBlock[n]).toBeDefined();
  }
}

describe("linemap 순수 함수", () => {
  const mark = (id: string, indent = "") => `${indent}${MARK}'${id}'${MARK}`;

  it("표식 구역: 형제는 앞 형제를 닫고, 자식은 열고, 얕은 줄(else)은 부모로", () => {
    const text = [
      mark("if"), "if x:", mark("a", "    "), "    a()", "else:", mark("b", "    "), "    b()", mark("n"), "n()", "",
    ].join("\n");
    const { code, map } = buildLineMap(marksToTags(text));
    expect(code).toBe("if x:\n    a()\nelse:\n    b()\nn()\n");
    expect(map.lineToBlock).toEqual({ 1: "if", 2: "a", 3: "if", 4: "b", 5: "n" });
    expect(map.blockToLines).toEqual({ if: [1, 3], a: [2], b: [4], n: [5] });
  });

  it("빈 줄은 지도에 없고 구역을 닫지 않는다, 표식 없는 줄은 주인이 없다", () => {
    const { code, map } = buildLineMap(marksToTags(["top()", mark("f"), "f()", "", "    g()", ""].join("\n")));
    expect(code).toBe("top()\nf()\n\n    g()\n");
    expect(map.lineToBlock).toEqual({ 2: "f", 4: "f" });
  });

  it("여러 주인 꼬리표: 줄은 첫 주인, 블록마다 그 줄", () => {
    const { code, map } = buildLineMap([tagLine("i2c = I2C(0)", ["a", "b"]), tagLine("x = 1", ["b"])].join("\n"));
    expect(code).toBe("i2c = I2C(0)\nx = 1");
    expect(map).toEqual({ lineToBlock: { 1: "a", 2: "b" }, blockToLines: { a: [1], b: [1, 2] }, blockStart: { a: 1, b: 1 } });
  });

  it("id 에 작은따옴표·$ 가 있어도 그대로", () => {
    const { map } = buildLineMap(marksToTags(`${mark("a'b$c")}\nx()\n`));
    expect(map.lineToBlock[1]).toBe("a'b$c");
  });

  it("shiftLineMap 은 줄을 옮기고 범위 밖은 버린다", () => {
    const map: LineMap = { lineToBlock: { 1: "a", 2: "b", 3: "b" }, blockToLines: { a: [1], b: [2, 3] }, blockStart: { a: 1, b: 3 } };
    expect(shiftLineMap(map, -1, 1)).toEqual({ lineToBlock: { 1: "b" }, blockToLines: { b: [1] }, blockStart: { b: 1 } });
    expect(shiftLineMap(map, 0, 3).blockStart).toEqual({ a: 1, b: 3 });
  });
});

describe("코드 지도: 블록 id ↔ 줄", () => {
  it("챕터 1 step4_blink_loop: 준비·반복·몸통 줄, import 줄은 지도에 없다", () => {
    const json = program(
      [pinSetup("setup_led", "led", 26), forever("loop", [pinWrite("on", "led", 1), wait("w1", 1), pinWrite("off", "led", 0), wait("w2", 1)])],
      { vars: ["led"] },
    );
    const { code, map } = workspaceJsonToCodeWithMap(json);
    expect(code).toBe(SAMPLE_CODE);
    expect(map.blockToLines).toEqual({ setup_led: [4], loop: [6], on: [7], w1: [8], off: [9], w2: [10] });
    expect(map.lineToBlock[7]).toBe("on");
    expect(map.lineToBlock[1]).toBeUndefined();
    expect(map.lineToBlock[2]).toBeUndefined();
    expectConsistent(code, map);
  });

  it("controls_if + else: if 줄과 else: 줄이 모두 if 블록", () => {
    const iff: B = {
      type: "controls_if", id: "if1", extraState: { hasElse: true },
      inputs: {
        IF0: { block: { type: "logic_boolean", fields: { BOOL: "TRUE" } } },
        DO0: { block: pinWrite("a", "led", 1) },
        ELSE: { block: pinWrite("b", "led", 0) },
      },
    };
    const { code, map } = workspaceJsonToCodeWithMap(program([pinSetup("s", "led", 2), iff, wait("w", 1)], { vars: ["led"] }));
    const ifLine = lineOf(code, "if True:");
    const elseLine = lineOf(code, "else:");
    expect(map.blockToLines.if1).toEqual([ifLine, elseLine]);
    expect(map.blockToLines.a).toEqual([lineOf(code, "led.value(1)")]);
    expect(map.blockToLines.b).toEqual([lineOf(code, "led.value(0)")]);
    expect(map.blockToLines.w).toEqual([lineOf(code, "time.sleep(1)")]);
    expectConsistent(code, map);
  });

  it("여러 줄 명령(dev_led_blink): 다섯 줄 모두 그 블록", () => {
    const blink: B = { type: "dev_led_blink", id: "blink", fields: { VAR: v("led") }, inputs: { SEC: { block: num(0.5) }, TIMES: { block: num(3) } } };
    const { code, map } = workspaceJsonToCodeWithMap(program([pinSetup("s", "led", 26), blink, wait("w", 1)], { vars: ["led"] }));
    const first = lineOf(code, "for i in range(3):");
    expect(map.blockToLines.blink).toEqual(range(first, first + 4));
    expect(map.blockToLines.w).toEqual([first + 5]);
    expectConsistent(code, map);
  });

  it("준비 블록 + 도우미(초음파): trig/echo 두 줄과 get_distance 함수 전부가 준비 블록", () => {
    const us: B = { type: "esp_ultrasonic_setup", id: "us", fields: { TRIG: 13, ECHO: 12 } };
    const show: B = { type: "esp_print", id: "p", inputs: { VALUE: { block: { type: "esp_distance" } } } };
    const { code, map } = workspaceJsonToCodeWithMap(program([us, show]));
    const def = lineOf(code, "def get_distance():");
    const ret = lineOf(code, "return int(340 * t // 10000)");
    expect(map.blockToLines.us).toEqual([lineOf(code, "trig = Pin(13, Pin.OUT)"), lineOf(code, "echo = Pin(12, Pin.IN)"), ...range(def, ret)]);
    expect(map.blockToLines.p).toEqual([lineOf(code, "print(get_distance())")]);
    expectConsistent(code, map);
  });

  it("같은 준비 줄을 함께 낸 준비 블록은 둘 다 그 줄을 갖는다", () => {
    const { code, map } = workspaceJsonToCodeWithMap(program([pinSetup("s1", "led", 26), pinSetup("s2", "led", 26)], { vars: ["led"] }));
    const n = lineOf(code, "led = Pin(26, Pin.OUT)");
    expect(map.blockToLines).toEqual({ s1: [n], s2: [n] });
    expect(map.lineToBlock[n]).toBe("s1");
  });

  it("사용자 함수: def 줄은 함수 정의 블록, 몸통 줄은 각 블록, return 줄은 정의 블록", () => {
    const def: B = {
      type: "procedures_defnoreturn", id: "def", x: 0, y: 0,
      extraState: { params: [{ name: "t", id: "var_t" }] },
      fields: { NAME: "blink" },
      inputs: { STACK: { block: chain([pinWrite("d1", "led", 1), { type: "flow_wait", id: "d2", inputs: { SEC: { block: { type: "variables_get", fields: { VAR: v("t") } } } } }]) } },
    };
    const twice: B = {
      type: "procedures_defreturn", id: "twice", x: 0, y: 300, extraState: { params: [] }, fields: { NAME: "twice" },
      inputs: { STACK: { block: pinWrite("t1", "led", 0) }, RETURN: { block: num(2) } },
    };
    const call: B = { type: "procedures_callnoreturn", id: "call", extraState: { name: "blink", params: ["t"] }, inputs: { ARG0: { block: num(0.2) } } };
    const { code, map } = workspaceJsonToCodeWithMap(program([pinSetup("s", "led", 26), call], { tops: [def, twice], vars: ["led", "t"] }));
    expect(map.blockToLines.def).toEqual([lineOf(code, "def blink(t):")]);
    expect(map.blockToLines.d1).toEqual([lineOf(code, "led.value(1)")]);
    expect(map.blockToLines.d2).toEqual([lineOf(code, "time.sleep(t)")]);
    expect(map.blockToLines.twice).toEqual([lineOf(code, "def twice():"), lineOf(code, "return 2")]);
    expect(map.blockToLines.t1).toEqual([lineOf(code, "led.value(0)")]);
    expect(map.blockToLines.call).toEqual([lineOf(code, "blink(0.2)")]);
    expectConsistent(code, map);
  });

  it("코멘트: 윗줄 주석은 그 블록, 줄 끝 주석이 붙은 줄도 그 블록 (준비 블록 코멘트도)", () => {
    const above = { ...pinWrite("above", "led", 1), icons: comment("켜기 전에\n한 번 더\n|켜기") };
    const trailing = { ...wait("trail", 1), icons: comment("쉬기") };
    const setup = { ...pinSetup("s", "led", 26), icons: comment("핀 준비\n|LED") };
    const { code, map } = workspaceJsonToCodeWithMap(program([setup, forever("loop", [above, trailing])], { vars: ["led"] }));
    expect(code).toBe(
      "from machine import Pin\nimport time\n\n# 핀 준비\nled = Pin(26, Pin.OUT)  # LED\n\nwhile True:\n    # 켜기 전에\n    # 한 번 더\n    led.value(1)  # 켜기\n    time.sleep(1)  # 쉬기\n",
    );
    expect(map.blockToLines).toEqual({ s: [4, 5], loop: [7], above: [8, 9, 10], trail: [11] });
    // 블록의 첫 문장 줄은 윗줄 주석을 건너뛴다 (검사 문제의 줄)
    expect(map.blockStart).toEqual({ s: 5, loop: 7, above: 10, trail: 11 });
  });

  it("시작 블록 코멘트(머리말)·내용 없는 시작 블록은 지도에 없다", () => {
    const json = program([pinWrite("on", "led", 1)], { vars: ["led"] });
    (json.blocks as { blocks: B[] }).blocks[0].icons = comment("첫 줄\n둘째 줄");
    const { code, map } = workspaceJsonToCodeWithMap(json);
    expect(code).toBe("# 첫 줄\n# 둘째 줄\n\nled.value(1)\n");
    expect(map).toEqual({ lineToBlock: { 4: "on" }, blockToLines: { on: [4] }, blockStart: { on: 4 } });
    expect(workspaceJsonToCodeWithMap(program([]))).toEqual({ code: "", map: { lineToBlock: {}, blockToLines: {}, blockStart: {} } });
  });

  it("몸통에 준비 블록만 있으면 pass 줄은 바깥 블록 (표식이 pass 를 없애지 않는다)", () => {
    const json = program([forever("loop", [pinSetup("s", "led", 26)])], { vars: ["led"] });
    const { code, map } = workspaceJsonToCodeWithMap(json);
    expect(code).toBe(workspaceJsonToCode(json));
    expect(map.blockToLines.loop).toEqual([lineOf(code, "while True:"), lineOf(code, "pass")]);
    expect(map.blockToLines.s).toEqual([lineOf(code, "led = Pin(26, Pin.OUT)")]);
  });

  it("내장 반복(controls_whileUntil)의 빈 몸통도 pass 가 남는다", () => {
    const loop: B = { type: "controls_whileUntil", id: "wl", fields: { MODE: "WHILE" }, inputs: { BOOL: { block: { type: "logic_boolean", fields: { BOOL: "TRUE" } } } } };
    const json = program([loop]);
    const { code, map } = workspaceJsonToCodeWithMap(json);
    expect(code).toBe(workspaceJsonToCode(json));
    expect(code).toContain("pass");
    expect(map.blockToLines.wl).toEqual([1, 2]);
  });

  it("코드 블록(code_stmt) 의 맨 앞 import 줄은 끌어올려지고 지도에 없다", () => {
    const json = program([{ type: "code_stmt", id: "imp", fields: { CODE: "import math" } }, { type: "code_stmt", id: "c", fields: { CODE: "x = math.pi" } }]);
    const { code, map } = workspaceJsonToCodeWithMap(json);
    expect(code).toBe(workspaceJsonToCode(json));
    expect(map.blockToLines).toEqual({ c: [lineOf(code, "x = math.pi")] });
  });

  it("generateCodeWithMap 뒤의 generateCode 에는 표식이 남지 않는다", () => {
    registerBlocks();
    const ws = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(program([pinSetup("s", "led", 26), forever("loop", [pinWrite("on", "led", 1)])], { vars: ["led"] }), ws);
      const plain = generateCode(ws);
      expect(generateCodeWithMap(ws).code).toBe(plain);
      expect(generateCode(ws)).toBe(plain);
      expect(plain).not.toMatch(/[\uE000-\uE003]/);
    } finally {
      ws.dispose();
    }
  });
});

describe("코드 지도: 수업 파일 전부", () => {
  const root = join(__dirname, "../../content/chapters");
  const files = readdirSync(root).flatMap((dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith(".py")).map((f) => join(dir, f)));

  it("수업 파일이 14개 이상 있다", () => expect(files.length).toBeGreaterThanOrEqual(14));

  for (const file of files) {
    it(`${file}: 코드가 같고, import·머리말 밖의 내용 줄은 모두 작업판 블록에 이어진다`, () => {
      const r = codeToBlocks(readFileSync(join(root, file), "utf8"));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const ws = new Blockly.Workspace();
      try {
        Blockly.serialization.workspaces.load(r.json, ws);
        const plain = generateCode(ws);
        const { code, map } = generateCodeWithMap(ws);
        expect(code).toBe(plain);
        expectConsistent(code, map);
        for (const id of Object.keys(map.blockToLines)) expect(ws.getBlockById(id), id).not.toBeNull();
        const lines = code.split("\n");
        const firstImport = lines.findIndex((l) => /^(from\s+\S+\s+)?import\s/.test(l));
        lines.forEach((line, i) => {
          if (!line.trim() || /^(from\s+\S+\s+)?import\s/.test(line) || (firstImport >= 0 && i < firstImport)) return;
          expect(map.lineToBlock[i + 1], `${i + 1}줄 ${line}`).toBeDefined();
        });
      } finally {
        ws.dispose();
      }
    });
  }
});
