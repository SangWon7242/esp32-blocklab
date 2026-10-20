from machine import Pin
import dht
from blocklab_net import *

dht11 = dht.DHT11(Pin(13))  # 13번 핀 온습도 센서

ip = wifi_connect("MyWiFi", "12345678")
server = web_start(80)

print(ip)
while True:
    conn, path, query = web_accept(server)  # 폰이 들어올 때까지 기다려요
    dht11.measure()  # 요청마다 새로 재요
    t = dht11.temperature()
    h = dht11.humidity()
    web_send(conn, web_page("교실 상황판", "", "T: " + str(t) + "C,H: " + str(h) + "%", 2))  # 2초마다 새로고침되는 페이지
