from machine import Pin
import time

pins = [18, 5, 14, 17, 26]


def showLed():
    for pin in pins:
        led = Pin(pin, Pin.OUT)
        led.value(1)
        time.sleep_ms(50)                 # 100 → 50 으로 (두 배 빠르게)
        led.value(0)
        time.sleep_ms(50)

    for pin in reversed(pins):
        led = Pin(pin, Pin.OUT)
        led.value(1)
        time.sleep_ms(50)                 # 여기도 50
        led.value(0)
        time.sleep_ms(50)


while True:
    showLed()
