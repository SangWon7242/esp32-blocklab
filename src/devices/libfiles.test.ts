import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEVICES, libFilesFor, libFilesForProgram } from "./registry";

const LIB_DIR = path.resolve(import.meta.dirname, "../../public/lib");

describe("보드 라이브러리 (public/lib)", () => {
  it("레지스트리의 모든 libFiles 가 public/lib 에 있다", () => {
    const files = DEVICES.flatMap((d) => d.setup?.libFiles ?? []);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(existsSync(path.join(LIB_DIR, f)), f).toBe(true);
  });
  it("libFilesForProgram: 코드의 import 줄로도 라이브러리를 잡고, 한 모듈이면 그 장치 묶음 전부", () => {
    expect(libFilesForProgram({ code: "import ssd1306\noled = 1\n", blockTypes: [] })).toEqual(["ssd1306.py"]);
    expect(libFilesForProgram({ code: "from keypad import Keypad\n", blockTypes: [] })).toEqual(["keypad.py"]);
    // 블록이 없는 gfx 도 import 하면 올린다 (9장 OLED 도형)
    expect(libFilesForProgram({ code: "import ssd1306\nimport gfx\n", blockTypes: [] }).sort()).toEqual(["gfx.py", "ssd1306.py"]);
    expect(libFilesForProgram({ code: "import time, mfrc522_i2c\n", blockTypes: [] }).sort()).toEqual(["mfrc522_config.py", "mfrc522_i2c.py", "soft_iic.py"]);
    // 주석·문자열 속 이름, 비슷한 이름은 잡지 않는다
    expect(libFilesForProgram({ code: "# import ssd1306\nprint('import keypad')\nimport ssd1306x\n", blockTypes: [] })).toEqual([]);
    // 블록 종류와 import 가 겹쳐도 한 번
    expect(libFilesForProgram({ code: "import ssd1306\n", blockTypes: ["esp_oled_setup"] })).toEqual(["ssd1306.py"]);
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
