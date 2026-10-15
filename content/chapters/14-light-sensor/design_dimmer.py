from machine import Pin, PWM, ADC
import time

light = ADC(Pin(34))
light.atten(ADC.ATTN_11DB)
light.width(ADC.WIDTH_12BIT)
led = PWM(Pin(26))
led.freq(1000)

while True:
    level = ((light.read() - 0) * (100 - 0) // (4095 - 0) + 0)
    print(level)
    led.duty(int(level * 1023 / 100))
    time.sleep(0.2)
