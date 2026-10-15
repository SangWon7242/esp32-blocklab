from machine import Pin, PWM
import time

motor1a = PWM(Pin(13))
motor1b = PWM(Pin(12))
motor1a.freq(1000)
motor1b.freq(1000)
button_a = Pin(14, Pin.IN, Pin.PULL_UP)
button_b = Pin(27, Pin.IN, Pin.PULL_UP)
led1 = Pin(25, Pin.OUT)
led2 = Pin(26, Pin.OUT)
led3 = Pin(33, Pin.OUT)


def forward(speed):
    motor1a.duty(speed)
    motor1b.duty(0)


def backward(speed):
    motor1a.duty(0)
    motor1b.duty(speed)


def stop():
    motor1a.duty(0)
    motor1b.duty(0)


def show_level():
    if speed >= 300:
        led1.value(1)
    else:
        led1.value(0)
    if speed >= 600:
        led2.value(1)
    else:
        led2.value(0)
    if speed >= 900:
        led3.value(1)
    else:
        led3.value(0)


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
    if mode == 1 and button_b.value() == 0:
        speed = speed + 300
        if speed > 900:
            speed = 300
        print("speed", speed)
        while button_b.value() == 0:
            time.sleep(0.01)
    forward(speed)
    show_level()
    time.sleep(0.1)
