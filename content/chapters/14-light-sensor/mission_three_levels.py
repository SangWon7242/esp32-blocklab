from machine import Pin, ADC
import time

light = ADC(Pin(34))
light.atten(ADC.ATTN_11DB)
light.width(ADC.WIDTH_12BIT)
led = Pin(26, Pin.OUT)

while True:
    value = light.read()
    print(value)
    if value > 2500:
        print("어두움")
        led.value(1)
    elif 1000 <= value <= 2500:
        print("보통")
        led.value(1)
        time.sleep(0.2)
        led.value(0)
    else:
        print("밝음")
        led.value(0)
    time.sleep(0.5)
