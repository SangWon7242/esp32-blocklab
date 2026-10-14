import { describe, expect, it } from "vitest";
import { workspaceJsonToCodeWithMap, type WorkspaceJson } from "@/codegen";
import type { LineMap } from "@/codegen/linemap";
import { blockLabel, lint } from "./index";
import type { Issue } from "./types";
import { forever, num, pinSetup, pinWrite, program, shadowNum, str, varGet, varSet, wait, type B } from "./testkit";

const only = (issues: Issue[], id: string) => issues.filter((i) => i.id === id);
const run = (json: ReturnType<typeof program>, map: LineMap | null = null) => lint(json, map);
/** 헤드리스 생성기로 만든 코드 지도로 검사 */
const runMapped = (json: ReturnType<typeof program>) => lint(json, workspaceJsonToCodeWithMap(json as WorkspaceJson).map);

describe("no-start", () => {
  it("시작 블록이 없으면 오류 (줄 없음)", () => {
    const issues = only(run(program([], { noStart: true, tops: [pinWrite("w", "led")] })), "no-start");
    expect(issues).toEqual([{ id: "no-start", level: "error", ko: "프로그램이 시작되면 블록이 없어요", en: 'Error: no "프로그램이 시작되면" block' }]);
  });
  it("있으면 없음", () => {
    expect(only(run(program([])), "no-start")).toEqual([]);
  });
});

describe("empty-input", () => {
  it("flow_wait 의 SEC 가 비면 그 블록에 오류", () => {
    const issues = only(run(program([{ type: "flow_wait", id: "w" }])), "empty-input");
    expect(issues).toEqual([{ id: "empty-input", level: "error", blockId: "w", ko: "이 칸에 값을 넣어 주세요", en: 'SyntaxError: missing value for "… 초 기다리기"' }]);
  });
  it("그림자만 있어도 채워진 것", () => {
    expect(only(run(program([{ type: "flow_wait", id: "w", inputs: { SEC: shadowNum(1) } }])), "empty-input")).toEqual([]);
  });
  it("장치 블록은 레지스트리 value 칸, controls_if 는 elseIfCount 만큼, 함수 호출은 매개변수 수만큼", () => {
    const servo = { type: "esp_servo_setup", id: "sv", fields: { VAR: { id: "var_servo" }, PIN: 4 } };
    const angle = { type: "dev_servo_angle", id: "a", fields: { VAR: { id: "var_servo" } } };
    const ifs = { type: "controls_if", id: "if", extraState: { elseIfCount: 1 }, inputs: { IF0: { block: { type: "logic_boolean", id: "t", fields: { BOOL: "TRUE" } } } } };
    const call = { type: "procedures_callnoreturn", id: "c", extraState: { name: "f", params: ["x"] } };
    const ids = only(run(program([servo, angle, ifs, call], { vars: ["servo"] })), "empty-input").map((i) => i.blockId);
    expect(ids).toEqual(["a", "if", "c"]);
    expect(blockLabel("dev_servo_angle")).toBe("… 각도를 … 도로");
  });
  it("판단·계산 새 블록도 빈 칸을 찾는다 (지난 시간 블록은 칸이 없다)", () => {
    const set = (id: string, value: B) => ({ ...varSet("x", value), id: `set_${id}` });
    const blocks = ["judge_between", "judge_contains", "calc_random", "calc_round", "calc_minmax", "calc_len", "calc_item", "calc_ticks"].map((type) => set(type, { type, id: type }));
    const ids = only(run(program(blocks, { vars: ["x"] })), "empty-input").map((i) => i.blockId);
    expect(ids).toEqual(["judge_between", "judge_contains", "calc_random", "calc_round", "calc_minmax", "calc_len", "calc_item"]);
    expect(blockLabel("calc_item")).toBe("… 의 … 번째 항목 (0부터)");
  });
});

describe("device-before-setup", () => {
  it("핀 준비 없이 esp_pin_write led → 오류", () => {
    const issues = only(run(program([pinWrite("w", "led")], { vars: ["led"] })), "device-before-setup");
    expect(issues).toEqual([{ id: "device-before-setup", level: "error", blockId: "w", ko: "led 를 먼저 준비해 주세요 (핀 블록)", en: "NameError: name 'led' is not defined" }]);
  });
  it("고정 이름 장치(OLED) 준비 없음", () => {
    const issues = only(run(program([{ type: "dev_oled_clear", id: "c" }])), "device-before-setup");
    expect(issues.map((i) => [i.blockId, i.ko, i.en])).toEqual([["c", "OLED 화면을 먼저 준비해 주세요", "NameError: name 'oled' is not defined"]]);
  });
  it("초음파 거리 값 블록은 get_distance 이름으로", () => {
    const json = program([{ type: "esp_print", id: "p", inputs: { VALUE: { block: { type: "esp_distance", id: "d" } } } }]);
    const issues = only(run(json), "device-before-setup");
    expect(issues.map((i) => [i.blockId, i.ko, i.en])).toEqual([["d", "초음파 센서를 먼저 준비해 주세요", "NameError: name 'get_distance' is not defined"]]);
  });
  it("dev_led_blink VAR=led 준비 없음 → 오류", () => {
    const blink = { type: "dev_led_blink", id: "b", fields: { VAR: { id: "var_led" } }, inputs: { SEC: shadowNum(0.5), TIMES: shadowNum(3) } };
    const issues = only(run(program([blink], { vars: ["led"] })), "device-before-setup");
    expect(issues.map((i) => [i.blockId, i.ko])).toEqual([["b", "led 를 먼저 준비해 주세요 (핀 블록)"]]);
  });
  it("다른 kind 로 준비된 이름 → 오류", () => {
    const servo = { type: "esp_servo_setup", id: "sv", fields: { VAR: { id: "var_led" }, PIN: 4 } };
    const issues = only(run(program([servo, pinWrite("w", "led")], { vars: ["led"] })), "device-before-setup");
    expect(issues.map((i) => [i.blockId, i.ko, i.en])).toEqual([["w", "led 는 서보 모터예요. 핀 블록으로 준비해 주세요", "TypeError: 'led' is a servo device, not pin or ultrasonic"]]);
  });
  it("준비 있음 → 없음 (초음파 trig 도 핀으로 쓸 수 있다, print 는 준비가 필요 없다)", () => {
    const ultra = { type: "esp_ultrasonic_setup", id: "u", fields: { TRIG: 13, ECHO: 12 } };
    const oled = { type: "esp_oled_setup", id: "o", fields: { SCL: 22, SDA: 21 } };
    const json = program(
      [pinSetup("p", "led", 26), ultra, oled, pinWrite("w", "led"), pinWrite("w2", "trig"), { type: "dev_oled_clear", id: "c" }, { type: "esp_print", id: "pr", inputs: { VALUE: { block: str("hi") } } }],
      { vars: ["led", "trig"] },
    );
    expect(only(run(json), "device-before-setup")).toEqual([]);
  });
  it("살아 있는 작업판 JSON 처럼 변수 칸에 id 만 있어도 variables 에서 이름을 찾는다", () => {
    const json = program([pinSetup("p", "led", 26), pinWrite("w", "lamp")], { vars: ["led", "lamp"] });
    expect(only(run(json), "device-before-setup").map((i) => i.ko)).toEqual(["lamp 를 먼저 준비해 주세요 (핀 블록)"]);
  });
});

describe("pin-rule", () => {
  it("입력 전용 핀에 출력", () => {
    const issues = only(run(program([pinSetup("p", "led", 34, "OUT")], { vars: ["led"] })), "pin-rule");
    expect(issues.map((i) => [i.blockId, i.level, i.ko, i.en])).toEqual([["p", "error", "34번 핀은 입력만 할 수 있어요", "ValueError: pin 34 is input-only"]]);
  });
  it("ADC 없는 핀에 아날로그 입력", () => {
    const adc = { type: "dev_adc_setup", id: "a", fields: { PIN: 5, VAR: { id: "var_adc" } } };
    const issues = only(run(program([adc], { vars: ["adc"] })), "pin-rule");
    expect(issues.map((i) => [i.ko, i.en])).toEqual([["5번 핀은 아날로그 입력을 할 수 없어요 (32~39, 25~27 등)", "ValueError: pin 5 has no ADC"]]);
  });
  it("I2C 버스 핀도 입력 전용 핀을 쓸 수 없다", () => {
    const oled = { type: "esp_oled_setup", id: "o", fields: { SCL: 36, SDA: 21 } };
    expect(only(run(program([oled])), "pin-rule").map((i) => [i.blockId, i.en])).toEqual([["o", "ValueError: pin 36 is input-only"]]);
  });
  it("0~39 밖", () => {
    expect(only(run(program([pinSetup("p", "led", 40)], { vars: ["led"] })), "pin-rule").map((i) => i.en)).toEqual(["ValueError: invalid pin 40"]);
  });
  it("PIN 26 출력, ADC 36, 입력 핀 34 → 없음", () => {
    const adc = { type: "dev_adc_setup", id: "a", fields: { PIN: 36, VAR: { id: "var_adc" } } };
    const json = program([pinSetup("p", "led", 26), adc, pinSetup("q", "sw", 34, "IN")], { vars: ["led", "adc", "sw"] });
    expect(only(run(json), "pin-rule")).toEqual([]);
  });
});

describe("value-range", () => {
  const servo = { type: "esp_servo_setup", id: "sv", fields: { VAR: { id: "var_servo" }, PIN: 4 } };
  const angle = (input: object): B => ({ type: "dev_servo_angle", id: "a", fields: { VAR: { id: "var_servo" } }, inputs: { ANGLE: input } });
  it("각도 200 → 오류", () => {
    const issues = only(run(program([servo, angle({ block: num(200) })], { vars: ["servo"] })), "value-range");
    expect(issues.map((i) => [i.blockId, i.level, i.ko, i.en])).toEqual([["a", "error", "각도는 0~180 사이여야 해요", "ValueError: angle must be 0..180"]]);
  });
  it("그림자 값도 본다", () => {
    expect(only(run(program([servo, angle(shadowNum(-5))], { vars: ["servo"] })), "value-range")).toHaveLength(1);
  });
  it("90 · 변수(그림자 200 위에 끼운 변수) → 없음", () => {
    expect(only(run(program([servo, angle({ block: num(90) })], { vars: ["servo"] })), "value-range")).toEqual([]);
    const withVar = angle({ block: varGet("x"), ...shadowNum(200) });
    expect(only(run(program([servo, varSet("x", num(1)), withVar], { vars: ["servo", "x"] })), "value-range")).toEqual([]);
  });
  it("조사: 횟수는 / 빨강은", () => {
    const blink = { type: "dev_led_blink", id: "b", fields: { VAR: { id: "var_led" } }, inputs: { SEC: shadowNum(0.5), TIMES: shadowNum(0) } };
    expect(only(run(program([pinSetup("p", "led", 26), blink], { vars: ["led"] })), "value-range").map((i) => i.ko)).toEqual(["횟수는 1~1000 사이여야 해요"]);
  });
});

describe("pin-conflict", () => {
  const ultra = (trig: number) => ({ type: "esp_ultrasonic_setup", id: "u", fields: { TRIG: trig, ECHO: 12 } });
  it("같은 핀 → 나중 블록에 주의", () => {
    const issues = only(run(program([pinSetup("p", "led", 13), ultra(13)], { vars: ["led"] })), "pin-conflict");
    expect(issues.map((i) => [i.blockId, i.level, i.ko, i.en])).toEqual([["u", "warning", "13번 핀을 trig 와 led 가 같이 쓰고 있어요", "Warning: pin 13 used by trig and led"]]);
  });
  it("다른 핀 → 없음", () => {
    expect(only(run(program([pinSetup("p", "led", 26), ultra(13)], { vars: ["led"] })), "pin-conflict")).toEqual([]);
  });
  it("떨어진(실행되지 않는) 준비 블록과 겹치는 것은 보지 않는다", () => {
    expect(only(run(program([pinSetup("p", "led", 13)], { tops: [ultra(13)], vars: ["led"] })), "pin-conflict")).toEqual([]);
  });
});

describe("loop-without-sleep", () => {
  it("계속 반복 몸통에 켜기만 → 주의", () => {
    const issues = only(run(program([pinSetup("p", "led", 26), forever("loop", [pinWrite("w", "led")])], { vars: ["led"] })), "loop-without-sleep");
    expect(issues.map((i) => [i.blockId, i.level, i.ko, i.en])).toEqual([["loop", "warning", "반복 안에 기다리기가 없으면 보드가 바빠져요", "Warning: loop without sleep"]]);
  });
  it("기다리기·깜빡이기·음 울리기 포함 → 없음 (안쪽 블록까지 본다)", () => {
    const blink = { type: "dev_led_blink", id: "b", fields: { VAR: { id: "var_led" } }, inputs: { SEC: shadowNum(0.5), TIMES: shadowNum(3) } };
    const beeper = { type: "dev_beeper_setup", id: "bs", fields: { PIN: 25, VAR: { id: "var_beeper" } } };
    const tone = { type: "dev_beeper_tone", id: "t", fields: { VAR: { id: "var_beeper" } }, inputs: { HZ: shadowNum(440), SEC: shadowNum(1) } };
    const ifWait = { type: "controls_if", id: "if", inputs: { IF0: { block: { type: "logic_boolean", id: "tb", fields: { BOOL: "TRUE" } } }, DO0: { block: wait("w", 1) } } };
    const json = program([pinSetup("p", "led", 26), beeper, forever("l1", [ifWait]), forever("l2", [blink]), forever("l3", [tone])], { vars: ["led", "beeper"] });
    expect(only(run(json), "loop-without-sleep")).toEqual([]);
  });
  it("조건 반복도 같은 규칙", () => {
    const cond = { block: { type: "logic_boolean", id: "tb", fields: { BOOL: "TRUE" } } };
    const bad = { type: "controls_whileUntil", id: "wu", fields: { MODE: "WHILE" }, inputs: { BOOL: cond, DO: { block: pinWrite("w", "led") } } };
    const good = { type: "controls_whileUntil", id: "wu2", fields: { MODE: "WHILE" }, inputs: { BOOL: cond, DO: { block: wait("w2", 1) } } };
    const ids = only(run(program([pinSetup("p", "led", 26), bad, good], { vars: ["led"] })), "loop-without-sleep").map((i) => i.blockId);
    expect(ids).toEqual(["wu"]);
  });
  it("몸통이 빈 조건 반복은 신호 기다리기라 보지 않는다 (빈 계속 반복은 주의)", () => {
    const cond = { block: { type: "esp_pin_read", id: "r", fields: { VAR: { id: "var_echo" } } } };
    const idle = { type: "controls_whileUntil", id: "wu", fields: { MODE: "UNTIL" }, inputs: { BOOL: cond } };
    const ids = only(run(program([pinSetup("p", "echo", 12, "IN"), idle, forever("loop", [])], { vars: ["echo"] })), "loop-without-sleep").map((i) => i.blockId);
    expect(ids).toEqual(["loop"]);
  });
  it("기다리는 함수를 부르면 쉬어 가는 것", () => {
    const def = { type: "procedures_defnoreturn", id: "def", fields: { NAME: "pause" }, inputs: { STACK: { block: wait("w", 1) } } };
    const call = { type: "procedures_callnoreturn", id: "c", extraState: { name: "pause" } };
    expect(only(run(program([forever("loop", [call])], { tops: [def] })), "loop-without-sleep")).toEqual([]);
  });
});

describe("break-outside-loop", () => {
  const brk = (id: string): B => ({ type: "flow_break", id });
  const cont = (id: string): B => ({ type: "flow_continue", id });
  const cond = { block: { type: "logic_boolean", id: "tb", fields: { BOOL: "TRUE" } } };
  const ifThen = (id: string, body: B): B => ({ type: "controls_if", id, inputs: { IF0: cond, DO0: { block: body } } });
  it("반복 밖의 멈추기·건너뛰기 → 오류", () => {
    const issues = only(run(program([brk("b"), ifThen("if", cont("c"))])), "break-outside-loop");
    expect(issues.map((i) => [i.blockId, i.level, i.ko, i.en])).toEqual([
      ["b", "error", "반복 안에서만 쓸 수 있어요", "SyntaxError: 'break' outside loop"],
      ["c", "error", "반복 안에서만 쓸 수 있어요", "SyntaxError: 'continue' outside loop"],
    ]);
  });
  it("반복 몸통 안(만약 안쪽, 다음 블록 포함)이면 없음 — 반복 블록 다섯 가지 모두", () => {
    const loops: B[] = [
      forever("l1", [wait("w", 1), ifThen("if1", brk("b1"))]),
      { type: "flow_repeat_n", id: "l2", inputs: { TIMES: shadowNum(3), DO: { block: cont("c2") } } },
      { type: "controls_whileUntil", id: "l3", fields: { MODE: "WHILE" }, inputs: { BOOL: cond, DO: { block: { ...wait("w3", 1), next: { block: brk("b3") } } } } },
      { type: "flow_for_each", id: "l4", fields: { VAR: { id: "var_x" } }, inputs: { LIST: { block: varGet("xs") }, DO: { block: cont("c4") } } },
      { type: "flow_for_range", id: "l5", fields: { VAR: { id: "var_i" } }, inputs: { FROM: shadowNum(0), TO: shadowNum(3), DO: { block: brk("b5") } } },
    ];
    expect(only(run(program(loops, { vars: ["x", "xs", "i"] })), "break-outside-loop")).toEqual([]);
  });
  it("반복 안에서 부르는 함수의 몸통도 반복 밖이다", () => {
    const def = { type: "procedures_defnoreturn", id: "def", fields: { NAME: "f" }, inputs: { STACK: { block: brk("b") } } };
    const call = { type: "procedures_callnoreturn", id: "call", extraState: { name: "f" } };
    expect(only(run(program([forever("loop", [call, wait("w", 1)])], { tops: [def] })), "break-outside-loop").map((i) => i.blockId)).toEqual(["b"]);
  });
  it("떨어진 블록은 보지 않는다 (orphan 만)", () => {
    expect(only(run(program([], { tops: [brk("loose")] })), "break-outside-loop")).toEqual([]);
  });
});

describe("orphan", () => {
  it("시작 블록 밖 최상위 명령 → 주의 (줄 머리에 한 번)", () => {
    const loose = { ...pinWrite("o", "led"), next: { block: pinWrite("o2", "led") } };
    const issues = only(run(program([pinSetup("p", "led", 26)], { tops: [loose], vars: ["led"] })), "orphan");
    expect(issues.map((i) => [i.blockId, i.level, i.ko, i.en])).toEqual([["o", "warning", "시작 블록에 붙이지 않은 블록은 실행되지 않아요", "Warning: orphan block ignored"]]);
  });
  it("함수 정의 최상위 → 없음", () => {
    const def = { type: "procedures_defnoreturn", id: "def", fields: { NAME: "f" } };
    expect(only(run(program([], { tops: [def] })), "orphan")).toEqual([]);
  });
  it("떨어진 준비 블록은 준비한 것으로 치지 않는다 (시작 블록 안의 켜기는 여전히 오류)", () => {
    const issues = run(program([pinWrite("w", "led")], { tops: [pinSetup("loose", "led", 26)], vars: ["led"] }));
    expect(only(issues, "device-before-setup").map((i) => i.blockId)).toEqual(["w"]);
    expect(only(issues, "orphan").map((i) => i.blockId)).toEqual(["loose"]);
  });
  it("떨어진 블록은 orphan 규칙만 본다 (빈 칸·핀·범위·반복·변수·코드 블록 규칙은 건너뛴다)", () => {
    const loose: B[] = [
      { type: "flow_wait", id: "w" },
      pinSetup("p", "led", 40),
      forever("loop", [pinWrite("on", "led")]),
      { type: "esp_print", id: "pr", inputs: { VALUE: { block: varGet("d", "g") } } },
      { type: "code_stmt", id: "c", fields: { CODE: "import gc" } },
      varSet("x", num(1), "set_x"),
    ];
    const issues = run(program([{ type: "esp_print", id: "pr2", inputs: { VALUE: { block: varGet("x", "gx") } } }], { tops: loose, vars: ["led", "d", "x"] }));
    expect(issues.map((i) => [i.id, i.blockId])).toEqual([
      ["orphan", "w"], ["orphan", "p"], ["orphan", "loop"], ["orphan", "pr"], ["orphan", "c"], ["orphan", "set_x"],
      ["undefined-variable", "gx"],
    ]);
  });
});

describe("undefined-variable", () => {
  const print = (id: string, value: B): B => ({ type: "esp_print", id, inputs: { VALUE: { block: value } } });
  it("variables_get d, set 없음 → 주의", () => {
    const issues = only(run(program([print("p", varGet("d", "g"))], { vars: ["d"] })), "undefined-variable");
    expect(issues).toEqual([{ id: "undefined-variable", level: "warning", blockId: "g", ko: "d 는 아직 값을 정하지 않았어요", en: "NameError: name 'd' may be undefined" }]);
  });
  it("set 있음 / 함수 매개변수 / 준비 블록 VAR / n번 반복의 i → 없음", () => {
    const def = {
      type: "procedures_defnoreturn", id: "def", fields: { NAME: "f" }, extraState: { params: [{ name: "t", id: "var_t" }] },
      inputs: { STACK: { block: print("p1", varGet("t")) } },
    };
    const adc = { type: "dev_adc_setup", id: "a", fields: { PIN: 36, VAR: { id: "var_light" } } };
    const repeat = { type: "flow_repeat_n", id: "r", inputs: { TIMES: shadowNum(3), DO: { block: print("p2", varGet("i")) } } };
    const json = program([adc, varSet("d", num(1)), print("p3", varGet("d")), print("p4", varGet("light")), repeat], { tops: [def], vars: ["t", "light", "d", "i"] });
    expect(only(run(json), "undefined-variable")).toEqual([]);
  });
  const listVar = (name: string) => ({ VAR: { id: `var_${name}` } });
  it("정의 안 된 리스트에 추가·바꾸기·위치 → 주의 (리스트 블록과 만큼 바꾸기도 변수를 읽는다)", () => {
    const append = { type: "list_append", id: "ap", fields: listVar("items"), inputs: { V: shadowNum(4) } };
    const change = { type: "var_change", id: "ch", fields: listVar("count"), inputs: { DELTA: shadowNum(1) } };
    const index = { type: "list_index", id: "ix", fields: listVar("items"), inputs: { V: shadowNum(3) } };
    const issues = only(run(program([append, change, print("p", index)], { vars: ["items", "count"] })), "undefined-variable");
    expect(issues.map((i) => [i.blockId, i.ko])).toEqual([
      ["ap", "items 는 아직 값을 정하지 않았어요"],
      ["ch", "count 는 아직 값을 정하지 않았어요"],
      ["ix", "items 는 아직 값을 정하지 않았어요"],
    ]);
  });
  it("리스트 만들기 · 각 항목 반복의 변수 · 범위 반복의 변수 → 정의로 본다", () => {
    const create = { type: "list_create", id: "c", fields: listVar("items") };
    const append = { type: "list_append", id: "ap", fields: listVar("items"), inputs: { V: shadowNum(4) } };
    const each = { type: "flow_for_each", id: "fe", fields: listVar("item"), inputs: { LIST: { block: varGet("items") }, DO: { block: print("p1", varGet("item")) } } };
    const range = { type: "flow_for_range", id: "fr", fields: listVar("x"), inputs: { FROM: shadowNum(0), TO: shadowNum(3), DO: { block: print("p2", varGet("x")) } } };
    const from = { type: "list_create_from", id: "cf", fields: { ...listVar("nums"), ITEMS: "1, 2" } };
    const set = { type: "list_set", id: "ls", fields: listVar("nums"), inputs: { I: shadowNum(0), V: shadowNum(5) } };
    const json = program([create, append, each, range, from, set], { vars: ["items", "item", "x", "nums"] });
    expect(only(run(json), "undefined-variable")).toEqual([]);
  });
  it("새 블록의 빈 칸도 찾는다", () => {
    const blocks: B[] = [
      { type: "var_change", id: "e1", fields: listVar("count") },
      { type: "list_append", id: "e2", fields: listVar("items") },
      { type: "list_insert", id: "e3", fields: listVar("items"), inputs: { I: shadowNum(0) } },
      { type: "list_set", id: "e4", fields: listVar("items"), inputs: { V: shadowNum(0) } },
      { type: "flow_for_each", id: "e5", fields: listVar("item") },
      { type: "flow_for_range", id: "e6", fields: listVar("x"), inputs: { FROM: shadowNum(0) } },
      { type: "list_clear", id: "ok", fields: listVar("items") },
    ];
    const issues = only(run(program([varSet("count", num(0)), { type: "list_create", id: "c", fields: listVar("items") }, ...blocks], { vars: ["count", "items", "item", "x"] })), "empty-input");
    expect(issues.map((i) => i.blockId)).toEqual(["e1", "e2", "e3", "e4", "e5", "e6"]);
    expect(blockLabel("list_insert")).toBe("… 의 … 번째에 … 끼워 넣기 (0부터)");
    expect(blockLabel("flow_break")).toBe("반복 멈추고 나가기");
  });
  it("값 블록의 줄은 담은 명령 블록의 줄", () => {
    const issues = only(runMapped(program([print("p", varGet("d", "g"))], { vars: ["d"] })), "undefined-variable");
    expect(issues.map((i) => [i.blockId, i.line])).toEqual([["g", 1]]);
  });
});

describe("raw-code", () => {
  it("code_stmt · code_expr → 정보", () => {
    const expr = { type: "code_expr", id: "e", fields: { CODE: "x + 1" } };
    const issues = only(run(program([{ type: "code_stmt", id: "c", fields: { CODE: "import gc" } }, { type: "esp_print", id: "p", inputs: { VALUE: { block: expr } } }])), "raw-code");
    expect(issues.map((i) => [i.blockId, i.level, i.ko, i.en])).toEqual([
      ["c", "info", "이 코드는 블록으로 바꾸지 못했어요. 그대로 실행됩니다", "Note: raw code kept as-is"],
      ["e", "info", "이 코드는 블록으로 바꾸지 못했어요. 그대로 실행됩니다", "Note: raw code kept as-is"],
    ]);
  });
});

describe("lint: 순서와 줄 번호", () => {
  it("오류 → 주의 → 정보, 같은 수준은 줄 순서", () => {
    // 줄: 3 led 준비(34번 핀 오류), 5 while(기다리기 없음 주의), 6 켜기(준비 없는 lamp 오류), 7 코드(정보)
    const json = program(
      [pinSetup("p", "led", 34), forever("loop", [pinWrite("w", "lamp"), { type: "code_stmt", id: "c", fields: { CODE: "pass" } }])],
      { vars: ["led", "lamp"] },
    );
    const { code, map } = workspaceJsonToCodeWithMap(json as WorkspaceJson);
    expect(code.split("\n").slice(2, 7)).toEqual(["led = Pin(34, Pin.OUT)", "", "while True:", "    lamp.value(1)", "    pass"]);
    const issues = lint(json, map);
    expect(issues.map((i) => [i.level, i.id, i.line])).toEqual([
      ["error", "pin-rule", 3],
      ["error", "device-before-setup", 6],
      ["warning", "loop-without-sleep", 5],
      ["info", "raw-code", 7],
    ]);
  });
  it("줄을 모르는 문제는 같은 수준의 뒤로, 지어낸 id 는 내보내지 않는다", () => {
    const map: LineMap = { blockToLines: { b: [5] }, lineToBlock: { 5: "b" }, blockStart: { b: 5 } };
    const json = { blocks: { blocks: [{ type: "start_program", id: "start", inputs: { BODY: { block: { type: "flow_wait", next: { block: { type: "flow_wait", id: "b" } } } } } }] } };
    const issues = only(lint(json, map), "empty-input");
    expect(issues.map((i) => [i.blockId, i.line])).toEqual([["b", 5], [undefined, undefined]]);
  });
  it("정상 프로그램 (깜빡이기 반복)에는 문제가 없다", () => {
    const json = program([pinSetup("p", "led", 26), forever("loop", [pinWrite("on", "led", 1), wait("w1", 1), pinWrite("off", "led", 0), wait("w2", 1)])], { vars: ["led"] });
    expect(runMapped(json)).toEqual([]);
  });
});
