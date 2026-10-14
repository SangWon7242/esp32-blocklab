from machine import Pin
import time

pins = [18, 5, 14, 17, 26]


def flow_leds(ms):
    for pin in pins:
        led = Pin(pin, Pin.OUT)
        led.value(1)
        time.sleep_ms(ms)
        led.value(0)


flow_leds(300)
flow_leds(200)
while True:
    flow_leds(100)
