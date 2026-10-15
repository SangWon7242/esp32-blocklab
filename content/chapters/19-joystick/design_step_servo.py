from machine import Pin, PWM, ADC
import time

rocker_x = ADC(Pin(36))
rocker_y = ADC(Pin(39))
rocker_x.atten(ADC.ATTN_11DB)
rocker_y.atten(ADC.ATTN_11DB)
button_z = Pin(26, Pin.IN, Pin.PULL_UP)
servo = PWM(Pin(4))
servo.freq(50)
servo.duty_u16(1638)

angle = 90
while True:
    if rocker_x.read() < 1000:
        angle = angle - 1
    elif rocker_x.read() > 3000:
        angle = angle + 1
    if angle < 0:
        angle = 0
    if angle > 180:
        angle = 180
    servo.duty_u16(1638 + angle * 6462 // 180)
    time.sleep_ms(20)
