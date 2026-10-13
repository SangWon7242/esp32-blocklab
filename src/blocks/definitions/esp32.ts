const pin = (name: string, value: number) => ({ type: "field_number", name, value, min: 0, max: 39, precision: 1 });
const stmt = { previousStatement: null, nextStatement: null, style: "hardware_blocks" };

export const esp32Blocks: Record<string, unknown>[] = [
  {
    type: "esp_pin_setup",
    message0: "핀 %1 을(를) %2 으로 준비하고 %3 이름 붙이기",
    args0: [
      pin("PIN", 26),
      { type: "field_dropdown", name: "MODE", options: [["출력", "OUT"], ["입력", "IN"]] },
      { type: "field_variable", name: "VAR", variable: "led" },
    ],
    ...stmt,
    tooltip: "led = Pin(26, Pin.OUT) 처럼 핀에 이름을 붙입니다. 코드 맨 위에 모입니다.",
  },
  {
    type: "esp_pin_write",
    message0: "%1 %2",
    args0: [
      { type: "field_variable", name: "VAR", variable: "led" },
      { type: "field_dropdown", name: "VALUE", options: [["켜기", "1"], ["끄기", "0"]] },
    ],
    ...stmt,
    tooltip: "led.value(1) 은 켜기, led.value(0) 은 끄기",
  },
  {
    type: "esp_pin_read",
    message0: "%1 값",
    args0: [{ type: "field_variable", name: "VAR", variable: "echo" }],
    output: "Number",
    style: "hardware_blocks",
    tooltip: "echo.value() — 입력 핀의 값(0 또는 1)",
  },
  {
    type: "esp_pwm_setup",
    message0: "PWM %1 을(를) 핀 %2 에 준비하기 (주파수 %3 Hz)",
    args0: [{ type: "field_variable", name: "VAR", variable: "pwm" }, pin("PIN", 2), { type: "field_number", name: "FREQ", value: 1000, min: 1, precision: 1 }],
    ...stmt,
    tooltip: "pwm = PWM(Pin(2)); pwm.freq(1000)",
  },
  {
    type: "esp_servo_setup",
    message0: "서보 %1 을(를) 핀 %2 에 준비하기 (처음엔 닫기)",
    args0: [{ type: "field_variable", name: "VAR", variable: "servo" }, pin("PIN", 4)],
    ...stmt,
    tooltip: "servo = PWM(Pin(4)); servo.freq(50); servo.duty_u16(1638)",
  },
  {
    type: "esp_pwm_duty",
    message0: "%1 세기를 %2 로 정하기",
    args0: [{ type: "field_variable", name: "VAR", variable: "pwm" }, { type: "input_value", name: "DUTY", check: "Number" }],
    ...stmt,
    tooltip: "pwm.duty_u16(0~65535)",
  },
  {
    type: "esp_servo_door",
    message0: "%1 문 %2",
    args0: [
      { type: "field_variable", name: "VAR", variable: "servo" },
      { type: "field_dropdown", name: "ACTION", options: [["열기", "8100"], ["닫기", "1638"]] },
    ],
    ...stmt,
    tooltip: "열기 = duty_u16(8100), 닫기 = duty_u16(1638)",
  },
  {
    type: "esp_ultrasonic_setup",
    message0: "초음파 센서 준비하기 (trig 핀 %1, echo 핀 %2)",
    args0: [pin("TRIG", 13), pin("ECHO", 12)],
    ...stmt,
    tooltip: "trig/echo 핀을 만들고 거리를 재는 get_distance() 함수를 준비합니다.",
  },
  {
    type: "esp_distance",
    message0: "거리 (cm)",
    output: "Number",
    style: "hardware_blocks",
    tooltip: "get_distance() — 초음파로 잰 거리(cm)",
  },
  {
    type: "esp_oled_setup",
    message0: "OLED 화면 준비하기 (scl 핀 %1, sda 핀 %2)",
    args0: [pin("SCL", 22), pin("SDA", 21)],
    ...stmt,
    tooltip: "i2c 와 oled 를 만들고 두 줄을 띄우는 show(a, b) 함수를 준비합니다.",
  },
  {
    type: "esp_oled_show",
    message0: "화면에 %1 와(과) %2 보여주기",
    args0: [{ type: "input_value", name: "A" }, { type: "input_value", name: "B" }],
    inputsInline: true,
    ...stmt,
    tooltip: "show(첫째 줄, 둘째 줄)",
  },
  {
    type: "esp_print",
    message0: "%1 출력하기",
    args0: [{ type: "input_value", name: "VALUE" }],
    ...stmt,
    tooltip: "print(값) — 시리얼 모니터에 찍습니다.",
  },
  {
    type: "esp_print2",
    message0: "%1 와(과) %2 출력하기",
    args0: [{ type: "input_value", name: "A" }, { type: "input_value", name: "B" }],
    inputsInline: true,
    ...stmt,
    tooltip: "print(a, b) — 두 값을 띄어서 찍습니다.",
  },
];
