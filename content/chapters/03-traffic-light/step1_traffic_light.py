from machine import Pin
import time

led_red = Pin(13, Pin.OUT)  # IO13 → 빨강
led_yellow = Pin(14, Pin.OUT)  # IO14 → 노랑
led_green = Pin(16, Pin.OUT)  # IO16 → 초록

while True:
    led_red.value(1)  # 빨간불 켜기
    time.sleep(5)  # 5초 기다리기
    led_red.value(0)  # 빨간불 끄기
    # 노란불 깜빡이기
    led_yellow.value(1)  # 노란불 깜빡 1
    time.sleep(0.5)
    led_yellow.value(0)
    time.sleep(0.5)
    led_yellow.value(1)  # 노란불 깜빡 2
    time.sleep(0.5)
    led_yellow.value(0)
    time.sleep(0.5)
    led_yellow.value(1)  # 노란불 깜빡 3
    time.sleep(0.5)
    led_yellow.value(0)
    time.sleep(0.5)
    # 초록불
    led_green.value(1)  # 초록불 켜기
    time.sleep(5)
    led_green.value(0)
