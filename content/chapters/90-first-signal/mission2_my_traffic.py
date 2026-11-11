from machine import Pin
import time

led_red = Pin(13, Pin.OUT)  # 13번 → 빨강
led_yellow = Pin(14, Pin.OUT)  # 14번 → 노랑
led_green = Pin(16, Pin.OUT)  # 16번 → 초록

while True:
    led_green.value(1)  # 초록불 켜기
    time.sleep(5)  # 5초 기다리기
    led_green.value(0)  # 초록불 끄기
    led_yellow.value(1)  # 노란불 켜기
    time.sleep(2)  # 2초 기다리기
    led_yellow.value(0)  # 노란불 끄기
    led_red.value(1)  # 빨간불 켜기
    time.sleep(5)  # 5초 기다리기
    led_red.value(0)  # 빨간불 끄기
