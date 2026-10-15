from machine import Pin, PWM
import time

button = Pin(14, Pin.IN, Pin.PULL_UP)
red = PWM(Pin(27))  # RGB LED (빨강 27, 초록 25, 파랑 26)
green = PWM(Pin(25))
blue = PWM(Pin(26))
red.freq(1000)
green.freq(1000)
blue.freq(1000)


def set_color(r, g, b):
    red.duty(r * 1023 // 255)
    green.duty(g * 1023 // 255)
    blue.duty(b * 1023 // 255)


while True:
    if button.value() == 0:
        start = time.ticks_ms()
        while button.value() == 0:
            time.sleep(0.01)
        held = time.ticks_diff(time.ticks_ms(), start)
        print(held)
        if held < 500:  # 500ms 보다 짧으면
            set_color(255, 0, 0)  # 짧게: 빨강
        else:
            set_color(0, 0, 255)  # 길게: 파랑
    time.sleep(0.01)
