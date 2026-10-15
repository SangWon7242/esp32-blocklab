from machine import Pin, PWM
import time

button = Pin(14, Pin.IN, Pin.PULL_UP)
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


clicks = 0
last = time.ticks_ms()
while True:
    if button.value() == 0:
        start = time.ticks_ms()
        while button.value() == 0:
            time.sleep(0.01)
        held = time.ticks_diff(time.ticks_ms(), start)
        time.sleep(0.05)
        if held >= 500:
            set_color(0, 0, 255)
            clicks = 0
        else:
            clicks = clicks + 1
            last = time.ticks_ms()
    if clicks > 0 and time.ticks_diff(time.ticks_ms(), last) > 400:
        if clicks == 1:
            set_color(255, 0, 0)
        else:
            set_color(0, 255, 0)
        clicks = 0
    time.sleep(0.01)
