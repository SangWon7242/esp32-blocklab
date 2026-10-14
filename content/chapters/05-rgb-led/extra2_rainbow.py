from machine import Pin, PWM
import time

red = PWM(Pin(27))  # 세 핀을 모두 PWM으로 (빨강 27, 초록 25, 파랑 26)
green = PWM(Pin(25))
blue = PWM(Pin(26))
red.freq(1000)
green.freq(1000)
blue.freq(1000)


def set_color(r, g, b):
    red.duty(r * 1023 // 255)
    green.duty(g * 1023 // 255)
    blue.duty(b * 1023 // 255)


# 빨강, 주황, 노랑, 초록, 파랑, 남색, 보라
rainbow = [(255, 0, 0), (255, 128, 0), (255, 255, 0), (0, 255, 0), (0, 0, 255), (75, 0, 130), (148, 0, 211)]
while True:
    for c in rainbow:  # 목록에서 하나씩 꺼내기
        set_color(c[0], c[1], c[2])
        time.sleep(0.5)
