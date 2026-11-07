from machine import Pin
import time

led = Pin(26, Pin.OUT)

while True:
    for i in range(3):  # S: 짧게 3번
        led.value(1)
        time.sleep(0.2)
        led.value(0)
        time.sleep(0.2)
    for i in range(3):  # O: 길게 3번
        led.value(1)
        time.sleep(0.6)
        led.value(0)
        time.sleep(0.2)
    for i in range(3):  # S: 짧게 3번
        led.value(1)
        time.sleep(0.2)
        led.value(0)
        time.sleep(0.2)
    time.sleep(1)  # 한 번 다 보내면 1초 쉬기
