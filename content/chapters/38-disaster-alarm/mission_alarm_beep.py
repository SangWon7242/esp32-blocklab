from machine import Pin, PWM, ADC
import time
import dht

flame = ADC(Pin(34))
flame.atten(ADC.ATTN_11DB)
flame.width(ADC.WIDTH_12BIT)
dht11 = dht.DHT11(Pin(13))
tilt = Pin(14, Pin.IN)
button = Pin(27, Pin.IN, Pin.PULL_UP)
beeper = PWM(Pin(25))  # 수동 부저: 처음에는 조용히
beeper.freq(440)
beeper.duty(0)

while True:
    dht11.measure()
    t = dht11.temperature()
    f = flame.read()
    if f >= 1500 and t >= 27:
        state = "FIRE"
    elif tilt.value() == 1:
        state = "QUAKE"
    elif button.value() == 0:
        state = "HERE"
    else:
        state = "OK"
    print(state)
    print(f, t)
    if state == "FIRE" or state == "QUAKE":  # 화재·지진일 때만 경보음
        beeper.freq(880)
        beeper.duty(512)
        time.sleep(0.5)
        beeper.duty(0)
    time.sleep(1)
