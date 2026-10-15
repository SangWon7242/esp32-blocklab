import type { BlockContent } from "../types";
import { adcSetup, ULTRASONIC_SETUP } from "./sensor";

/** 시작·흐름·판단·계산·변수·함수·코드 블록 설명 */
export const coreContent: Record<string, BlockContent> = {
  // 시작
  start_program: {
    concept: "프로그램의 출발점이에요. 보드에 코드를 올려 실행하면 이 블록 안에 끼운 블록이 위에서 아래로 차례대로 실행됩니다. 코드에는 따로 줄이 생기지 않고, 안에 끼운 블록들이 그대로 파일의 본문이 돼요.",
    example: { title: "시작하면 인사 출력하기", code: 'print("hello")\nprint("ESP32")' },
    tips: ["핀 준비 같은 준비 블록은 어디에 두어도 코드 맨 위로 모여요.", "import 줄은 쓰는 블록에 맞춰 저절로 붙어요."],
  },

  // 흐름
  flow_repeat_forever: {
    concept: "안에 끼운 블록을 끝없이 되풀이해요. 코드로는 while True: 이고, 보드가 꺼지거나 멈춤 버튼을 누를 때까지 계속 돕니다. 센서 값을 계속 읽거나 LED 를 계속 깜빡일 때 씁니다.",
    example: {
      title: "LED 를 1초마다 깜빡이기",
      code: "led = Pin(26, Pin.OUT)\nwhile True:\n    led.value(1)\n    time.sleep(1)\n    led.value(0)\n    time.sleep(1)",
    },
    tips: ["반복 안에 기다리기 블록이 없으면 너무 빨라서 눈으로 볼 수 없어요."],
  },
  flow_repeat_n: {
    concept: "정한 횟수만큼 안의 블록을 되풀이해요. 코드로는 for i in range(3): 처럼 쓰고, i 가 0, 1, 2 로 바뀌며 세 번 돕니다. 몇 번 할지 알 때 쓰는 반복이에요.",
    example: { title: "인사를 세 번 출력하기", code: 'for i in range(3):\n    print("hello")\n    time.sleep(1)' },
    tips: ["range(3) 은 0부터 2까지, 모두 세 번이에요."],
  },
  controls_whileUntil: {
    concept: "조건이 참인 동안 안의 블록을 되풀이해요. '이 될 때까지' 를 고르면 조건이 참이 될 때까지 되풀이하고, 코드로는 while not 조건: 이 됩니다. 조건이 처음부터 맞지 않으면 한 번도 실행되지 않아요.",
    example: { title: "0부터 4까지 세기", code: "count = 0\nwhile count < 5:\n    print(count)\n    count = count + 1" },
    tips: ["반복 안에서 조건이 언젠가 바뀌어야 반복이 끝나요."],
  },
  controls_if: {
    concept: "조건이 참일 때만 안의 블록을 실행해요. '아니면' 칸이 있는 모양을 쓰면 조건이 거짓일 때 할 일도 넣을 수 있습니다. 코드로는 if 조건: 과 else: 예요.",
    example: {
      title: "버튼을 누르면 LED 켜기",
      code: "led = Pin(26, Pin.OUT)\nbutton = Pin(14, Pin.IN, Pin.PULL_UP)\nwhile True:\n    if button.value() == 0:\n        led.value(1)\n    else:\n        led.value(0)",
    },
    tips: ["조건 칸에는 판단 블록(비교, 그리고·또는)이나 '눌렸는가' 같은 참·거짓 블록을 끼워요."],
  },
  flow_wait: {
    concept: "정한 초만큼 프로그램을 잠시 멈춰요. time.sleep(1) 은 1초, time.sleep(0.5) 는 0.5초 기다립니다. 기다리는 동안에는 다음 블록으로 넘어가지 않아요.",
    example: { title: "1초 간격으로 출력하기", code: 'print("one")\ntime.sleep(1)\nprint("two")' },
  },
  flow_wait_ms: {
    concept: "밀리초 단위로 기다려요. 1000밀리초가 1초라서 time.sleep_ms(500) 은 0.5초입니다. 짧은 시간을 정수로 딱 맞게 정할 때 편해요.",
    example: {
      title: "LED 를 빠르게 깜빡이기",
      code: "led = Pin(26, Pin.OUT)\nwhile True:\n    led.value(1)\n    time.sleep_ms(200)\n    led.value(0)\n    time.sleep_ms(200)",
    },
  },
  flow_wait_us: {
    concept: "마이크로초 단위로 아주 짧게 기다려요. 1초는 1,000,000마이크로초입니다. 초음파 센서에 신호를 보낼 때처럼 아주 짧은 펄스를 만들 때 씁니다.",
    example: { title: "10마이크로초 펄스 보내기", code: "trig = Pin(13, Pin.OUT)\ntrig.value(1)\ntime.sleep_us(10)\ntrig.value(0)" },
  },

  flow_for_range: {
    concept: "변수를 시작 수부터 1씩 늘리며 안의 블록을 반복해요. 코드로는 for n in range(1, 6): 이고, 끝 수 6 은 들어가지 않아서 n 은 1, 2, 3, 4, 5 가 됩니다. 몇 번째 반복인지 그 번호를 안에서 쓰고 싶을 때 좋아요.",
    example: {
      title: "1번부터 5번까지 번호를 말하며 LED 깜빡이기",
      code: "led = Pin(26, Pin.OUT)\nfor n in range(1, 6):\n    print(n)\n    led.value(1)\n    time.sleep(0.3)\n    led.value(0)\n    time.sleep(0.3)",
    },
    tips: [
      "끝 수는 들어가지 않아요. 1부터 5까지 돌리려면 range(1, 6) 처럼 끝 수를 하나 크게 적어요.",
      "시작이 0 이면 코드에 range(5) 처럼 수를 하나만 적어요. range(0, 5) 와 뜻이 같아요.",
      "반복 변수가 i 이고 range(3) 처럼 수가 하나면 '번 반복하기' 블록이 돼요.",
    ],
  },
  flow_for_range_step: {
    concept: "변수를 시작 수부터 정한 걸음만큼씩 바꾸며 안의 블록을 반복해요. 코드로는 for num in range(9, -1, -1): 이고, 걸음이 -1 이면 9, 8, 7 … 0 처럼 하나씩 줄어듭니다. 끝 수 -1 은 들어가지 않아요.",
    example: {
      title: "9부터 0까지 거꾸로 세기",
      code: "for num in range(9, -1, -1):\n    print(num)\n    time.sleep(1)",
    },
    tips: [
      "걸음이 2 면 0, 2, 4 … 처럼 건너뛰며 세요.",
      "걸음이 음수면 시작 수가 끝 수보다 커야 반복이 돌아요.",
    ],
  },
  flow_for_each: {
    concept: "리스트의 항목을 앞에서부터 하나씩 꺼내 변수에 넣으며 반복해요. 코드로는 for name in names: 이고, 항목 수만큼 돕니다. 리스트 대신 글자를 넣으면 한 글자씩 꺼내며 반복해요.",
    example: { title: "모은 이름에게 한 명씩 인사하기", code: 'names = ["mina", "jun", "sora"]\nfor name in names:\n    print("hi " + name)\n    time.sleep(1)' },
    tips: [
      "반복하는 동안 그 리스트에 항목을 더하거나 지우면 순서가 꼬여요. 바꾸는 일은 반복이 끝난 뒤에 해요.",
      "몇 번째 항목인지 번호도 필요하면 '바꾸며 반복' 블록과 'n 번째 항목' 블록을 함께 써요.",
    ],
  },
  flow_break: {
    concept: "지금 도는 반복을 바로 끝내고 반복 다음 블록으로 넘어가요. 코드로는 break 입니다. 끝없이 반복하다가 버튼이 눌리는 것처럼 어떤 일이 생기면 빠져나올 때 씁니다.",
    example: {
      title: "버튼을 누르면 기다리기 반복 끝내기",
      code: 'button = Pin(14, Pin.IN, Pin.PULL_UP)\nwhile True:\n    if button.value() == 0:\n        break\n    print("waiting")\n    time.sleep(0.1)\nprint("start!")',
    },
    tips: [
      "반복 블록 안에서만 써요. 반복 밖에 두면 실행할 때 SyntaxError 가 나는데, 검사가 빨간 표시로 먼저 알려 줘요.",
      "반복 안에 반복이 있으면 가장 안쪽 반복 하나만 끝나요.",
    ],
  },
  flow_continue: {
    concept: "이번 반복의 남은 블록을 건너뛰고 바로 다음 반복으로 가요. 코드로는 continue 입니다. 반복 자체는 끝나지 않아서, 어떤 값만 빼고 처리할 때 씁니다.",
    example: { title: "1부터 10까지 홀수만 출력하기", code: "for n in range(1, 11):\n    if n % 2 == 0:\n        continue\n    print(n)" },
    tips: [
      "반복 블록 안에서만 써요. 반복 밖에 두면 실행할 때 SyntaxError 가 나는데, 검사가 빨간 표시로 먼저 알려 줘요.",
      "조건 반복(while) 안에서 쓸 때는 건너뛰기 전에 값을 바꿔야 해요. 그렇지 않으면 같은 값에서 끝없이 돌아요.",
    ],
  },

  // 판단
  logic_compare: {
    concept: "두 값을 비교해서 참이나 거짓을 만들어요. =, ≠, <, ≤, >, ≥ 중에서 고를 수 있고 코드로는 ==, !=, <, <=, >, >= 입니다. 만약 블록이나 반복 블록의 조건 칸에 끼워 씁니다.",
    example: { title: "점수가 80 이상이면 출력하기", code: 'score = 85\nif score >= 80:\n    print("pass")' },
    tips: ["같은지 비교할 때 코드에서는 = 하나가 아니라 == 두 개를 써요. = 하나는 변수에 값을 넣는 것이에요."],
  },
  logic_operation: {
    concept: "두 조건을 함께 따져요. '그리고'(and)는 둘 다 참일 때만 참, '또는'(or)은 하나라도 참이면 참입니다. '0보다 크고 10보다 작다' 처럼 범위를 따질 때 자주 씁니다.",
    example: { title: "값이 범위 안에 있는지 보기", code: 'count = 5\nif count > 0 and count < 10:\n    print("middle")' },
  },
  logic_negate: {
    concept: "참은 거짓으로, 거짓은 참으로 뒤집어요. 코드로는 not 조건 입니다. '아직 끝나지 않았으면' 처럼 반대 조건을 만들 때 씁니다.",
    example: { title: "끝나지 않았으면 출력하기", code: 'done = False\nif not done:\n    print("not yet")' },
  },
  logic_boolean: {
    concept: "참(True) 또는 거짓(False) 값 하나예요. 변수에 켜짐·꺼짐 같은 상태를 담거나, 조건 칸에 넣어 언제나 참인 조건을 만들 때 씁니다.",
    example: { title: "상태를 변수에 담기", code: 'light_on = True\nif light_on:\n    print("on")' },
  },

  judge_between: {
    concept: "값이 두 수 사이에 있는지 따져서 참이나 거짓을 만들어요. 코드로는 10 <= d <= 30 이고, 끝 값 10 과 30 도 사이에 들어갑니다. d >= 10 and d <= 30 과 같은 뜻을 블록 하나로 쓸 수 있어요.",
    example: {
      title: "적당한 거리(10~30cm)면 LED 켜기",
      code: `led = Pin(26, Pin.OUT)\n${ULTRASONIC_SETUP}while True:\n    d = get_distance()\n    if 10 <= d <= 30:\n        led.value(1)\n    else:\n        led.value(0)\n    time.sleep(0.2)`,
    },
    tips: [
      "작은 수를 앞 칸(부터), 큰 수를 뒤 칸에 넣어요. 거꾸로 넣으면 언제나 거짓이에요.",
      "코드에서 10 <= d < 30 처럼 < 가 섞이면 이 블록이 아니라 식 블록이 돼요. 끝 값을 빼고 싶으면 비교 블록 두 개를 '그리고' 로 이어요.",
    ],
  },
  judge_contains: {
    concept: "글자나 리스트 안에 어떤 값이 들어 있는지 따져요. 코드로는 \"jun\" in names 처럼 in 을 쓰고, 들어 있으면 참이에요. '아니다' 블록으로 감싸면 \"jun\" not in names 가 됩니다.",
    example: {
      title: "출석부에 이름이 있는지 보기",
      code: 'names = ["mina", "jun", "sora"]\nif "jun" in names:\n    print("here")\nelse:\n    print("absent")',
    },
    tips: [
      "글자에서는 \"ell\" in \"hello\" 처럼 이어진 글자 묶음도 찾을 수 있어요.",
      "대문자와 소문자는 다른 글자예요. \"A\" in \"apple\" 은 거짓이에요.",
    ],
  },

  // 계산
  math_number: {
    concept: "숫자 하나를 나타내요. 정수(3)도, 소수(0.5)도, 음수(-1)도 쓸 수 있습니다. 기다리는 시간, 반복 횟수, 비교할 기준값처럼 숫자가 필요한 칸에 끼워요.",
    example: { title: "숫자 출력하기", code: "print(42)\nprint(0.5)" },
  },
  text: {
    concept: "글자(문자열)를 나타내요. 코드에서는 큰따옴표로 감싸서 \"hello\" 처럼 씁니다. 출력하거나 화면에 보여 줄 말을 담을 때 써요.",
    example: { title: "글자 출력하기", code: 'print("Hello ESP32")' },
    tips: ["OLED·LCD 화면은 한글을 보여 주지 못해요. 화면에 띄울 글은 영어로 적어요."],
  },
  calc_arith: {
    concept: "두 수로 계산해요. +, -, ×(*), ÷(/) 말고도 // 는 나눈 몫(정수), % 는 나머지, ^ 는 거듭제곱을 구합니다. 예를 들어 7 // 2 는 3, 7 % 2 는 1 이고, 2 ^ 3 은 2 를 세 번 곱한 8 이에요.",
    example: { title: "몫과 나머지, 거듭제곱 구하기", code: "a = 7\nb = 2\nprint(a + b)\nprint(a // b)\nprint(a % b)\nprint(a ** b)" },
    tips: [
      "/ 로 나누면 7 / 2 가 3.5 처럼 소수가 나와요.",
      "^ 를 고르면 코드에는 ** 로 적혀요. 파이썬 코드에서 ^ 는 거듭제곱이 아니라 전혀 다른 계산이에요.",
    ],
  },
  calc_paren: {
    concept: "괄호 안의 값을 먼저 계산해요. 파이썬도 수학처럼 곱셈·나눗셈을 덧셈보다 먼저 하므로, (a + b) / 2 처럼 괄호로 계산 순서를 정합니다. 이 블록으로 넣은 괄호는 코드에도 그대로 남아요.",
    example: { title: "두 수의 평균 구하기", code: "a = 3\nb = 7\navg = (a + b) / 2\nprint(avg)" },
    tips: [
      "계산 순서에 꼭 필요한 괄호는 이 블록 없이도 코드에 저절로 붙어요. 이 블록은 괄호를 눈에 보이게 하고 싶을 때 써요.",
      "코드에 적은 괄호는 블록으로 바꿔도 이 블록이 되어 그대로 남아요.",
    ],
  },
  calc_concat: {
    concept: "두 글자를 하나로 이어 붙여요. 코드로는 \"count: \" + \"3\" 처럼 + 로 잇습니다. 숫자를 붙이려면 먼저 '글자로' 블록으로 바꿔야 해요.",
    example: { title: "이름표와 값을 이어 출력하기", code: 'count = 3\nprint("count: " + str(count))' },
  },
  calc_str: {
    concept: "숫자 같은 값을 글자로 바꿔요. 코드로는 str(값) 입니다. 숫자를 다른 글자와 이어 붙이거나 화면에 글로 보여 줄 때 필요해요.",
    example: { title: "거리를 글자로 바꿔 출력하기", code: 'distance = 25\nprint("distance " + str(distance))' },
  },
  calc_int: {
    concept: "값을 정수로 바꾸고 소수점 아래는 버려요. 코드로는 int(값) 이라서 int(3.7) 은 3 이 됩니다. 계산 결과를 깔끔한 정수로 만들 때 씁니다.",
    example: { title: "소수를 정수로 바꾸기", code: "volt = 2.75\nprint(int(volt))" },
  },
  calc_random: {
    concept: "두 수 사이에서 정수 하나를 아무렇게나 골라요. 코드로는 random.randint(1, 6) 이고, 끝 값 1 과 6 도 나올 수 있습니다. 주사위처럼 매번 다른 값이 필요할 때 씁니다.",
    example: {
      title: "버튼을 누르면 주사위 굴리기",
      code: "button = Pin(14, Pin.IN, Pin.PULL_UP)\nwhile True:\n    if button.value() == 0:\n        dice = random.randint(1, 6)\n        print(dice)\n        time.sleep(0.5)",
    },
    tips: [
      "작은 수를 앞 칸에 넣어요. random.randint(6, 1) 처럼 거꾸로 쓰면 오류가 나요.",
      "이 블록을 쓰면 코드 맨 위에 import random 이 저절로 붙어요.",
    ],
  },
  calc_round: {
    concept: "수를 반올림·내림·올림하거나 절댓값·제곱근을 구해요. 코드로는 round(x), math.floor(x), math.ceil(x), abs(x), math.sqrt(x) 입니다. 내림·올림·제곱근을 고르면 import math 가 저절로 붙어요.",
    example: {
      title: "가변저항 전압을 반올림·내림해서 보기",
      code: `${adcSetup("knob")}\nwhile True:\n    volt = knob.read() * 3.3 / 4095\n    print(round(volt))\n    print(math.floor(volt))\n    time.sleep(0.5)`,
    },
    tips: [
      "파이썬의 round 는 딱 반일 때 짝수 쪽으로 가요. round(2.5) 는 2, round(3.5) 는 4 예요.",
      "절댓값은 -5 를 5 로 만들어요. 두 값이 얼마나 차이 나는지 볼 때 abs(a - b) 처럼 써요.",
      "음수의 제곱근은 구할 수 없어서 오류가 나요.",
    ],
  },
  calc_minmax: {
    concept: "두 수 중에서 큰 수나 작은 수를 골라요. 코드로는 max(a, b) 와 min(a, b) 입니다. min(speed, 100) 처럼 쓰면 값이 100 을 넘지 않게 막을 수 있어요.",
    example: {
      title: "주사위 5번 중 가장 큰 수 기억하기",
      code: "best = 0\nfor i in range(5):\n    dice = random.randint(1, 6)\n    print(dice)\n    best = max(best, dice)\nprint(best)",
    },
    tips: [
      "세 수 중에서 고르려면 블록 칸에 이 블록을 하나 더 끼워요.",
      "코드에 max(a, b, c) 처럼 세 개를 한 번에 쓰면 식 블록이 돼요.",
    ],
  },
  calc_len: {
    concept: "글자의 글자 수나 리스트의 항목 수를 세요. 코드로는 len(values) 입니다. 빈 글자와 빈 리스트의 길이는 0 이에요.",
    example: {
      title: "센서 값이 5개 모일 때까지 읽기",
      code: `${adcSetup("knob")}\nvalues = []\nwhile len(values) < 5:\n    values.append(knob.read())\n    time.sleep(0.2)\nprint(values)`,
    },
    tips: ["마지막 항목의 번호는 길이보다 1 작아요. 항목이 5개면 마지막은 4번이에요 (0부터)."],
  },
  calc_item: {
    concept: "글자나 리스트에서 몇 번째 항목을 꺼내요. 코드로는 names[0] 처럼 대괄호 안에 번호를 쓰고, 번호는 0부터 셉니다. 그래서 첫 번째 항목은 0번, 두 번째 항목은 1번이에요.",
    example: { title: "오늘의 당번 뽑기", code: 'names = ["mina", "jun", "sora"]\nn = random.randint(0, 2)\nprint(names[n])' },
    tips: [
      "블록의 '(0부터)' 는 번호를 0부터 센다는 뜻이에요. 항목이 3개면 쓸 수 있는 번호는 0, 1, 2 예요.",
      "없는 번호를 쓰면 IndexError 오류가 나요.",
      "번호에 -1 을 넣으면 맨 마지막 항목을 꺼내요.",
    ],
  },
  calc_ticks: {
    concept: "보드가 켜진 뒤 지난 시간을 밀리초(1000분의 1초)로 알려 줘요. 코드로는 time.ticks_ms() 입니다. 시작할 때 값을 변수에 적어 두고 나중 값에서 빼면 걸린 시간을 알 수 있어요.",
    example: {
      title: "반응 속도 재기: LED 가 켜지면 버튼 누르기",
      code: "led = Pin(26, Pin.OUT)\nbutton = Pin(14, Pin.IN, Pin.PULL_UP)\ntime.sleep(random.randint(2, 5))\nled.value(1)\nstart = time.ticks_ms()\nwhile button.value() == 1:\n    time.sleep_ms(1)\nprint(time.ticks_ms() - start)\nled.value(0)",
    },
    tips: [
      "1000 이 1초예요. 초로 보려면 걸린 시간을 1000 으로 나눠요.",
      "보드를 며칠 동안 켜 두면 값이 다시 작은 수로 돌아가요. 몇 분 정도 재는 데는 그냥 빼도 괜찮아요.",
    ],
  },
  calc_elapsed: {
    concept: "시작 시각부터 지금까지 지난 시간을 밀리초로 알려 줘요. 시작할 때 '지금까지 지난 시간' 값을 변수에 넣어 두고 그 변수를 이 블록에 끼우면 됩니다. 코드로는 time.ticks_diff(time.ticks_ms(), start) 예요.",
    example: {
      title: "버튼을 누를 때까지 걸린 시간 재기",
      code: "button = Pin(14, Pin.IN, Pin.PULL_UP)\nstart = time.ticks_ms()\nwhile button.value() == 1:\n    time.sleep_ms(1)\nprint(time.ticks_diff(time.ticks_ms(), start))",
    },
    tips: [
      "1000 이 1초예요. 반응 속도 게임이나 '3초 동안 누르기' 같은 시간 재기에 써요.",
      "그냥 빼도 되지만, ticks_diff 는 보드를 오래 켜 두어 시간 값이 다시 작은 수로 돌아가도 바르게 계산해요.",
    ],
  },
  calc_map: {
    concept: "한 범위의 값을 같은 비율로 다른 범위의 값으로 바꿔요. 0~4095 인 가변저항 값을 0~100 으로 바꾸면 퍼센트가 되고, 0~180 으로 바꾸면 서보 각도가 됩니다. 아두이노의 map() 과 같은 일을 하고, 결과는 정수예요.",
    example: {
      title: "가변저항 값을 0~100 으로 바꾸기",
      code: "knob = ADC(Pin(39))\nknob.atten(ADC.ATTN_11DB)\nknob.width(ADC.WIDTH_12BIT)\nwhile True:\n    percent = ((knob.read() - 0) * (100 - 0) // (4095 - 0) + 0)\n    print(percent)\n    time.sleep(0.2)",
    },
    tips: [
      "코드로는 ((값 - A) * (D - C) // (B - A) + C) 로 바뀌어요. A~B 는 원래 범위, C~D 는 바꿀 범위예요.",
      "C 를 D 보다 크게 적으면 거꾸로 바뀌어요. 0~4095 를 180~0 으로 바꾸면 손잡이를 돌릴 때 서보가 반대로 돌아요.",
    ],
  },

  // 변수
  variables_set: {
    concept: "변수에 값을 넣어요. count = 0 처럼 왼쪽은 변수 이름, 오른쪽은 넣을 값입니다. 이미 값이 있으면 새 값으로 바뀌고, count = count + 1 처럼 자기 값을 써서 늘릴 수도 있어요.",
    example: { title: "1초마다 하나씩 세기", code: "count = 0\nwhile True:\n    count = count + 1\n    print(count)\n    time.sleep(1)" },
    tips: ["변수 이름은 영어·숫자·밑줄(_)로 짓고, 숫자로 시작하면 안 돼요."],
  },
  variables_get: {
    concept: "변수에 넣어 둔 값을 꺼내 써요. 코드에서는 변수 이름만 쓰면 그 안의 값이 됩니다. 계산·비교·출력 칸 어디에나 끼울 수 있어요.",
    example: { title: "변수 값으로 계산하기", code: "speed = 3\nprint(speed * 2)" },
  },

  var_change: {
    concept: "변수의 값에 수를 더해서 바꿔요. 코드로는 count += 1 이고 count = count + 1 과 뜻이 같습니다. -1 처럼 음수를 넣으면 그만큼 줄어들어요.",
    example: {
      title: "버튼 누른 횟수 세기",
      code: "button = Pin(14, Pin.IN, Pin.PULL_UP)\ncount = 0\nwhile True:\n    if button.value() == 0:\n        count += 1\n        print(count)\n        time.sleep(0.3)",
    },
    tips: [
      "바꾸기 전에 '정하기' 블록으로 처음 값을 꼭 넣어 두어요. 값이 없는 변수는 바꿀 수 없어요.",
      "버튼 한 번에 여러 번 세어지면 바꾼 다음 잠깐 기다려요.",
      "코드의 count -= 1 은 이 블록이 아니라 코드 블록이 돼요. 줄일 때는 -1 만큼 바꾸기를 써요.",
    ],
  },
  var_global: {
    concept: "함수 안에서 바깥(함수 밖)에 만든 변수의 값을 바꾸겠다고 알려요. 코드로는 global count 입니다. 이 블록이 없으면 함수 안의 count 는 그 함수만의 새 변수가 되어, count += 1 에서 UnboundLocalError 가 나요.",
    example: {
      title: "버튼 인터럽트로 누른 횟수 세기",
      code: "count = 0\n\ndef on_press(pin):\n    global count\n    count += 1\n\nbutton = Pin(14, Pin.IN, Pin.PULL_UP)\nbutton.irq(trigger=Pin.IRQ_FALLING, handler=on_press)\nwhile True:\n    print(count)\n    time.sleep(1)",
    },
    tips: [
      "함수 블록 안, 몸통 맨 위에 두어요. 함수 밖에서는 쓸 수 없어요.",
      "값을 읽기만 할 때는 필요 없어요. 정하기·만큼 바꾸기로 바깥 변수의 값을 바꿀 때만 써요.",
      "바꿀 변수가 둘이면 블록도 두 개 놓아요. 코드의 global a, b 는 블록 두 개가 돼요.",
    ],
  },

  // 리스트
  list_create: {
    concept: "항목이 하나도 없는 빈 리스트를 만들어요. 코드로는 values = [] 입니다. 처음에는 비워 두고 추가하기 블록으로 값을 하나씩 모을 때 씁니다.",
    example: {
      title: "센서 값 5개 모아 평균 내기",
      code: `${adcSetup("knob")}\nvalues = []\nfor i in range(5):\n    values.append(knob.read())\n    time.sleep(0.2)\ntotal = 0\nfor v in values:\n    total += v\nprint(total / len(values))`,
    },
    tips: [
      "반복 안에서 빈 리스트를 만들면 반복할 때마다 다시 비워져요. 모으기 전에 한 번만 만들어요.",
      "리스트 이름도 변수 이름처럼 영어로 지어요. values, names 처럼 끝에 s 를 붙이면 여러 개가 든 것을 알아보기 쉬워요.",
    ],
  },
  list_create_from: {
    concept: "처음부터 항목을 넣어 리스트를 만들어요. 칸에 80, 95, 70 처럼 쉼표로 나눠 적으면 코드로는 scores = [80, 95, 70] 이 됩니다. 글자 항목은 \"mina\" 처럼 큰따옴표로 감싸요.",
    example: { title: "점수 리스트의 합 구하기", code: "scores = [80, 95, 70]\ntotal = 0\nfor s in scores:\n    total += s\nprint(total)" },
    tips: [
      "칸에 적은 글이 대괄호 안에 그대로 들어가요. 쉼표를 빠뜨리지 않게 조심해요.",
      "글자 항목에 따옴표를 빼먹으면 변수 이름으로 읽혀서 NameError 오류가 나요.",
    ],
  },
  list_append: {
    concept: "리스트 맨 끝에 항목을 하나 붙여요. 코드로는 values.append(3) 이고, 붙일 때마다 리스트 길이가 1 늘어납니다. 센서 값이나 이름을 하나씩 모을 때 씁니다.",
    example: {
      title: "버튼을 누를 때마다 밝기 값 모으기",
      code: `${adcSetup("light")}\nbutton = Pin(14, Pin.IN, Pin.PULL_UP)\nvalues = []\nwhile len(values) < 3:\n    if button.value() == 0:\n        values.append(light.read())\n        print(values)\n        time.sleep(0.3)`,
    },
    tips: [
      "한 번에 항목 하나만 붙어요. 여러 개를 붙이려면 블록을 여러 번 써요.",
      "모으기 전에 '리스트 만들기' 블록으로 리스트를 먼저 만들어 두어요.",
    ],
  },
  list_insert: {
    concept: "리스트의 정한 자리에 항목을 끼워 넣어요. 코드로는 line.insert(0, \"sora\") 이고, 그 자리에 있던 항목부터 뒤로 한 칸씩 밀립니다. 0 번째에 넣으면 맨 앞에 들어가요.",
    example: { title: "줄 맨 앞에 새 친구 세우기", code: 'line = ["mina", "jun"]\nline.insert(0, "sora")\nprint(line)' },
    tips: [
      "번호는 (0부터) 세요. 0 은 맨 앞, 1 은 두 번째 자리예요.",
      "길이보다 큰 번호를 넣으면 오류 없이 맨 끝에 붙어요.",
    ],
  },
  list_remove_at: {
    concept: "리스트에서 몇 번째 항목을 지워요. 코드로는 values.pop(0) 이고, 뒤의 항목들이 한 칸씩 앞으로 당겨집니다. 0 번째를 지우면 가장 먼저 넣은 값이 빠져요.",
    example: {
      title: "가장 최근 센서 값 3개만 남기기",
      code: `${adcSetup("knob")}\nvalues = []\nwhile True:\n    values.append(knob.read())\n    if len(values) > 3:\n        values.pop(0)\n    print(values)\n    time.sleep(0.5)`,
    },
    tips: [
      "번호는 (0부터) 세요. 첫 항목은 0번이에요.",
      "없는 번호를 지우면 IndexError 오류가 나요. 빈 리스트에서 지워도 마찬가지예요.",
    ],
  },
  list_remove_value: {
    concept: "리스트에서 어떤 값을 찾아 지워요. 코드로는 names.remove(\"jun\") 이고, 같은 값이 여럿이면 맨 앞의 하나만 지웁니다. 번호가 아니라 값으로 지울 때 씁니다.",
    example: {
      title: "집에 간 친구 이름 지우기",
      code: 'names = ["mina", "jun", "sora"]\nif "jun" in names:\n    names.remove("jun")\nprint(names)',
    },
    tips: ["없는 값을 지우면 ValueError 오류가 나요. '들어 있는가' 블록으로 먼저 확인하면 안전해요."],
  },
  list_clear: {
    concept: "리스트의 항목을 모두 지워 빈 리스트로 만들어요. 코드로는 values.clear() 입니다. 리스트 변수는 그대로 남아서 다시 항목을 모을 수 있어요.",
    example: {
      title: "센서 값 5개씩 모아 보여 주고 다시 모으기",
      code: `${adcSetup("knob")}\nvalues = []\nwhile True:\n    values.append(knob.read())\n    if len(values) == 5:\n        print(values)\n        values.clear()\n    time.sleep(0.2)`,
    },
    tips: ["비운 뒤의 길이는 0 이에요. 길이 블록으로 비었는지 확인할 수 있어요."],
  },
  list_set: {
    concept: "리스트의 몇 번째 항목을 새 값으로 바꿔요. 코드로는 scores[2] = 75 입니다. 리스트 길이는 그대로이고 그 자리의 값만 바뀌어요.",
    example: { title: "세 번째 점수 고치기", code: "scores = [80, 95, 70]\nscores[2] = 75\nprint(scores)" },
    tips: [
      "번호는 (0부터) 세요. 세 번째 항목은 2번이에요.",
      "없는 번호에 값을 넣으면 IndexError 오류가 나요. 새 항목은 추가하기 블록으로 붙여요.",
    ],
  },
  list_reversed: {
    concept: "리스트의 항목을 뒤에서부터 차례로 꺼내요. 코드로는 reversed(pins) 이고, 각 항목 반복에 끼우면 맨 뒤 항목부터 거꾸로 돕니다. 원래 리스트의 순서는 바뀌지 않아요.",
    example: {
      title: "핀 번호를 뒤에서부터 찍기",
      code: "pins = [18, 5, 14, 17, 26]\nfor pin in reversed(pins):\n    print(pin)",
    },
    tips: ["거꾸로 꺼낸 것은 반복에 바로 쓰는 값이에요. 길이를 재거나 번째 항목을 찾을 때는 원래 리스트를 써요."],
  },
  list_index: {
    concept: "리스트에서 어떤 값이 몇 번째에 있는지 찾아 알려 줘요. 코드로는 names.index(\"sora\") 이고, 같은 값이 여럿이면 맨 앞의 번호를 알려 줍니다. 결과 번호도 0부터 세요.",
    example: { title: "친구가 줄의 몇 번째에 섰는지 찾기", code: 'names = ["mina", "jun", "sora"]\nprint(names.index("sora"))' },
    tips: [
      "결과는 (0부터) 센 번호예요. 맨 앞이면 0 이 나와요.",
      "없는 값을 찾으면 ValueError 오류가 나요. '들어 있는가' 블록으로 먼저 확인해요.",
    ],
  },

  // 함수
  procedures_defnoreturn: {
    concept: "여러 블록을 하나로 묶고 이름을 붙여 함수로 만들어요. 코드로는 def 이름(): 이고, 정의만 해서는 실행되지 않으며 함수 호출 블록으로 불러야 실행됩니다. 같은 일을 여러 번 할 때 코드가 짧아져요.",
    example: {
      title: "깜빡이기 함수를 만들어 두 번 부르기",
      code: "led = Pin(26, Pin.OUT)\n\n\ndef blink():\n    led.value(1)\n    time.sleep(0.5)\n    led.value(0)\n    time.sleep(0.5)\n\n\nblink()\nblink()",
    },
    tips: ["함수 이름은 영어·숫자·밑줄(_)로 지어요."],
  },
  procedures_defreturn: {
    concept: "계산한 값을 돌려주는 함수를 만들어요. 코드로는 def 이름(): 안에 return 값 이 들어가고, 부르면 그 값이 식처럼 쓰입니다. 매개변수를 두면 부를 때마다 다른 값을 넣어 계산할 수 있어요.",
    example: { title: "두 배를 돌려주는 함수", code: "def double(n):\n    return n * 2\n\n\nprint(double(5))" },
  },
  procedures_callnoreturn: {
    concept: "정의해 둔 함수를 실행해요. 코드로는 hello() 처럼 함수 이름 뒤에 괄호를 붙입니다. 함수에 매개변수가 있으면 괄호 안에 넣을 값을 함께 보내요.",
    example: { title: "인사 함수를 두 번 부르기", code: 'def hello():\n    print("hello")\n\n\nhello()\nhello()' },
  },
  procedures_callreturn: {
    concept: "값을 돌려주는 함수를 실행하고 그 결과를 받아요. 숫자나 글자처럼 값이 들어가는 칸에 끼워 쓰고, 코드로는 add(2, 3) 처럼 식이 됩니다.",
    example: { title: "더한 값을 받아 출력하기", code: "def add(a, b):\n    return a + b\n\n\nresult = add(2, 3)\nprint(result)" },
  },

  // 코드
  code_stmt: {
    concept: "블록으로 바꾸지 못한 파이썬 코드를 그대로 담아요. 코드를 블록으로 불러올 때 블록이 모르는 꼴이 있으면 이 블록이 생깁니다. 한 줄도, 여러 줄도 담을 수 있어요.",
    example: { title: "오류를 잡는 try 문은 코드 블록이 돼요", code: "try:\n    print(10 // 0)\nexcept ZeroDivisionError:\n    print(\"0 으로 나눌 수 없어요\")" },
    tips: ["안의 글을 고치면 그대로 코드가 돼요. 들여쓰기를 잘 맞춰 주세요."],
  },
  code_expr: {
    concept: "블록으로 바꾸지 못한 식(값)을 그대로 담아요. 값이 들어가는 칸에 끼울 수 있고, 안에 적은 글이 그대로 코드의 식이 됩니다.",
    example: { title: "세 수의 max 처럼 블록에 없는 꼴은 식 블록이 돼요", code: "print(max(3, 7, 5))" },
  },
};
