from machine import Pin, ADC
import time
import dht

flame = ADC(Pin(34))  # 불꽃 센서: 적외선(불꽃)이 가까우면 값이 커져요
flame.atten(ADC.ATTN_11DB)
flame.width(ADC.WIDTH_12BIT)
dht11 = dht.DHT11(Pin(13))  # 온습도 센서: 온도로 화재를 한 번 더 확인해요
tilt = Pin(14, Pin.IN)  # 틸트 스위치: 흔들리거나 기울면 1
button = Pin(27, Pin.IN, Pin.PULL_UP)  # 위치 버튼: 누르면 0

while True:
    dht11.measure()
    t = dht11.temperature()  # 지금 온도를 t 에
    f = flame.read()  # 지금 불꽃 값을 f 에
    if f >= 1500 and t >= 27:  # 불꽃과 높은 온도가 함께일 때만 화재
        state = "FIRE"
    elif tilt.value() == 1:
        state = "QUAKE"
    elif button.value() == 0:
        state = "HERE"
    else:
        state = "OK"
    print(state)
    print(f, t)
    time.sleep(1)
