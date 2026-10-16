from machine import Pin, PWM, ADC
import time

red = PWM(Pin(27))  # RGB LED 빨강 27, 초록 25, 파랑 26
green = PWM(Pin(25))
blue = PWM(Pin(26))
red.freq(1000)
green.freq(1000)
blue.freq(1000)
knob = ADC(Pin(39))  # 가변저항 가운데 다리 → 39번
knob.atten(ADC.ATTN_11DB)
knob.width(ADC.WIDTH_12BIT)


def set_color(r, g, b):
    red.duty(r * 1023 // 255)
    green.duty(g * 1023 // 255)
    blue.duty(b * 1023 // 255)


while True:
    value = knob.read()  # 손잡이 값 0~4095
    if value < 800:  # 0~799: 빨강
        set_color(255, 0, 0)
    elif value < 1600:
        set_color(0, 255, 0)  # 800~1599: 초록
    elif value < 2400:
        set_color(0, 0, 255)  # 1600~2399: 파랑
    elif value < 3200:
        set_color(255, 0, 255)  # 2400~3199: 보라
    else:
        set_color(255, 255, 255)  # 3200~4095: 흰색
    time.sleep_ms(50)
