from machine import Pin
import time
import dht

dht11 = dht.DHT11(Pin(13))
led = Pin(26, Pin.OUT)

while True:
    dht11.measure()
    t = dht11.temperature()  # 잰 온도를 t 에 담아요
    print(t)
    if t >= 28:  # 28도 이상이면 덥다고 봐요
        led.value(1)
    else:
        led.value(0)
    time.sleep(2)
