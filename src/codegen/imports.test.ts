import { describe, expect, it } from "vitest";
import { collectImports, hoistImports } from "./imports";

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

describe("본문에 남은 import", () => {
  it("본문이 이미 machine 에서 가져오면 from machine 줄을 만들지 않는다", () => {
    expect(collectImports("from machine import Pin, ADC\nadc = ADC(Pin(34))\n")).toEqual([]);
    expect(collectImports("import utime as time\ntime.sleep(1)\n")).toEqual([]);
  });
  it("남긴 줄이 주지 않는 이름만 만든다 (as 로 가져온 이름은 주지 않은 것으로)", () => {
    expect(collectImports("from machine import ADC\nled = Pin(2, Pin.OUT)\n")).toEqual(["from machine import Pin"]);
    expect(collectImports("from machine import Pin as P\nled = Pin(2, Pin.OUT)\n")).toEqual(["from machine import Pin"]);
    expect(collectImports("from machine import (Pin, ADC)\nservo = PWM(Pin(4))\n")).toEqual(["from machine import PWM"]);
  });
  it("맨 앞 칸 import 줄을 뽑아 생성한 import 와 정해진 순서로 모은다", () => {
    expect(hoistImports("import random\nfrom machine import Pin, ADC\nx = 1\n", ["import time"])).toEqual({
      imports: ["from machine import Pin, ADC", "import time", "import random"],
      body: "x = 1\n",
    });
    // 들여쓴 import 는 그 자리에 둔다
    expect(hoistImports("def f():\n    import random\n", []).body).toBe("def f():\n    import random\n");
  });
});
