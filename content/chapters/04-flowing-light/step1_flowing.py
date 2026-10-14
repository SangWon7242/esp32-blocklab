from machine import Pin
import time

def showLed():
    for pin in pins:  # 목록 앞에서부터 하나씩
        print(pin)  # 지금 켜는 핀 번호 찍기
        led = Pin(pin, Pin.OUT)
        led.value(1)  # 켜기
        time.sleep_ms(100)  # 0.1초
        led.value(0)  # 끄기
        time.sleep_ms(100)
    for pin in reversed(pins):  # 목록 뒤에서부터 (거꾸로)
        print(pin)
        led = Pin(pin, Pin.OUT)
        led.value(1)
        time.sleep_ms(100)
        led.value(0)
        time.sleep_ms(100)


pins = [18, 5, 14, 17, 26]  # 다섯 개의 핀 번호를 목록에 모으기
while True:
    showLed()  # 묶어 둔 동작을 계속 부르기
