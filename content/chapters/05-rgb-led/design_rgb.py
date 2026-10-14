from machine import Pin, PWM
import time

red = PWM(Pin(27))
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
    set_color(255, 0, 0)
    time.sleep(1)
    set_color(255, 255, 0)
    time.sleep(1)
    set_color(0, 255, 0)
    time.sleep(1)
