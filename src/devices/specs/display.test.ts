import { describe, expect, it } from "vitest";
import { forever, fromCode, num, toCode, type B } from "../testkit";
import { DEVICES } from "../registry";
import { isGeneratedImport } from "../imports";
import { collectImports } from "@/codegen/imports";

const text = (s: string): B => ({ type: "text", fields: { TEXT: s } });
/** 값 입력 이름 → 블록 */
const withInputs = (type: string, inputs: Record<string, B>, fields?: Record<string, unknown>): B => ({
  type, ...(fields ? { fields } : {}), inputs: Object.fromEntries(Object.entries(inputs).map(([k, b]) => [k, { block: b }])),
});

describe("OLED 확장 (oled.text·fill·show·line·rect)", () => {
  const code = [
    "from machine import Pin, SoftI2C",
    "import ssd1306",
    "",
    "i2c = SoftI2C(scl=Pin(22), sda=Pin(21))",
    "oled = ssd1306.SSD1306_I2C(128, 64, i2c)",
    "",
    "",
    "def show(a, b):",
    "    oled.fill(0)",
    "    oled.text(a, 0, 20)",
    "    oled.text(b, 0, 36)",
    "    oled.show()",
    "",
    "",
    "oled.fill(0)",
    'oled.text("hello", 0, 0)',
    "oled.line(0, 0, 127, 63, 1)",
    "oled.rect(0, 0, 40, 20, 1)",
    "oled.show()",
    "",
  ].join("\n");
  const blocks: B[] = [
    { type: "esp_oled_setup", fields: { SCL: 22, SDA: 21 } },
    { type: "dev_oled_clear" },
    withInputs("dev_oled_text", { TEXT: text("hello"), X: num(0), Y: num(0) }),
    withInputs("dev_oled_line", { X1: num(0), Y1: num(0), X2: num(127), Y2: num(63) }),
    withInputs("dev_oled_rect", { X: num(0), Y: num(0), W: num(40), H: num(20) }),
    { type: "dev_oled_update" },
  ];

  it("지우기·글·선·사각형·내보내기 코드", () => {
    expect(toCode(blocks)).toBe(code);
  });
  it("왕복: 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.tops).toEqual(["start_program"]);
    expect(r.types).toEqual([
      "esp_oled_setup", "dev_oled_clear",
      "dev_oled_text", "text", "math_number", "math_number",
      "dev_oled_line", "math_number", "math_number", "math_number", "math_number",
      "dev_oled_rect", "math_number", "math_number", "math_number", "math_number",
      "dev_oled_update",
    ]);
    const { next: _next, ...textBlock } = r.body[2];
    expect(textBlock).toEqual(withInputs("dev_oled_text", { TEXT: text("hello"), X: num(0), Y: num(0) }));
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("선의 마지막 인자가 1 이 아니면(지우는 선) 블록으로 접지 않는다", () => {
    const r = fromCode(code.replace("oled.line(0, 0, 127, 63, 1)", "oled.line(0, 0, 127, 63, 0)"));
    expect(r.types).not.toContain("dev_oled_line");
    expect(r.code).toContain("oled.line(0, 0, 127, 63, 0)\n");
  });
  it("oled 가 아닌 이름의 text·fill 은 OLED 블록이 아니다", () => {
    const r = fromCode('screen.fill(0)\nscreen.text("a", 0, 0)\n');
    expect(r.types).not.toContain("dev_oled_clear");
    expect(r.types).not.toContain("dev_oled_text");
  });
});

describe("LCD 128×32 (dev_lcd_setup)", () => {
  const head = [
    "from lcd128_32 import lcd128_32",
    "import lcd128_32_fonts",
    "",
    "lcd = lcd128_32(21, 22, 0, 0x3f)",
    "lcd.Init()",
    "lcd.Clear()",
    "",
    "",
  ].join("\n");
  const code = head + 'lcd.Cursor(1, 2)\nlcd.Display("hello")\nlcd.Clear()\n';
  const setup: B = { type: "dev_lcd_setup", fields: { SDA: 21, SCL: 22, ADDR: "0x3f" } };
  const lcdText = (row: B, col: B, t: B) => withInputs("dev_lcd_text", { ROW: row, COL: col, TEXT: t });

  it("준비 3줄(import 두 줄), 글 적기는 Cursor·Display 2줄, 지우기", () => {
    expect(toCode([setup, lcdText(num(1), num(2), text("hello")), { type: "dev_lcd_clear" }])).toBe(code);
  });
  it("왕복: 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["dev_lcd_setup", "dev_lcd_text", "math_number", "math_number", "text", "dev_lcd_clear"]);
    expect(r.body[0].fields).toEqual({ SDA: 21, SCL: 22, ADDR: "0x3f" });
    const { next: _next, ...t } = r.body[1];
    expect(t).toEqual(lcdText(num(1), num(2), text("hello")));
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("반복 안에서도 2줄이 함께 들여써지고 왕복한다", () => {
    const c = toCode([setup, forever([lcdText(num(0), num(0), text("hi"))])]);
    expect(c).toBe(head + 'while True:\n    lcd.Cursor(0, 0)\n    lcd.Display("hi")\n');
    const r = fromCode(c);
    expect(r.types).toEqual(["dev_lcd_setup", "flow_repeat_forever", "dev_lcd_text", "math_number", "math_number", "text"]);
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(c);
  });
  it("Cursor 인자에 쉼표 든 식이 있으면 잘못 나누지 않고 코드로 둔다", () => {
    const c = head + 'lcd.Cursor(0, max(a, b))\nlcd.Display("hello")\n';
    const r = fromCode(c);
    expect(r.types).not.toContain("dev_lcd_text");
    expect(r.code).toBe(c);
  });
  it("주소가 16진수가 아니면 준비 블록으로 접지 않는다", () => {
    expect(fromCode(code.replace("0x3f)", "63)")).types).not.toContain("dev_lcd_setup");
  });
});

describe("7세그먼트 (dev_seg_setup)", () => {
  const code = [
    "from machine import Pin",
    "",
    "si = Pin(5, Pin.OUT)",
    "rck = Pin(23, Pin.OUT)",
    "sck = Pin(18, Pin.OUT)",
    "SEGCODE = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f]",
    "",
    "",
    "def hc595_shift(dat):",
    "    rck.value(0)",
    "    for bit in range(7, -1, -1):",
    "        value = 1 & (dat >> bit)",
    "        sck.value(0)",
    "        si.value(value)",
    "        sck.value(1)",
    "    rck.value(1)",
    "",
    "",
    "def show_digit(n, dot):",
    "    hc595_shift(SEGCODE[n] | (0x80 if dot else 0))",
    "",
    "",
    "show_digit(3, False)",
    "show_digit(7, True)",
    "hc595_shift(0)",
    "",
  ].join("\n");
  const digit = (n: number, dot: string) => withInputs("dev_seg_digit", { N: num(n) }, { DOT: dot });
  const blocks: B[] = [{ type: "dev_seg_setup", fields: { SI: 5, RCK: 23, SCK: 18 } }, digit(3, "False"), digit(7, "True"), { type: "dev_seg_clear" }];

  it("핀 3줄, SEGCODE, hc595_shift·show_digit 도우미", () => {
    expect(toCode(blocks)).toBe(code);
  });
  it("왕복: 도우미까지 접혀 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.tops).toEqual(["start_program"]);
    expect(r.types).toEqual(["dev_seg_setup", "dev_seg_digit", "math_number", "dev_seg_digit", "math_number", "dev_seg_clear"]);
    expect(r.body[0].fields).toEqual({ SI: 5, RCK: 23, SCK: 18 });
    expect(r.body[2].fields).toEqual({ DOT: "True" });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("도우미가 표준 꼴이 아니면 접지 않는다 (출력 핀 셋 + 함수 블록)", () => {
    const r = fromCode(code.replace("range(7, -1, -1)", "range(8)"));
    expect(r.types).not.toContain("dev_seg_setup");
    expect(r.types.slice(0, 3)).toEqual(["esp_pin_setup", "esp_pin_setup", "esp_pin_setup"]);
    expect(r.tops).toContain("procedures_defnoreturn");
  });
  describe("SEGCODE 표를 고치면(13칸) 접지 않고 코드로 둔다 (핀 셋 + 코드, unparsed > 0)", () => {
    const table = "SEGCODE = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39]";
    const standard = "SEGCODE = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f]";
    it("함수 정의 뒤에 둔 고친 표는 글자 그대로 왕복한다", () => {
      const edited = code.replace(standard + "\n", "").replace("\n\nshow_digit(3, False)", `\n\n${table}\nshow_digit(3, False)`);
      const r = fromCode(edited);
      expect(r.types).not.toContain("dev_seg_setup");
      expect(r.types.slice(0, 3)).toEqual(["esp_pin_setup", "esp_pin_setup", "esp_pin_setup"]);
      expect(r.unparsed.length).toBeGreaterThan(0);
      expect(r.code).toBe(edited);
    });
    it("준비 줄 자리에서 고친 표도 사라지지 않는다 (문장은 함수 정의 뒤로 옮겨지고, 그다음부터는 글자 그대로)", () => {
      const r = fromCode(code.replace(standard, table));
      expect(r.types).not.toContain("dev_seg_setup");
      expect(r.unparsed.length).toBeGreaterThan(0);
      expect(r.code).toContain(table + "\n");
      expect(r.code).not.toContain(standard);
      expect(fromCode(r.code).code).toBe(r.code);
    });
  });
  it("SEGCODE 표가 표준이면 띄어쓰기가 달라도 접는다", () => {
    const r = fromCode(code.replace("SEGCODE = [0x3f, 0x06,", "SEGCODE=[ 0x3f,0x06 ,"));
    expect(r.types[0]).toBe("dev_seg_setup");
    expect(r.code).toBe(code);
  });
  it("7세그먼트 선언이 출력 핀 선언보다 앞에 있다", () => {
    const ids = DEVICES.map((d) => d.id);
    expect(ids.indexOf("seg7")).toBeLessThan(ids.indexOf("pin_out"));
  });
});

describe("화면·입력장치 import", () => {
  it("lcd128_32( 가 보이면 두 줄, 다른 라이브러리는 한 줄씩 (rank 3, 규칙 순서)", () => {
    expect(collectImports("lcd = lcd128_32(21, 22, 0, 0x3f)\n")).toEqual(["from lcd128_32 import lcd128_32", "import lcd128_32_fonts"]);
    expect(collectImports("r = mfrc522(22, 21, 0x28)\nk = KeyPad(1, 2, 3, 4, 5, 6, 7, 8)\nir = irGetCMD(5)\n")).toEqual([
      "from mfrc522_i2c import mfrc522", "from keypad import KeyPad", "from irrecvdata import irGetCMD",
    ]);
  });
  it("다시 읽을 때는 생성기가 만드는 그 줄만 지운다", () => {
    for (const line of ["from lcd128_32 import lcd128_32", "import lcd128_32_fonts", "from mfrc522_i2c import mfrc522", "from keypad import KeyPad", "from irrecvdata import irGetCMD"]) {
      expect(isGeneratedImport(line), line).toBe(true);
    }
    for (const line of ["from lcd128_32 import *", "import lcd128_32_fonts as f", "import lcd128_32", "from keypad import KeyPad as K", "import keypad", "from irrecvdata import irGetCMD, other", "import mfrc522_i2c"]) {
      expect(isGeneratedImport(line), line).toBe(false);
    }
  });
});
