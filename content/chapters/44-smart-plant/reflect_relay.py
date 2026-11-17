from machine import Pin, ADC
import time

soil = ADC(Pin(34))
soil.atten(ADC.ATTN_11DB)
soil.width(ADC.WIDTH_12BIT)
relay = Pin(26, Pin.OUT)

while True:
    if soil.read() < 1500:
        relay.value(1)
        time.sleep(1)
        relay.value(0)
    time.sleep(5)
