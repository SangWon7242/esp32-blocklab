from machine import Pin
import time

led = Pin(26, Pin.OUT)


def blink(t):  # 한 번 깜빡이는 동작에 이름 붙이기
    led.value(1)
    time.sleep(t)  # t초 동안 켜 두기
    led.value(0)
    time.sleep(0.2)  # 0.2초 쉬기


while True:
    for i in range(3):  # 짧게 3번  (S)
        blink(0.2)
    for i in range(3):  # 길게 3번  (O)
        blink(0.6)
    for i in range(3):  # 짧게 3번  (S)
        blink(0.2)
    time.sleep(1)  # 한 번 보내고 1초 쉬기
