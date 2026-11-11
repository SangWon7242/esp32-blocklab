from machine import Pin
import time

led_red = Pin(13, Pin.OUT)  # 13번 → 빨강
led_yellow = Pin(14, Pin.OUT)  # 14번 → 노랑
led_green = Pin(16, Pin.OUT)  # 16번 → 초록
button = Pin(25, Pin.IN, Pin.PULL_UP)  # 보행자 버튼: 떼면 1, 누르면 0

led_green.value(1)  # 평소에는 자동차가 지나가는 초록불
while True:
    if button.value() == 0:  # 보행자가 버튼을 눌렀으면
        led_green.value(0)  # 초록불 끄기
        led_yellow.value(1)  # 노란불 1초
        time.sleep(1)
        led_yellow.value(0)
        led_red.value(1)  # 빨간불: 자동차는 멈추고 사람이 건너요
        time.sleep(8)
        led_red.value(0)
        led_green.value(1)  # 다시 초록불
    time.sleep(0.1)  # 0.1초마다 버튼 보기
