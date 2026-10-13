from machine import Pin
import time

led = Pin(26, Pin.OUT)

while True:
    led.value(1)               # 켜기
    time.sleep(2)              # 2초 동안 켜 두기

    led.value(0)               # 끄기
    time.sleep(1)              # 1초 동안 꺼 두기
