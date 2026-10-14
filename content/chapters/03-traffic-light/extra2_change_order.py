from machine import Pin
import time

led_red = Pin(13, Pin.OUT)
led_yellow = Pin(14, Pin.OUT)
led_green = Pin(16, Pin.OUT)

while True:
    led_green.value(1)  # 초록 먼저
    time.sleep(5)
    led_green.value(0)
    # 노란불 깜빡이기
    for i in range(5):  # 노랑은 가운데 그대로
        led_yellow.value(1)
        time.sleep(0.5)
        led_yellow.value(0)
        time.sleep(0.5)
    # 빨간불
    led_red.value(1)  # 빨강을 마지막으로
    time.sleep(5)
    led_red.value(0)
