from machine import Pin, PWM, ADC
import time

red = PWM(Pin(27))
green = PWM(Pin(25))
blue = PWM(Pin(26))
red.freq(1000)
green.freq(1000)
blue.freq(1000)
knob = ADC(Pin(39))
knob.atten(ADC.ATTN_11DB)
knob.width(ADC.WIDTH_12BIT)
button = Pin(14, Pin.IN, Pin.PULL_UP)  # 모드 버튼


def set_color(r, g, b):
    red.duty(r * 1023 // 255)
    green.duty(g * 1023 // 255)
    blue.duty(b * 1023 // 255)


def knob_color():
    value = knob.read()
    if value < 800:
        set_color(255, 0, 0)
    elif value < 1600:
        set_color(0, 255, 0)
    elif value < 2400:
        set_color(0, 0, 255)
    elif value < 3200:
        set_color(255, 0, 255)
    else:
        set_color(255, 255, 255)


mode = 0
while True:
    if button.value() == 0:  # 버튼을 누르면 다음 모드로
        mode = mode + 1
        if mode == 3:  # 2 다음은 다시 0
            mode = 0
        print(mode)
        time.sleep(0.3)  # 한 번 누름을 여러 번 세지 않게
    if mode == 0:
        set_color(0, 0, 0)  # 모드 0: 끄기
    elif mode == 1:
        knob_color()  # 모드 1: 손잡이 색
    else:
        set_color(255, 105, 180)  # 모드 2: 내가 고른 감정 색
    time.sleep_ms(50)
