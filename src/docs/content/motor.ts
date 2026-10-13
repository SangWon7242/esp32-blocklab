import type { BlockContent } from "../types";

const SERVO_SETUP = "servo = PWM(Pin(4))\nservo.freq(50)\nservo.duty_u16(1638)";

const MOTOR_SETUP = [
  "motor1a = PWM(Pin(13))", "motor1b = PWM(Pin(12))", "motor1a.freq(1000)", "motor1b.freq(1000)",
  "", "",
  "def forward(speed):", "    motor1a.duty(speed)", "    motor1b.duty(0)",
  "", "",
  "def backward(speed):", "    motor1a.duty(0)", "    motor1b.duty(speed)",
  "", "",
  "def stop():", "    motor1a.duty(0)", "    motor1b.duty(0)",
  "", "",
].join("\n");

const MOTOR_TIP = "먼저 DC 모터 준비 블록이 있어야 해요.";

/** 모터 카테고리 블록 설명 (src/devices/specs/motor.ts) */
export const motorContent: Record<string, BlockContent> = {
  esp_servo_setup: {
    concept: "서보 모터를 PWM 핀에 준비하고 이름을 붙여요. 서보는 1초에 50번(50Hz) 오는 신호의 길이에 따라 정한 각도로 돌아가 멈추는 모터입니다. 준비하면서 duty_u16(1638) 로 0도(문 닫기) 자리에 둬요.",
    example: { title: "문을 열었다가 닫기", code: `${SERVO_SETUP}\nservo.duty_u16(8100)\ntime.sleep(2)\nservo.duty_u16(1638)` },
    tips: ["서보는 전기를 많이 써요. 움직임이 이상하면 전원 선과 GND 선을 먼저 확인해요."],
  },
  esp_servo_door: {
    concept: "서보를 문처럼 열거나 닫아요. 열기는 servo.duty_u16(8100) 으로 180도 쪽, 닫기는 servo.duty_u16(1638) 로 0도 쪽으로 돌립니다. 자동문이나 상자 뚜껑처럼 두 자리만 오갈 때 쓰기 좋아요.",
    example: {
      title: "버튼을 누르면 문 열기",
      code: `${SERVO_SETUP}\nbutton = Pin(14, Pin.IN, Pin.PULL_UP)\nwhile True:\n    if button.value() == 0:\n        servo.duty_u16(8100)\n        time.sleep(3)\n        servo.duty_u16(1638)\n    time.sleep(0.1)`,
    },
    tips: ["서보가 다 돌아갈 시간이 필요해요. 열고 닫는 사이에 기다리기를 넣어요."],
  },
  dev_servo_angle: {
    concept: "서보를 0~180도 가운데 원하는 각도로 돌려요. 블록이 각도를 신호 세기 1638~8100 으로 바꿔 servo.duty_u16(1638 + 90 * 6462 // 180) 같은 코드를 만듭니다. 변수를 끼우면 조금씩 돌아가게 할 수 있어요.",
    example: {
      title: "30도씩 천천히 돌리기",
      code: `${SERVO_SETUP}\nangle = 0\nwhile angle <= 180:\n    servo.duty_u16(1638 + angle * 6462 // 180)\n    angle = angle + 30\n    time.sleep(0.5)`,
    },
    tips: ["각도는 0~180 사이로 정해요. 그 밖의 값을 주면 서보가 끝에 부딪혀 떨릴 수 있어요."],
  },
  dev_motor_setup: {
    concept: "DC 모터(선풍기 날개 같은 돌기만 하는 모터)를 두 PWM 핀에 준비해요. 두 핀 중 어느 쪽에 힘을 주느냐로 도는 방향이, 세기로 빠르기가 정해집니다. forward·backward·stop 세 함수가 함께 만들어지고, 핀 이름은 motor1a, motor1b 로 정해져 있어요.",
    example: { title: "2초 돌리고 멈추기", code: `${MOTOR_SETUP}forward(800)\ntime.sleep(2)\nstop()` },
    tips: ["ESP32 핀만으로는 모터를 돌릴 힘이 모자라요. 모터 드라이버가 달린 모듈의 IN+·IN- 에 연결해요."],
  },
  dev_motor_forward: {
    concept: "DC 모터를 앞쪽 방향으로 돌려요. 속도는 0~1023 이고 클수록 빠릅니다. 코드로는 forward(1023) 이며, motor1a 핀에 힘을 주고 motor1b 는 0 으로 둬요.",
    example: { title: "천천히, 빠르게 돌리기", code: `${MOTOR_SETUP}forward(500)\ntime.sleep(2)\nforward(1023)\ntime.sleep(2)\nstop()` },
    tips: [MOTOR_TIP, "속도가 너무 작으면 모터가 돌지 못하고 윙 소리만 날 수 있어요."],
  },
  dev_motor_backward: {
    concept: "DC 모터를 반대 방향으로 돌려요. 속도는 0~1023 이고, 코드로는 backward(1023) 입니다. 앞으로 블록과 두 핀의 역할이 바뀌어요.",
    example: { title: "앞으로 돌다가 반대로 돌기", code: `${MOTOR_SETUP}forward(800)\ntime.sleep(2)\nstop()\ntime.sleep(1)\nbackward(800)\ntime.sleep(2)\nstop()` },
    tips: [MOTOR_TIP, "방향을 바꿀 때는 잠깐 멈췄다가 바꾸면 모터에 무리가 덜 가요."],
  },
  dev_motor_stop: {
    concept: "DC 모터를 멈춰요. 코드로는 stop() 이고, 두 핀의 세기를 모두 0 으로 만듭니다.",
    example: {
      title: "버튼을 누르는 동안만 돌리기",
      code: `${MOTOR_SETUP}button = Pin(14, Pin.IN, Pin.PULL_UP)\nwhile True:\n    if button.value() == 0:\n        forward(800)\n    else:\n        stop()`,
    },
    tips: [MOTOR_TIP],
  },
  dev_relay_setup: {
    concept: "릴레이를 출력 핀에 준비하고 이름을 붙여요. 릴레이는 ESP32 의 작은 신호로 다른 회로의 스위치를 딸깍 켜고 끄는 부품입니다. 켜고 끄는 것은 핀 켜기·끄기 블록(relay.value(1)·relay.value(0))으로 해요.",
    example: { title: "릴레이를 2초 켰다 끄기", code: "relay = Pin(16, Pin.OUT)\nrelay.value(1)\ntime.sleep(2)\nrelay.value(0)" },
    tips: [
      "집에서 쓰는 220V 전기는 위험해요. 릴레이에는 선생님이 허락한 낮은 전압의 회로만 연결해요.",
      "코드를 블록으로 바꾸면 핀 준비 블록(출력)으로 돌아와요. 코드가 같아서 뜻도 같아요.",
    ],
  },
};
