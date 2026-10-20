from machine import Pin
import time

buzzer = Pin(25, Pin.OUT)  # 능동 부저를 25번 핀에

while True:
    buzzer.value(1)  # 삑 (켜기)
    time.sleep(0.5)
    buzzer.value(0)  # 조용히 (끄기)
    time.sleep(0.5)
