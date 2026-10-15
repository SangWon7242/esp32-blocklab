from machine import Pin, ADC
import time

knob = ADC(Pin(39))  # 가변저항 가운데 다리 → 39번
knob.atten(ADC.ATTN_11DB)
knob.width(ADC.WIDTH_12BIT)

while True:
    value = knob.read()  # 지금 다이얼 값 읽기
    voltage = value * 3.3 / 4095  # 숫자를 전압(V)으로 바꾸기
    print(value, voltage)
    time.sleep(0.5)
