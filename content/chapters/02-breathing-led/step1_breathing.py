import time                               # 시간 기능
from machine import Pin, PWM              # 핀과 PWM 기능

pwm = PWM(Pin(26, Pin.OUT), 10000)        # IO26을 PWM으로, 1초에 10000번

try:
    while True:
        for i in range(0, 1023):          # 0 → 1022 까지 커지며
            pwm.duty(i)                   # 점점 밝아짐
            time.sleep_ms(1)              # 1밀리초 기다리기

        for i in range(0, 1023):
            pwm.duty(1023 - i)            # 1023 → 1 까지 작아지며 어두워짐
            time.sleep_ms(1)
except:
    pwm.deinit()                          # 멈출 때 PWM 정리하기
