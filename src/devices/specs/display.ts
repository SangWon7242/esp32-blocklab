import type { DeviceSpec, Part } from "../types";
import { I2C_ADDR, isSingleArg, pinNo, validPins } from "./common";

const numIn = (name: string, shadow: number): Part => ({ kind: "value", name, check: "Number", shadow });

/**
 * OLED (esp_oled_setup). 이름 i2c/oled 고정. 글·선·사각형은 oled 의 메서드를 그대로 부른다.
 * show(a, b) 도우미는 준비가 아니라 "두 줄 보여주기"(esp_oled_show) 블록의 선택 도우미: 그 블록을 쓸 때만 정의되고,
 * 준비 두 줄은 도우미 없이도 접힌다.
 */
export const oled: DeviceSpec = {
  id: "oled", category: "display", label: "OLED", toolboxOrder: 70, colour: "#1d4ed8",
  setup: {
    blockType: "esp_oled_setup", message: "OLED 화면 준비하기 (scl 핀 %1, sda 핀 %2)",
    parts: [pinNo("SCL", 22, "bus"), pinNo("SDA", 21, "bus")],
    tooltip: "i2c 와 oled 를 만들어 OLED 화면을 준비합니다.",
    lines: (v) => [`i2c = SoftI2C(scl=Pin(${v.SCL}), sda=Pin(${v.SDA}))`, "oled = ssd1306.SSD1306_I2C(128, 64, i2c)"],
    kind: "oled",
    provides: () => ["i2c", "oled"],
    pattern: {
      lines: [
        /^i2c\s*=\s*SoftI2C\(\s*scl\s*=\s*Pin\(\s*(\d+)\s*\)\s*,\s*sda\s*=\s*Pin\(\s*(\d+)\s*\)\s*\)$/,
        /^oled\s*=\s*ssd1306\.SSD1306_I2C\(\s*128\s*,\s*64\s*,\s*i2c\s*\)$/,
      ],
      fields: ([m]) => (validPins(m[1], m[2]) ? { SCL: m[1], SDA: m[2] } : null),
    },
    libFiles: ["ssd1306.py"],
  },
  actions: [
    {
      blockType: "esp_oled_show", message: "화면에 %1 와(과) %2 보여주기",
      parts: [{ kind: "value", name: "A", shadow: "AUTO DOOR" }, { kind: "value", name: "B", shadow: "Come closer" }],
      tooltip: "show(첫째 줄, 둘째 줄) — 이 블록을 쓰면 화면을 지우고 두 줄을 띄우는 show(a, b) 함수가 함께 만들어집니다.",
      code: (v) => `show(${v.A}, ${v.B})`,
      helper: { name: "show", params: "a, b", body: ["oled.fill(0)", "oled.text(a, 0, 20)", "oled.text(b, 0, 36)", "oled.show()"] },
      pattern: { kind: "call", name: "show", args: [null, null] },
    },
    {
      blockType: "dev_oled_text", message: "OLED에 %1 을(를) (x %2, y %3) 에 적기",
      parts: [{ kind: "value", name: "TEXT", shadow: "hello" }, numIn("X", 0), numIn("Y", 0)],
      tooltip: "oled.text(글, x, y) — 화면 버퍼에 글을 적습니다. 'OLED 화면에 내보내기' 를 해야 보입니다.",
      code: (v) => `oled.text(${v.TEXT}, ${v.X}, ${v.Y})`,
      pattern: { kind: "method", name: "text", args: [null, null, null], objName: "oled" },
    },
    {
      blockType: "dev_oled_clear", message: "OLED 지우기", parts: [],
      tooltip: "oled.fill(0) — 화면 버퍼를 모두 지웁니다.",
      code: () => "oled.fill(0)",
      pattern: { kind: "method", name: "fill", args: [["0"]], objName: "oled" },
    },
    {
      blockType: "dev_oled_update", message: "OLED 화면에 내보내기", parts: [],
      tooltip: "oled.show() — 지금까지 적고 그린 것을 화면에 보여 줍니다.",
      code: () => "oled.show()",
      pattern: { kind: "method", name: "show", args: [], objName: "oled" },
    },
    {
      blockType: "dev_oled_line", message: "OLED 선 (%1,%2) 에서 (%3,%4) 까지",
      parts: [numIn("X1", 0), numIn("Y1", 0), numIn("X2", 127), numIn("Y2", 63)],
      tooltip: "oled.line(x1, y1, x2, y2, 1) — 두 점을 잇는 선을 그립니다.",
      code: (v) => `oled.line(${v.X1}, ${v.Y1}, ${v.X2}, ${v.Y2}, 1)`,
      pattern: { kind: "method", name: "line", args: [null, null, null, null, ["1"]], objName: "oled" },
    },
    {
      blockType: "dev_oled_rect", message: "OLED 사각형 (x %1, y %2, 너비 %3, 높이 %4)",
      parts: [numIn("X", 0), numIn("Y", 0), numIn("W", 40), numIn("H", 20)],
      tooltip: "oled.rect(x, y, 너비, 높이, 1) — 테두리만 있는 사각형을 그립니다.",
      code: (v) => `oled.rect(${v.X}, ${v.Y}, ${v.W}, ${v.H}, 1)`,
      pattern: { kind: "method", name: "rect", args: [null, null, null, null, ["1"]], objName: "oled" },
    },
    {
      blockType: "dev_oled_fill_rect", message: "OLED 에 채운 네모 (x %1, y %2, 너비 %3, 높이 %4)",
      parts: [numIn("X", 0), numIn("Y", 0), numIn("W", 20), numIn("H", 20)],
      tooltip: "oled.fill_rect(x, y, 너비, 높이, 1) — 속까지 하얗게 채운 사각형을 그립니다.",
      code: (v) => `oled.fill_rect(${v.X}, ${v.Y}, ${v.W}, ${v.H}, 1)`,
      pattern: { kind: "method", name: "fill_rect", args: [null, null, null, null, ["1"]], objName: "oled" },
    },
  ],
  values: [],
};

/** LCD 128×32 (dev_lcd_setup). 이름 lcd 고정. Keyestudio lcd128_32 라이브러리: lcd128_32(sda, scl, 버스, 주소) */
export const lcd: DeviceSpec = {
  id: "lcd", category: "display", label: "LCD 128×32", toolboxOrder: 71, colour: "#0058af",
  setup: {
    blockType: "dev_lcd_setup", message: "LCD 128×32 준비하기 (sda 핀 %1, scl 핀 %2, 주소 %3)",
    parts: [pinNo("SDA", 21, "bus"), pinNo("SCL", 22, "bus"), { kind: "text", name: "ADDR", default: "0x3f", validate: I2C_ADDR }],
    tooltip: "lcd = lcd128_32(21, 22, 0, 0x3f) — LCD 를 켜고 지웁니다.",
    lines: (v) => [`lcd = lcd128_32(${v.SDA}, ${v.SCL}, 0, ${v.ADDR})`, "lcd.Init()", "lcd.Clear()"],
    kind: "lcd",
    provides: () => ["lcd"],
    pattern: {
      lines: [
        /^lcd\s*=\s*lcd128_32\(\s*(\d+)\s*,\s*(\d+)\s*,\s*0\s*,\s*(0x[0-9a-fA-F]+)\s*\)$/,
        /^lcd\.Init\(\s*\)$/,
        /^lcd\.Clear\(\s*\)$/,
      ],
      fields: ([m]) => (validPins(m[1], m[2]) ? { SDA: m[1], SCL: m[2], ADDR: m[3] } : null),
    },
    libFiles: ["lcd128_32.py", "lcd128_32_fonts.py"],
  },
  actions: [
    {
      blockType: "dev_lcd_text", message: "LCD %1 줄 %2 칸에 %3 적기",
      parts: [numIn("ROW", 0), numIn("COL", 0), { kind: "value", name: "TEXT", shadow: "hello" }],
      tooltip: "lcd.Cursor(줄, 칸) 다음 lcd.Display(글) — 글은 영문·숫자·기호만 보입니다.",
      code: (v) => `lcd.Cursor(${v.ROW}, ${v.COL})\nlcd.Display(${v.TEXT})`,
      // 그룹이 인자 하나씩일 때만 접는다 (`lcd.Cursor(0, f(a, b))` 를 `0, f(a` / `b)` 로 나누지 않게)
      pattern: {
        kind: "lines",
        lines: [/^lcd\.Cursor\((.+), (.+)\)$/, /^lcd\.Display\((.+)\)$/],
        values: ([c, d]) => ([c[1], c[2], d[1]].every(isSingleArg) ? { ROW: c[1], COL: c[2], TEXT: d[1] } : null),
      },
    },
    {
      blockType: "dev_lcd_clear", message: "LCD 지우기", parts: [],
      tooltip: "lcd.Clear() — 화면을 지웁니다.",
      code: () => "lcd.Clear()",
      pattern: { kind: "method", name: "Clear", args: [], objName: "lcd" },
    },
  ],
  values: [],
};

/** 표준 숫자 모양표 (0~9). 준비 줄과 패턴이 함께 쓴다 */
const SEGCODE = ["0x3f", "0x06", "0x5b", "0x4f", "0x66", "0x6d", "0x7d", "0x07", "0x7f", "0x6f"];

/**
 * 7세그먼트 (dev_seg_setup). 74HC595 로 한 자리를 켠다. 이름 si/rck/sck/SEGCODE 고정, hc595_shift·show_digit 도우미.
 * si·rck·sck 줄은 출력 핀 1줄과 같은 꼴이라 레지스트리에서 pinOut 보다 앞에 둔다 (도우미가 표준이 아니면 출력 핀 셋으로 떨어진다).
 */
export const seg7: DeviceSpec = {
  id: "seg7", category: "display", label: "7세그먼트", toolboxOrder: 72, colour: "#0832bc",
  setup: {
    blockType: "dev_seg_setup", message: "7세그먼트 준비하기 (SI 핀 %1, RCK 핀 %2, SCK 핀 %3)",
    parts: [pinNo("SI", 5, "out"), pinNo("RCK", 23, "out"), pinNo("SCK", 18, "out")],
    tooltip: "74HC595 의 세 핀과 숫자 모양표 SEGCODE, show_digit(숫자, 점) 함수를 준비합니다.",
    lines: (v) => [
      `si = Pin(${v.SI}, Pin.OUT)`, `rck = Pin(${v.RCK}, Pin.OUT)`, `sck = Pin(${v.SCK}, Pin.OUT)`,
      `SEGCODE = [${SEGCODE.join(", ")}]`,
    ],
    helpers: [
      {
        name: "hc595_shift", params: "dat",
        body: [
          "rck.value(0)",
          "for bit in range(7, -1, -1):",
          "  value = 1 & (dat >> bit)",
          "  sck.value(0)",
          "  si.value(value)",
          "  sck.value(1)",
          "rck.value(1)",
        ],
      },
      { name: "show_digit", params: "n, dot", body: ["hc595_shift(SEGCODE[n] | (0x80 if dot else 0))"] },
    ],
    kind: "seg7",
    provides: () => ["si", "rck", "sck", "SEGCODE", "hc595_shift", "show_digit"],
    pattern: {
      lines: [
        /^si\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.OUT\s*\)$/,
        /^rck\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.OUT\s*\)$/,
        /^sck\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.OUT\s*\)$/,
        // 표준 표와 값이 똑같을 때만 (띄어쓰기는 무관). 고친 표를 접으면 표준 10칸으로 다시 만들어져 바뀐 값이 사라진다
        new RegExp(String.raw`^SEGCODE\s*=\s*\[\s*${SEGCODE.join(String.raw`\s*,\s*`)}\s*\]$`),
      ],
      fields: ([a, b, c]) => (validPins(a[1], b[1], c[1]) ? { SI: a[1], RCK: b[1], SCK: c[1] } : null),
    },
  },
  actions: [
    {
      blockType: "dev_seg_digit", message: "7세그먼트에 숫자 %1 표시 (점 %2)",
      parts: [numIn("N", 3), { kind: "dropdown", name: "DOT", options: [["끄기", "False"], ["켜기", "True"]] }],
      tooltip: "show_digit(숫자, 점) — 0~9 한 자리를 보여 줍니다.",
      code: (v) => `show_digit(${v.N}, ${v.DOT})`,
      pattern: { kind: "call", name: "show_digit", args: [null, ["False", "True"]] },
      range: { N: { min: 0, max: 9, label: { ko: "숫자", en: "digit" } } },
    },
    {
      blockType: "dev_seg_clear", message: "7세그먼트 지우기", parts: [],
      tooltip: "hc595_shift(0) — 모든 칸을 끕니다.",
      code: () => "hc595_shift(0)",
      pattern: { kind: "call", name: "hc595_shift", args: [["0"]] },
    },
  ],
  values: [],
};
