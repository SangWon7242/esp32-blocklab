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
trig = Pin(18, Pin.OUT)
echo = Pin(19, Pin.IN)


def forward(speed):
    motor1a.duty(speed)
    motor1b.duty(0)


def backward(speed):
    motor1a.duty(0)
    motor1b.duty(speed)


def stop():
    motor1a.duty(0)
    motor1b.duty(0)


def get_distance():
    trig.value(1)
    time.sleep_us(10)
    trig.value(0)
    while not echo.value():
        pass
    start = time.ticks_us()
    while echo.value():
        pass
    stop = time.ticks_us()
    t = time.ticks_diff(stop, start) // 2
    return int(340 * t // 10000)


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
level = 1
speed = 0
while True:
    if button_a.value() == 0:
        mode = 1 - mode
        level = 1
        while button_a.value() == 0:
            time.sleep(0.01)
    if mode == 1 and button_b.value() == 0:
        level = level + 1
        if level > 3:
            level = 1
        while button_b.value() == 0:
            time.sleep(0.01)
    d = get_distance()
    if d > 2 and d < 8:
        mode = 0
    speed = mode * level * 300
    print(d, speed)
    forward(speed)
    show_level()
    time.sleep(0.1)
