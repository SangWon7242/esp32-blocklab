from machine import Pin
import time

motor1a = Pin(13, Pin.OUT)                # IN+ 쪽
motor1b = Pin(12, Pin.OUT)                # IN- 쪽


def forward():                            # 앞으로
    motor1a.value(1)                      # 한쪽은 HIGH
    motor1b.value(0)                      # 다른 쪽은 LOW


def backward():                           # 뒤로 — 두 값을 서로 바꿈
    motor1a.value(0)
    motor1b.value(1)


def stop():                               # 정지 — 둘 다 0
    motor1a.value(0)
    motor1b.value(0)


forward()                                 # 앞으로 돌려 보기
time.sleep(3)
stop()                                    # 멈추기
