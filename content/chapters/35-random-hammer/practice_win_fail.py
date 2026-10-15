from machine import Pin
import time
import random

button = Pin(14, Pin.IN, Pin.PULL_UP)

while True:
    if button.value() == 0:
        num = random.randint(1, 2)
        if num == 1:
            print("당첨")
        else:
            print("꽝")
        time.sleep(0.5)
    time.sleep(0.05)
