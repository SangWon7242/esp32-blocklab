from machine import Pin
import time

led_red = Pin(13, Pin.OUT)  # 13번 핀에 꽂은 빨강 LED

while True:  # 아래를 끝없이 반복
    led_red.value(1)  # 켜기
    time.sleep(0.2)  # 0.2초 기다리기
    led_red.value(0)  # 끄기
    time.sleep(0.2)  # 0.2초 기다리기
