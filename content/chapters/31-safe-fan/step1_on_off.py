from machine import Pin, PWM
import time

motor1a = PWM(Pin(13))
motor1b = PWM(Pin(12))
motor1a.freq(1000)
motor1b.freq(1000)
button_a = Pin(14, Pin.IN, Pin.PULL_UP)


def forward(speed):
    motor1a.duty(speed)
    motor1b.duty(0)


def backward(speed):
    motor1a.duty(0)
    motor1b.duty(speed)


def stop():
    motor1a.duty(0)
    motor1b.duty(0)


mode = 0
speed = 0
while True:
    if button_a.value() == 0:
        if mode == 0:
            mode = 1
            speed = 300
        else:
            mode = 0
            speed = 0
        print("speed", speed)
        while button_a.value() == 0:
            time.sleep(0.01)
    forward(speed)
    time.sleep(0.1)
