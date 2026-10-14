from machine import Pin
import time

led = Pin(26, Pin.OUT)  # IO26을 출력으로

led.value(1)  # 켜기
time.sleep(1)  # 1초 기다리기
led.value(0)  # 끄기
