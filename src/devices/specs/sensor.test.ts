import { describe, expect, it } from "vitest";
import { fromCode, print, toCode, v, type B } from "../testkit";
import { DEVICES } from "../registry";
import { isGeneratedImport } from "../imports";
import { collectImports } from "@/codegen/imports";

const val = (type: string, name?: string): B => (name ? { type, fields: { VAR: v(name) } } : { type });

describe("온습도 센서 DHT11 (dev_dht_setup)", () => {
  const code = [
    "from machine import Pin",
    "import dht",
    "",
    "dht11 = dht.DHT11(Pin(13))",
    "",
    "dht11.measure()",
    "print(dht11.temperature())",
    "print(dht11.humidity())",
    "",
  ].join("\n");

  it("준비 줄, 측정하기, 온도·습도 (import dht)", () => {
    const blocks = [{ type: "dev_dht_setup", fields: { PIN: 13, VAR: v("dht11") } }, val("dev_dht_measure", "dht11"), print(val("dev_dht_temp", "dht11")), print(val("dev_dht_hum", "dht11"))];
    expect(toCode(blocks, ["dht11"])).toBe(code);
  });
  it("왕복: 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["dev_dht_setup", "dev_dht_measure", "esp_print", "dev_dht_temp", "esp_print", "dev_dht_hum"]);
    expect(r.body[0].fields).toEqual({ PIN: 13, VAR: v("dht11") });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("준비되지 않은 이름의 measure() 는 장치 블록이 아니다", () => {
    expect(fromCode("d.measure()\n").types).not.toContain("dev_dht_measure");
  });
});

describe("서미스터 (dev_ntc_setup, 이름 ntc 고정)", () => {
  const code = [
    "from machine import Pin, ADC",
    "import math",
    "",
    "ntc = ADC(Pin(36))",
    "ntc.atten(ADC.ATTN_11DB)",
    "ntc.width(ADC.WIDTH_12BIT)",
    "",
    "",
    "def ntc_temperature():",
    "    v = ntc.read() / 4095 * 3.3",
    "    r = 10 * v / (3.3 - v)",
    "    return 1 / (math.log(r / 10) / 3950 + 1 / 298.15) - 273.15",
    "",
    "",
    "print(ntc_temperature())",
    "",
  ].join("\n");

  it("아날로그 3줄과 ntc_temperature 도우미 (import math)", () => {
    expect(toCode([{ type: "dev_ntc_setup", fields: { PIN: 36 } }, print(val("dev_ntc_temp"))])).toBe(code);
  });
  it("왕복: 도우미까지 접혀 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.tops).toEqual(["start_program"]);
    expect(r.types).toEqual(["dev_ntc_setup", "esp_print", "dev_ntc_temp"]);
    expect(r.body[0].fields).toEqual({ PIN: 36 });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("도우미가 표준 꼴이 아니면 접지 않는다 (아날로그 핀 + 함수 블록)", () => {
    const r = fromCode(code.replace("- 273.15", "- 273"));
    expect(r.types).not.toContain("dev_ntc_setup");
    expect(r.types[0]).toBe("dev_adc_setup");
    expect(r.tops).toContain("procedures_defreturn");
  });
  it("준비 3줄의 이름이 ntc 가 아니면 접지 않는다 (도우미가 ntc 를 읽으므로)", () => {
    const r = fromCode(code.replace("ntc = ADC(Pin(36))\nntc.atten(ADC.ATTN_11DB)\nntc.width", "t = ADC(Pin(36))\nt.atten(ADC.ATTN_11DB)\nt.width"));
    expect(r.types).not.toContain("dev_ntc_setup");
    expect(r.types[0]).toBe("dev_adc_setup");
  });
  it("도우미 없이 ntc 3줄만 있으면 아날로그 핀", () => {
    const r = fromCode("from machine import Pin, ADC\n\nntc = ADC(Pin(36))\nntc.atten(ADC.ATTN_11DB)\nntc.width(ADC.WIDTH_12BIT)\n\nprint(ntc.read())\n");
    expect(r.types).toEqual(["dev_adc_setup", "esp_print", "dev_adc_read"]);
    expect(r.unparsed).toEqual([]);
  });
});

describe("LM35 온도 센서 (dev_lm35_setup)", () => {
  const code = [
    "from machine import Pin, ADC",
    "",
    "lm35 = ADC(Pin(39))",
    "lm35.atten(ADC.ATTN_11DB)",
    "lm35.width(ADC.WIDTH_12BIT)",
    "",
    "",
    "def lm35_temperature():",
    "    return lm35.read() * 330 / 4095",
    "",
    "",
    "print(lm35_temperature())",
    "",
  ].join("\n");

  it("아날로그 3줄(이름 lm35)과 lm35_temperature 도우미", () => {
    expect(toCode([{ type: "dev_lm35_setup", fields: { PIN: 39 } }, print(val("dev_lm35_temp"))])).toBe(code);
  });
  it("왕복: 도우미까지 접혀 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.tops).toEqual(["start_program"]);
    expect(r.types).toEqual(["dev_lm35_setup", "esp_print", "dev_lm35_temp"]);
    expect(r.body[0].fields).toEqual({ PIN: 39 });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("준비 3줄의 이름이 lm35 가 아니면 접지 않는다 (도우미가 lm35 를 읽으므로)", () => {
    const r = fromCode(code.replace("lm35 = ADC(Pin(39))\nlm35.atten(ADC.ATTN_11DB)\nlm35.width", "t = ADC(Pin(39))\nt.atten(ADC.ATTN_11DB)\nt.width"));
    expect(r.types).not.toContain("dev_lm35_setup");
    expect(r.types[0]).toBe("dev_adc_setup");
  });
  it("도우미가 표준 꼴이 아니면 접지 않는다", () => {
    const r = fromCode(code.replace("* 330 /", "* 300 /"));
    expect(r.types).not.toContain("dev_lm35_setup");
    expect(r.types[0]).toBe("dev_adc_setup");
  });
});

describe("우선순위와 import", () => {
  it("서미스터·LM35 선언이 아날로그 핀 선언보다 앞에 있다", () => {
    const ids = DEVICES.map((d) => d.id);
    expect(ids.indexOf("ntc")).toBeLessThan(ids.indexOf("adc"));
    expect(ids.indexOf("lm35")).toBeLessThan(ids.indexOf("adc"));
  });
  it("dht.·math. 이 보이면 import dht·import math, 다시 읽을 때는 그 두 줄만 지운다", () => {
    expect(collectImports("d = dht.DHT11(Pin(13))\nx = math.log(2)\n")).toEqual(["from machine import Pin", "import dht", "import math"]);
    expect(isGeneratedImport("import dht")).toBe(true);
    expect(isGeneratedImport("import math")).toBe(true);
    expect(isGeneratedImport("import math as m")).toBe(false);
    expect(isGeneratedImport("from math import log")).toBe(false);
    expect(isGeneratedImport("import dht as d")).toBe(false);
  });
});
