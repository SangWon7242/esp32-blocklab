from machine import Pin, PWM, ADC
import time

servo = PWM(Pin(4))
servo.freq(50)
servo.duty_u16(1638)
knob = ADC(Pin(39))
knob.atten(ADC.ATTN_11DB)
knob.width(ADC.WIDTH_12BIT)

while True:
    angle = ((knob.read() - 0) * (180 - 0) // (4095 - 0) + 0)  # 0~4095 → 0~180
    servo.duty_u16(1638 + angle * 6462 // 180)
    time.sleep_ms(20)
