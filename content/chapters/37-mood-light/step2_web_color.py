from machine import Pin, PWM
from blocklab_net import *

red = PWM(Pin(27))
green = PWM(Pin(25))
blue = PWM(Pin(26))
red.freq(1000)
green.freq(1000)
blue.freq(1000)


def set_color(r, g, b):
    red.duty(r * 1023 // 255)
    green.duty(g * 1023 // 255)
    blue.duty(b * 1023 // 255)


ip = wifi_connect("MyWiFi", "12345678")  # 우리 WiFi 이름과 비밀번호로 고치기
server = web_start(80)

print(ip)  # 폰 브라우저에 이 주소를 적어요
while True:
    conn, path, query = web_accept(server)  # 손님(폰)이 올 때까지 기다려요
    c = query.get("c", "")  # /cmd?c=red 에서 c 의 값
    if c == "red":
        set_color(255, 0, 0)
    elif c == "green":
        set_color(0, 255, 0)
    elif c == "blue":
        set_color(0, 0, 255)
    elif c == "off":
        set_color(0, 0, 0)
    web_send(conn, web_page("Mood Light", "c=red,c=green,c=blue,c=off", c, 0))  # 버튼 4개가 있는 페이지로 답하기
