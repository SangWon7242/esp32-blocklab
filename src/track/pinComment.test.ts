import { describe, expect, it } from "vitest";
import { commentStart, followPinLine, pinSlots, renamePinInComment, renamePinsInComment, type PinMemory } from "./pinComment";

describe("renamePinInComment — 옛 번호만, 핀으로 보는 자리만 바꾼다", () => {
  const table: [string, number, number, string][] = [
    ["# IO13 → 빨강", 13, 15, "# IO15 → 빨강"],
    ["# io13", 13, 15, "# io15"],
    ["# GPIO13 에 빨강", 13, 15, "# GPIO15 에 빨강"],
    ["# IO 13", 13, 15, "# IO 15"],
    ["# D13 빨강", 13, 15, "# D15 빨강"],
    ["# 13번 핀에 꽂은 빨강 LED", 13, 15, "# 15번 핀에 꽂은 빨강 LED"],
    ["# 13 번", 13, 15, "# 15 번"],
    ["# 핀 13", 13, 15, "# 핀 15"],
    ["# Pin 13", 13, 15, "# Pin 15"],
    ["# IO26을 출력으로, 이름은 led", 26, 27, "# IO27을 출력으로, 이름은 led"],
    ["# 온습도 센서 S → 13번", 13, 4, "# 온습도 센서 S → 4번"],
    // 숫자 경계
    ["# 113번", 13, 15, "# 113번"],
    ["# 1300", 13, 15, "# 1300"],
    ["# 13.5", 13, 15, "# 13.5"],
    ["# IO130", 13, 15, "# IO130"],
    ["# LED13", 13, 15, "# LED13"],
    // 다른 숫자·단위·순서는 그대로
    ["# 13초 기다리기", 13, 15, "# 13초 기다리기"],
    ["# 13번째 LED", 13, 15, "# 13번째 LED"],
    ["# 5초 동안 켜기", 5, 18, "# 5초 동안 켜기"],
    ["# 1 을 보내면 펌프가 돌아요", 1, 2, "# 1 을 보내면 펌프가 돌아요"],
    // 범위의 숫자는 핀 번호가 아니다
    ["# 가변저항 39번. 아날로그는 32~39번", 39, 36, "# 가변저항 36번. 아날로그는 32~39번"],
    ["# 아날로그는 32~39번", 32, 33, "# 아날로그는 32~39번"],
    ["# 0~4095 값을 읽어요", 0, 4, "# 0~4095 값을 읽어요"],
    // 한 주석이 여러 핀을 말하면 바뀐 번호만
    ["# 13번 = 트리거, 12번 = 에코", 13, 5, "# 5번 = 트리거, 12번 = 에코"],
    ["# 13번 = 트리거, 12번 = 에코", 12, 18, "# 13번 = 트리거, 18번 = 에코"],
    ["# RGB LED (빨강 27, 초록 25, 파랑 26)", 25, 33, "# RGB LED (빨강 27, 초록 33, 파랑 26)"],
    ["# 신호등 RGB LED: 빨강 27, 초록 25, 파랑 26", 26, 32, "# 신호등 RGB LED: 빨강 27, 초록 25, 파랑 32"],
    ["# OLED 두 선 (SCL 22번, SDA 21번)", 22, 18, "# OLED 두 선 (SCL 18번, SDA 21번)"],
    ["# 초음파 Trig 13, Echo 12", 13, 5, "# 초음파 Trig 5, Echo 12"],
    ["# 조이스틱 X → 36번, Y → 39번, B(버튼) → 26번", 39, 35, "# 조이스틱 X → 36번, Y → 35번, B(버튼) → 26번"],
    ["# 13·14·16번", 14, 17, "# 13·17·16번"],
    // 블록 주석 형식(위 줄 + | 줄 끝)
    ["빨강 LED\n|IO13 → 빨강", 13, 15, "빨강 LED\n|IO15 → 빨강"],
    // 같은 번호면 그대로
    ["# IO13", 13, 13, "# IO13"],
  ];
  it.each(table)("%s : %i → %i", (text, from, to, want) => {
    expect(renamePinInComment(text, from, to)).toBe(want);
  });

  it("여러 번호를 한꺼번에 — 맞바꿔도 섞이지 않는다", () => {
    expect(renamePinsInComment("# SCL 22번, SDA 21번", new Map([[22, 21], [21, 22]]))).toBe("# SCL 21번, SDA 22번");
  });
});

describe("pinSlots — 코드 부분의 핀 자리", () => {
  const values = (code: string) => pinSlots(code).map((s) => s.value);
  it.each([
    ["led_red = Pin(13, Pin.OUT)", [13]],
    ["led = PWM(Pin(26))", [26]],
    ["i2c = SoftI2C(scl=Pin(22), sda=Pin(21))", [22, 21]],
    ["sound = ADC(Pin(36))", [36]],
    ["touch = TouchPad(Pin(4))", [4]],
    ["dht11 = dht.DHT11(Pin(13))", [13]],
    ["rc522 = mfrc522(22, 21, 0x28)", [22, 21]],
    ["lcd = lcd128_32(21, 22, 0, 0x3f)", [21, 22]],
    ["ir = irGetCMD(5)", [5]],
    ["keypad = KeyPad(26, 25, 17, 16, 27, 14, 12, 13)", [26, 25, 17, 16, 27, 14, 12, 13]],
    ["pins = [18, 5, 14, 17, 26]", [18, 5, 14, 17, 26]],
    ["    led = Pin(pin, Pin.OUT)", []],
    ["time.sleep(13)", []],
    ["led = Pin(", [null]],
  ] as [string, (number | null)[]][])("%s", (code, want) => {
    expect(values(code)).toEqual(want);
  });
  it("자리는 숫자 글자 위치", () => {
    const code = "led = Pin(13, Pin.OUT)";
    const [s] = pinSlots(code);
    expect(code.slice(s.start, s.end)).toBe("13");
  });
  it("주석 자리: 문자열 안의 # 은 주석이 아니다", () => {
    expect(commentStart('print("#1")  # 출력')).toBe(13);
    expect(commentStart("led = Pin(13)")).toBe(13);
  });
});

describe("followPinLine — 코드 모드에서 핀 숫자를 고치면 그 줄 주석이 따라간다", () => {
  const line = (pin: string) => `led_red = Pin(${pin}, Pin.OUT)  # IO13 → 빨강`;
  it("바로 바꾸면 주석도", () => {
    expect(followPinLine("led_red = Pin(13, Pin.OUT)  # IO13 → 빨강", "led_red = Pin(15, Pin.OUT)  # IO13 → 빨강").line).toBe("led_red = Pin(15, Pin.OUT)  # IO15 → 빨강");
  });
  it("13 → 1 → 15 처럼 중간 값을 거쳐도 최종이 맞다", () => {
    let cur = line("13");
    let memory: PinMemory = new Map();
    for (const pin of ["1", "15"]) {
      // 학생이 친 글자(코드 부분만 바뀐 줄)에 지금 주석을 붙인다
      const next = `led_red = Pin(${pin}, Pin.OUT)` + cur.slice(cur.indexOf("  #"));
      ({ line: cur, memory } = followPinLine(cur, next, memory));
    }
    expect(cur).toBe("led_red = Pin(15, Pin.OUT)  # IO15 → 빨강");
  });
  it("숫자를 다 지웠다가 새로 쳐도 기억해 둔 옛 번호로 따라간다", () => {
    let memory: PinMemory = new Map();
    let cur = line("13");
    for (const pin of ["1", "", "1", "15"]) {
      const next = `led_red = Pin(${pin}, Pin.OUT)` + cur.slice(cur.indexOf("  #"));
      ({ line: cur, memory } = followPinLine(cur, next, memory));
    }
    expect(cur).toBe("led_red = Pin(15, Pin.OUT)  # IO15 → 빨강");
    expect(memory.size).toBe(0);
  });
  it("핀이 아닌 곳을 고치면 그대로", () => {
    const old = "led_red = Pin(13, Pin.OUT)  # IO13 → 빨강";
    expect(followPinLine(old, "led_rd = Pin(13, Pin.OUT)  # IO13 → 빨강").line).toBe("led_rd = Pin(13, Pin.OUT)  # IO13 → 빨강");
    expect(followPinLine(old, "led_red = Pin(13, Pin.IN)  # IO13 → 빨강").line).toBe("led_red = Pin(13, Pin.IN)  # IO13 → 빨강");
  });
  it("여러 핀 줄은 바뀐 자리의 옛 번호만", () => {
    const old = "i2c = SoftI2C(scl=Pin(22), sda=Pin(21))  # OLED 두 선 (SCL 22번, SDA 21번)";
    expect(followPinLine(old, old.replace("Pin(21)", "Pin(19)")).line).toBe("i2c = SoftI2C(scl=Pin(22), sda=Pin(19))  # OLED 두 선 (SCL 22번, SDA 19번)");
  });
  it("주석이 없으면 그대로", () => {
    expect(followPinLine("led = Pin(13)", "led = Pin(15)").line).toBe("led = Pin(15)");
  });
});
