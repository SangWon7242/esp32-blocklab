from machine import Pin
import time

led = Pin(26, Pin.OUT)

while True:
    led.value(1)
    time.sleep(0.2)            # 0.2초만 켜기

    led.value(0)
    time.sleep(0.2)            # 0.2초만 끄기
