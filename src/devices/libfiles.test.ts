import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEVICES, libFilesFor } from "./registry";

const LIB_DIR = path.resolve(import.meta.dirname, "../../public/lib");

describe("보드 라이브러리 (public/lib)", () => {
  it("레지스트리의 모든 libFiles 가 public/lib 에 있다", () => {
    const files = DEVICES.flatMap((d) => d.setup?.libFiles ?? []);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(existsSync(path.join(LIB_DIR, f)), f).toBe(true);
  });
  it("libFilesFor: 쓰인 준비 블록의 라이브러리만, 겹치지 않게", () => {
    expect(libFilesFor([])).toEqual([]);
    expect(libFilesFor(["esp_pin_setup", "esp_print", "dev_oled_text"])).toEqual([]);
    expect(libFilesFor(["esp_oled_setup", "dev_oled_text", "esp_oled_setup"])).toEqual(["ssd1306.py"]);
    expect(libFilesFor(["dev_ir_setup", "dev_rfid_setup", "dev_lcd_setup", "dev_keypad_setup"]).sort()).toEqual(
      ["irrecvdata.py", "keypad.py", "lcd128_32.py", "lcd128_32_fonts.py", "mfrc522_config.py", "mfrc522_i2c.py", "soft_iic.py"],
    );
  });
});
