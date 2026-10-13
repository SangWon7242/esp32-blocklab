import type { BlockContent } from "../types";

const RGB_SETUP = [
  "red = PWM(Pin(27))", "green = PWM(Pin(25))", "blue = PWM(Pin(26))",
  "red.freq(1000)", "green.freq(1000)", "blue.freq(1000)",
  "", "",
  "def set_color(r, g, b):", "    red.duty(r * 1023 // 255)", "    green.duty(g * 1023 // 255)", "    blue.duty(b * 1023 // 255)",
  "", "",
].join("\n");

const FLOW_SETUP = [
  "pins = [18, 5, 14, 17, 26]",
  "", "",
  "def flow_leds(ms):", "    for pin in pins:", "        led = Pin(pin, Pin.OUT)", "        led.value(1)", "        time.sleep_ms(ms)", "        led.value(0)",
  "", "",
].join("\n");

const LED_PWM_SETUP = "led = PWM(Pin(26))\nled.freq(1000)";

/** LED 카테고리 블록 설명 (src/devices/specs/led.ts) */
export const ledContent: Record<string, BlockContent> = {
  dev_led_blink: {
    concept: "LED 를 켰다 끄기를 정한 번만큼 되풀이해요. 블록 하나가 for 반복과 켜기·기다리기·끄기·기다리기 네 줄을 만들어 줍니다. 간격은 켜져 있는 시간이자 꺼져 있는 시간이에요.",
    example: {
      title: "LED 를 세 번 깜빡이기",
      code: "led = Pin(26, Pin.OUT)\nfor i in range(3):\n    led.value(1)\n    time.sleep(0.5)\n    led.value(0)\n    time.sleep(0.5)",
    },
    tips: ["LED 는 먼저 핀 준비 블록(출력)으로 준비해요.", "코드를 블록으로 바꾸면 반복 블록과 켜기·끄기 블록으로 돌아와요. 뜻은 같아요."],
  },
  dev_led_pwm_setup: {
    concept: "밝기를 조절할 수 있는 LED 를 준비해요. 핀을 PWM 으로 만들고 주파수를 1000Hz 로 정해서 밝기 블록과 세기 블록을 쓸 수 있게 합니다.",
    example: { title: "LED 를 30% 밝기로 켜기", code: `${LED_PWM_SETUP}\nled.duty(int(30 * 1023 / 100))` },
    tips: ["이름을 led 로 시작하게 지어야 코드를 블록으로 바꿀 때 이 블록으로 돌아와요."],
  },
  dev_led_brightness: {
    concept: "LED 밝기를 0~100 퍼센트로 정해요. 블록이 퍼센트를 0~1023 세기로 바꿔서 led.duty(int(50 * 1023 / 100)) 같은 코드를 만듭니다. 0 이면 꺼지고 100 이면 가장 밝아요.",
    example: {
      title: "어둡게, 밝게 번갈아 켜기",
      code: `${LED_PWM_SETUP}\nwhile True:\n    led.duty(int(10 * 1023 / 100))\n    time.sleep(1)\n    led.duty(int(100 * 1023 / 100))\n    time.sleep(1)`,
    },
  },
  dev_pwm_duty10: {
    concept: "PWM 세기를 0~1023 사이 수로 정해요. 0 은 꺼짐, 1023 은 가장 세게입니다. 코드로는 led.duty(값) 이고, 밝기 LED 나 PWM 핀의 세기를 정할 때 씁니다.",
    example: {
      title: "세기를 바꿔 가며 켜기",
      code: `${LED_PWM_SETUP}\nwhile True:\n    led.duty(100)\n    time.sleep(1)\n    led.duty(1023)\n    time.sleep(1)`,
    },
    tips: ["0~65535 로 정하는 세기 블록(duty_u16)과 범위가 달라요. 512 는 절반쯤이에요."],
  },
  dev_rgb_setup: {
    concept: "빨강·초록·파랑 세 핀으로 RGB LED 를 준비해요. 세 빛의 세기를 섞어 여러 색을 만들며, 색을 정하는 set_color(r, g, b) 함수도 함께 만들어집니다. 이름은 red, green, blue 로 정해져 있어요.",
    example: { title: "빨강, 파랑 차례로 켜기", code: `${RGB_SETUP}set_color(255, 0, 0)\ntime.sleep(1)\nset_color(0, 0, 255)` },
  },
  dev_rgb_colour: {
    concept: "색 고르기 칸에서 고른 색으로 RGB LED 를 켜요. 고른 색을 빨강·초록·파랑 세 수(0~255)로 바꿔 set_color(255, 105, 180) 처럼 부릅니다.",
    example: { title: "분홍색으로 켜기", code: `${RGB_SETUP}set_color(255, 105, 180)` },
    tips: ["먼저 RGB LED 준비 블록이 있어야 해요."],
  },
  dev_rgb_set: {
    concept: "빨강·초록·파랑 세기를 0~255 수로 직접 정해요. 셋 다 255 면 흰색, 셋 다 0 이면 꺼집니다. 변수나 계산 블록을 끼우면 색이 조금씩 바뀌게 할 수도 있어요.",
    example: {
      title: "파랑에서 빨강으로 바뀌기",
      code: `${RGB_SETUP}level = 0\nwhile level <= 255:\n    set_color(level, 0, 255 - level)\n    level = level + 51\n    time.sleep(0.5)`,
    },
  },
  dev_rgb_off: {
    concept: "RGB LED 를 꺼요. 코드로는 set_color(0, 0, 0) 이고, 세 빛을 모두 0 으로 만듭니다.",
    example: { title: "초록으로 1초 켰다 끄기", code: `${RGB_SETUP}set_color(0, 255, 0)\ntime.sleep(1)\nset_color(0, 0, 0)` },
    tips: ["코드를 블록으로 바꾸면 검은색 RGB 색 블록으로 돌아와요. 뜻은 같아요."],
  },
  dev_flow_setup: {
    concept: "여러 LED 를 차례로 켜는 흐르는 LED 를 준비해요. 핀 번호 목록을 pins 로 만들고, 목록의 LED 를 하나씩 켰다 끄는 flow_leds(ms) 함수도 함께 만들어집니다.",
    example: { title: "LED 가 계속 흐르게 하기", code: `${FLOW_SETUP}while True:\n    flow_leds(100)` },
    tips: ["핀 목록은 18, 5, 14 처럼 쉼표로 나눠 적어요."],
  },
  dev_flow_run: {
    concept: "목록의 LED 를 하나씩 차례로 켰다 꺼요. 간격(ms)은 LED 하나가 켜져 있는 시간이라서 작을수록 빨리 흘러갑니다. 코드로는 flow_leds(100) 이에요.",
    example: { title: "느리게, 빠르게 흐르기", code: `${FLOW_SETUP}flow_leds(300)\nflow_leds(50)` },
  },
};
