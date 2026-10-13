import type { BlockContent } from "../types";

const RFID_SETUP = [
  "rc522 = mfrc522(22, 21, 0x28)", "rc522.PCD_Init()",
  "", "",
  "def card_present():", "    return rc522.PICC_IsNewCardPresent() and rc522.PICC_ReadCardSerial()",
  "", "",
  "def card_uid():", "    return rc522.uid.uidByte[0:rc522.uid.size]",
  "", "",
].join("\n");

const KEYPAD_SETUP = "keypad = KeyPad(26, 25, 17, 16, 27, 14, 12, 13)";
const IR_SETUP = "ir = irGetCMD(5)";

const RFID_TIP = "먼저 RFID 준비 블록이 있어야 해요.";

/** 입력장치 카테고리 블록 설명 (src/devices/specs/input.ts) */
export const inputContent: Record<string, BlockContent> = {
  dev_rfid_setup: {
    concept: "RFID 카드 읽개를 I2C(scl·sda 두 선)로 준비해요. 카드나 열쇠고리를 가까이 대면 안에 든 칩의 번호를 무선으로 읽습니다. 카드를 알아내는 card_present()·card_uid() 함수가 함께 만들어지고, 이름은 rc522 로 정해져 있어요.",
    example: {
      title: "카드를 대면 번호 출력하기",
      code: `${RFID_SETUP}while True:\n    if card_present():\n        print(card_uid())\n    time.sleep(0.5)`,
    },
    tips: ["mfrc522_i2c.py 등 라이브러리 세 개가 필요해요. 보드에 저장할 때 앱이 알아서 함께 올려 줘요."],
  },
  dev_rfid_present: {
    concept: "새 카드를 대서 번호까지 읽었는지 참·거짓으로 알려 줘요. 코드로는 card_present() 이고, 만약 블록의 조건 칸에 끼워 씁니다. 참이 된 뒤에 카드 번호 블록으로 번호를 꺼내요.",
    example: {
      title: "카드를 대면 LED 켜기",
      code: `led = Pin(26, Pin.OUT)\n${RFID_SETUP}while True:\n    if card_present():\n        led.value(1)\n        time.sleep(1)\n        led.value(0)\n    time.sleep(0.1)`,
    },
    tips: [RFID_TIP, "카드를 계속 대고 있어도 처음 한 번만 참이 돼요. 다시 읽으려면 카드를 뗐다가 다시 대요."],
  },
  dev_rfid_uid: {
    concept: "마지막으로 읽은 카드의 번호를 알려 줘요. 번호는 [12, 34, 56, 78] 처럼 숫자 몇 개가 든 목록(바이트)입니다. 코드로는 card_uid() 이고, 카드마다 번호가 달라서 누구의 카드인지 가려낼 때 써요.",
    example: {
      title: "카드 번호 출력하기",
      code: `${RFID_SETUP}while True:\n    if card_present():\n        print(card_uid())\n    time.sleep(0.5)`,
    },
    tips: [RFID_TIP, "먼저 '카드가 있는가' 가 참인지 확인한 다음 번호를 읽어요."],
  },
  dev_keypad_setup: {
    concept: "0~9, A~D, *, # 열여섯 개 키가 있는 4×4 키패드를 준비해요. 행 핀 4개와 열 핀 4개, 모두 8개 핀을 연결하고, 어느 행과 어느 열이 이어졌는지로 눌린 키를 알아냅니다. 이름은 keypad 로 정해져 있어요.",
    example: {
      title: "눌린 키 출력하기",
      code: `${KEYPAD_SETUP}\nwhile True:\n    key = keypad.scan()\n    if key:\n        print(key)\n    time.sleep(0.1)`,
    },
    tips: ["keypad.py 라이브러리가 필요해요. 보드에 저장할 때 앱이 알아서 함께 올려 줘요.", "핀 8개의 순서가 바뀌면 다른 키로 읽혀요. 행 4개, 열 4개 차례대로 맞춰요."],
  },
  dev_keypad_key: {
    concept: "지금 눌린 키의 값을 알려 줘요. 아무 키도 안 눌렸으면 None(없음)이 나옵니다. 코드로는 keypad.scan() 이고, 변수에 담아 만약 블록의 조건 칸에 그대로 끼우면 키가 눌렸을 때만 참이 돼요.",
    example: {
      title: "A 키를 누르면 LED 켜기",
      code: `led = Pin(4, Pin.OUT)\n${KEYPAD_SETUP}\nwhile True:\n    key = keypad.scan()\n    if key == "A":\n        led.value(1)\n    time.sleep(0.1)`,
    },
    tips: ["먼저 키패드 준비 블록이 있어야 해요.", "키를 한 번 누르는 동안 여러 번 읽힐 수 있어요. 반복 안에 잠깐 기다리기를 넣어요."],
  },
  dev_ir_setup: {
    concept: "적외선(IR) 리모컨 신호를 받는 수신기를 입력 핀에 준비해요. 리모컨 버튼을 누르면 눈에 보이지 않는 빛 신호가 오고, 수신기가 그것을 '0xff00ff' 같은 글자 값으로 바꿉니다. 이름은 ir 로 정해져 있어요.",
    example: {
      title: "받은 리모컨 값 출력하기",
      code: `${IR_SETUP}\nwhile True:\n    value = ir.ir_read()\n    if value:\n        print(value)\n    time.sleep(0.1)`,
    },
    tips: ["irrecvdata.py 라이브러리가 필요해요. 보드에 저장할 때 앱이 알아서 함께 올려 줘요.", "리모컨을 수신기 쪽으로 향하게 하고 눌러요."],
  },
  dev_ir_value: {
    concept: "리모컨에서 받은 버튼 값을 '0xff00ff' 같은 글자로 알려 줘요. 받은 신호가 없으면 None(없음)이 나옵니다. 코드로는 ir.ir_read() 이고, 버튼마다 값이 달라서 어느 버튼을 눌렀는지 가려낼 수 있어요. 만약 블록의 조건 칸에 그대로 끼우면 신호를 받았을 때만 참이 돼요.",
    example: {
      title: "신호를 받으면 LED 깜빡이기",
      code: `led = Pin(26, Pin.OUT)\n${IR_SETUP}\nwhile True:\n    if ir.ir_read():\n        led.value(1)\n        time.sleep(0.2)\n        led.value(0)\n    time.sleep(0.05)`,
    },
    tips: ["먼저 IR 수신기 준비 블록이 있어야 해요.", "먼저 버튼마다 어떤 값이 나오는지 출력해 보고, 그 값으로 만약 블록을 만들어요.", "읽을 때마다 0.2초를 기다리고 신호가 끝난 뒤에야 값이 나오므로, 누르고 1초쯤 지나서 값이 보이는 게 정상이에요."],
  },
};
