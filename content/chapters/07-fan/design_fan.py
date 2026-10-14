from machine import Pin, PWM
import time

motor1a = PWM(Pin(13))
motor1b = PWM(Pin(12))
motor1a.freq(1000)
motor1b.freq(1000)


def forward(speed):
    motor1a.duty(speed)
    motor1b.duty(0)


def backward(speed):
    motor1a.duty(0)
    motor1b.duty(speed)


def stop():
    motor1a.duty(0)
    motor1b.duty(0)


forward(500)
time.sleep(3)
forward(1023)
time.sleep(3)
stop()
time.sleep(1)
backward(1023)
time.sleep(2)
stop()
