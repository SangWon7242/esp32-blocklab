import type { BlockContent } from "../types";

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

  // TODO(plan6 task3): 아래 flow_for_range·flow_for_each·flow_break·flow_continue 설명은 Task 3 가 다듬는다 (지금은 카탈로그 테스트를 지키는 최소 내용)
  flow_for_range: {
    concept: "변수를 시작 수부터 1씩 늘리며 안의 블록을 반복해요. 코드로는 for x in range(0, 5): 이고, 끝 수(5)는 들어가지 않습니다. 그래서 x 는 0, 1, 2, 3, 4 가 돼요.",
    example: { title: "1부터 5까지 출력하기", code: "for x in range(1, 6):\n    print(x)" },
  },
  flow_for_each: {
    concept: "리스트의 항목을 앞에서부터 하나씩 변수에 넣으며 반복해요. 코드로는 for item in items: 입니다. 글자를 넣으면 한 글자씩 반복해요.",
    example: { title: "리스트의 항목 하나씩 출력하기", code: "items = [3, 5, 7]\nfor item in items:\n    print(item)" },
  },
  flow_break: {
    concept: "지금 도는 반복을 바로 끝내요. 코드로는 break 입니다. 반복 다음 블록부터 이어서 실행됩니다.",
    example: { title: "5 가 되면 반복 멈추기", code: "for x in range(0, 10):\n    if x == 5:\n        break\n    print(x)" },
  },
  flow_continue: {
    concept: "이번 반복의 남은 블록을 건너뛰고 다음 반복으로 가요. 코드로는 continue 입니다. 반복을 끝내지는 않아요.",
    example: { title: "3 만 빼고 출력하기", code: "for x in range(0, 6):\n    if x == 3:\n        continue\n    print(x)" },
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

  // TODO(plan6 task3): 아래 judge_* 설명은 Task 3 가 다듬는다 (지금은 카탈로그 테스트를 지키는 최소 내용)
  judge_between: {
    concept: "값이 두 수 사이에 있는지 따져요. 코드로는 10 <= d <= 30 처럼 쓰고, 두 끝 값도 사이에 들어갑니다. 거리나 온도가 알맞은 범위인지 볼 때 씁니다.",
    example: { title: "거리가 10부터 30 사이면 출력하기", code: 'd = 25\nif 10 <= d <= 30:\n    print("near")' },
  },
  judge_contains: {
    concept: "글자나 리스트 안에 어떤 값이 들어 있는지 따져요. 코드로는 \"e\" in word 처럼 in 을 씁니다. 아니다 블록으로 감싸면 not in 이 돼요.",
    example: { title: "글자에 e 가 있으면 출력하기", code: 'word = "hello"\nif "e" in word:\n    print("found")' },
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
    concept: "두 수로 계산해요. +, -, ×(*), ÷(/) 말고도 // 는 나눈 몫(정수), % 는 나머지를 구합니다. 예를 들어 7 // 2 는 3, 7 % 2 는 1 이에요.",
    example: { title: "몫과 나머지 구하기", code: "a = 7\nb = 2\nprint(a + b)\nprint(a // b)\nprint(a % b)" },
    tips: ["/ 로 나누면 7 / 2 가 3.5 처럼 소수가 나와요."],
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
  // TODO(plan6 task3): 아래 calc_* 설명은 Task 3 가 다듬는다 (지금은 카탈로그 테스트를 지키는 최소 내용)
  calc_random: {
    concept: "두 수 사이에서 정수 하나를 아무렇게나 골라요. 코드로는 random.randint(1, 6) 이고, 1 과 6 도 나올 수 있습니다. 주사위나 무작위 색처럼 매번 다른 값이 필요할 때 씁니다.",
    example: { title: "주사위 굴리기", code: "dice = random.randint(1, 6)\nprint(dice)" },
  },
  calc_round: {
    concept: "수를 반올림·내림·올림하거나 절댓값·제곱근을 구해요. 코드로는 round(x), math.floor(x), math.ceil(x), abs(x), math.sqrt(x) 입니다. math 를 쓰면 import math 가 저절로 붙어요.",
    example: { title: "소수를 반올림하고 내리기", code: "volt = 2.75\nprint(round(volt))\nprint(math.floor(volt))" },
  },
  calc_minmax: {
    concept: "두 수 중에서 큰 수나 작은 수를 골라요. 코드로는 max(a, b) 와 min(a, b) 입니다. 값이 정한 범위를 넘지 않게 막을 때도 씁니다.",
    example: { title: "두 수 중 큰 수 출력하기", code: "a = 3\nb = 7\nprint(max(a, b))" },
  },
  calc_len: {
    concept: "글자 수나 리스트의 항목 수를 세요. 코드로는 len(word) 입니다. 빈 글자의 길이는 0 이에요.",
    example: { title: "글자 수 세기", code: 'word = "hello"\nprint(len(word))' },
  },
  calc_item: {
    concept: "글자나 리스트에서 몇 번째 항목을 꺼내요. 코드로는 word[0] 처럼 쓰고, 번호는 0부터 셉니다. 그래서 첫 번째 항목은 0번이에요.",
    example: { title: "첫 글자 꺼내기", code: 'word = "hello"\nprint(word[0])' },
  },
  calc_ticks: {
    concept: "보드가 켜진 뒤 지난 시간을 밀리초로 알려 줘요. 코드로는 time.ticks_ms() 입니다. 시작할 때 값을 적어 두고 나중 값과 빼면 걸린 시간을 알 수 있어요.",
    example: { title: "1초 동안 걸린 시간 재기", code: "start = time.ticks_ms()\ntime.sleep(1)\nprint(time.ticks_ms() - start)" },
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

  // TODO(plan6 task3): 아래 var_change·list_* 설명은 Task 3 가 다듬는다 (지금은 카탈로그 테스트를 지키는 최소 내용)
  var_change: {
    concept: "변수의 값에 수를 더해 바꿔요. 코드로는 count += 1 이고 count = count + 1 과 같습니다. 음수를 넣으면 줄어들어요.",
    example: { title: "1초마다 하나씩 세기", code: "count = 0\nwhile True:\n    count += 1\n    print(count)\n    time.sleep(1)" },
  },

  // 리스트
  list_create: {
    concept: "항목이 하나도 없는 빈 리스트를 만들어요. 코드로는 items = [] 입니다. 나중에 추가하기 블록으로 항목을 넣어요.",
    example: { title: "빈 리스트에 값 넣기", code: "items = []\nitems.append(3)\nprint(items)" },
  },
  list_create_from: {
    concept: "쉼표로 나눈 항목으로 리스트를 만들어요. 코드로는 items = [1, 2, 3] 입니다. 글자 항목은 \"red\" 처럼 따옴표로 감싸요.",
    example: { title: "숫자 세 개로 리스트 만들기", code: "items = [1, 2, 3]\nprint(items)" },
  },
  list_append: {
    concept: "리스트 맨 끝에 항목을 하나 붙여요. 코드로는 items.append(4) 입니다. 센서 값을 하나씩 모을 때 씁니다.",
    example: { title: "끝에 항목 붙이기", code: "items = [1, 2, 3]\nitems.append(4)\nprint(items)" },
  },
  list_insert: {
    concept: "리스트의 정한 자리에 항목을 끼워 넣어요. 코드로는 items.insert(0, 5) 이고 번호는 0부터 셉니다. 뒤의 항목은 한 칸씩 밀려요.",
    example: { title: "맨 앞에 끼워 넣기", code: "items = [1, 2, 3]\nitems.insert(0, 5)\nprint(items)" },
  },
  list_remove_at: {
    concept: "리스트에서 몇 번째 항목을 지워요. 코드로는 items.pop(0) 이고 번호는 0부터 셉니다. 그래서 0 은 첫 항목이에요.",
    example: { title: "첫 항목 지우기", code: "items = [1, 2, 3]\nitems.pop(0)\nprint(items)" },
  },
  list_remove_value: {
    concept: "리스트에서 어떤 값을 찾아 지워요. 코드로는 items.remove(3) 이고, 같은 값이 여럿이면 앞의 하나만 지웁니다. 없는 값을 지우면 오류가 나요.",
    example: { title: "값 3 지우기", code: "items = [1, 2, 3]\nitems.remove(3)\nprint(items)" },
  },
  list_clear: {
    concept: "리스트의 항목을 모두 지워 빈 리스트로 만들어요. 코드로는 items.clear() 입니다. 리스트 변수는 그대로 남아요.",
    example: { title: "리스트 비우기", code: "items = [1, 2, 3]\nitems.clear()\nprint(items)" },
  },
  list_set: {
    concept: "리스트의 몇 번째 항목을 새 값으로 바꿔요. 코드로는 items[0] = 10 이고 번호는 0부터 셉니다. 없는 번호를 쓰면 오류가 나요.",
    example: { title: "첫 항목 바꾸기", code: "items = [1, 2, 3]\nitems[0] = 10\nprint(items)" },
  },
  list_index: {
    concept: "리스트에서 어떤 값이 몇 번째에 있는지 알려 줘요. 코드로는 items.index(3) 이고 번호는 0부터 셉니다. 없는 값을 찾으면 오류가 나요.",
    example: { title: "값 3 의 위치 찾기", code: "items = [1, 2, 3]\nprint(items.index(3))" },
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
    example: { title: "2씩 건너뛰며 세는 반복은 코드 블록이 돼요", code: "for n in range(0, 10, 2):\n    print(n)" },
    tips: ["안의 글을 고치면 그대로 코드가 돼요. 들여쓰기를 잘 맞춰 주세요."],
  },
  code_expr: {
    concept: "블록으로 바꾸지 못한 식(값)을 그대로 담아요. 값이 들어가는 칸에 끼울 수 있고, 안에 적은 글이 그대로 코드의 식이 됩니다.",
    example: { title: "세 수의 max 처럼 블록에 없는 꼴은 식 블록이 돼요", code: "print(max(3, 7, 5))" },
  },
};
