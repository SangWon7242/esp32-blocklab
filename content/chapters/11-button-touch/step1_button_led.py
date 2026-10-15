from machine import Pin
import time

button = Pin(14, Pin.IN, Pin.PULL_UP)  # 풀업: 떼면 1, 누르면 0
led = Pin(26, Pin.OUT)

while True:
    print(button.value())  # 지금 버튼 값 찍기
    if button.value() == 0:  # 눌렸으면
        led.value(1)
    else:
        led.value(0)
    time.sleep(0.1)
