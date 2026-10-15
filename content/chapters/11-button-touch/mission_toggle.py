from machine import Pin
import time

button = Pin(14, Pin.IN, Pin.PULL_UP)
led = Pin(26, Pin.OUT)

state = 0  # 처음 상태: 꺼짐
while True:
    if button.value() == 0:
        if state == 0:  # 꺼져 있었으면
            state = 1
            led.value(1)
        else:
            state = 0  # 켜져 있었으면
            led.value(0)
        while button.value() == 0:  # 손을 뗄 때까지 기다리기
            time.sleep(0.01)
    time.sleep(0.05)
