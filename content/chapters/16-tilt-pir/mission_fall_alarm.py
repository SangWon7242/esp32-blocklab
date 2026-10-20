from machine import Pin
import time

tilt = Pin(14, Pin.IN)
led = Pin(26, Pin.OUT)
buzzer = Pin(25, Pin.OUT)  # 능동 부저

while True:
    print(tilt.value())
    if tilt.value() == 1:  # 넘어졌으면 삐삐 경보
        led.value(1)
        buzzer.value(1)
        time.sleep(0.2)
        buzzer.value(0)
        time.sleep(0.2)
    else:
        led.value(0)
        buzzer.value(0)
    time.sleep(0.1)
