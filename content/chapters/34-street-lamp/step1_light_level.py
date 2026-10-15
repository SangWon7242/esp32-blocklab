from machine import Pin, ADC
import time

light = ADC(Pin(36))  # 36번 핀에서 0~4095 값을 읽어요
light.atten(ADC.ATTN_11DB)
light.width(ADC.WIDTH_12BIT)

while True:
    value = light.read()
    level = ((value - 3500) * (3 - 0) // (500 - 3500) + 0)  # 가렸을 때 3500 → 0, 비췄을 때 500 → 3
    print(value, level)
    time.sleep(0.5)
