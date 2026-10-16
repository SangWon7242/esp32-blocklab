from machine import Pin, ADC
import time

light = ADC(Pin(34))
light.atten(ADC.ATTN_11DB)
light.width(ADC.WIDTH_12BIT)

limit = 2000
last = time.ticks_ms()
while True:
    if time.ticks_diff(time.ticks_ms(), last) >= 2000:
        last = time.ticks_ms()
        if light.read() > limit:
            print("L: " + str(light.read()) + " !")
        else:
            print("L: " + str(light.read()))
    time.sleep(0.1)
