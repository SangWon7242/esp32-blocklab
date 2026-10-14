from machine import Pin, PWM
import time

RED_PIN = 27                              # 빨강 핀
GREEN_PIN = 25                            # 초록 핀
BLUE_PIN = 26                             # 파랑 핀

red = PWM(Pin(RED_PIN))                   # 세 핀을 모두 PWM으로
green = PWM(Pin(GREEN_PIN))
blue = PWM(Pin(BLUE_PIN))

red.freq(1000)                            # 1초에 1000번
green.freq(1000)
blue.freq(1000)


def interval_mapping(x, in_min, in_max, out_min, out_max):
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min


def color_to_duty(rgb_value):             # 0~255 를 0~1023 으로
    rgb_value = int(interval_mapping(rgb_value, 0, 255, 0, 1023))
    return rgb_value


def set_color(red_value, green_value, blue_value):   # 세 색을 한꺼번에
    red.duty(color_to_duty(red_value))
    green.duty(color_to_duty(green_value))
    blue.duty(color_to_duty(blue_value))


while True:
    set_color(255, 105, 180)              # 분홍
    time.sleep(1)
    set_color(135, 206, 235)              # 하늘색
    time.sleep(1)
    set_color(154, 205, 50)               # 연두
    time.sleep(1)
