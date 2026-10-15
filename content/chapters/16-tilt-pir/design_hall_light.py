from machine import Pin
import time

pir = Pin(23, Pin.IN)
led = Pin(26, Pin.OUT)

time.sleep(30)
last = time.ticks_ms()
while True:
    if pir.value() == 1:
        last = time.ticks_ms()
        led.value(1)
    if time.ticks_diff(time.ticks_ms(), last) > 5000:
        led.value(0)
    time.sleep(0.1)
