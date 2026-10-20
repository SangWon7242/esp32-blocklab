import { describe, expect, it } from "vitest";
import { actionHelpersOf, defaultValues, DEVICES, DEVICE_CATEGORIES, findActionByBlock, findSetupByBlock, findValueByBlock, requiredKinds, setupSpecs } from "./registry";
import { workspaceJsonToCode } from "@/codegen";
import { codeToBlocks } from "@/parser";
import { print, program } from "./testkit";

import { ADC_PINS, LEADING_ASSIGN, TOUCH_PINS } from "./specs/common";
import { setupLinesAt } from "@/parser/devices";
import { deviceBlockDefinitions, deviceToolboxCategories } from "./toBlocks";
import { collectImports } from "@/codegen/imports";
import { isGeneratedImport } from "./imports";

const specsOf = (d: (typeof DEVICES)[number]) => [...(d.setup ? [d.setup] : []), ...d.actions, ...d.values];
const allBlocks = () => DEVICES.flatMap((d) => specsOf(d).map((s) => s.blockType));

describe("장치 레지스트리", () => {
  it("블록 type 이 겹치지 않는다", () => {
    const types = allBlocks();
    expect(new Set(types).size).toBe(types.length);
  });
  it("메시지의 %n 개수가 parts 개수와 같다", () => {
    for (const d of DEVICES) for (const s of specsOf(d)) {
      const n = (s.message.match(/%\d+/g) ?? []).length;
      expect(n, s.blockType).toBe(s.parts.length);
    }
  });
  it("기존 14개 블록이 그대로 있다", () => {
    for (const t of ["esp_pin_setup", "esp_pin_write", "esp_pin_read", "esp_pwm_setup", "esp_servo_setup", "esp_pwm_duty", "esp_servo_door", "esp_ultrasonic_setup", "esp_distance", "esp_oled_setup", "esp_oled_show", "esp_print", "esp_print2"]) {
      expect(findSetupByBlock(t) ?? findActionByBlock(t) ?? findValueByBlock(t), t).toBeTruthy();
    }
    expect(findSetupByBlock("esp_pin_setup")!.parts.map((p) => p.name)).toEqual(["PIN", "MODE", "VAR"]);
  });
  it("블록 JSON 과 툴박스를 만든다", () => {
    const defs = deviceBlockDefinitions();
    expect(defs.map((d) => d.type)).toEqual(expect.arrayContaining(allBlocks()));
    const cats = deviceToolboxCategories();
    expect(cats.map((c) => c.name)).toEqual(DEVICE_CATEGORIES.map((c) => c.label));
  });
  it("서보 3줄 선언이 PWM 2줄 선언보다 앞에 있다 (먼저 나온 선언이 접힌다)", () => {
    const ids = DEVICES.map((d) => d.id);
    expect(ids.indexOf("servo")).toBeLessThan(ids.indexOf("pwm"));
    expect(ids.indexOf("ultrasonic")).toBeLessThan(ids.indexOf("pin_out"));
  });
  it("툴박스 항목은 값 입력에 shadow 를 끼운다", () => {
    const blocks = deviceToolboxCategories().flatMap((c) => c.contents).filter((i) => i.kind === "block");
    const duty = blocks.find((b) => b.type === "esp_pwm_duty");
    expect(duty?.inputs).toEqual({ DUTY: { shadow: { type: "math_number", fields: { NUM: 32768 } } } });
    const show = blocks.find((b) => b.type === "esp_oled_show");
    expect(show?.inputs).toEqual({ A: { shadow: { type: "text", fields: { TEXT: "AUTO DOOR" } } }, B: { shadow: { type: "text", fields: { TEXT: "Come closer" } } } });
  });
});

describe("장치 카테고리의 도우미 \"함수 만들기\" 블록", () => {
  const items = (category: string) => deviceToolboxCategories().find((c) => c.name === category)!.contents;
  it("장치 블록 뒤에 그 장치 도우미의 함수 정의 블록(몸통이 채워진)이 이름 그대로 있다", () => {
    const defs = deviceToolboxCategories().flatMap((c) => c.contents).flatMap((i) => (i.kind === "block" && i.type.startsWith("procedures_def") ? [(i.fields as { NAME: string }).NAME] : []));
    expect([...new Set(defs)].sort()).toEqual(DEVICES.flatMap(actionHelpersOf).map((h) => h.name).sort());
    const sensor = items("센서");
    const at = sensor.findIndex((i) => i.kind === "label" && i.text === "초음파 센서");
    expect(sensor.slice(at, at + 4).map((i) => (i.kind === "label" ? i.text : i.type))).toEqual(["초음파 센서", "esp_ultrasonic_setup", "esp_distance", "procedures_defreturn"]);
    const def = sensor[at + 3] as { fields: unknown; inputs: Record<string, { block?: { type: string; fields?: unknown } }> };
    expect(def.fields).toEqual({ NAME: "get_distance" });
    expect(def.inputs.STACK.block).toMatchObject({ type: "esp_pin_write", fields: { VAR: { id: "var_trig", name: "trig" }, VALUE: "1" } });
    expect(def.inputs.RETURN.block?.type).toBe("calc_int");
  });
  it("7세그먼트는 hc595_shift 다음 show_digit (부르는 것보다 먼저 정의)", () => {
    const names = items("화면").flatMap((i) => (i.kind === "block" && i.type.startsWith("procedures_def") ? [(i.fields as { NAME: string }).NAME] : []));
    expect(names.filter((n) => n === "hc595_shift" || n === "show_digit")).toEqual(["hc595_shift", "show_digit"]);
  });
});

describe("툴박스 순서 (toolboxOrder)", () => {
  it("카테고리 안의 장치 라벨이 읽기 좋은 순서다 (파서 우선순위와 따로)", () => {
    const labels = Object.fromEntries(deviceToolboxCategories().map((c) => [c.name, c.contents.flatMap((i) => (i.kind === "label" ? [i.text] : []))]));
    expect(labels).toEqual({
      "핀": ["핀", "입력 핀", "PWM 핀", "아날로그 핀", "출력"],
      "LED": ["핀", "LED", "밝기 LED", "RGB LED", "흐르는 LED"],
      "버튼·스위치": ["버튼", "터치 패드", "틸트 스위치", "인체감지(PIR)", "조이스틱"],
      "센서": ["조도 센서", "가변저항", "소리 센서", "불꽃 센서", "온도(서미스터)", "온도(LM35)", "초음파 센서", "온습도(DHT11)"],
      "소리": ["능동 부저", "수동 부저(음)"],
      "모터": ["서보 모터", "DC 모터", "릴레이"],
      "화면": ["OLED", "LCD 128×32", "7세그먼트"],
      "입력장치": ["RFID", "키패드", "IR 리모컨"],
      "통신": ["WiFi", "웹서버"],
    });
  });
});

describe("import 규칙", () => {
  it("ADC 도 machine 에서 가져온다", () => {
    expect(collectImports("adc = ADC(Pin(36))\n")).toEqual(["from machine import Pin, ADC"]);
  });
  it("생성기가 다시 만드는 import 줄만 지워도 된다", () => {
    expect(isGeneratedImport("from machine import Pin, PWM")).toBe(true);
    expect(isGeneratedImport("import time")).toBe(true);
    expect(isGeneratedImport("import ssd1306")).toBe(true);
    expect(isGeneratedImport("import time as t")).toBe(false);
    expect(isGeneratedImport("from machine import Pin as P")).toBe(false);
    expect(isGeneratedImport("import random")).toBe(true);
    expect(isGeneratedImport("import network")).toBe(true);
    expect(isGeneratedImport("import socket")).toBe(true);
    expect(isGeneratedImport("import os")).toBe(false);
  });
});

describe("계획 2B 검사용 메타데이터", () => {
  const commands = DEVICES.flatMap((d) => [...d.actions, ...d.values].map((spec) => ({ d, spec })));

  it("print 가 아닌 모든 명령·값 블록은 requiredKinds 가 있다", () => {
    for (const { d, spec } of commands) {
      if (d.id === "print") expect(requiredKinds(spec), spec.blockType).toEqual([]);
      else expect(requiredKinds(spec).length, spec.blockType).toBeGreaterThan(0);
    }
    expect(requiredKinds(findActionByBlock("dev_led_blink")!)).toEqual(["pin"]);
    expect(requiredKinds(findActionByBlock("dev_beeper_note")!)).toEqual(["beeper"]);
    expect(requiredKinds(findActionByBlock("esp_pin_write")!)).toEqual(["pin", "ultrasonic", "tilt", "pir", "seg7"]);
    // 아날로그 값 블록은 아날로그 핀과 아날로그 센서 넷의 변수를 모두 받는다
    expect(requiredKinds(findValueByBlock("dev_adc_read")!)).toEqual(["adc", "light", "knob", "sound", "flame"]);
    expect(requiredKinds(findValueByBlock("dev_light_value")!)).toEqual(["light"]);
    expect(requiredKinds(findActionByBlock("dev_motor_stop")!)).toEqual(["motor"]);
  });

  it("모든 핀 칸에 쓰임(dir)이 있고, mode 는 OUT/IN 드롭다운을 가리키며, adc 핀 기본값은 ADC 핀이다", () => {
    for (const d of DEVICES) for (const s of specsOf(d)) for (const p of s.parts) {
      if (p.kind !== "pin") continue;
      expect(["out", "in", "adc", "bus", "touch", "mode"], `${s.blockType}.${p.name}`).toContain(p.dir);
      if (p.dir === "touch") expect(TOUCH_PINS, `${s.blockType}.${p.name}`).toContain(p.default);
      if (p.dir === "mode") {
        const mode = s.parts.find((q) => q.name === p.modeField);
        expect(mode?.kind === "dropdown" ? mode.options.map(([, v]) => v).sort() : null, s.blockType).toEqual(["IN", "OUT"]);
      }
      if (p.dir === "adc") expect(ADC_PINS, `${s.blockType}.${p.name}`).toContain(p.default);
    }
  });

  it("값 범위는 값 입력 칸에 { min, max, label: { ko, en } } 로 적는다", () => {
    for (const { spec } of commands) for (const [name, r] of Object.entries(spec.range ?? {})) {
      expect(spec.parts.some((p) => p.name === name && p.kind === "value"), `${spec.blockType}.${name}`).toBe(true);
      expect(r.min, `${spec.blockType}.${name}`).toBeLessThan(r.max);
      expect(r.label.ko && r.label.en, `${spec.blockType}.${name}`).toBeTruthy();
    }
    expect(findActionByBlock("dev_servo_angle")!.range).toEqual({ ANGLE: { min: 0, max: 180, label: { ko: "각도", en: "angle" } } });
  });

  it("준비의 provides 는 비어 있지 않고, 기본값 준비 줄을 접은 선언의 장치 변수와 같다", () => {
    for (const s of setupSpecs()) {
      const v = defaultValues(s.parts);
      const provided = s.provides(v);
      expect(provided.length, s.blockType).toBeGreaterThan(0);
      // 이 준비 줄을 실제로 접는 선언 (자기 자신, 또는 같은 줄을 먼저 잡는 esp_pin_setup·dev_adc_setup·dev_button_setup)
      const lines = s.lines(v);
      const folder = setupSpecs().find((o) => setupLinesAt(o, lines, 0));
      expect(folder, s.blockType).toBeTruthy();
      expect(setupLinesAt(folder!, lines, 0)!.vars, s.blockType).toEqual(provided);
    }
  });
});

describe("레지스트리 불변식", () => {
  it("명령·값 템플릿은 도우미를 맨 앞에서만(대입 `a, b = ` 뒤 포함), 자기 장치의 것만 부른다 (생성기가 맨 앞 호출만 바뀐 이름으로 고친다)", () => {
    const helperOwner = new Map(DEVICES.flatMap((d) => actionHelpersOf(d).map((h) => [h.name, d.id] as const)));
    for (const d of DEVICES) for (const spec of [...d.actions, ...d.values]) {
      const code = spec.code(defaultValues(spec.parts));
      const head = LEADING_ASSIGN.exec(code)?.[0].length ?? 0;
      for (const [name, owner] of helperOwner) {
        const at = [...code.matchAll(new RegExp(String.raw`(?<![\w.])${name}\(`, "g"))].map((m) => m.index);
        if (!at.length) continue;
        expect({ at, owner }, `${spec.blockType}: ${code}`).toEqual({ at: [head], owner: d.id });
      }
    }
  });
  it("함수 정의 뒤에 두는 준비 줄(afterHelpers)은 대입 뒤 맨 앞에서 자기 보드 라이브러리 함수를 부른다", () => {
    for (const s of setupSpecs()) {
      if (!s.afterHelpers) continue;
      const names = s.libNames ?? [];
      for (const line of s.lines(defaultValues(s.parts))) {
        const rest = line.slice(LEADING_ASSIGN.exec(line)?.[0].length ?? 0);
        expect(names.some((n) => rest.startsWith(`${n}(`)), `${s.blockType}: ${line}`).toBe(true);
      }
    }
  });
  it("도우미가 있는 블록의 템플릿은 그 도우미 중 하나를 값 칸보다 앞(맨 앞)에서 부른다", () => {
    for (const d of DEVICES) for (const a of [...d.actions, ...d.values]) {
      if (!a.helpers?.length) continue;
      const v = defaultValues(a.parts);
      for (const p of a.parts) if (p.kind === "value") v[p.name] = `VALUE_${p.name}`;
      const code = a.code(v);
      const at = Math.min(...a.helpers.map((h) => code.search(new RegExp(String.raw`(?<![\w.])${h.name}\(`))).filter((i) => i >= 0), Infinity);
      const firstValue = Math.min(...a.parts.filter((p) => p.kind === "value").map((p) => code.indexOf(`VALUE_${p.name}`)), Infinity);
      expect(at, a.blockType).toBe(LEADING_ASSIGN.exec(code)?.[0].length ?? 0);
      expect(at, a.blockType).toBeLessThan(firstValue);
    }
  });
  it("짧은 도우미 이름은 장치끼리 겹치지 않고, 같은 이름이면 몸통도 같다 (한 장치 안에서 여러 블록이 같은 도우미를 쓴다)", () => {
    const seen = new Map<string, { device: string; body: string }>();
    for (const d of DEVICES) for (const s of [...d.actions, ...d.values]) for (const h of s.helpers ?? []) {
      const body = JSON.stringify([h.params, h.body]);
      const prev = seen.get(h.name);
      if (prev) expect(prev, `${s.blockType}: ${h.name}`).toEqual({ device: d.id, body });
      else seen.set(h.name, { device: d.id, body });
    }
    expect(seen.size).toBe(11);
  });
  it("도우미 몸통은 모두 블록이 되고(code 블록 없음) 그 장치 준비와 함께 글자 그대로 돌아온다", () => {
    for (const d of DEVICES) {
      const helpers = actionHelpersOf(d);
      if (!helpers.length) continue;
      const setup = d.setup!;
      const call = [...d.actions, ...d.values].find((s) => s.helpers?.length)!;
      // 준비 줄 → 도우미 def 들 → 그 도우미를 부르는 블록 하나 (생성기가 내는 꼴)
      const json = program([{ type: setup.blockType }, "output" in call ? print({ type: call.blockType }) : { type: call.blockType }]);
      const code = workspaceJsonToCode(json);
      for (const h of call.helpers!) expect(code, `${call.blockType}`).toContain(`def ${h.name}(`);
      const r = codeToBlocks(code);
      if (!r.ok) throw new Error(r.error.message);
      expect(r.unparsed, `${d.id}:\n${code}`).toEqual([]);
      expect(JSON.stringify(r.json), d.id).not.toMatch(/"code_(stmt|expr)"/);
      // 도우미 def 는 함수 정의 블록이 되고, 다시 만든 코드는 같은 글 (생성기는 같은 이름의 함수 블록이 있으면 도우미를 다시 만들지 않는다)
      const defs = (r.json.blocks.blocks as { type: string; fields?: { NAME?: string } }[]).filter((b) => b.type.startsWith("procedures_def")).map((b) => b.fields?.NAME);
      expect(defs, d.id).toEqual(call.helpers!.map((h) => h.name));
      expect(workspaceJsonToCode(r.json), d.id).toBe(code);
    }
  });
  it("명령 lines 패턴의 첫 정규식은 어느 준비 블록의 첫 줄(기본값)에도 맞지 않는다", () => {
    const firstLines = setupSpecs().map((s) => ({ type: s.blockType, line: s.lines(defaultValues(s.parts))[0] }));
    for (const d of DEVICES) for (const a of d.actions) {
      if (a.pattern.kind !== "lines") continue;
      const re = a.pattern.lines[0];
      for (const { type, line } of firstLines) {
        re.lastIndex = 0;
        expect(re.test(line), `${a.blockType} ↔ ${type}: ${line}`).toBe(false);
      }
    }
  });
});
