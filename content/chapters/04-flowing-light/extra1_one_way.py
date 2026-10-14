from machine import Pin
import time

def showLed():
    for pin in pins:  # 되돌아오는 반복문을 통째로 지웠습니다
        led = Pin(pin, Pin.OUT)
        led.value(1)
        time.sleep_ms(100)
        led.value(0)
        time.sleep_ms(100)


pins = [18, 5, 14, 17, 26]
while True:
    showLed()
