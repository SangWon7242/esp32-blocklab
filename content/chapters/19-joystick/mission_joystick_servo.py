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

while True:
    angle = ((rocker_x.read() - 0) * (180 - 0) // (4095 - 0) + 0)  # 0~4095 → 0~180
    servo.duty_u16(1638 + angle * 6462 // 180)
    time.sleep_ms(20)
