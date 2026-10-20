from machine import Pin, PWM, ADC
import time
import dht
import network
import socket

flame = ADC(Pin(34))
flame.atten(ADC.ATTN_11DB)
flame.width(ADC.WIDTH_12BIT)
dht11 = dht.DHT11(Pin(13))
tilt = Pin(14, Pin.IN)
button = Pin(27, Pin.IN, Pin.PULL_UP)
beeper = PWM(Pin(25))
beeper.freq(440)
beeper.duty(0)


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
