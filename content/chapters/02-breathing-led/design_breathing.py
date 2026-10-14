from machine import Pin, PWM
import time

pwm = PWM(Pin(26))
pwm.freq(10000)

for i in range(0, 1023):
    pwm.duty(i)
    time.sleep_ms(1)

for i in range(0, 1023):
    pwm.duty(1023 - i)
    time.sleep_ms(1)
