from machine import Pin, PWM
import time

pwm = PWM(Pin(26))
pwm.freq(10000)

while True:
    for i in range(1023):
        pwm.duty(i)
        time.sleep_ms(3)  # 1 → 3 으로 늘려 더 천천히
    for i in range(1023):
        pwm.duty(1023 - i)
        time.sleep_ms(3)  # 여기도 3
