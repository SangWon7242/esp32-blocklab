import type { BlockContent } from "../types";

const JOYSTICK_SETUP = [
  "rocker_x = ADC(Pin(36))", "rocker_y = ADC(Pin(39))",
  "rocker_x.atten(ADC.ATTN_11DB)", "rocker_y.atten(ADC.ATTN_11DB)",
  "button_z = Pin(26, Pin.IN, Pin.PULL_UP)",
].join("\n");

/** 버튼·스위치 카테고리 블록 설명 (src/devices/specs/switch.ts) */
export const switchContent: Record<string, BlockContent> = {
  dev_button_setup: {
    concept: "버튼을 연결한 핀을 준비하고 이름을 붙여요. 풀업 입력이라서 누르지 않으면 1, 누르면 0 이 됩니다. 코드로는 button = Pin(14, Pin.IN, Pin.PULL_UP) 이에요.",
    example: {
      title: "버튼을 누르면 출력하기",
      code: 'button = Pin(14, Pin.IN, Pin.PULL_UP)\nwhile True:\n    if button.value() == 0:\n        print("pressed")\n    time.sleep(0.1)',
    },
  },
  dev_button_pressed: {
    concept: "버튼이 지금 눌려 있는지 참·거짓으로 알려 줘요. 풀업 버튼은 누르면 0 이 되므로 코드로는 button.value() == 0 입니다. 만약 블록의 조건 칸에 끼워 써요.",
    example: {
      title: "누르는 동안 LED 켜기",
      code: "led = Pin(26, Pin.OUT)\nbutton = Pin(14, Pin.IN, Pin.PULL_UP)\nwhile True:\n    if button.value() == 0:\n        led.value(1)\n    else:\n        led.value(0)",
    },
  },
  dev_tilt_setup: {
    concept: "틸트(기울기) 스위치를 준비해요. 안에 든 작은 구슬이 굴러 전기가 이어지면 1 이 됩니다. 코드로는 tilt = Pin(14, Pin.IN) 이에요.",
    example: { title: "기울기 값 출력하기", code: "tilt = Pin(14, Pin.IN)\nwhile True:\n    print(tilt.value())\n    time.sleep(0.5)" },
    tips: ["코드를 블록으로 바꾸면 핀 준비 블록(입력)으로 돌아와요. 뜻은 같아요."],
  },
  dev_tilt_tilted: {
    concept: "틸트 스위치가 기울었는지 참·거짓으로 알려 줘요. 코드로는 tilt.value() == 1 이고, 만약 블록의 조건 칸에 끼워 씁니다.",
    example: {
      title: "기울이면 LED 켜기",
      code: "tilt = Pin(14, Pin.IN)\nled = Pin(26, Pin.OUT)\nwhile True:\n    if tilt.value() == 1:\n        led.value(1)\n    else:\n        led.value(0)",
    },
  },
  dev_pir_setup: {
    concept: "인체감지(PIR) 센서를 준비해요. 사람이 움직일 때 몸에서 나오는 적외선의 변화를 느끼면 1 이 됩니다. 코드로는 pir = Pin(14, Pin.IN) 이에요.",
    example: { title: "감지 값 출력하기", code: "pir = Pin(14, Pin.IN)\nwhile True:\n    print(pir.value())\n    time.sleep(0.5)" },
    tips: ["코드를 블록으로 바꾸면 핀 준비 블록(입력)으로 돌아와요. 뜻은 같아요."],
  },
  dev_pir_detected: {
    concept: "PIR 센서 앞에 움직이는 사람이 있는지 참·거짓으로 알려 줘요. 코드로는 pir.value() == 1 입니다. 사람이 오면 불을 켜는 장치에 써요.",
    example: {
      title: "사람이 오면 LED 켜기",
      code: "pir = Pin(14, Pin.IN)\nled = Pin(26, Pin.OUT)\nwhile True:\n    if pir.value() == 1:\n        led.value(1)\n    else:\n        led.value(0)",
    },
    tips: ["코드를 블록으로 바꾸면 '기울었는가' 블록으로 돌아올 수 있어요. 코드가 같아서 뜻도 같아요."],
  },
  dev_joystick_setup: {
    concept: "조이스틱을 준비해요. 손잡이의 가로(X)·세로(Y) 위치는 아날로그 핀으로, 손잡이를 누르는 버튼은 풀업 입력 핀으로 읽습니다. 이름은 rocker_x, rocker_y, button_z 로 정해져 있어요.",
    example: { title: "X·Y 값 출력하기", code: `${JOYSTICK_SETUP}\nwhile True:\n    print(rocker_x.read(), rocker_y.read())\n    time.sleep(0.2)` },
  },
  dev_joystick_x: {
    concept: "조이스틱 손잡이의 가로 위치를 0~4095 로 읽어요. 가운데에 두면 중간쯤 값이 나오고, 한쪽 끝까지 밀면 0 이나 4095 에 가까워집니다.",
    example: {
      title: "오른쪽·왼쪽 알아내기",
      code: `${JOYSTICK_SETUP}\nwhile True:\n    if rocker_x.read() > 3000:\n        print("high")\n    if rocker_x.read() < 1000:\n        print("low")\n    time.sleep(0.2)`,
    },
  },
  dev_joystick_y: {
    concept: "조이스틱 손잡이의 세로 위치를 0~4095 로 읽어요. 가운데에 두면 중간쯤 값이 나오고, 위나 아래 끝까지 밀면 0 이나 4095 에 가까워집니다.",
    example: { title: "세로 값 출력하기", code: `${JOYSTICK_SETUP}\nwhile True:\n    print(rocker_y.read())\n    time.sleep(0.2)` },
  },
  dev_joystick_pressed: {
    concept: "조이스틱 손잡이를 꾹 눌렀는지 참·거짓으로 알려 줘요. 풀업 입력이라 누르면 0 이 되므로 코드로는 button_z.value() == 0 입니다.",
    example: {
      title: "손잡이를 누르면 출력하기",
      code: `${JOYSTICK_SETUP}\nwhile True:\n    if button_z.value() == 0:\n        print("click")\n    time.sleep(0.1)`,
    },
  },
};
