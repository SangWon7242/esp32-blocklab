from machine import Pin, PWM
import time

red = PWM(Pin(27))
green = PWM(Pin(25))
blue = PWM(Pin(26))
red.freq(1000)
green.freq(1000)
blue.freq(1000)
beeper = PWM(Pin(15))
beeper.freq(440)
beeper.duty(0)
servo = PWM(Pin(4))
servo.freq(50)
servo.duty_u16(1638)


def set_color(r, g, b):
    red.duty(r * 1023 // 255)
    green.duty(g * 1023 // 255)
    blue.duty(b * 1023 // 255)


set_color(0, 255, 0)
servo.duty_u16(1638 + 90 * 6462 // 180)
beeper.freq(1000)
beeper.duty(512)
time.sleep(0.3)
beeper.duty(0)
time.sleep(5)
for i in range(3):
    set_color(0, 0, 0)
    time.sleep(0.5)
    set_color(0, 255, 0)
    time.sleep(0.5)
set_color(255, 0, 0)
servo.duty_u16(1638 + 0 * 6462 // 180)
