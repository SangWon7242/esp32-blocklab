from machine import Pin
import time
import network
import socket

led = Pin(2, Pin.OUT)  # 2번 핀의 LED


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
