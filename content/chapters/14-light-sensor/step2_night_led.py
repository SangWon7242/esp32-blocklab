from machine import Pin, ADC
import time

light = ADC(Pin(34))
light.atten(ADC.ATTN_11DB)
light.width(ADC.WIDTH_12BIT)
led = Pin(26, Pin.OUT)

while True:
    value = light.read()  # 밝기 값을 value 에 담아요
    print(value)
    if value > 2500:  # 기준보다 값이 크면 = 어두우면
        led.value(1)
    else:
        led.value(0)
    time.sleep(0.5)
