from machine import Pin
import time

def showLed():
    for pin in pins:  # 켜기만 하는 반복문
        led = Pin(pin, Pin.OUT)
        led.value(1)
        time.sleep_ms(300)
    time.sleep(1)  # 다 켜진 채로 1초
    for pin in pins:  # 끄기만 하는 반복문
        led = Pin(pin, Pin.OUT)
        led.value(0)


pins = [18, 5, 14, 17, 26]
while True:
    showLed()
