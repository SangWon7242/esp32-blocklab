import type { BlockContent } from "../types";

const OLED_SETUP = "i2c = SoftI2C(scl=Pin(22), sda=Pin(21))\noled = ssd1306.SSD1306_I2C(128, 64, i2c)\n";

/** 두 줄 보여주기 블록을 쓰는 예시: 그 블록이 함께 만드는 show(a, b) 함수까지 */
const OLED_SHOW_SETUP = [
  "i2c = SoftI2C(scl=Pin(22), sda=Pin(21))", "oled = ssd1306.SSD1306_I2C(128, 64, i2c)",
  "", "",
  "def show(a, b):", "    oled.fill(0)", "    oled.text(a, 0, 20)", "    oled.text(b, 0, 36)", "    oled.show()",
  "", "",
].join("\n");

const LCD_SETUP = "lcd = lcd128_32(21, 22, 0, 0x3f)\nlcd.Init()\nlcd.Clear()";

const SEG_SETUP = [
  "si = Pin(5, Pin.OUT)", "rck = Pin(23, Pin.OUT)", "sck = Pin(18, Pin.OUT)",
  "SEGCODE = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f]",
  "", "",
  "def hc595_shift(dat):",
  "    rck.value(0)",
  "    for bit in range(7, -1, -1):",
  "        value = 1 & (dat >> bit)",
  "        sck.value(0)",
  "        si.value(value)",
  "        sck.value(1)",
  "    rck.value(1)",
  "", "",
  "def show_digit(n, dot):", "    code = SEGCODE[n]", "    if dot:", "        code = code | 128", "    hc595_shift(code)",
  "", "",
].join("\n");

const OLED_TIP = "먼저 OLED 화면 준비 블록이 있어야 해요.";
const BUFFER_TIP = "적고 그리는 블록은 보이지 않는 버퍼에만 그려요. 마지막에 'OLED 화면에 내보내기' 를 해야 화면에 나타나요.";
const LCD_TIP = "먼저 LCD 준비 블록이 있어야 해요.";
const SEG_TIP = "먼저 7세그먼트 준비 블록이 있어야 해요.";

/** 화면 카테고리 블록 설명 (src/devices/specs/display.ts) */
export const displayContent: Record<string, BlockContent> = {
  esp_oled_setup: {
    concept: "128×64 점으로 된 OLED 화면을 I2C(scl·sda 두 선) 로 준비해요. 화면을 다루는 oled 가 만들어지고, 이름은 i2c, oled 로 정해져 있어요. 그 뒤 적기·그리기 블록으로 버퍼에 그리고 내보내기로 화면에 보여요.",
    example: { title: "인사 한 줄 띄우기", code: `${OLED_SETUP}oled.fill(0)\noled.text("Hello", 0, 0)\noled.show()` },
    tips: ["화면을 쓰려면 ssd1306.py 라이브러리가 보드에 있어야 해요. 보드에 저장할 때 앱이 알아서 함께 올려 줘요."],
  },
  esp_oled_show: {
    concept: "OLED 화면을 지우고 두 줄의 글을 가운데쯤에 띄워요. 코드로는 show(\"AUTO DOOR\", \"Come closer\") 이고, 지우기·적기·내보내기를 한 번에 해 줍니다. 이 블록을 쓰면 그 일을 하는 show(a, b) 함수가 코드에 함께 만들어져요.",
    example: {
      title: "버튼을 누르면 글 바꾸기",
      code: `${OLED_SHOW_SETUP}button = Pin(14, Pin.IN, Pin.PULL_UP)\nwhile True:\n    if button.value() == 0:\n        show("Button", "pressed")\n    else:\n        show("AUTO DOOR", "Come closer")\n    time.sleep(0.1)`,
    },
    tips: [OLED_TIP, "글은 영문·숫자·기호만 보여요. 한 줄에 16글자쯤 들어가요."],
  },
  dev_oled_text: {
    concept: "OLED 의 (x, y) 자리에 글을 적어요. x 는 왼쪽에서 0~127, y 는 위에서 0~63 점이고, 글자 하나는 가로·세로 8점입니다. 코드로는 oled.text(\"hello\", 0, 0) 이에요.",
    example: {
      title: "세 줄 적어서 보여 주기",
      code: `${OLED_SETUP}oled.fill(0)\noled.text("hello", 0, 0)\noled.text("ESP32", 0, 16)\noled.text("block lab", 0, 32)\noled.show()`,
    },
    tips: [OLED_TIP, BUFFER_TIP, "글은 영문·숫자·기호만 보여요."],
  },
  dev_oled_clear: {
    concept: "OLED 버퍼를 모두 검은색으로 지워요. 코드로는 oled.fill(0) 입니다. 새로 그리기 전에 먼저 지워야 앞의 글과 겹치지 않아요.",
    example: {
      title: "글을 바꿔 가며 보여 주기",
      code: `${OLED_SETUP}while True:\n    oled.fill(0)\n    oled.text("ON", 0, 0)\n    oled.show()\n    time.sleep(1)\n    oled.fill(0)\n    oled.text("OFF", 0, 0)\n    oled.show()\n    time.sleep(1)`,
    },
    tips: [OLED_TIP, "지우기도 버퍼에만 해요. 화면을 바로 비우려면 뒤에 내보내기를 붙여요."],
  },
  dev_oled_update: {
    concept: "지금까지 버퍼에 적고 그린 것을 OLED 화면에 한꺼번에 내보내요. 코드로는 oled.show() 입니다. 여러 개를 다 그린 뒤 마지막에 한 번 하면 화면이 깜빡이지 않아요.",
    example: { title: "글과 선을 그린 뒤 내보내기", code: `${OLED_SETUP}oled.fill(0)\noled.text("hello", 0, 0)\noled.line(0, 12, 127, 12, 1)\noled.show()` },
    tips: [OLED_TIP],
  },
  dev_oled_line: {
    concept: "OLED 에 두 점 (x1, y1) 과 (x2, y2) 를 잇는 곧은 선을 그려요. 코드로는 oled.line(0, 0, 127, 63, 1) 이고, 마지막 1 은 흰 점으로 그린다는 뜻이에요.",
    example: { title: "X 자 그리기", code: `${OLED_SETUP}oled.fill(0)\noled.line(0, 0, 127, 63, 1)\noled.line(0, 63, 127, 0, 1)\noled.show()` },
    tips: [OLED_TIP, BUFFER_TIP],
  },
  dev_oled_rect: {
    concept: "OLED 에 테두리만 있는 사각형을 그려요. (x, y) 는 왼쪽 위 모서리이고, 너비와 높이는 점의 개수입니다. 코드로는 oled.rect(0, 0, 40, 20, 1) 이에요.",
    example: { title: "글 둘레에 상자 그리기", code: `${OLED_SETUP}oled.fill(0)\noled.rect(0, 0, 60, 20, 1)\noled.text("BOX", 6, 6)\noled.show()` },
    tips: [OLED_TIP, BUFFER_TIP],
  },
  dev_oled_fill_rect: {
    concept: "OLED 에 속까지 하얗게 채운 사각형을 그려요. (x, y) 는 왼쪽 위 모서리이고, 너비와 높이는 점의 개수입니다. 코드로는 oled.fill_rect(70, 30, 20, 20, 1) 이에요.",
    example: { title: "빈 네모와 채운 네모 나란히 그리기", code: `${OLED_SETUP}oled.fill(0)\noled.rect(10, 30, 20, 20, 1)\noled.fill_rect(40, 30, 20, 20, 1)\noled.show()` },
    tips: [OLED_TIP, BUFFER_TIP],
  },
  dev_lcd_setup: {
    concept: "128×32 LCD 화면을 I2C(sda·scl 두 선)로 준비해요. 주소(0x3f)는 I2C 선에서 이 화면을 찾는 번호입니다. 준비하면서 화면을 켜고(Init) 지워요(Clear). 이름은 lcd 로 정해져 있어요.",
    example: { title: "LCD 에 인사 적기", code: `${LCD_SETUP}\nlcd.Cursor(0, 0)\nlcd.Display("hello")` },
    tips: [
      "lcd128_32.py, lcd128_32_fonts.py 라이브러리가 필요해요. 보드에 저장할 때 앱이 알아서 함께 올려 줘요.",
      "주소(0x3f)가 모듈과 다르면 화면이 켜지지 않아요. 모듈에 적힌 I2C 주소를 확인해요.",
    ],
  },
  dev_lcd_text: {
    concept: "LCD 의 정한 줄·칸에 글을 적어요. 커서를 옮기는 lcd.Cursor(줄, 칸) 과 글을 쓰는 lcd.Display(글) 두 줄이 만들어집니다. 줄은 0~3, 칸은 0~17 로 왼쪽에서 셉니다.",
    example: { title: "두 줄 적기", code: `${LCD_SETUP}\nlcd.Cursor(0, 0)\nlcd.Display("hello")\nlcd.Cursor(2, 0)\nlcd.Display("ESP32")` },
    tips: [LCD_TIP, "글은 영문·숫자·기호만 보여요."],
  },
  dev_lcd_clear: {
    concept: "LCD 화면의 글을 모두 지워요. 코드로는 lcd.Clear() 입니다. 같은 자리에 새 글을 적기 전에 지우면 앞의 글자가 남지 않아요.",
    example: {
      title: "글을 바꿔 가며 보여 주기",
      code: `${LCD_SETUP}\nwhile True:\n    lcd.Clear()\n    lcd.Cursor(0, 0)\n    lcd.Display("ON")\n    time.sleep(1)\n    lcd.Clear()\n    lcd.Cursor(0, 0)\n    lcd.Display("OFF")\n    time.sleep(1)`,
    },
    tips: [LCD_TIP],
  },
  dev_seg_setup: {
    concept: "숫자 한 자리를 보여 주는 7세그먼트를 74HC595 칩으로 준비해요. 세 핀(si·rck·sck)으로 8칸의 켜짐·꺼짐을 차례로 밀어 넣습니다. 숫자 모양표 SEGCODE 도 함께 만들어지고, 숫자 표시 블록을 쓰면 hc595_shift·show_digit 함수가 함수 블록으로 생겨요.",
    example: { title: "숫자 7 보여 주기", code: `${SEG_SETUP}show_digit(7, False)` },
    tips: ["핀 이름(si, rck, sck)과 SEGCODE 표는 정해져 있어요. 바꾸면 코드를 블록으로 바꿀 때 이 블록으로 돌아오지 않아요."],
  },
  dev_seg_digit: {
    concept: "7세그먼트에 0~9 숫자 한 자리를 보여 줘요. 점을 켜기로 고르면 오른쪽 아래 점도 함께 켜집니다. 코드로는 show_digit(3, False) 예요.",
    example: {
      title: "0부터 9까지 세기",
      code: `${SEG_SETUP}n = 0\nwhile n <= 9:\n    show_digit(n, False)\n    time.sleep(1)\n    n = n + 1`,
    },
    tips: [SEG_TIP, "숫자는 0~9 한 자리만 돼요. 10 이상을 주면 오류가 나요."],
  },
  dev_seg_clear: {
    concept: "7세그먼트의 모든 칸을 꺼요. 코드로는 hc595_shift(0) 이고, 8칸 모두에 0 을 밀어 넣습니다.",
    example: { title: "숫자를 깜빡이기", code: `${SEG_SETUP}while True:\n    show_digit(8, True)\n    time.sleep(0.5)\n    hc595_shift(0)\n    time.sleep(0.5)` },
    tips: [SEG_TIP],
  },
};
