from machine import Pin, TouchPad
import time

touch = TouchPad(Pin(4))
led = Pin(26, Pin.OUT)

base = touch.read()
print(base)
limit = base // 2
while True:
    if touch.read() < limit:
        led.value(1)
    else:
        led.value(0)
    time.sleep(0.1)
