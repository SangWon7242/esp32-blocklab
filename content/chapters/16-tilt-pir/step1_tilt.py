from machine import Pin
import time

tilt = Pin(14, Pin.IN)  # 틸트 스위치: 기울면 1
led = Pin(26, Pin.OUT)

while True:
    print(tilt.value())  # 지금 틸트 값 찍기
    if tilt.value() == 1:  # 기울었으면
        led.value(1)
    else:
        led.value(0)
    time.sleep(0.1)
