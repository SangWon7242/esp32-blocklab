/** 처음 열었을 때 깔려 있는 예시 (챕터 1 step4_blink_loop) */
export const SAMPLE_CODE = [
  "from machine import Pin",
  "import time",
  "",
  "led = Pin(26, Pin.OUT)",
  "",
  "while True:",
  "    led.value(1)",
  "    time.sleep(1)",
  "    led.value(0)",
  "    time.sleep(1)",
  "",
].join("\n");
