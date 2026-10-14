from machine import Pin, PWM
import time

pwm = PWM(Pin(26))  # IO26을 PWM으로
pwm.freq(10000)

while True:
    for i in range(1023):  # 0 → 1022 까지 커지며
        pwm.duty(i)  # 점점 밝아짐
        time.sleep_ms(1)  # 1밀리초 기다리기
    for i in range(1023):
        pwm.duty(1023 - i)  # 1023 → 1 까지 작아지며 어두워짐
        time.sleep_ms(1)
