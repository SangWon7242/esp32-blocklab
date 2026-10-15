from machine import Pin
import time

button = Pin(14, Pin.IN, Pin.PULL_UP)
led = Pin(2, Pin.OUT)

while True:
    led.value(1)
    time.sleep(2)  # 2초 동안 켜 두기
    led.value(0)
    time.sleep(2)  # 2초 동안 꺼 두기
    if button.value() == 0:  # 여기서만 버튼을 확인해요
        print("눌렸다!")
