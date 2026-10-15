from machine import Pin
import time
import dht

dht11 = dht.DHT11(Pin(13))  # 13번 핀 한 선으로 센서와 이야기해요

while True:
    dht11.measure()  # 지금 온도와 습도를 새로 재요
    print("온도:", dht11.temperature())
    print("습도:", dht11.humidity())
    time.sleep(2)
