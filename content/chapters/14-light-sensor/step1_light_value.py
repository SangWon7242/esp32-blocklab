from machine import Pin, ADC
import time

light = ADC(Pin(34))  # 34번 핀에서 0~4095 값을 읽어요
light.atten(ADC.ATTN_11DB)
light.width(ADC.WIDTH_12BIT)

while True:
    print(light.read())  # 지금 밝기 값 출력
    time.sleep(0.5)
