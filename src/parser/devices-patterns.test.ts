import { describe, expect, it, vi } from "vitest";
import { codeToBlocks } from "./index";
import { workspaceJsonToCode } from "@/codegen";
import { normalizeCode } from "./normalize";
import type { BlockJson } from "./types";

/*
 * Task 5~7 장치 작성자를 위한 패턴 종류별 계약. 가짜 장치를 레지스트리에 끼워 파서·생성기 왕복을 본다.
 * (가짜 장치 정의는 vi.mock 이 끌어올려지므로 factory 안에 둔다)
 */
vi.mock("@/devices/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/devices/registry")>();
  type D = (typeof actual.DEVICES)[number];
  const v = (name: string, extra: object = {}) => ({ kind: "var" as const, name, default: name.toLowerCase(), ...extra });
  const beeper: D = {
    id: "fake_beeper", category: "sound", label: "가짜 부저", colour: "#888888",
    setup: {
      blockType: "fake_beeper_setup", message: "부저 %1 핀 %2", parts: [{ kind: "var", name: "VAR", default: "beeper" }, { kind: "pin", name: "PIN", default: 15, dir: "out" }], tooltip: "",
      lines: (x) => [`${x.VAR} = PWM(Pin(${x.PIN}))`, `${x.VAR}.freq(440)`, `${x.VAR}.duty(0)`],
      kind: "beeper", provides: (x) => [x.VAR],
      pattern: {
        lines: [/^(\w+)\s*=\s*PWM\(\s*Pin\(\s*(\d+)\s*\)\s*\)$/, /^(\w+)\.freq\(\s*440\s*\)$/, /^(\w+)\.duty\(\s*0\s*\)$/],
        fields: ([a, b, c]) => (a[1] === b[1] && a[1] === c[1] ? { VAR: a[1], PIN: a[2] } : null),
        vars: ([a]) => [a[1]],
      },
    },
    actions: [
      {
        blockType: "fake_beeper_tone", message: "%1 %2 Hz %3 초", tooltip: "",
        parts: [{ kind: "var", name: "VAR", default: "beeper" }, { kind: "value", name: "HZ", check: "Number" }, { kind: "value", name: "SEC", check: "Number" }],
        code: (x) => `${x.VAR}.freq(${x.HZ})\n${x.VAR}.duty(512)\ntime.sleep(${x.SEC})\n${x.VAR}.duty(0)`,
        pattern: {
          kind: "lines", objPart: "VAR",
          lines: [/^(\w+)\.freq\((.+)\)$/, /^(\w+)\.duty\(512\)$/, /^time\.sleep\((.+)\)$/, /^(\w+)\.duty\(0\)$/],
          values: ([f, d, s, o]) => (f[1] === d[1] && f[1] === o[1] ? { VAR: f[1], HZ: f[2], SEC: s[1] } : null),
        },
      },
      {
        blockType: "fake_beeper_stop", message: "%1 멈추기", tooltip: "", parts: [{ kind: "var", name: "VAR", default: "beeper" }],
        code: (x) => `${x.VAR}.duty(0)`,
        pattern: { kind: "method", name: "duty", args: [["0"]], objPart: "VAR" },
      },
      {
        blockType: "fake_beeper_song", message: "%1 노래", tooltip: "", parts: [{ kind: "var", name: "VAR", default: "beeper" }],
        code: (x) => `for i in range(2):\n    ${x.VAR}.duty(512)`,
        pattern: { kind: "none" },
      },
    ],
    values: [],
  };
  const lcd: D = {
    id: "fake_lcd", category: "display", label: "가짜 LCD", colour: "#888888",
    setup: {
      blockType: "fake_lcd_setup", message: "LCD 핀 %1", parts: [{ kind: "pin", name: "PIN", default: 21, dir: "out" }], tooltip: "",
      lines: (x) => [`lcd = LCD(${x.PIN})`], kind: "lcd", provides: () => ["lcd"],
      pattern: { lines: [/^lcd\s*=\s*LCD\((\d+)\)$/], fields: ([m]) => ({ PIN: m[1] }), vars: () => ["lcd"] },
    },
    actions: [
      {
        blockType: "fake_lcd_text", message: "LCD %1 줄 %2 칸 %3", tooltip: "",
        parts: [{ kind: "value", name: "ROW", check: "Number" }, { kind: "value", name: "COL", check: "Number" }, { kind: "value", name: "TEXT" }],
        code: (x) => `lcd.Cursor(${x.ROW}, ${x.COL})\nlcd.Display(${x.TEXT})`,
        pattern: { kind: "lines", lines: [/^lcd\.Cursor\((.+), (.+)\)$/, /^lcd\.Display\((.+)\)$/], values: ([c, d]) => ({ ROW: c[1], COL: c[2], TEXT: d[1] }) },
      },
      {
        blockType: "fake_lcd_line", message: "LCD 선 %1", tooltip: "", parts: [{ kind: "value", name: "X", check: "Number" }],
        code: (x) => `lcd.line(${x.X}, 1)`,
        pattern: { kind: "method", name: "line", objName: "lcd", args: [null, ["1"]] },
      },
    ],
    values: [],
  };
  const tilt: D = {
    id: "fake_tilt", category: "switch", label: "가짜 틸트", colour: "#888888",
    setup: {
      blockType: "fake_tilt_setup", message: "틸트 핀 %1 %2", parts: [{ kind: "pin", name: "PIN", default: 14, dir: "out" }, v("VAR")], tooltip: "",
      lines: (x) => [`${x.VAR} = Pin(${x.PIN}, Pin.IN)`], kind: "pin", provides: (x) => [x.VAR],
      pattern: { lines: [], fields: () => null, vars: () => [] },
    },
    actions: [],
    values: [
      {
        blockType: "fake_tilted", message: "%1 기울었나", tooltip: "", parts: [v("VAR")], output: "Boolean", order: 7,
        code: (x) => `${x.VAR}.value() == 1`,
        pattern: { kind: "expr", regex: /^(\w+)\.value\(\) == 1$/, objPart: "VAR", objKinds: ["pin"] },
      },
    ],
  };
  const motor: D = {
    id: "fake_motor", category: "motor", label: "가짜 모터", colour: "#888888",
    setup: {
      blockType: "fake_motor_setup", message: "모터 핀 %1", parts: [{ kind: "pin", name: "PIN", default: 13, dir: "out" }], tooltip: "",
      lines: (x) => [`m = Motor(${x.PIN})`],
      helpers: [{ name: "go", params: "speed, dir", body: ["if dir:", "  m.on(speed)", "else:", "  m.off()"] }],
      kind: "motor", provides: () => ["m", "go"],
      pattern: { lines: [/^m\s*=\s*Motor\((\d+)\)$/], fields: ([x]) => ({ PIN: x[1] }), vars: () => ["m"] },
    },
    actions: [
      {
        blockType: "fake_motor_go", message: "모터 %1 방향 %2", tooltip: "",
        parts: [{ kind: "value", name: "SPEED", check: "Number" }, { kind: "dropdown", name: "DIR", options: [["앞", "True"], ["뒤", "False"]] }],
        code: (x) => `go(${x.SPEED}, ${x.DIR})`,
        pattern: { kind: "call", name: "go", args: [null, ["True", "False"]] },
      },
    ],
    values: [],
  };
  // 가짜 틸트는 진짜 틸트(dev_tilt_tilted, 같은 정규식)보다 앞에 둔다
  const DEVICES = [beeper, lcd, tilt, ...actual.DEVICES, motor];
  const withDevice = <T,>(d: D, x: T) => ({ ...x, device: d });
  const all = <K extends "actions" | "values">(k: K) => new Map(DEVICES.flatMap((d) => d[k].map((s) => [s.blockType, withDevice(d, s)] as const)));
  const setups = new Map(DEVICES.flatMap((d) => (d.setup ? [[d.setup.blockType, withDevice(d, d.setup)] as const] : [])));
  const actions = all("actions"), values = all("values");
  return {
    ...actual, DEVICES,
    setupSpecs: () => [...setups.values()],
    findSetupByBlock: (t: string) => setups.get(t),
    findActionByBlock: (t: string) => actions.get(t),
    findValueByBlock: (t: string) => values.get(t),
    devicesByCategory: (c: string) => DEVICES.filter((d) => d.category === c),
  };
});

const parse = (code: string) => { const r = codeToBlocks(code); if (!r.ok) throw new Error(r.error.message); return r; };
const chainOf = (b: BlockJson | undefined): BlockJson[] => { const out: BlockJson[] = []; for (let c = b; c; c = c.next?.block) out.push(c); return out; };
const body = (code: string) => chainOf((parse(code).json.blocks.blocks as BlockJson[]).find((b) => b.type === "start_program")?.inputs?.BODY?.block);
const roundtrip = (src: string) => { const r = parse(src); return { out: workspaceJsonToCode(r.json), unparsed: r.unparsed }; };

describe("레지스트리 패턴 종류", () => {
  it("lines 준비: 더 구체적인 3줄 선언이 앞서고, 이름이 다르면 다음 선언(pwm)으로", () => {
    expect(body("b = PWM(Pin(15))\nb.freq(440)\nb.duty(0)\n").map((x) => x.type)).toEqual(["fake_beeper_setup"]);
    expect(body("b = PWM(Pin(15))\nb.freq(440)\nc.duty(0)\n").map((x) => x.type)).toEqual(["esp_pwm_setup", "code_stmt"]);
  });

  it("lines 명령: 몸통 안 4줄이 블록 하나로, 값 칸은 다시 식으로 파싱된다", () => {
    const src = "from machine import Pin, PWM\nimport time\nb = PWM(Pin(15))\nb.freq(440)\nb.duty(0)\nwhile True:\n    b.freq(262)\n    b.duty(512)\n    time.sleep(1 * 0.5)\n    b.duty(0)\n";
    const [, loop] = body(src);
    const tone = loop.inputs?.DO?.block;
    expect(tone?.type).toBe("fake_beeper_tone");
    expect(tone?.fields).toEqual({ VAR: { id: "var_b" } });
    expect(tone?.inputs?.HZ?.block).toEqual({ type: "math_number", fields: { NUM: 262 } });
    expect(tone?.inputs?.SEC?.block?.type).toBe("calc_arith");
    expect(tone?.next).toBeUndefined();
    const { out, unparsed } = roundtrip(src);
    expect(normalizeCode(out)).toEqual(normalizeCode(src));
    expect(unparsed).toEqual([]);
  });

  it("lines 명령은 objPart 변수의 kind 를 본다 (등록 안 된 변수면 문장 하나씩)", () => {
    const b = body("while True:\n    q.freq(262)\n    q.duty(512)\n    time.sleep(1)\n    q.duty(0)\n")[0];
    expect(chainOf(b.inputs?.DO?.block).map((x) => x.type)).toEqual(["code_stmt", "code_stmt", "flow_wait", "code_stmt"]);
  });

  it("값 칸 조각 안의 모르는 이름은 code_expr, unparsed 줄은 그 명령의 줄", () => {
    const r = parse("b = PWM(Pin(15))\nb.freq(440)\nb.duty(0)\n\nb.freq(zz)\nb.duty(512)\ntime.sleep(1)\nb.duty(0)\n");
    const tone = body("b = PWM(Pin(15))\nb.freq(440)\nb.duty(0)\nb.freq(zz)\nb.duty(512)\ntime.sleep(1)\nb.duty(0)\n")[1];
    expect(tone.inputs?.HZ?.block).toEqual({ type: "code_expr", fields: { CODE: "zz" } });
    expect(r.unparsed).toEqual([{ line: 5, text: "zz" }]);
  });

  it("method: 인자 수가 parts 보다 많으면 남는 인자는 허용 리터럴로만 (objPart 없는 고정 이름 objName)", () => {
    const pre = "lcd = LCD(21)\n";
    expect(body(pre + "lcd.line(5, 1)\n")[1]).toEqual({ type: "fake_lcd_line", inputs: { X: { block: { type: "math_number", fields: { NUM: 5 } } } } });
    expect(body(pre + "lcd.line(5, 2)\n")[1].type).toBe("code_stmt");
    expect(body("lcd.line(5, 1)\n")[0].type).toBe("code_stmt"); // lcd 준비가 없으면 장치 변수가 아니다
  });

  it("method: 허용 리터럴 인자에 parts 가 없으면 고정 값 (b.duty(0) → 멈추기)", () => {
    expect(body("b = PWM(Pin(15))\nb.freq(440)\nb.duty(0)\nb.duty(0)\n").map((x) => x.type)).toEqual(["fake_beeper_setup", "fake_beeper_stop"]);
  });

  it("objPart 없는 lines 명령은 장치가 준비됐을 때만", () => {
    const text = "lcd.Cursor(0, 1)\nlcd.Display(\"hi\")\n";
    expect(body("lcd = LCD(21)\n" + text).map((x) => x.type)).toEqual(["fake_lcd_setup", "fake_lcd_text"]);
    expect(body(text).map((x) => x.type)).toEqual(["code_stmt", "code_stmt"]);
    const { out, unparsed } = roundtrip("lcd = LCD(21)\n\n" + text);
    expect(out).toBe("lcd = LCD(21)\n\n" + text);
    expect(unparsed).toEqual([]);
  });

  it("lines: [] 준비는 접지 않는다 — 그 줄은 다른 선언(esp_pin_setup)이 잡고, expr 값은 objKinds 로 맞춘다", () => {
    const src = "from machine import Pin\n\nt = Pin(14, Pin.IN)\n\nif t.value() == 1:\n    print(1)\n";
    const [setup, ifb] = body(src);
    expect(setup.type).toBe("esp_pin_setup");
    expect(ifb.inputs?.IF0?.block).toEqual({ type: "fake_tilted", fields: { VAR: { id: "var_t" } } });
    expect(body("if t.value() == 1:\n    print(1)\n")[0].inputs?.IF0?.block?.type).toBe("logic_compare");
    expect(roundtrip(src).out).toBe(src);
  });

  it("도우미 call: 표준 def 가 있으면 준비·호출이 접히고 def 는 사라진다, 아니면 함수 블록", () => {
    const def = "def go(speed, dir):\n    if dir:\n        m.on(speed)\n    else:\n        m.off()\n";
    const src = `m = Motor(13)\n\n\n${def}\n\ngo(100, True)\n`;
    const r = parse(src);
    const blocks = r.json.blocks.blocks as BlockJson[];
    expect(blocks.map((b) => b.type)).toEqual(["start_program"]);
    expect(body(src).map((x) => x.type)).toEqual(["fake_motor_setup", "fake_motor_go"]);
    expect(body(src)[1].fields).toEqual({ DIR: "True" });
    // 접힌 도우미는 함수 표에서 빠지므로 패턴에 안 맞는 호출은 함수 블록이 아니라 code_stmt (def 는 준비 블록이 다시 만든다)
    expect(body("m = Motor(13)\ngo(100, 7)\n" + def)[1].type).toBe("code_stmt");
    const changed = def.replace("m.off()", "m.stop()");
    expect(body(`m = Motor(13)\n${changed}\ngo(100, True)\n`).map((x) => x.type)).toEqual(["variables_set", "procedures_callnoreturn"]);
    expect(roundtrip(src).out).toBe(src);
  });

  it("none 명령은 파서가 되돌리지 않는다 (생성 코드가 다른 블록들로 돌아온다)", () => {
    const b = body("b = PWM(Pin(15))\nb.freq(440)\nb.duty(0)\nfor i in range(2):\n    b.duty(512)\n");
    expect(b.map((x) => x.type)).toEqual(["fake_beeper_setup", "flow_repeat_n"]);
  });

  it("접힌 준비 줄 사이의 주석은 준비 블록 코멘트의 윗줄로 이어진다", () => {
    const b = body("b = PWM(Pin(15))  # 부저\n# 가운데\nb.freq(440)  # 라\nb.duty(0)\nprint(1)\n");
    expect(b[0].icons?.comment.text).toBe("가운데\n라\n|부저");
    expect(b[1].icons).toBeUndefined();
  });
});
