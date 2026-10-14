import type { BlockContent } from "../types";

/** 아날로그 센서 준비 3줄 (조도·가변저항·소리·불꽃: 이름만 다르다) */
const adcSetup = (name: string) => `${name} = ADC(Pin(36))\n${name}.atten(ADC.ATTN_11DB)\n${name}.width(ADC.WIDTH_12BIT)`;

const NTC_SETUP = [
  adcSetup("ntc"),
  "", "",
  "def ntc_temperature():",
  "    v = ntc.read() / 4095 * 3.3",
  "    r = 10 * v / (3.3 - v)",
  "    return 1 / (math.log(r / 10) / 3950 + 1 / 298.15) - 273.15",
  "", "",
].join("\n");

const LM35_SETUP = [adcSetup("lm35"), "", "", "def lm35_temperature():", "    return lm35.read() * 330 / 4095", "", ""].join("\n");

const ULTRASONIC_SETUP = [
  "trig = Pin(13, Pin.OUT)", "echo = Pin(12, Pin.IN)",
  "", "",
  "def get_distance():",
  "    trig.value(1)", "    time.sleep_us(10)", "    trig.value(0)",
  "    while not echo.value():", "        pass",
  "    start = time.ticks_us()",
  "    while echo.value():", "        pass",
  "    stop = time.ticks_us()",
  "    t = time.ticks_diff(stop, start) // 2",
  "    return int(340 * t // 10000)",
  "", "",
].join("\n");

const DHT_SETUP = "dht11 = dht.DHT11(Pin(13))";

const ADC_TIP = "아날로그로 읽을 수 있는 핀에만 연결해요. 36·39·34·35·32·33번 핀이 쓰기 좋아요.";
const ADC_BACK_TIP = "코드를 블록으로 바꿀 때 변수 이름이 센서 이름(light, knob, sound, flame)으로 시작해야 이 센서 블록으로 돌아와요. 다른 이름이면 아날로그 핀 블록이 돼요.";

/** 센서 카테고리 블록 설명 (src/devices/specs/sensor.ts) */
export const sensorContent: Record<string, BlockContent> = {
  dev_light_setup: {
    concept: "조도(빛) 센서를 아날로그 핀에 준비하고 이름을 붙여요. 주변 밝기에 따라 바뀌는 전압을 0~4095 수로 읽습니다. 값은 '값 (0~4095)' 블록으로 읽고, 코드로는 light.read() 예요.",
    example: { title: "밝기 값 계속 출력하기", code: `${adcSetup("light")}\nwhile True:\n    print(light.read())\n    time.sleep(0.5)` },
    tips: [ADC_TIP, "손으로 센서를 가렸을 때와 비췄을 때 값을 먼저 출력해 보고, 어느 쪽이 큰지 확인한 다음 기준 값을 정해요.", ADC_BACK_TIP],
  },
  dev_knob_setup: {
    concept: "가변저항(돌리는 손잡이)을 아날로그 핀에 준비하고 이름을 붙여요. 손잡이를 끝까지 한쪽으로 돌리면 0 에, 반대쪽으로 돌리면 4095 에 가까운 값이 나옵니다. 코드로는 knob.read() 로 읽어요.",
    example: {
      title: "손잡이를 많이 돌리면 알려 주기",
      code: `${adcSetup("knob")}\nwhile True:\n    if knob.read() > 2000:\n        print("high")\n    else:\n        print("low")\n    time.sleep(0.5)`,
    },
    tips: [ADC_TIP, ADC_BACK_TIP],
  },
  dev_sound_setup: {
    concept: "소리 센서를 아날로그 핀에 준비하고 이름을 붙여요. 마이크가 받은 소리의 크기를 0~4095 수로 읽어서, 손뼉 소리처럼 큰 소리가 났는지 알아낼 때 씁니다. 코드로는 sound.read() 로 읽어요.",
    example: {
      title: "큰 소리가 나면 출력하기",
      code: `${adcSetup("sound")}\nwhile True:\n    if sound.read() > 2000:\n        print("loud")\n    time.sleep(0.1)`,
    },
    tips: [ADC_TIP, "조용할 때 값과 소리 낼 때 값을 먼저 출력해 보고, 그 사이 값으로 기준(예시의 2000)을 정해요.", "소리는 아주 짧게 지나가니 기다리는 시간을 짧게(0.1초쯤) 두고 자주 읽어요.", ADC_BACK_TIP],
  },
  dev_flame_setup: {
    concept: "불꽃 센서를 아날로그 핀에 준비하고 이름을 붙여요. 불꽃에서 나오는 적외선의 세기를 0~4095 수로 읽습니다. 코드로는 flame.read() 로 읽어요.",
    example: { title: "불꽃 센서 값 출력하기", code: `${adcSetup("flame")}\nwhile True:\n    print(flame.read())\n    time.sleep(0.5)` },
    tips: [ADC_TIP, "라이터를 가까이 댔을 때와 멀리 했을 때 값을 먼저 출력해 보고 기준 값을 정해요. 불은 꼭 선생님과 함께 다뤄요.", ADC_BACK_TIP],
  },
  dev_light_value: {
    concept: "조도 센서가 지금 읽은 밝기를 0~4095 수로 알려 줘요. 코드로는 light.read() 이고, 어두우면 작은 값·밝으면 큰 값(모듈에 따라 반대)이 나옵니다. 만약 블록의 비교 칸에 끼워 기준보다 큰지 작은지 판단해요.",
    example: { title: "어두워지면 알려 주기", code: `${adcSetup("light")}\nwhile True:\n    if light.read() < 1000:\n        print("dark")\n    time.sleep(0.5)` },
    tips: ["먼저 조도 센서 준비 블록이 있어야 해요.", "값이 어느 쪽으로 커지는지 먼저 출력해 보고 기준을 정해요."],
  },
  dev_knob_value: {
    concept: "가변저항 손잡이의 위치를 0~4095 수로 알려 줘요. 코드로는 knob.read() 예요. 밝기나 속도처럼 단계가 있는 값을 손으로 조절할 때 계산 블록으로 비율을 바꿔 씁니다.",
    example: { title: "손잡이로 LED 밝기 조절하기", code: `led = PWM(Pin(26))\nled.freq(1000)\n${adcSetup("knob")}\nwhile True:\n    led.duty(knob.read() // 4)\n    time.sleep(0.05)` },
    tips: ["먼저 가변저항 준비 블록이 있어야 해요.", "0~4095 를 0~1023 로 줄이려면 4 로 나눠요 (몫 //)."],
  },
  dev_sound_value: {
    concept: "소리 센서가 받은 소리 크기를 0~4095 수로 알려 줘요. 코드로는 sound.read() 예요. 손뼉처럼 짧은 소리는 금방 지나가니 짧은 간격으로 자주 읽어야 잡힙니다.",
    example: { title: "손뼉 치면 켜기", code: `led = Pin(26, Pin.OUT)\n${adcSetup("sound")}\nwhile True:\n    if sound.read() > 2000:\n        led.value(1)\n        time.sleep(1)\n        led.value(0)\n    time.sleep(0.05)` },
    tips: ["먼저 소리 센서 준비 블록이 있어야 해요.", "조용할 때 값을 먼저 출력해 보고 그보다 넉넉히 큰 수를 기준으로 해요."],
  },
  dev_flame_value: {
    concept: "불꽃 센서가 받은 적외선 세기를 0~4095 수로 알려 줘요. 코드로는 flame.read() 예요. 불꽃이 가까울수록 값이 한쪽으로 치우치니, 기준보다 넘으면 경고를 내는 식으로 씁니다.",
    example: { title: "불꽃이 감지되면 경고 출력", code: `${adcSetup("flame")}\nwhile True:\n    if flame.read() > 3000:\n        print("fire!")\n    time.sleep(0.2)` },
    tips: ["먼저 불꽃 센서 준비 블록이 있어야 해요.", "불은 꼭 선생님과 함께 다뤄요."],
  },
  dev_ntc_setup: {
    concept: "서미스터(온도에 따라 저항이 바뀌는 부품)를 아날로그 핀에 준비해요. 읽은 값을 저항으로, 저항을 다시 온도(℃)로 바꾸는 ntc_temperature() 함수도 함께 만들어집니다. 이름은 ntc 로 정해져 있어요.",
    example: { title: "온도를 1초마다 출력하기", code: `${NTC_SETUP}while True:\n    print(ntc_temperature())\n    time.sleep(1)` },
    tips: [ADC_TIP, "10kΩ 서미스터(B 값 3950)와 10kΩ 저항을 함께 연결한 회로에 맞춘 계산이에요."],
  },
  dev_ntc_temp: {
    concept: "서미스터로 잰 지금 온도를 ℃ 로 알려 줘요. 코드로는 ntc_temperature() 이고, 25.3 처럼 소수가 나옵니다. 출력하거나 만약 블록의 비교에 끼워 써요.",
    example: {
      title: "30℃ 가 넘으면 알려 주기",
      code: `${NTC_SETUP}while True:\n    if ntc_temperature() > 30:\n        print("hot")\n    time.sleep(1)`,
    },
    tips: ["먼저 서미스터 준비 블록이 있어야 해요."],
  },
  dev_lm35_setup: {
    concept: "LM35 온도 센서를 아날로그 핀에 준비해요. LM35 는 1℃ 마다 10mV 씩 높은 전압을 내보내서, 읽은 값을 그대로 온도로 바꿀 수 있습니다. 온도를 돌려주는 lm35_temperature() 함수도 함께 만들어지고, 이름은 lm35 로 정해져 있어요.",
    example: { title: "온도를 1초마다 출력하기", code: `${LM35_SETUP}while True:\n    print(lm35_temperature())\n    time.sleep(1)` },
    tips: [ADC_TIP],
  },
  dev_lm35_temp: {
    concept: "LM35 로 잰 지금 온도를 ℃ 로 알려 줘요. 코드로는 lm35_temperature() 이고, 안에서 lm35.read() * 330 / 4095 를 계산합니다.",
    example: {
      title: "더우면 LED 켜기",
      code: `led = Pin(26, Pin.OUT)\n${LM35_SETUP}while True:\n    if lm35_temperature() > 28:\n        led.value(1)\n    else:\n        led.value(0)\n    time.sleep(1)`,
    },
    tips: ["먼저 LM35 준비 블록이 있어야 해요."],
  },
  esp_ultrasonic_setup: {
    concept: "초음파 거리 센서를 준비해요. trig 핀으로 짧은 초음파를 쏘고, echo 핀으로 되돌아오는 데 걸린 시간을 재서 거리(cm)로 바꾸는 get_distance() 함수가 함께 만들어집니다. 핀 이름은 trig, echo 로 정해져 있어요.",
    example: { title: "거리를 0.5초마다 출력하기", code: `${ULTRASONIC_SETUP}while True:\n    print(get_distance())\n    time.sleep(0.5)` },
    tips: ["echo 선이 빠져 있으면 get_distance() 가 메아리를 끝없이 기다려서 프로그램이 멈춘 것처럼 보여요. 선을 먼저 확인해요."],
  },
  esp_distance: {
    concept: "초음파 센서로 앞에 있는 물체까지의 거리를 cm 로 재서 알려 줘요. 코드로는 get_distance() 이고, 소리의 빠르기(초속 340m)로 왕복 시간을 거리로 바꿉니다. 출력하거나 만약 블록의 비교에 끼워 써요.",
    example: {
      title: "가까이 오면 LED 켜기",
      code: `led = Pin(26, Pin.OUT)\n${ULTRASONIC_SETUP}while True:\n    if get_distance() < 10:\n        led.value(1)\n    else:\n        led.value(0)\n    time.sleep(0.2)`,
    },
    tips: ["먼저 초음파 센서 준비 블록이 있어야 해요.", "2cm 보다 가깝거나 아주 먼 물체는 잘 재지 못해요. 결과는 소수점 없는 정수예요."],
  },
  dev_dht_setup: {
    concept: "DHT11 온습도 센서를 핀 하나에 준비하고 이름을 붙여요. 한 선으로 센서와 신호를 주고받으며 온도와 습도를 함께 잽니다. 코드로는 dht11 = dht.DHT11(Pin(13)) 이에요.",
    example: {
      title: "온도와 습도 출력하기",
      code: `${DHT_SETUP}\nwhile True:\n    dht11.measure()\n    print(dht11.temperature())\n    print(dht11.humidity())\n    time.sleep(2)`,
    },
    tips: ["DHT11 은 1~2초에 한 번만 잴 수 있어요. 반복 안에 2초쯤 기다리기를 꼭 넣어요."],
  },
  dev_dht_measure: {
    concept: "DHT11 센서에게 온도와 습도를 지금 새로 재라고 시켜요. 코드로는 dht11.measure() 입니다. 이 블록을 먼저 해야 온도·습도 블록이 새 값을 알려 줘요.",
    example: {
      title: "2초마다 재서 온도 출력하기",
      code: `${DHT_SETUP}\nwhile True:\n    dht11.measure()\n    print(dht11.temperature())\n    time.sleep(2)`,
    },
    tips: ["너무 자주 재면 오류(OSError)가 나요. 측정 사이에 2초쯤 기다려요.", "센서 선이 빠져 있어도 OSError 가 나요."],
  },
  dev_dht_temp: {
    concept: "DHT11 이 마지막으로 잰 온도를 ℃ 로 알려 줘요. 코드로는 dht11.temperature() 이고, DHT11 은 0~50℃ 를 정수로 잽니다.",
    example: {
      title: "28℃ 가 넘으면 알려 주기",
      code: `${DHT_SETUP}\nwhile True:\n    dht11.measure()\n    if dht11.temperature() > 28:\n        print("hot")\n    time.sleep(2)`,
    },
    tips: ["먼저 측정하기 블록을 해야 새 온도가 나와요."],
  },
  dev_dht_hum: {
    concept: "DHT11 이 마지막으로 잰 습도(공기 속 물기의 정도)를 % 로 알려 줘요. 코드로는 dht11.humidity() 이고, 20~90% 사이를 정수로 잽니다.",
    example: {
      title: "습도가 높으면 알려 주기",
      code: `${DHT_SETUP}\nwhile True:\n    dht11.measure()\n    if dht11.humidity() > 70:\n        print("humid")\n    time.sleep(2)`,
    },
    tips: ["먼저 측정하기 블록을 해야 새 습도가 나와요."],
  },
};
