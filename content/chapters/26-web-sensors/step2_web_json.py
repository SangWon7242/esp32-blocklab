from machine import Pin, ADC
import time
import dht
import network
import socket

dht11 = dht.DHT11(Pin(13))
light = ADC(Pin(34))
light.atten(ADC.ATTN_11DB)
light.width(ADC.WIDTH_12BIT)


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

print(ip)
while True:
    conn, path, query = web_accept(server)
    dht11.measure()
    t = dht11.temperature()
    h = dht11.humidity()
    if path == "/data":  # 앱이 읽는 주소
        web_send(conn, "{\"temp\": " + str(t) + ", \"hum\": " + str(h) + "}", "application/json")
    elif path == "/light":
        web_send(conn, "{\"light\": " + str(light.read()) + "}", "application/json")
    else:
        web_send(conn, web_page("교실 상황판", "", "T: " + str(t) + "C,H: " + str(h) + "%", 2))
