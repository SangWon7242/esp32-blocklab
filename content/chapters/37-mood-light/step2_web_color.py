from machine import Pin, PWM
import time
import network
import socket

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


def wifi_connect(ssid, password):
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(ssid, password)
    while not wlan.isconnected():
        time.sleep(0.5)
    print("IP:", wlan.ifconfig()[0])
    return wlan.ifconfig()[0]


def web_start(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("", port))
    s.listen(5)
    return s


def web_accept(s):
    conn, addr = s.accept()
    request = conn.recv(1024).decode()
    line = request.split("\r\n")[0]
    target = line.split(" ")[1] if " " in line else "/"
    path, _, qs = target.partition("?")
    query = {}
    for part in qs.split("&"):
        if "=" in part:
            k, v = part.split("=", 1)
            query[k] = v
    return conn, path, query


def web_send(conn, body, ctype="text/html"):
    conn.send("HTTP/1.1 200 OK\r\n")
    conn.send("Content-Type: " + ctype + "\r\n")
    conn.send("Connection: close\r\n\r\n")
    conn.sendall(body)
    conn.close()


def web_page(title, buttons, values, refresh):
    html = "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width'>"
    if refresh > 0:
        html += "<meta http-equiv='refresh' content='" + str(refresh) + "'>"
    html += "<title>" + title + "</title></head><body><h1>" + title + "</h1>"
    for b in buttons.split(","):
        if b:
            html += "<p><a href='/cmd?" + b + "'><button>" + b + "</button></a></p>"
    for v in values.split(","):
        if v:
            html += "<p>" + v + "</p>"
    return html + "</body></html>"


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
