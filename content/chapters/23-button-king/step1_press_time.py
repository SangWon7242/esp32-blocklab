from machine import Pin
import time

button = Pin(14, Pin.IN, Pin.PULL_UP)  # 풀업: 떼면 1, 누르면 0

while True:
    if button.value() == 0:  # 누르기 시작했으면
        start = time.ticks_ms()  # 누르기 시작한 시각 (ms)
        while button.value() == 0:  # 뗄 때까지 기다리기
            time.sleep(0.01)
        held = time.ticks_diff(time.ticks_ms(), start)  # 누른 시간 = 지금 - 시작
        print(held)
    time.sleep(0.01)
