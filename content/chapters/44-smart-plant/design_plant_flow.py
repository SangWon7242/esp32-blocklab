from machine import Pin, ADC
import time

soil = ADC(Pin(34))
soil.atten(ADC.ATTN_11DB)
soil.width(ADC.WIDTH_12BIT)
water = ADC(Pin(35))
water.atten(ADC.ATTN_11DB)
water.width(ADC.WIDTH_12BIT)
relay = Pin(26, Pin.OUT)

dry = 1500
empty = 500
relay.value(0)
while True:
    s = soil.read()
    w = water.read()
    if w < empty:
        relay.value(0)
        print("NO WATER")
    elif s < dry:
        relay.value(1)
        time.sleep(1)
        relay.value(0)
        print("WATER")
        time.sleep(5)
    else:
        print("OK")
    time.sleep(1)
