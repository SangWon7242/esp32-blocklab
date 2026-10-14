from machine import Pin, PWM
import time

pwm = PWM(Pin(26))
pwm.freq(10000)

while True:
    for i in range(1023):
        pwm.duty(i)
        time.sleep_ms(1)
    time.sleep(1)  # 가장 밝은 채로 1초 멈추기
    for i in range(1023):
        pwm.duty(1023 - i)
        time.sleep_ms(1)
