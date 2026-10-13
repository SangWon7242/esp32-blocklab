import { describe, expect, it } from "vitest";
import { DEVICES, DEVICE_CATEGORIES, findActionByBlock, findSetupByBlock, findValueByBlock } from "./registry";
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

describe("툴박스 순서 (toolboxOrder)", () => {
  it("카테고리 안의 장치 라벨이 읽기 좋은 순서다 (파서 우선순위와 따로)", () => {
    const labels = Object.fromEntries(deviceToolboxCategories().map((c) => [c.name, c.contents.flatMap((i) => (i.kind === "label" ? [i.text] : []))]));
    expect(labels).toEqual({
      "핀": ["핀", "입력 핀", "PWM 핀", "아날로그 핀", "출력"],
      "LED": ["핀", "LED", "밝기 LED", "RGB LED", "흐르는 LED"],
      "버튼·스위치": ["버튼", "틸트 스위치", "인체감지(PIR)", "조이스틱"],
      "센서": ["조도 센서", "가변저항", "소리 센서", "불꽃 센서", "온도(서미스터)", "온도(LM35)", "초음파 센서", "온습도(DHT11)"],
      "소리": ["능동 부저", "수동 부저(음)"],
      "모터": ["서보 모터", "DC 모터", "릴레이"],
      "화면": ["OLED"],
      "입력장치": [],
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
    expect(isGeneratedImport("import random")).toBe(false);
  });
});
