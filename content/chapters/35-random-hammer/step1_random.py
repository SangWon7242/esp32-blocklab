from machine import Pin
import time
import random

button = Pin(14, Pin.IN, Pin.PULL_UP)

while True:
    if button.value() == 0:  # 버튼을 누르면
        num = random.randint(1, 2)  # 1 과 2 중 하나를 뽑아
        print(num)
        time.sleep(0.5)  # 한 번 누름이 여러 번 세어지지 않게
    time.sleep(0.05)
