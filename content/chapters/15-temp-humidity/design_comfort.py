from machine import Pin
import time
import dht

dht11 = dht.DHT11(Pin(13))
led = Pin(26, Pin.OUT)

while True:
    dht11.measure()
    t = dht11.temperature()
    h = dht11.humidity()
    di = 0.81 * t + 0.01 * h * (0.99 * t - 14.3) + 46.3
    print(di)
    if di >= 75:
        led.value(1)
    else:
        led.value(0)
    time.sleep(2)
