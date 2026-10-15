from machine import Pin, PWM, ADC
import time

knob = ADC(Pin(39))
knob.atten(ADC.ATTN_11DB)
knob.width(ADC.WIDTH_12BIT)
led = PWM(Pin(26))
led.freq(1000)

while True:
    duty = ((knob.read() - 0) * (1023 - 0) // (4095 - 0) + 0)  # 0~4095 → 0~1023
    led.duty(duty)
    time.sleep_ms(20)
