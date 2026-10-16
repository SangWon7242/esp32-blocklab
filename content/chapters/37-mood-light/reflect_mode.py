from machine import Pin
import time

button = Pin(14, Pin.IN, Pin.PULL_UP)

mode = 0
while True:
    if button.value() == 0:
        mode = mode + 1
        if mode == 3:
            mode = 0
        print(mode)
        time.sleep(0.3)
    time.sleep_ms(50)
