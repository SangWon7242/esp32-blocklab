import type { DeviceSpec } from "../types";
import { pinNo, validPins } from "./common";

/** OLED (esp_oled_setup). 이름 i2c/oled 고정, show(a, b) 도우미 */
export const oled: DeviceSpec = {
  id: "oled", category: "display", label: "OLED", toolboxOrder: 70,
  setup: {
    blockType: "esp_oled_setup", message: "OLED 화면 준비하기 (scl 핀 %1, sda 핀 %2)",
    parts: [pinNo("SCL", 22), pinNo("SDA", 21)],
    tooltip: "i2c 와 oled 를 만들고 두 줄을 띄우는 show(a, b) 함수를 준비합니다.",
    lines: (v) => [`i2c = SoftI2C(scl=Pin(${v.SCL}), sda=Pin(${v.SDA}))`, "oled = ssd1306.SSD1306_I2C(128, 64, i2c)"],
    helpers: [{ name: "show", params: "a, b", body: ["oled.fill(0)", "oled.text(a, 0, 20)", "oled.text(b, 0, 36)", "oled.show()"] }],
    kind: "oled",
    pattern: {
      lines: [
        /^i2c\s*=\s*SoftI2C\(\s*scl\s*=\s*Pin\(\s*(\d+)\s*\)\s*,\s*sda\s*=\s*Pin\(\s*(\d+)\s*\)\s*\)$/,
        /^oled\s*=\s*ssd1306\.SSD1306_I2C\(\s*128\s*,\s*64\s*,\s*i2c\s*\)$/,
      ],
      fields: ([m]) => (validPins(m[1], m[2]) ? { SCL: m[1], SDA: m[2] } : null),
      vars: () => ["i2c", "oled"],
    },
    libFiles: ["ssd1306.py"],
  },
  actions: [
    {
      blockType: "esp_oled_show", message: "화면에 %1 와(과) %2 보여주기",
      parts: [{ kind: "value", name: "A", shadow: "AUTO DOOR" }, { kind: "value", name: "B", shadow: "Come closer" }],
      tooltip: "show(첫째 줄, 둘째 줄)",
      code: (v) => `show(${v.A}, ${v.B})`,
      pattern: { kind: "call", name: "show", args: [null, null] },
    },
  ],
  values: [],
};
