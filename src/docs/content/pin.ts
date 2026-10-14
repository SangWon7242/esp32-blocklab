import type { BlockContent } from "../types";

const ADC_SETUP = "adc = ADC(Pin(36))\nadc.atten(ADC.ATTN_11DB)\nadc.width(ADC.WIDTH_12BIT)";

/** 핀 카테고리 블록 설명 (src/devices/specs/pin.ts, 출력 블록은 misc.ts) */
export const pinContent: Record<string, BlockContent> = {
  esp_pin_setup: {
    concept: "핀 하나를 출력이나 입력으로 쓰겠다고 정하고 이름을 붙여요. 출력은 LED·부저처럼 켜고 끄는 부품, 입력은 스위치처럼 값을 읽는 부품에 씁니다. 코드로는 led = Pin(26, Pin.OUT) 이고, 어디에 두어도 코드 맨 위로 모여요.",
    example: {
      title: "LED 를 1초마다 깜빡이기",
      code: "led = Pin(26, Pin.OUT)\nwhile True:\n    led.value(1)\n    time.sleep(1)\n    led.value(0)\n    time.sleep(1)",
    },
    tips: ["34~39번 핀은 입력 전용이라 출력으로 쓸 수 없어요.", "붙인 이름은 켜기·끄기 블록의 이름 칸에서 골라요."],
  },
  esp_pin_setup_var: {
    concept: "변수에 든 번호의 핀을 출력이나 입력으로 준비하고 이름을 붙여요. 리스트에 모은 핀 번호를 하나씩 꺼내며 반복할 때, 반복 안에서 지금 번호의 핀을 준비하는 데 씁니다. 코드로는 led = Pin(pin, Pin.OUT) 이고, 맨 위로 모이지 않고 블록을 놓은 자리에 그대로 들어가요.",
    example: {
      title: "다섯 LED 를 차례로 켰다 끄기",
      code: "pins = [18, 5, 14, 17, 26]\nfor pin in pins:\n    led = Pin(pin, Pin.OUT)\n    led.value(1)\n    time.sleep(0.2)\n    led.value(0)",
    },
    tips: [
      "핀 번호 칸에는 반복 변수처럼 이미 값이 정해진 변수를 골라요.",
      "번호가 하나로 정해져 있으면 숫자를 적는 핀 준비 블록이 더 알아보기 쉬워요.",
    ],
  },
  esp_pin_write: {
    concept: "출력 핀을 켜거나 꺼요. 켜기는 led.value(1), 끄기는 led.value(0) 입니다. 1 이면 핀에서 3.3V 전기가 나가고, 0 이면 끊겨요.",
    example: { title: "LED 를 2초 켰다가 끄기", code: "led = Pin(26, Pin.OUT)\nled.value(1)\ntime.sleep(2)\nled.value(0)" },
    tips: ["부저·릴레이도 출력 핀이라 같은 블록으로 켜고 꺼요."],
  },
  esp_pin_read: {
    concept: "입력 핀의 지금 값을 읽어요. 핀에 전기가 들어오면 1, 아니면 0 이 됩니다. 코드로는 echo.value() 처럼 이름 뒤에 .value() 를 붙여요.",
    example: { title: "입력 핀 값을 계속 출력하기", code: "sensor = Pin(14, Pin.IN)\nwhile True:\n    print(sensor.value())\n    time.sleep(0.5)" },
  },
  dev_pin_in_setup: {
    concept: "입력 핀을 준비하고 이름을 붙여요. 풀업으로 고르면 핀 안쪽 저항이 값을 1 로 끌어올려 두어서, 아무것도 누르지 않을 때 1, 버튼을 누르면 0 이 됩니다. 그대로를 고르면 Pin(14, Pin.IN) 이 돼요.",
    example: { title: "풀업 입력 핀 값 보기", code: "button = Pin(14, Pin.IN, Pin.PULL_UP)\nwhile True:\n    print(button.value())\n    time.sleep(0.2)" },
    tips: ["코드를 블록으로 바꾸면 풀업 입력 핀은 버튼 준비 블록으로, 그대로 입력 핀은 핀 준비 블록으로 돌아와요. 뜻은 같아요."],
  },
  esp_pwm_setup: {
    concept: "핀을 PWM 으로 준비해요. PWM 은 아주 빠르게 켜고 끄기를 되풀이해서 LED 밝기나 모터 세기처럼 중간 정도의 힘을 내는 방법입니다. 주파수(Hz)는 1초에 몇 번 켜고 끌지예요.",
    example: { title: "PWM 세기를 바꿔 보기", code: "pwm = PWM(Pin(2))\npwm.freq(1000)\npwm.duty_u16(16384)\ntime.sleep(1)\npwm.duty_u16(65535)" },
  },
  esp_pwm_duty: {
    concept: "PWM 핀의 세기를 0~65535 사이 수로 정해요. 0 이면 꺼짐, 65535 면 계속 켜짐, 32768 이면 절반쯤 켜진 것과 같아요. 코드로는 pwm.duty_u16(값) 입니다.",
    example: {
      title: "세 단계로 밝아지기",
      code: "pwm = PWM(Pin(2))\npwm.freq(1000)\nwhile True:\n    pwm.duty_u16(0)\n    time.sleep(0.5)\n    pwm.duty_u16(32768)\n    time.sleep(0.5)\n    pwm.duty_u16(65535)\n    time.sleep(0.5)",
    },
  },
  dev_pwm_freq: {
    concept: "PWM 핀이 1초에 몇 번 켜고 끌지(주파수, Hz)를 바꿔요. 부저를 연결하면 주파수가 곧 음 높이라서 440Hz 는 '라' 음이 됩니다. 코드로는 pwm.freq(값) 이에요.",
    example: {
      title: "음 높이 바꾸기",
      code: "pwm = PWM(Pin(15))\npwm.freq(440)\npwm.duty_u16(32768)\ntime.sleep(1)\npwm.freq(880)\ntime.sleep(1)\npwm.duty_u16(0)",
    },
  },
  dev_adc_setup: {
    concept: "아날로그 핀을 준비하고 이름을 붙여요. 아날로그 핀은 0V~3.3V 사이 전압을 0~4095 수로 읽어서, 조도 센서나 가변저항처럼 값이 조금씩 바뀌는 부품에 씁니다. 코드 세 줄(ADC, atten, width)이 함께 만들어져요.",
    example: { title: "아날로그 값 계속 출력하기", code: `${ADC_SETUP}\nwhile True:\n    print(adc.read())\n    time.sleep(0.5)` },
    tips: ["아날로그로 읽을 수 없는 핀도 있어요. 36·39·34·35·32·33번 핀이 쓰기 좋아요."],
  },
  dev_adc_read: {
    concept: "아날로그 핀의 값을 0~4095 사이 수로 읽어요. 0 은 0V, 4095 는 3.3V 에 가깝습니다. 코드로는 adc.read() 예요.",
    example: { title: "값이 크면 알려 주기", code: `${ADC_SETUP}\nwhile True:\n    if adc.read() > 3000:\n        print("high")\n    time.sleep(0.5)` },
  },
  dev_adc_voltage: {
    concept: "아날로그 핀에서 읽은 값을 전압(V)으로 바꿔 알려 줘요. 코드로는 adc.read() * 3.3 / 4095 이고, 결과는 0~3.3 사이 소수입니다.",
    example: { title: "전압 출력하기", code: `${ADC_SETUP}\nwhile True:\n    print(adc.read() * 3.3 / 4095)\n    time.sleep(1)` },
  },
  esp_print: {
    concept: "값을 시리얼 모니터(아래 출력 창)에 찍어요. 코드로는 print(값) 이고, 센서 값이 잘 읽히는지, 프로그램이 어디까지 왔는지 확인할 때 가장 많이 씁니다.",
    example: { title: "시작과 숫자 출력하기", code: 'print("start")\nfor i in range(3):\n    print(i)' },
  },
  esp_print2: {
    concept: "두 값을 한 줄에 띄어서 찍어요. print(\"value\", 25) 처럼 이름표와 값을 함께 보여 줄 때 편합니다.",
    example: { title: "이름표와 센서 값 함께 출력하기", code: `${ADC_SETUP}\nwhile True:\n    print("value", adc.read())\n    time.sleep(1)` },
  },
};
