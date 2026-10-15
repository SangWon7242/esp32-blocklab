from machine import Pin, ADC
import time

rocker_x = ADC(Pin(36))
rocker_y = ADC(Pin(39))
rocker_x.atten(ADC.ATTN_11DB)
rocker_y.atten(ADC.ATTN_11DB)
button_z = Pin(26, Pin.IN, Pin.PULL_UP)

while True:
    x = rocker_x.read()  # 가운데 값에서 많이 벗어나야 방향으로 봐요
    y = rocker_y.read()
    if button_z.value() == 0:
        print("Button")
    elif x < 1000:
        print("Left")
    elif x > 3000:
        print("Right")
    elif y < 1000:
        print("Up")
    elif y > 3000:
        print("Down")
    else:
        print("Center")
    time.sleep(0.2)
