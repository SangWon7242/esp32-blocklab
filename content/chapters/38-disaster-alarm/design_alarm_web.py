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
    if query.get("exit", "") == "1":
        beeper.freq(660)
        beeper.duty(512)
        time.sleep(1)
        beeper.duty(0)
    web_send(conn, web_page("교실 상태", "exit=1", state, 2))
