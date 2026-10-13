import { describe, expect, it } from "vitest";
import { collectImports } from "./imports";

describe("collectImports", () => {
  it("쓰인 것만, 정해진 순서로 낸다", () => {
    expect(collectImports("led = Pin(26, Pin.OUT)\nled.value(1)\n")).toEqual(["from machine import Pin"]);
    expect(collectImports("led = Pin(26, Pin.OUT)\ntime.sleep(1)\n")).toEqual(["from machine import Pin", "import time"]);
    expect(
      collectImports("servo = PWM(Pin(4))\ni2c = SoftI2C(scl=Pin(22), sda=Pin(21))\noled = ssd1306.SSD1306_I2C(128, 64, i2c)\ntime.sleep(2)\n"),
    ).toEqual(["from machine import Pin, PWM, SoftI2C", "import ssd1306", "import time"]);
  });
  it("아무것도 안 쓰면 빈 배열", () => {
    expect(collectImports("print(1)\n")).toEqual([]);
  });
});
