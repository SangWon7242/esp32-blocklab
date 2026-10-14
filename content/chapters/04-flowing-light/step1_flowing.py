from machine import Pin
import time

pins = [18, 5, 14, 17, 26]                # 다섯 개의 핀 번호를 목록에 모으기


def showLed():
    for pin in pins:                      # 왼쪽 → 오른쪽
        print(pin)                        # 지금 켜는 핀 번호 찍기
        led = Pin(pin, Pin.OUT)
        led.value(1)                      # 켜기
        time.sleep_ms(100)                # 0.1초
        led.value(0)                      # 끄기
        time.sleep_ms(100)

    for pin in reversed(pins):            # 오른쪽 → 왼쪽 (거꾸로)
        print(pin)
        led = Pin(pin, Pin.OUT)
        led.value(1)
        time.sleep_ms(100)
        led.value(0)
        time.sleep_ms(100)


while True:
    showLed()                             # 묶어 둔 동작을 계속 부르기
