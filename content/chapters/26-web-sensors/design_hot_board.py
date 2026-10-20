from machine import Pin, ADC
import dht
from blocklab_net import *

dht11 = dht.DHT11(Pin(13))
light = ADC(Pin(34))
light.atten(ADC.ATTN_11DB)
light.width(ADC.WIDTH_12BIT)

ip = wifi_connect("MyWiFi", "12345678")
server = web_start(80)

print(ip)
while True:
    conn, path, query = web_accept(server)
    dht11.measure()
    t = dht11.temperature()
    h = dht11.humidity()
    if t > 28:
        word = "HOT"
    else:
        word = "OK"
    if path == "/data":
        web_send(conn, "{\"temp\": " + str(t) + ", \"hum\": " + str(h) + "}", "application/json")
    elif path == "/light":
        web_send(conn, "{\"light\": " + str(light.read()) + "}", "application/json")
    else:
        web_send(conn, web_page("교실 상황판", "", word + ",T: " + str(t) + "C,H: " + str(h) + "%", 2))
