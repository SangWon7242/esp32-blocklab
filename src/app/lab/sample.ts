/** 처음 열었을 때의 프로그램: 빈 코드 → 작업판에는 "프로그램이 시작되면" 블록 하나만 (codeToBlocks("") 가 그렇게 만든다) */
export const START_ONLY_CODE = "";

/** LED 1초 깜빡이기 예시 (챕터 1 step4_blink_loop). 예전 첫 화면이던 것으로, 테스트가 기준 프로그램으로 쓴다 */
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
