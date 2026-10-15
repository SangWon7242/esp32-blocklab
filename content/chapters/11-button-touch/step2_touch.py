from machine import Pin, TouchPad
import time

touch = TouchPad(Pin(4))  # 4번 핀을 터치 패드로
led = Pin(26, Pin.OUT)

while True:
    print(touch.read())  # 지금 터치 값 찍기
    if touch.read() < 300:  # 기준보다 작으면 만진 것
        led.value(1)
    else:
        led.value(0)
    time.sleep(0.2)
