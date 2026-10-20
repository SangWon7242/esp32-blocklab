from machine import Pin, PWM, ADC
import time
import dht
from blocklab_net import *

flame = ADC(Pin(34))
flame.atten(ADC.ATTN_11DB)
flame.width(ADC.WIDTH_12BIT)
dht11 = dht.DHT11(Pin(13))
tilt = Pin(14, Pin.IN)
button = Pin(27, Pin.IN, Pin.PULL_UP)
beeper = PWM(Pin(25))
beeper.freq(440)
beeper.duty(0)

ip = wifi_connect("MyWiFi", "12345678")
server = web_start(80)

while True:
    conn, path, query = web_accept(server)
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
    if state == "FIRE" or state == "QUAKE":
        beeper.freq(880)
        beeper.duty(512)
        time.sleep(0.5)
        beeper.duty(0)
    if path == "/data":  # 앱이 2초마다 읽어 가는 값
        web_send(conn, "{\"state\": " + str("\"" + state + "\"") + ", \"temp\": " + str(t) + "}", "application/json")
    elif path == "/cmd":
        if query.get("exit", "") == "1":
            beeper.freq(660)
            beeper.duty(512)
            time.sleep(1)
            beeper.duty(0)
        web_send(conn, "OK")
    else:
        web_send_file(conn, "index.html")  # 보드에 올린 앱 화면
