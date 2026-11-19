import { describe, expect, it } from "vitest";
import { codeToBlocks } from "@/parser";
import { getChapter, type LoadedChapter } from "./content";
import { judge } from "./judge";
import {
  applyPinMap, carriedPinMap, chapterPinBaseline, invertPinMap, judgeCodeOf, pinChanges, replacePins, resolvePinMap,
} from "./pinCarry";
import type { StepRecord } from "./progress";
import type { StepOf } from "./schema";

const rec = (input: Record<string, unknown>): StepRecord => ({ status: "open", input, attempts: 0, updatedAt: "2026-11-19T00:00:00.000Z" });
const chapter = (id: string): LoadedChapter => getChapter(id)!;
const traffic = chapter("03-traffic-light");
const trafficStart = traffic.files["step1_traffic_light.py"];

describe("pinChanges — 같은 변수 이름 줄끼리 핀 자리 숫자를 비교한다", () => {
  it("바꾼 핀과 그대로인 핀 모두", () => {
    const edited = trafficStart.replace("Pin(13,", "Pin(15,").replace("Pin(14,", "Pin(16,").replace("Pin(16, Pin.OUT)  # IO16", "Pin(5, Pin.OUT)  # IO16");
    expect([...pinChanges(trafficStart, edited)]).toEqual([[13, 15], [14, 16], [16, 5]]);
  });
  it("이름이 없어진 줄·자리 수가 다른 줄은 보지 않는다", () => {
    expect([...pinChanges("a = Pin(1)\nb = Pin(2)", "b = Pin(3)\nc = Pin(4)")]).toEqual([[2, 3]]);
    expect([...pinChanges("i2c = SoftI2C(scl=Pin(22), sda=Pin(21))", "i2c = SoftI2C(scl=Pin(19), sda=Pin(18))")]).toEqual([[22, 19], [21, 18]]);
  });
});

describe("applyPinMap — 시작 코드에 표를 적용한다 (핀 숫자 + 그 줄 주석)", () => {
  it("신호등 13·14·16 → 15·16·5: 맞물린 바꿈도 한꺼번에", () => {
    const r = applyPinMap(trafficStart, new Map([[13, 15], [14, 16], [16, 5]]));
    expect(r.applied).toEqual([{ from: 13, to: 15 }, { from: 14, to: 16 }, { from: 16, to: 5 }]);
    expect(r.skipped).toEqual([]);
    expect(r.code).toContain("led_red = Pin(15, Pin.OUT)  # IO15 → 빨강");
    expect(r.code).toContain("led_yellow = Pin(16, Pin.OUT)  # IO16 → 노랑");
    expect(r.code).toContain("led_green = Pin(5, Pin.OUT)  # IO5 → 초록");
    // 다른 숫자는 그대로
    expect(r.code).toContain("time.sleep(5)  # 5초 기다리기");
  });
  it("시작 코드에 없는 번호의 바꿈은 적용할 것이 없다", () => {
    const r = applyPinMap(trafficStart, new Map([[26, 27]]));
    expect(r).toEqual({ code: trafficStart, applied: [], skipped: [] });
  });
  it("새 번호가 바꾸지 않는 다른 핀과 같으면 그 바꿈은 빼고 알린다", () => {
    const r = applyPinMap(trafficStart, new Map([[13, 14]]));
    expect(r.applied).toEqual([]);
    expect(r.skipped).toEqual([{ from: 13, to: 14 }]);
    expect(r.code).toBe(trafficStart);
  });
  it("부딪혀 뺀 핀이 그대로 남으면 그 번호로 가려던 다른 바꿈도 뺀다", () => {
    // 13 → 14 는 14 가 그대로라 빠지고, 그러면 13 이 남아 16 → 13 도 빠진다
    const r = resolvePinMap(new Map([[13, 14], [16, 13]]), trafficStart);
    expect(r.applied).toEqual([]);
    expect(r.skipped).toEqual([{ from: 13, to: 14 }, { from: 16, to: 13 }]);
  });
  it("두 핀이 한 번호로 모이면 둘 다 뺀다", () => {
    const r = resolvePinMap(new Map([[13, 25], [14, 25]]), trafficStart);
    expect(r.applied).toEqual([]);
    expect(r.skipped).toHaveLength(2);
  });
  it("한 줄 주석이 여러 핀을 말하면 모두 (RGB)", () => {
    const r = applyPinMap(chapter("05-rgb-led").files["step1_rgb_colors.py"], new Map([[25, 33]]));
    expect(r.code).toContain("red = PWM(Pin(27))  # 세 핀을 모두 PWM으로 (빨강 27, 초록 33, 파랑 26)");
    expect(r.code).toContain("green = PWM(Pin(33))");
  });
  it("맞바꿈(13 ↔ 14)", () => {
    const r = applyPinMap(trafficStart, new Map([[13, 14], [14, 13]]));
    expect(r.code).toContain("led_red = Pin(14, Pin.OUT)  # IO14 → 빨강");
    expect(r.code).toContain("led_yellow = Pin(13, Pin.OUT)  # IO13 → 노랑");
  });
});

describe("carriedPinMap — 앞 단계 기록으로 핀 바꿈 표", () => {
  const edited = trafficStart.replace("Pin(13, Pin.OUT)  # IO13", "Pin(15, Pin.OUT)  # IO15");
  it("실행 단계에서 바꾼 핀이 미션으로 이어진다 (그 단계 앞만 본다)", () => {
    const records = { run: rec({ program: { code: edited } }) };
    expect([...carriedPinMap(traffic, records, "mission")]).toEqual([[13, 15]]);
    expect([...carriedPinMap(traffic, records, "run")]).toEqual([]);
    expect([...carriedPinMap(traffic, records, "predict")]).toEqual([]);
  });
  it("뒤 단계의 바꿈이 앞 단계를 덮는다 — 원래 핀으로 되돌린 것도", () => {
    const back = rec({ program: { code: trafficStart } });
    expect([...carriedPinMap(traffic, { run: rec({ program: { code: edited } }), mission: back }, "extra1")]).toEqual([]);
    const other = trafficStart.replace("Pin(13, Pin.OUT)", "Pin(17, Pin.OUT)");
    expect([...carriedPinMap(traffic, { run: rec({ program: { code: edited } }), mission: rec({ program: { code: other } }) }, "extra1")]).toEqual([[13, 17]]);
  });
  it("변수 이름이 달라도 원래 번호로 잇는다 (다음 단계 파일의 이름은 상관없다)", () => {
    const map = carriedPinMap(traffic, { run: rec({ program: { code: edited } }) }, "extra1");
    const next = applyPinMap(traffic.files["mission_yellow_5times.py"], map);
    expect(next.code).toContain("led_red = Pin(15, Pin.OUT)");
    expect(next.applied).toEqual([{ from: 13, to: 15 }]);
  });
  it("디버깅: 통과한 증상의 프로그램만, 증상 코드가 아니라 챕터 기준 배선과 비교한다", () => {
    const clap = chapter("13-clap-dial");
    const debug = clap.parts.flatMap((p) => p.steps).find((s) => s.type === "debug") as StepOf<"debug">;
    const i = debug.symptoms.findIndex((s) => s.rules.some((r) => "pinIs" in r));
    // 증상 코드는 소리 센서·LED 핀이 일부러 뒤바뀌어 있다 (26 ↔ 36). 고쳐서 통과한 프로그램은 바꿈이 없어야 한다
    const fixed = debug.symptoms[i].code.replace("ADC(Pin(26))", "ADC(Pin(36))").replace("led = Pin(36, Pin.OUT)", "led = Pin(26, Pin.OUT)");
    const programs: unknown[] = [];
    const passed: boolean[] = [];
    programs[i] = { code: fixed };
    passed[i] = true;
    const base = chapterPinBaseline(clap);
    expect(base.get("sound")).toEqual([36]);
    const after = clap.parts.flatMap((p) => p.steps).map((s) => s.id);
    const nextId = after[after.indexOf(debug.id) + 1];
    expect([...carriedPinMap(clap, { [debug.id]: rec({ programs, passed }) }, nextId)]).toEqual([]);
    // 학생 보드에서 LED 를 27 에 꽂아 고쳤으면 26 → 27
    programs[i] = { code: fixed.replace("led = Pin(26, Pin.OUT)", "led = Pin(27, Pin.OUT)") };
    expect([...carriedPinMap(clap, { [debug.id]: rec({ programs, passed }) }, nextId)]).toEqual([[26, 27]]);
    // 통과하지 못한 프로그램은 보지 않는다
    expect([...carriedPinMap(clap, { [debug.id]: rec({ programs, passed: [] }) }, nextId)]).toEqual([]);
  });
});

describe("judgeCodeOf — 판정은 거꾸로 표로 원래 핀 번호로 되돌려서", () => {
  it("미션 판정이 바꾼 핀 때문에 떨어지지 않는다 (07-fan 의 PWM(Pin(13)) 규칙)", () => {
    const fan = chapter("07-fan");
    const mission = fan.parts.flatMap((p) => p.steps).find((s) => s.type === "mission" && s.rules.some((r) => "codeMatches" in r && r.codeMatches.includes("Pin\\(\\s*13"))) as StepOf<"mission">;
    const rule = mission.rules.filter((r) => "codeMatches" in r && r.codeMatches.includes("Pin\\(\\s*13"));
    const code = "from machine import Pin, PWM\nfan = PWM(Pin(15))\n";
    expect(judge(rule, { code }).pass).toBe(false);
    expect(judge(rule, { code: judgeCodeOf(code, new Map([[13, 15]])) }).pass).toBe(true);
  });
  it("디버깅 증상: 이어 받은 고장 코드를 학생 핀으로 고치면 원래 규칙으로 통과", () => {
    const door = chapter("10-auto-door");
    const debug = door.parts.flatMap((p) => p.steps).find((s) => s.id === "debug1") as StepOf<"debug">;
    const symptom = debug.symptoms[0];
    const map = new Map([[13, 5]]);
    const carried = applyPinMap(symptom.code, map);
    expect(carried.code).toBe("trig = Pin(12, Pin.OUT)\necho = Pin(5, Pin.IN)");
    const fixed = "trig = Pin(5, Pin.OUT)\necho = Pin(12, Pin.IN)";
    expect(judge(symptom.rules, { code: fixed }).pass).toBe(false);
    expect(judge(symptom.rules, { code: judgeCodeOf(fixed, map, symptom.code) }).pass).toBe(true);
  });
  it("시작 코드의 바꾸지 않는 핀과 부딪히는 바꿈은 판정에도 쓰지 않는다", () => {
    // 13 → 14 는 14(노랑)와 부딪혀 빠진다 → 학생 코드의 14 를 13 으로 되돌리지 않는다
    expect(judgeCodeOf("led_yellow = Pin(14, Pin.OUT)", new Map([[13, 14]]), trafficStart)).toBe("led_yellow = Pin(14, Pin.OUT)");
  });
  it("표가 비면 그대로, 주석은 건드리지 않는다", () => {
    expect(judgeCodeOf("a = Pin(15)  # IO15", new Map())).toBe("a = Pin(15)  # IO15");
    expect(judgeCodeOf("a = Pin(15)  # IO15", new Map([[13, 15]]))).toBe("a = Pin(13)  # IO15");
  });
  it("invertPinMap · replacePins", () => {
    expect([...invertPinMap(new Map([[13, 15]]))]).toEqual([[15, 13]]);
    expect(replacePins("rc522 = mfrc522(22, 21, 0x28)  # SCL 22번, SDA 21번", new Map([[22, 18]]))).toBe("rc522 = mfrc522(18, 21, 0x28)  # SCL 18번, SDA 21번");
  });
});

describe("이어 받은 시작 코드도 블록으로 바뀐다 (unparsed 0)", () => {
  const cases: [string, string, Map<number, number>][] = [
    ["03-traffic-light", "step1_traffic_light.py", new Map([[13, 15], [14, 16], [16, 5]])],
    ["10-auto-door", "step3_auto_door.py", new Map([[13, 5], [12, 18], [4, 15], [22, 19], [21, 23]])],
    ["05-rgb-led", "step1_rgb_colors.py", new Map([[27, 32], [25, 33], [26, 14]])],
  ];
  it.each(cases)("%s %s", (id, file, map) => {
    const ch = chapter(id);
    const start = ch.files[file];
    const r = applyPinMap(start, map);
    expect(r.applied.length).toBeGreaterThan(0);
    const before = codeToBlocks(start);
    const after = codeToBlocks(r.code);
    expect(after.ok).toBe(true);
    if (before.ok && after.ok) expect(after.unparsed.length).toBe(before.unparsed.length);
    if (after.ok) expect(after.unparsed).toHaveLength(0);
  });
});
