from machine import Pin
import time

led_red = Pin(13, Pin.OUT)
led_yellow = Pin(14, Pin.OUT)
led_green = Pin(16, Pin.OUT)

while True:
    led_red.value(1)
    time.sleep(5)
    led_red.value(0)
    # 노란불 깜빡이기
    for i in range(5):  # 다섯 번 반복 — 12줄이 5줄로
        led_yellow.value(1)
        time.sleep(0.5)
        led_yellow.value(0)
        time.sleep(0.5)
    # 초록불
    led_green.value(1)
    time.sleep(5)
    led_green.value(0)
