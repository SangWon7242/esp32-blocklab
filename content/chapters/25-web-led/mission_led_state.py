from machine import Pin
from blocklab_net import *

led = Pin(2, Pin.OUT)  # 2번 핀의 LED

ip = wifi_connect("MyWiFi", "12345678")  # 공유기에 붙고 IP 를 받아요
server = web_start(80)  # 80번 포트에서 손님을 기다려요

print(ip)  # 폰 브라우저에 넣을 주소
while True:
    conn, path, query = web_accept(server)  # 손님이 올 때까지 기다렸다가 요청을 받아요
    if query.get("led", "") == "on":
        led.value(1)
    if query.get("led", "") == "off":
        led.value(0)
    web_send(conn, web_page("LED", "led=on,led=off", query.get("led", ""), 0))  # 값 칸에 지금 받은 명령을 보여 줘요
