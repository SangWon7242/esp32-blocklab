from machine import Pin, ADC
import time

rocker_x = ADC(Pin(36))  # 조이스틱 X → 36번, Y → 39번, B(버튼) → 26번
rocker_y = ADC(Pin(39))
rocker_x.atten(ADC.ATTN_11DB)
rocker_y.atten(ADC.ATTN_11DB)
button_z = Pin(26, Pin.IN, Pin.PULL_UP)

while True:
    x = rocker_x.read()  # 좌우로 기울인 정도 0~4095
    y = rocker_y.read()  # 앞뒤로 기울인 정도 0~4095
    print(x, y)
    if button_z.value() == 0:  # 누르면 0
        print("Button")
    time.sleep(0.2)
